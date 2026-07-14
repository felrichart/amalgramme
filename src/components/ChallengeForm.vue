<script setup>
/*
 * The shared challenge editor: 4 index words + an énigme, live-validated by
 * game/word.js, with a cross-recap confirmation mirroring the board. Used by the
 * community create/edit view and the admin daily editor. The parent owns the
 * network call: it listens for `submit` (which carries the normalised
 * {words, secret}) and feeds progress back via the `submitting` / `error` props.
 * A `#fields-top` slot lets a parent prepend extra fields (e.g. the daily date).
 */
import { ref, reactive, computed, watch } from 'vue';
import { validateChallenge, MAX_LETTERS, MIN_LETTERS } from '../game/word.js';
import { WHEEL_TINTS } from '../palette.js';

const props = defineProps({
  author: { type: String, default: '' },
  initialWords: { type: Array, default: () => ['', '', '', ''] },
  initialSecret: { type: String, default: '' },
  isEdit: { type: Boolean, default: false },
  /* When true, the recap "Confirmer" action is blocked from re-firing. */
  submitting: { type: Boolean, default: false },
  /* A server error shown inside the recap; keeps the modal open. */
  error: { type: String, default: '' },
  /* Byline under the recap title, e.g. "par cara+" or the date label. */
  recapByline: { type: String, default: '' },
  /* Optional warning shown in the recap before confirming (e.g. "you can't
   * edit this later"). */
  confirmNote: { type: String, default: '' },
  /* Extra guard the parent can add (e.g. missing/past date); blocks submit. */
  extraValid: { type: Boolean, default: true },
});

const emit = defineEmits(['submit']);

const words = reactive([...props.initialWords]);
const secret = ref(props.initialSecret);

/* Re-seed when the parent supplies values asynchronously (edit prefill). */
watch(
  () => [props.initialWords, props.initialSecret],
  () => {
    props.initialWords.forEach((w, i) => (words[i] = w));
    secret.value = props.initialSecret;
  },
);

/* Live validation drives the field hints and the submit button. */
const v = computed(() => validateChallenge({ author: props.author, words, secret: secret.value }));

const ERRORS = {
  char: 'Caractère non autorisé',
  short: `${MIN_LETTERS} lettres minimum`,
  long: `${MAX_LETTERS} lettres maximum`,
  sep: '2 espaces / traits / apostrophes maximum',
  dup: 'Indice déjà utilisé',
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

function confirm() {
  emit('submit', v.value.normalized);
}
</script>

<template>
  <main class="form">
    <slot name="fields-top" />

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
    <button
      class="create-btn"
      type="button"
      :disabled="!v.ok || !extraValid"
      @click="confirmOpen = true"
    >
      {{ isEdit ? 'Enregistrer' : 'Publier' }}
    </button>
  </footer>

  <!-- Recap / confirmation -->
  <div v-if="confirmOpen" class="overlay" @click.self="!submitting && (confirmOpen = false)">
    <div class="modal" role="dialog" aria-modal="true" aria-label="Publier le défi">
      <h2 class="modal-title">
        {{ isEdit ? 'Enregistrer les modifications ?' : 'Publier le défi' }}
      </h2>
      <p v-if="recapByline" class="modal-by">{{ recapByline }}</p>
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
      <p v-if="confirmNote" class="note">⚠ {{ confirmNote }}</p>
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
        <button class="cta" type="button" :disabled="submitting" @click="confirm">
          {{ submitting ? '…' : 'Publier' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
/* Pre-confirm warning (e.g. "no edits later"). */
.note {
  text-align: center;
  color: red;
  font-weight: 700;
  font-size: 0.86rem;
  line-height: 1.35;
  margin: 0;
  padding: 0.6rem 0.7rem;
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
