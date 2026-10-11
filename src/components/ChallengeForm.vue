<script setup>
/*
 * Shared challenge editor (community create, admin daily editor): 4 indices + an
 * énigme, live-validated, with a recap mirroring the board before submitting. The
 * parent owns the network call: `submit` carries the normalised { author, words,
 * secret }; progress comes back via `submitting` / `error`. The `#fields-top` slot
 * prepends extra fields styled like the built-in ones.
 */
import { ref, reactive, computed } from 'vue';
import { validateChallenge, MAX_LETTERS, MIN_LETTERS, MAX_SEPARATOR } from '../game/word.js';
import { WORD_TINTS } from '../palette.js';
import BaseModal from './ui/BaseModal.vue';

const props = defineProps({
  author: { type: String, default: '' },
  initialWords: { type: Array, default: () => ['', '', '', ''] },
  initialSecret: { type: String, default: '' },
  isEdit: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  /* Server error shown inside the recap. */
  error: { type: String, default: '' },
  /* Byline under the recap title, e.g. "par cara+" or the date label. */
  recapByline: { type: String, default: '' },
  /* Warning shown in the recap before confirming. */
  confirmNote: { type: String, default: '' },
  /* Extra parent-side guard (e.g. the daily date); blocks submit. */
  extraValid: { type: Boolean, default: true },
});

const emit = defineEmits(['submit']);

const words = reactive([...props.initialWords]);
const secret = ref(props.initialSecret);

const v = computed(() => validateChallenge({ author: props.author, words, secret: secret.value }));

const ERRORS = {
  char: 'Caractère non autorisé',
  short: `${MIN_LETTERS} lettres minimum`,
  long: `${MAX_LETTERS} lettres maximum`,
  sep: `${MAX_SEPARATOR} espaces / traits / apostrophes maximum`,
  dup: 'Indice déjà utilisé',
};
/* Blank isn't flagged until submit is attempted. */
const hintFor = (err) => (err && err !== 'empty' ? ERRORS[err] : '');

const secretHint = computed(() => {
  const err = hintFor(v.value.secret);
  if (err) return err;
  if (secret.value && !v.value.buildable && v.value.words.every((e) => !e))
    return 'L’énigme doit s’écrire avec les lettres des indices';
  return '';
});

/* Recap line endpoints (0–100 viewBox) from the centre to each corner chip. */
const CROSS_PTS = [
  [25, 22],
  [75, 22],
  [25, 78],
  [75, 78],
];

const confirmOpen = ref(false);
</script>

<template>
  <main class="form">
    <slot name="fields-top" />

    <section class="section">
      <h2 class="section-title">Indices</h2>
      <label v-for="(w, i) in words" :key="i" class="field" :style="{ '--tint': WORD_TINTS[i] }">
        <span class="lab">Indice {{ i + 1 }}</span>
        <input
          v-model="words[i]"
          class="input"
          type="text"
          maxlength="15"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :placeholder="`Indice ${i + 1}`"
        />
        <span v-if="hintFor(v.words[i])" class="hint">{{ hintFor(v.words[i]) }}</span>
      </label>
    </section>

    <section class="section secret">
      <h2 class="section-title">Énigme</h2>
      <label class="field">
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
      class="big-btn press"
      type="button"
      :disabled="!v.ok || !extraValid"
      @click="confirmOpen = true"
    >
      {{ isEdit ? 'Enregistrer' : 'Publier' }}
    </button>
  </footer>

  <BaseModal
    v-if="confirmOpen"
    style="max-width: 360px"
    label="Publier le défi"
    :locked="submitting"
    @close="confirmOpen = false"
  >
    <h2 class="modal-title">
      {{ isEdit ? 'Enregistrer les modifications ?' : 'Publier le défi' }}
    </h2>
    <p v-if="recapByline" class="by">{{ recapByline }}</p>
    <!-- The indices in the corners, the énigme at the centre, like the board. -->
    <div class="cross">
      <svg class="cross-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line
          v-for="(pt, i) in CROSS_PTS"
          :key="i"
          x1="50"
          y1="50"
          :x2="pt[0]"
          :y2="pt[1]"
          :stroke="WORD_TINTS[i]"
          stroke-width="2.5"
          stroke-linecap="round"
          opacity="0.8"
        />
      </svg>
      <span
        v-for="(w, i) in v.normalized.words"
        :key="i"
        class="chip"
        :style="{ gridArea: `c${i}`, '--tint': WORD_TINTS[i] }"
        >{{ w }}</span
      >
      <span class="chip center">{{ v.normalized.secret }}</span>
    </div>
    <p v-if="confirmNote" class="note">⚠ {{ confirmNote }}</p>
    <p v-if="error" class="err">{{ error }}</p>
    <div class="modal-actions">
      <button
        class="cta ghost press"
        type="button"
        :disabled="submitting"
        @click="confirmOpen = false"
      >
        Modifier
      </button>
      <button
        class="cta press"
        type="button"
        :disabled="submitting"
        @click="emit('submit', v.normalized)"
      >
        {{ submitting ? '…' : 'Publier' }}
      </button>
    </div>
  </BaseModal>
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
/* :slotted() so a parent's #fields-top sections match. */
.section,
:slotted(.section) {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 0.9rem;
  border-radius: 1rem;
  background: var(--panel);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.section-title,
:slotted(.section-title) {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--tint, var(--ink));
}
.field,
:slotted(.field) {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.input,
:slotted(.input) {
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
.input:focus-visible {
  outline: 2px solid var(--tint, var(--accent));
  outline-offset: 2px;
}
.secret {
  --tint: var(--accent);
  border-color: var(--accent);
}
.lab {
  font-weight: 800;
  font-size: 0.85rem;
  color: var(--tint);
  padding-left: 0.2rem;
}

/* Recap modal. */
.by {
  text-align: center;
  color: var(--muted);
  font-weight: 700;
  margin-top: -0.4rem;
}
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
  background: var(--tint, var(--accent));
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.center {
  grid-area: sec;
}
.note {
  text-align: center;
  color: red;
  font-weight: 700;
  font-size: 0.86rem;
  line-height: 1.35;
  padding: 0.6rem 0.7rem;
}
.modal-actions {
  margin-top: 0.3rem;
}
</style>
