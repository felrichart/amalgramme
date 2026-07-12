<script setup>
import { ref, watch, nextTick, computed } from 'vue';
import {
  username,
  pin,
  setIdentity,
  clearIdentity,
  pinValid,
  connected,
} from '../composables/useUsername.js';
import { authenticate } from '../services/community.js';

const props = defineProps({ open: Boolean });
const emit = defineEmits(['close', 'saved', 'logout']);

/* 'connexion' logs into an existing name; 'inscription' claims a new one and
 * asks the code twice. When already connected we show the account panel first,
 * with a way to switch (which reveals these forms). */
const mode = ref('connexion');
const switching = ref(false);
const name = ref('');
const digits = ref(['', '', '', '']);
const confirm = ref(['', '', '', '']);
const nameInput = ref(null);
const boxes = ref([]);
const confirmBoxes = ref([]);
const error = ref('');
const busy = ref(false);

const accountView = computed(() => connected.value && !switching.value);

function reset() {
  name.value = '';
  digits.value = ['', '', '', ''];
  confirm.value = ['', '', '', ''];
  error.value = '';
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    switching.value = false;
    mode.value = 'connexion';
    reset();
    if (!connected.value) nextTick(() => nameInput.value?.focus());
  },
);

const code = () => digits.value.join('');
const confirmCode = () => confirm.value.join('');
const valid = computed(() => {
  if (!name.value.trim() || !pinValid(code())) return false;
  if (mode.value === 'inscription' && code() !== confirmCode()) return false;
  return true;
});

/* The templates pass a row key rather than the refs themselves: in <script
 * setup> refs auto-unwrap in the template, so a passed ref would arrive as its
 * bare array (no `.value`). Resolve to the actual refs from the closure here. */
function rowRefs(which) {
  return which === 'confirm' ? [confirm, confirmBoxes] : [digits, boxes];
}

/* Keep one digit per box; typing advances, deleting an empty box goes back. */
function onDigit(which, i, e) {
  const [arr, refs] = rowRefs(which);
  const d = e.target.value.replace(/\D/g, '').slice(-1);
  arr.value[i] = d;
  e.target.value = d; // drop any rejected keystroke from the box immediately
  if (d && i < 3) refs.value[i + 1]?.focus();
}
function onKey(which, i, e) {
  const [arr, refs] = rowRefs(which);
  if (e.key === 'Backspace' && !arr.value[i] && i > 0) refs.value[i - 1]?.focus();
  else if (e.key === 'Enter') submit();
}

function pick(next) {
  mode.value = next;
  error.value = '';
}

async function submit() {
  error.value = '';
  if (busy.value || !name.value.trim() || !pinValid(code())) return;
  if (mode.value === 'inscription' && code() !== confirmCode()) {
    error.value = 'Les deux codes ne correspondent pas.';
    return;
  }
  /* Verify against the backend first: connexion refuses an unknown name or a
   * wrong code; inscription refuses an already-taken name. */
  busy.value = true;
  const res = await authenticate({ author: name.value.trim(), pin: code(), mode: mode.value });
  busy.value = false;
  if (!res.ok) {
    error.value = res.error;
    return;
  }
  setIdentity(name.value, code());
  emit('saved', username.value);
  emit('close');
}

function switchAccount() {
  switching.value = true;
  mode.value = 'connexion';
  reset();
  nextTick(() => nameInput.value?.focus());
}

/* Drop the identity and dismiss: parents decide where to go (the create view
 * bounces to the community list — staying there signed out makes no sense). */
function logout() {
  clearIdentity();
  emit('logout');
  emit('close');
}
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true" aria-label="Compte joueur">
      <!-- Signed in: show identity, log out or switch account. -->
      <template v-if="accountView">
        <h2 class="title">Mon compte</h2>
        <p class="who">
          Connecté en tant que <strong>{{ username }}</strong>
        </p>
        <button class="cta ghost" type="button" @click="switchAccount">Changer de compte</button>
        <button class="cta danger" type="button" @click="logout">Déconnexion</button>
      </template>

      <!-- Signed out (or switching): connexion / inscription. -->
      <template v-else>
        <div class="tabs" role="tablist">
          <button
            class="tab"
            :class="{ on: mode === 'connexion' }"
            type="button"
            role="tab"
            :aria-selected="mode === 'connexion'"
            @click="pick('connexion')"
          >
            Connexion
          </button>
          <button
            class="tab"
            :class="{ on: mode === 'inscription' }"
            type="button"
            role="tab"
            :aria-selected="mode === 'inscription'"
            @click="pick('inscription')"
          >
            Inscription
          </button>
        </div>

        <input
          ref="nameInput"
          v-model="name"
          class="field"
          type="text"
          maxlength="20"
          placeholder="Votre nom"
          @keydown.enter="submit"
        />

        <span class="sub">Code PIN à 4 chiffres</span>
        <div class="pin" role="group" aria-label="Code PIN à 4 chiffres">
          <input
            v-for="(d, i) in digits"
            :key="i"
            :ref="(el) => (boxes[i] = el)"
            class="digit"
            type="password"
            inputmode="numeric"
            maxlength="1"
            :value="d"
            @input="onDigit('code', i, $event)"
            @keydown="onKey('code', i, $event)"
          />
        </div>

        <template v-if="mode === 'inscription'">
          <span class="sub">Confirmez le code PIN</span>
          <div class="pin" role="group" aria-label="Confirmer le code">
            <input
              v-for="(d, i) in confirm"
              :key="i"
              :ref="(el) => (confirmBoxes[i] = el)"
              class="digit"
              type="password"
              inputmode="numeric"
              maxlength="1"
              :value="d"
              @input="onDigit('confirm', i, $event)"
              @keydown="onKey('confirm', i, $event)"
            />
          </div>
        </template>

        <p v-if="mode === 'inscription'" class="warn">
          ⚠️ CE CODE N'EST PAS SÉCURISÉ. N’utilisez pas un vrai mot de passe.
        </p>
        <p v-if="error" class="err">{{ error }}</p>
        <button class="cta" type="button" :disabled="!valid || busy" @click="submit">
          {{ busy ? '…' : mode === 'connexion' ? 'Se connecter' : "S'inscrire" }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1.2rem;
  background: rgba(22, 24, 31, 0.45);
}
.modal {
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.6rem 1.4rem;
  border-radius: 1.3rem;
  background: var(--panel);
  border: var(--outline-w-lg) solid var(--outline);
  box-shadow: var(--pop-lg);
}
.title {
  margin: 0;
  text-align: center;
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--ink);
}
.who {
  margin: 0;
  text-align: center;
  font-weight: 700;
  color: var(--muted);
}
.who strong {
  color: var(--ink);
}

/* Connexion / Inscription switch. */
.tabs {
  display: flex;
  gap: 0.5rem;
}
.tab {
  flex: 1;
  padding: 0.7rem 0.5rem;
  border-radius: 0.9rem;
  font-family: inherit;
  font-weight: 900;
  font-size: 1rem;
  cursor: pointer;
  color: var(--muted);
  background: var(--tile);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.tab.on {
  color: #fff;
  background: var(--accent);
}
.tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.field {
  width: 100%;
  padding: 0.85rem 1rem;
  border-radius: 0.9rem;
  font-family: inherit;
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--ink);
  background: var(--tile);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.field:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.sub {
  text-align: center;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--muted);
  margin-bottom: -0.4rem;
}
/* Four square PIN boxes; contents masked as dots. */
.pin {
  display: flex;
  justify-content: center;
  gap: 0.6rem;
}
.digit {
  width: 3.2rem;
  height: 3.2rem;
  text-align: center;
  font-family: inherit;
  font-weight: 900;
  font-size: 1.5rem;
  color: var(--ink);
  background: var(--tile);
  border: var(--outline-w) solid var(--outline);
  border-radius: 0.8rem;
  box-shadow: var(--pop-sm);
}
.digit:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.warn {
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--muted);
  margin: 0;
}
.err {
  margin: 0;
  text-align: center;
  color: var(--pink);
  font-weight: 800;
  font-size: 0.9rem;
}
.cta {
  background: var(--accent);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 1.02rem;
  padding: 0.85rem 1.4rem;
  border-radius: 1.1rem;
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop);
  cursor: pointer;
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.cta.ghost {
  background: var(--panel);
  color: var(--ink);
}
.cta.danger {
  background: var(--pink);
  color: #fff;
}
.cta:disabled {
  opacity: 0.45;
  cursor: default;
}
.cta:not(:disabled):active {
  transform: translate(4px, 5px);
  box-shadow: 0 0 0 var(--outline);
}
.cta:focus-visible {
  outline: none;
  transform: translate(4px, 5px);
  box-shadow: 0 0 0 var(--outline);
}
</style>
