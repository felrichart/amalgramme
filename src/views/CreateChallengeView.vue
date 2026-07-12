<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { validateChallenge, MAX_LETTERS, MIN_LETTERS } from '../game/word.js';
import { createCommunityLevel, updateCommunityLevel } from '../services/community.js';
import { communityRecord } from '../data/community.js';
import { username, pin, pinValid, isAdmin } from '../composables/useUsername.js';
import { WHEEL_TINTS } from '../palette.js';
import UsernamePrompt from '../components/UsernamePrompt.vue';

const route = useRoute();
const router = useRouter();

const editId = route.params.id ?? null;
const isEdit = !!editId;

const words = reactive(['', '', '', '']);
const secret = ref('');

/* Original author of the level being edited (kept for the recap and preserved
 * server-side when the admin edits someone else's level). */
const editAuthor = ref('');

/* Edit mode: prefill from the cached level; bounce unless it's the player's own
 * (or they're the admin, who may edit anyone's). */
onMounted(() => {
  if (!isEdit) return;
  const rec = communityRecord(editId);
  if (!rec || (rec.author !== username.value && !isAdmin.value)) {
    router.replace('/community');
    return;
  }
  editAuthor.value = rec.author;
  rec.words.forEach((w, i) => (words[i] = w));
  secret.value = rec.secret;
});

/* No identity yet → force the name/PIN prompt open. */
const nameOpen = ref(!username.value || !pinValid(pin.value));

/* Live validation drives the field hints and the submit button. */
const v = computed(() =>
  validateChallenge({ author: username.value, words, secret: secret.value }),
);

const ERRORS = {
  char: 'Caractère non autorisé',
  short: `${MIN_LETTERS} lettres minimum`,
  long: `${MAX_LETTERS} lettres maximum`,
  sep: '2 espaces / traits / apostrophes maximum',
};
/* A hint for a word field: skip 'empty' (blank is not an error to flag yet). */
function wordHint(err) {
  return err && err !== 'empty' ? ERRORS[err] : '';
}
/* The énigme hint adds the buildability rule once the word itself is valid. */
const secretHint = computed(() => {
  const err = v.value.secret;
  if (err && err !== 'empty') return ERRORS[err];
  if (secret.value && !v.value.buildable && v.value.words.every((e) => !e))
    return 'L’énigme doit s’écrire avec les lettres des indices';
  return '';
});

/* Endpoints (in the recap's 0–100 viewBox) of the lines from the centre énigme
 * to each corner index — order matches WHEEL_TINTS / the corner chips. */
const CROSS_PTS = [
  [25, 22],
  [75, 22],
  [25, 78],
  [75, 78],
];

const confirmOpen = ref(false);
const submitting = ref(false);
const error = ref('');

async function submit() {
  submitting.value = true;
  error.value = '';
  const payload = { ...v.value.normalized, pin: pin.value };
  const res = isEdit
    ? await updateCommunityLevel(editId, payload)
    : await createCommunityLevel(payload);
  submitting.value = false;
  if (res.ok) {
    confirmOpen.value = false;
    router.push(`/community/${res.level.author}`);
  } else {
    error.value = res.error;
  }
}
</script>

<template>
  <div class="create">
    <header class="top">
      <button
        class="icon-btn"
        type="button"
        @click="router.push('/community')"
        aria-label="communauté"
      >
        ←
      </button>
      <h1 class="title">{{ isEdit ? 'Modifier le défi' : 'Créer un défi' }}</h1>
      <div class="spacer" />
    </header>

    <div class="who">
      <span class="who-name">Auteur : {{ username || 'Sans nom' }}</span>
      <button class="switch" type="button" @click="nameOpen = true">Changer de compte</button>
    </div>

    <main class="form">
      <section class="section">
        <h2 class="section-title">Indices</h2>
        <label v-for="(w, i) in words" :key="i" class="field" :style="{ '--tint': WHEEL_TINTS[i] }">
          <span class="lab">Indice {{ i + 1 }}</span>
          <input
            v-model="words[i]"
            class="input word"
            type="text"
            maxlength="15"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            :placeholder="`Indice ${i + 1}`"
          />
          <span v-if="wordHint(v.words[i])" class="hint">{{ wordHint(v.words[i]) }}</span>
        </label>
      </section>

      <section class="section secret-section">
        <h2 class="section-title">Énigme</h2>
        <label class="field secret">
          <input
            v-model="secret"
            class="input"
            type="text"
            maxlength="15"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="Mot énigme"
          />
          <span v-if="secretHint" class="hint">{{ secretHint }}</span>
        </label>
      </section>
    </main>

    <footer class="foot">
      <button class="create-btn" type="button" :disabled="!v.ok" @click="confirmOpen = true">
        {{ isEdit ? 'Enregistrer' : 'Créer' }}
      </button>
    </footer>

    <!-- Recap / confirmation -->
    <div v-if="confirmOpen" class="overlay" @click.self="!submitting && (confirmOpen = false)">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Confirmer le défi">
        <h2 class="modal-title">
          {{ isEdit ? 'Enregistrer les modifications ?' : 'Confirmer le défi' }}
        </h2>
        <p class="modal-by">par {{ isEdit ? editAuthor : v.normalized.author }}</p>
        <!-- Cross recap: the 4 indices in the corners, the énigme at the centre,
             mirroring the game board. -->
        <div class="cross">
          <svg
            class="cross-links"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line
              v-for="(pt, i) in CROSS_PTS"
              :key="i"
              x1="50"
              y1="50"
              :x2="pt[0]"
              :y2="pt[1]"
              :stroke="WHEEL_TINTS[i]"
              stroke-width="2.5"
              stroke-linecap="round"
              opacity="0.8"
            />
          </svg>
          <span
            v-for="(w, i) in v.normalized.words"
            :key="i"
            class="chip"
            :class="`c${i}`"
            :style="{ '--tint': WHEEL_TINTS[i] }"
            >{{ w }}</span
          >
          <span class="chip secret-chip center">{{ v.normalized.secret }}</span>
        </div>
        <p v-if="error" class="err">{{ error }}</p>
        <div class="modal-actions">
          <button
            class="cta cta-ghost"
            type="button"
            :disabled="submitting"
            @click="confirmOpen = false"
          >
            Modifier
          </button>
          <button class="cta" type="button" :disabled="submitting" @click="submit">
            {{ submitting ? '…' : 'Confirmer' }}
          </button>
        </div>
      </div>
    </div>

    <UsernamePrompt
      :open="nameOpen"
      @close="nameOpen = false"
      @logout="router.replace('/community')"
    />
  </div>
</template>

<style scoped>
.create {
  min-height: 100dvh;
  max-height: 100dvh;
  display: flex;
  flex-direction: column;
  max-width: 560px;
  margin: 0 auto;
}
.top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.9rem 1rem 0.3rem;
}
.icon-btn {
  width: 2.6rem;
  height: 2.6rem;
  flex: none;
  display: grid;
  place-items: center;
  font-size: 1.3rem;
  border-radius: 0.9rem;
  color: var(--ink);
  cursor: pointer;
  background: var(--panel);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.icon-btn:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
.title {
  flex: 1;
  margin: 0;
  text-align: center;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--ink);
}
.spacer {
  width: 2.6rem;
  flex: none;
}

/* Author strip: who's posting + a way to switch account. */
.who {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.2rem 1rem 0.4rem;
}
.who-name {
  font-weight: 900;
  font-size: 1.05rem;
  color: var(--ink);
}
.switch {
  flex: none;
  padding: 0.45rem 0.7rem;
  border-radius: 0.7rem;
  font-family: inherit;
  font-weight: 800;
  font-size: 0.82rem;
  cursor: pointer;
  color: var(--ink);
  background: var(--panel);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.switch:active {
  transform: translate(2px, 3px);
  box-shadow: 0 0 0 var(--outline);
}

.form {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  padding: 0.6rem 1rem 1rem;
}
/* Grouped blocks so Indices and Énigme read as distinct steps. */
.section {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 0.9rem;
  border-radius: 1rem;
  background: var(--panel);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.secret-section {
  border-color: var(--accent);
}
.section-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink);
}
.secret-section .section-title {
  color: var(--accent);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.lab {
  font-weight: 800;
  font-size: 0.85rem;
  color: var(--tint, var(--accent));
  padding-left: 0.2rem;
}
.secret .lab {
  color: var(--accent);
}
.input {
  width: 100%;
  padding: 0.8rem 1rem;
  border-radius: 0.9rem;
  font-family: inherit;
  font-weight: 900;
  font-size: 1.15rem;
  text-transform: uppercase;
  color: var(--tint, var(--accent));
  background: var(--tile);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.secret .input {
  color: var(--accent);
}
.input:focus-visible {
  outline: 2px solid var(--tint, var(--accent));
  outline-offset: 2px;
}
.hint {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--pink);
  padding-left: 0.2rem;
}

.foot {
  flex: none;
  padding: 0.8rem 1rem calc(1.2rem + env(safe-area-inset-bottom));
  border-top: var(--outline-w) solid var(--outline);
  background: var(--bg);
}
.create-btn {
  width: 100%;
  padding: 1rem 1.2rem;
  border-radius: 1.1rem;
  font-family: inherit;
  font-weight: 900;
  font-size: 1.12rem;
  color: #fff;
  cursor: pointer;
  background: var(--accent);
  border: var(--outline-w-lg) solid var(--outline);
  box-shadow: var(--pop);
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.create-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.create-btn:not(:disabled):active {
  transform: translate(4px, 5px);
  box-shadow: 0 0 0 var(--outline);
}

/* Confirmation modal. */
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
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.6rem 1.4rem;
  border-radius: 1.3rem;
  background: var(--panel);
  border: var(--outline-w-lg) solid var(--outline);
  box-shadow: var(--pop-lg);
}
.modal-title {
  margin: 0;
  text-align: center;
  font-size: 1.15rem;
  font-weight: 900;
}
.modal-by {
  text-align: center;
  color: var(--muted);
  font-weight: 700;
  margin-top: -0.4rem;
}
/* Cross recap mirroring the board: corners + centre linked by tinted lines. */
.cross {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-areas:
    'c0 c1'
    'sec sec'
    'c2 c3';
  gap: 0.7rem 1rem;
  place-items: center;
  padding: 0.4rem 0;
}
.cross-links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.chip {
  position: relative;
  z-index: 1;
  padding: 0.5rem 0.75rem;
  border-radius: 0.7rem;
  font-weight: 900;
  font-size: 0.95rem;
  text-transform: uppercase;
  color: #fff;
  background: var(--tint);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.c0 {
  grid-area: c0;
}
.c1 {
  grid-area: c1;
}
.c2 {
  grid-area: c2;
}
.c3 {
  grid-area: c3;
}
.center {
  grid-area: sec;
}
.secret-chip {
  background: var(--accent);
}
.err {
  text-align: center;
  color: var(--pink);
  font-weight: 800;
  font-size: 0.9rem;
}
.modal-actions {
  display: flex;
  gap: 0.7rem;
  margin-top: 0.3rem;
}
.cta {
  flex: 1;
  background: var(--accent);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 1rem;
  padding: 0.8rem 1rem;
  border-radius: 1rem;
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop);
  cursor: pointer;
}
.cta-ghost {
  background: var(--panel);
  color: var(--ink);
}
.cta:disabled {
  opacity: 0.5;
  cursor: default;
}
.cta:not(:disabled):active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
</style>
