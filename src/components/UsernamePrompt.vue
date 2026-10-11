<script setup>
/* Account dialog. Signed in: show the identity with log-out / switch. Otherwise
 * (or while switching): 'connexion' to an existing name, or 'inscription' to claim
 * one (code asked twice), both verified by the backend before being stored. */
import { ref, reactive, watch, nextTick, computed } from 'vue';
import { pinValid } from '../../shared/constants.js';
import { username, setIdentity, clearIdentity, connected } from '../composables/useUsername.js';
import { authenticate } from '../services/levels.js';
import BaseModal from './ui/BaseModal.vue';

const props = defineProps({ open: Boolean });
const emit = defineEmits(['close', 'saved', 'logout']);

const mode = ref('connexion');
const switching = ref(false);
const name = ref('');
const nameInput = ref(null);
const error = ref('');
const busy = ref(false);

/* The PIN row and, for inscription, its confirmation: 4 one-digit boxes each. */
const blank = () => ['', '', '', ''];
const pins = reactive({ code: blank(), confirm: blank() });
const boxes = { code: [], confirm: [] };
const pinRows = computed(() =>
  mode.value === 'inscription'
    ? [
        { key: 'code', label: 'Code PIN à 4 chiffres' },
        { key: 'confirm', label: 'Confirmez le code PIN' },
      ]
    : [{ key: 'code', label: 'Code PIN à 4 chiffres' }],
);
const code = () => pins.code.join('');

const accountView = computed(() => connected.value && !switching.value);

function reset(nextMode = 'connexion') {
  mode.value = nextMode;
  name.value = '';
  pins.code = blank();
  pins.confirm = blank();
  error.value = '';
}

function focusName() {
  nextTick(() => nameInput.value?.focus());
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    switching.value = false;
    reset();
    if (!connected.value) focusName();
  },
);

const mismatch = () => mode.value === 'inscription' && code() !== pins.confirm.join('');
const valid = computed(() => !!name.value.trim() && pinValid(code()) && !mismatch());

/* One digit per box; typing advances, deleting an empty box goes back. */
function onDigit(row, i, e) {
  const d = e.target.value.replace(/\D/g, '').slice(-1);
  pins[row][i] = d;
  e.target.value = d;
  if (d && i < 3) boxes[row][i + 1]?.focus();
}
function onKey(row, i, e) {
  if (e.key === 'Backspace' && !pins[row][i] && i > 0) boxes[row][i - 1]?.focus();
  else if (e.key === 'Enter') submit();
}

async function submit() {
  error.value = '';
  if (busy.value || !name.value.trim() || !pinValid(code())) return;
  if (mismatch()) {
    error.value = 'Les deux codes ne correspondent pas.';
    return;
  }
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
  reset();
  focusName();
}

/* Parents decide where to go after logging out. */
function logout() {
  clearIdentity();
  emit('logout');
  emit('close');
}
</script>

<template>
  <BaseModal v-if="open" label="Compte joueur" @close="emit('close')">
    <template v-if="accountView">
      <h2 class="modal-title">Mon compte</h2>
      <p class="who">
        Connecté en tant que <strong>{{ username }}</strong>
      </p>
      <button class="cta ghost press" type="button" @click="switchAccount">
        Changer de compte
      </button>
      <button class="cta danger press" type="button" @click="logout">Déconnexion</button>
    </template>

    <template v-else>
      <div class="tabs" role="tablist">
        <button
          v-for="m in ['connexion', 'inscription']"
          :key="m"
          class="tab"
          :class="{ on: mode === m }"
          type="button"
          role="tab"
          :aria-selected="mode === m"
          @click="((mode = m), (error = ''))"
        >
          {{ m === 'connexion' ? 'Connexion' : 'Inscription' }}
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

      <template v-for="row in pinRows" :key="row.key">
        <span class="sub">{{ row.label }}</span>
        <div class="pin" role="group" :aria-label="row.label">
          <input
            v-for="(d, i) in pins[row.key]"
            :key="i"
            :ref="(el) => (boxes[row.key][i] = el)"
            class="field digit"
            type="password"
            inputmode="numeric"
            maxlength="1"
            :value="d"
            @input="onDigit(row.key, i, $event)"
            @keydown="onKey(row.key, i, $event)"
          />
        </div>
      </template>

      <p v-if="mode === 'inscription'" class="warn">
        ⚠️ CE CODE N'EST PAS SÉCURISÉ. N’utilisez pas un vrai mot de passe.
      </p>
      <p v-if="error" class="err">{{ error }}</p>
      <button class="cta press" type="button" :disabled="!valid || busy" @click="submit">
        {{ busy ? '…' : mode === 'connexion' ? 'Se connecter' : "S'inscrire" }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.who {
  text-align: center;
  font-weight: 700;
  color: var(--muted);
}
.who strong {
  color: var(--ink);
}
.tabs {
  display: flex;
  gap: 0.5rem;
}
.tab,
.field {
  font-family: inherit;
  font-weight: 900;
  color: var(--ink);
  background: var(--tile);
  border: var(--outline-w) solid var(--outline);
  border-radius: 0.9rem;
  box-shadow: var(--pop-sm);
}
.tab:focus-visible,
.field:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.tab {
  flex: 1;
  padding: 0.7rem 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  color: var(--muted);
}
.tab.on {
  color: #fff;
  background: var(--accent);
}
.field {
  width: 100%;
  padding: 0.85rem 1rem;
  font-size: 1.1rem;
}
.sub {
  text-align: center;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--muted);
  margin-bottom: -0.4rem;
}
.pin {
  display: flex;
  justify-content: center;
  gap: 0.6rem;
}
.digit {
  width: 3.2rem;
  height: 3.2rem;
  padding: 0;
  text-align: center;
  font-size: 1.5rem;
  border-radius: 0.8rem;
}
.warn {
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--muted);
}
</style>
