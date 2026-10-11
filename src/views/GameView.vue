<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameState, HELP_MAX } from '../composables/useGameState.js';
import { useLevel } from '../composables/useLevel.js';
import { usePlayStats } from '../composables/usePlayStats.js';
import { useShake } from '../composables/useShake.js';
import { useFlip } from '../composables/useFlip.js';
import { answerSlots, tileKey } from '../game/puzzle.js';
import { solvedBy } from '../utils/format.js';
import { WORD_TINTS } from '../palette.js';
import PageHeader from '../components/ui/PageHeader.vue';
import BulbIcon from '../components/ui/BulbIcon.vue';
import EditIcon from '../components/ui/EditIcon.vue';
import PuzzlePiece from '../components/PuzzlePiece.vue';
import AidePopup from '../components/AidePopup.vue';

const route = useRoute();
const router = useRouter();

const level = useLevel(route.params.slug, router);
const g = useGameState(level.date);
const stats = usePlayStats(level.date, () => g.state.completed);

const AREAS = ['w0', 'w1', 'w2', 'w3'];

/*
 * What's shown: 'word:<i>' (piece i in the editor), 'merged' (pieces assembled
 * around the secret, its letter stock in the editor) or 'none'. Trails the game
 * focus so the change can run inside a view transition, and lingers a beat on a
 * just-solved word or secret.
 */
const target = computed(() => {
  if (g.state.completed || g.secretActive.value) return 'merged';
  return g.wordActive.value ? `word:${g.state.wordIndex}` : 'none';
});
const view = ref(target.value);
const openWord = computed(() =>
  view.value.startsWith('word:') ? Number(view.value.slice(5)) : null,
);
const merged = computed(() => view.value === 'merged');

/* The assemble / split glides the pieces and the secret to their new spots. */
const boardEl = ref(null);
const flip = useFlip(boardEl, '.piece, .secret');

let userMove = false;
let settle = null;
watch(target, (t) => {
  clearTimeout(settle);
  const update = () => (view.value = t);
  const apply = () => ((t === 'merged') !== merged.value ? flip(update) : update());
  if (userMove) apply();
  else settle = setTimeout(apply, 300);
  userMove = false;
});
onUnmounted(() => clearTimeout(settle));

/* Switch input on a player tap, so the view follows without the post-solve pause. */
function go(action) {
  userMove = true;
  action();
}

/* Secret boxes; the help-revealed leading ones are `given` (locked). */
const secretSlots = computed(() =>
  answerSlots(g.secret, g.secretChars.value).map((s, i) => ({
    ...s,
    given: i < g.state.secretReveal,
  })),
);
function onSecret(i) {
  if (merged.value) g.moveCursor(i);
  else go(g.activateSecret);
}

const canHelp = computed(() => g.canRevealWord.value || g.canRevealSecret.value);
const aideOpen = ref(false);
function openAide() {
  aideOpen.value = true;
}
function reveal(kind) {
  g.useHelp(kind);
  aideOpen.value = false;
}

const wordShaking = useShake(() => g.shakeSignal.value);
const secretShaking = useShake(() => g.secretShake.value);

const tint = (i) => ({
  '--tint': WORD_TINTS[i],
  '--piece': `color-mix(in srgb, ${WORD_TINTS[i]} 45%, var(--panel))`,
});

function pieceProps(i) {
  return {
    index: i,
    word: g.words[i],
    solved: g.solved[i],
    tiles: g.shuffledTiles(i),
    given: g.revealed[i],
    typed: g.wordActive.value && g.state.wordIndex === i ? g.wordChars.value : [],
  };
}

/* Physical keyboard: letters, Backspace, arrows to move the cursor, Space shuffles. */
const LETTER = /^[a-zA-Zà-ÿÀ-ß]$/;
function onKeydown(e) {
  if (g.state.completed || aideOpen.value || e.metaKey || e.ctrlKey) return;
  const secret = g.secretActive.value;
  if (!secret && !g.wordActive.value) return;
  if (LETTER.test(e.key)) (secret ? g.typeSecret : g.typeLetter)(e.key);
  else if (e.key === 'Backspace') {
    e.preventDefault();
    g.backspace();
  } else if (e.key === 'ArrowLeft') g.stepCursor(-1);
  else if (e.key === 'ArrowRight') g.stepCursor(1);
  else if (e.key === 'Escape') go(g.close);
  else if (e.key === ' ' && !secret) {
    e.preventDefault();
    g.shuffleWord();
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="page fit game">
    <PageHeader :title="level.title" :back="level.back">
      <button
        class="icon-btn help-btn press sm"
        type="button"
        :disabled="!canHelp"
        aria-label="aide"
        @click="openAide"
      >
        <BulbIcon />
        <span class="help-count">{{ g.helpLeft.value }}/{{ HELP_MAX }}</span>
      </button>
    </PageHeader>

    <main ref="boardEl" class="board" :class="{ merged }">
      <PuzzlePiece
        v-for="(w, i) in g.words"
        :key="i"
        v-bind="pieceProps(i)"
        :mode="merged ? 'merged' : 'overview'"
        :active="openWord === i"
        :dimmed="openWord !== i"
        :style="{ gridArea: AREAS[i], ...tint(i) }"
        @open="go(() => g.activate(i))"
      />

      <div
        class="secret"
        :class="{ found: g.state.secretFound, active: merged }"
        :role="merged || g.state.secretFound ? undefined : 'button'"
        :tabindex="merged || g.state.secretFound ? undefined : 0"
        aria-label="mot énigme"
        @click="!merged && !g.state.secretFound && go(g.activateSecret)"
        @keydown.enter="!merged && go(g.activateSecret)"
      >
        <span class="secret-boxes" :class="{ shake: secretShaking, wrong: g.secretWrong.value }">
          <button
            v-for="(s, i) in secretSlots"
            :key="i"
            class="sbox"
            type="button"
            tabindex="-1"
            :class="{
              set: s.ch && !s.given,
              given: s.given,
              caret: merged && !g.state.secretFound && i === g.secretCursor.value,
              'gap-after': s.gapAfter,
            }"
            :disabled="g.state.secretFound || (merged && s.given)"
            @click.stop="onSecret(i)"
          >
            {{ s.ch }}
          </button>
        </span>
      </div>
    </main>

    <section class="dock">
      <div v-if="g.state.completed" class="finish">
        <div class="finish-head">
          <span class="finish-mark" aria-hidden="true">✓</span>
          <span class="finish-bravo">Bravo</span>
        </div>
        <p v-if="stats" class="finish-stats">{{ solvedBy(stats.successes, stats.attempts) }}</p>
        <div class="finish-actions">
          <button
            v-for="a in level.actions"
            :key="a.label"
            class="cta press"
            :class="a.variant"
            type="button"
            @click="router.push(a.to)"
          >
            {{ a.label }}
          </button>
        </div>
      </div>

      <div v-else-if="openWord != null" :key="view" class="editor">
        <PuzzlePiece
          :key="openWord"
          v-bind="pieceProps(openWord)"
          mode="open"
          :style="tint(openWord)"
          :cursor="g.wordCursor.value"
          :used="g.usedTiles.value"
          :shake="wordShaking"
          @tile="g.appendTile"
          @shuffle="g.shuffleWord"
          @cursor="g.moveCursor"
          @back="g.backspace"
          @clear="g.clearInput"
        />
        <button class="close" type="button" aria-label="fermer" @click="go(g.close)">✕</button>
      </div>

      <div v-else-if="merged" key="stock" class="editor stock">
        <div
          v-for="(row, r) in g.trayRows.value"
          :key="r"
          class="stock-row"
          :style="{ '--tint': WORD_TINTS[r] }"
        >
          <button
            v-for="t in row"
            :key="t.id"
            class="stock-key"
            :class="{ solved: g.solved[r] }"
            type="button"
            tabindex="-1"
            :disabled="g.spentTiles.value.has(tileKey(r, t.id))"
            @click="g.typeSecret({ r, id: t.id, ch: t.ch })"
          >
            {{ t.ch }}
          </button>
        </div>
        <div class="edit-bar">
          <button
            class="pill"
            type="button"
            tabindex="-1"
            aria-label="tout effacer"
            @click="g.clearInput"
          >
            <EditIcon name="clear" />
          </button>
          <button
            class="pill"
            type="button"
            tabindex="-1"
            aria-label="effacer une lettre"
            @click="g.backspace"
          >
            <EditIcon name="back" />
          </button>
        </div>
        <button class="close" type="button" aria-label="fermer" @click="go(g.close)">✕</button>
      </div>

      <p v-else class="idle">Touche une pièce ou le mot du milieu.</p>
    </section>

    <AidePopup
      v-if="aideOpen"
      :can-word="g.canRevealWord.value"
      :can-secret="g.canRevealSecret.value"
      :left="g.helpLeft.value"
      @reveal="reveal"
      @close="aideOpen = false"
    />
  </div>
</template>

<style scoped>
/* Help button: a lime pill in the top-right, lightbulb + remaining count in a row. */
.help-btn {
  width: auto;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.3rem;
  padding: 0 0.6rem;
  font-size: 1rem;
  color: var(--ink);
  background: var(--panel);
}
.help-count {
  font-weight: 900;
  font-size: 0.9rem;
  letter-spacing: 0.02em;
}

/* Secret: a row of empty boxes between the pieces; tapping it assembles them. */
.secret {
  position: relative;
  grid-area: secret;
  justify-self: center;
  max-width: 100%;
  min-width: 0;
  display: flex;
  padding: 0.75rem 0.9rem;
  border: var(--outline-w) solid var(--outline);
  border-radius: 1.1rem;
  background: var(--panel);
  box-shadow: var(--lift);
  cursor: pointer;
  font: inherit;
  transition: transform 0.12s ease;
}
.secret[role='button']:active {
  transform: translateY(3px);
  box-shadow: none;
}
.secret:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}
/* Assembled: the secret sits in the hollow the four pieces close around. */
.secret.active {
  cursor: default;
  padding: 0.7rem 0.9rem;
  box-shadow: none;
}
.secret-boxes {
  display: flex;
  gap: 0.45rem;
  max-width: 100%;
  min-width: 0;
}
.secret-boxes.shake {
  animation: shake 0.4s ease;
}
/* Same underlined boxes as a word's editor (see PuzzlePiece .is-open .slot). */
.sbox {
  flex: 0 1 auto;
  width: 2rem;
  min-width: 0;
  height: 2.6rem;
  display: grid;
  place-items: center;
  padding: 0 0 0.2rem;
  font: inherit;
  font-weight: 900;
  font-size: 1.8rem;
  text-transform: uppercase;
  color: var(--ink);
  background: none;
  border: 0;
  border-bottom: 3px solid color-mix(in srgb, var(--ink) 30%, transparent);
  border-radius: 0.3rem 0.3rem 0 0;
  cursor: inherit;
}
.sbox:focus-visible {
  outline: none;
}
.secret.active .sbox {
  cursor: pointer;
}
.sbox.set {
  animation: pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
/* Help-given leading letter: pre-filled and locked. */
.sbox.given,
.secret.active .sbox.given {
  color: color-mix(in srgb, var(--ink) 55%, var(--accent));
  cursor: default;
}
.secret.active .sbox.caret {
  background: var(--panel);
  border-bottom-color: var(--ink);
}
.secret-boxes.wrong .sbox {
  color: var(--danger);
}
/* Secret had a space after this box: widen the gap between the parts. */
.sbox.gap-after {
  margin-right: 1.1rem;
}
.secret.found {
  background: var(--accent);
  cursor: default;
}
.secret.found .sbox {
  color: var(--on-color);
  border-bottom-color: color-mix(in srgb, var(--ink) 35%, transparent);
  animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.board,
.dock {
  user-select: none;
}
.board {
  position: relative;
  flex: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-areas:
    'w0 w1'
    'secret secret'
    'w2 w3';
  gap: 1.35rem 1.7rem;
  padding: 0.9rem 1.2rem 0.6rem;
}
.board > .piece {
  height: 6.2rem;
}
/* Assembled: pieces flush in a 2×2 block, the secret in the hollow at its centre. */
.board.merged {
  grid-template-areas:
    'w0 w1'
    'w2 w3';
  gap: 0;
}
.board.merged > .piece {
  height: 6.2rem;
}
.board.merged .secret {
  grid-area: 1 / 1 / 3 / 3;
  align-self: center;
  z-index: 2;
}

/* Editor under the board: the enlarged piece, or the secret's letter stock. */
.dock {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.8rem 1.2rem calc(0.8rem + env(safe-area-inset-bottom));
}
.editor {
  position: relative;
  animation: editor-in 0.2s ease-out;
}
@keyframes editor-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
/* Close: a quiet cross in the editor card's top-right corner. */
.close {
  position: absolute;
  top: 0.2rem;
  right: 0.3rem;
  z-index: 1;
  width: 1.6rem;
  height: 1.6rem;
  display: grid;
  place-items: center;
  padding: 0;
  font: inherit;
  font-size: 1rem;
  font-weight: 900;
  color: var(--ink);
  background: none;
  opacity: 0.55;
  cursor: pointer;
}
.close:active {
  opacity: 1;
}
.idle {
  margin: 1.5rem 0 0;
  text-align: center;
  font-weight: 700;
  color: var(--muted);
}

/* Letter stock for the secret: one row per word, solved ones read in order. */
.stock {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 2rem 0.6rem 1rem;
  border: var(--outline-w) solid var(--outline);
  border-radius: 1rem;
  background: var(--panel);
  box-shadow: var(--lift);
}
.stock-row {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  max-width: 100%;
}
.stock-key {
  flex: none;
  width: 2.4rem;
  height: 2.8rem;
  padding: 0;
  font: inherit;
  font-weight: 900;
  font-size: 1.25rem;
  text-transform: uppercase;
  color: var(--ink);
  background: var(--panel);
  border: var(--outline-w) solid var(--outline);
  border-radius: 0.5rem;
  box-shadow: var(--lift-sm);
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.stock-key.solved {
  background: color-mix(in srgb, var(--tint) 45%, var(--panel));
}
.stock-key:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: none;
}
.stock-key:disabled {
  opacity: 0.3;
  box-shadow: none;
  cursor: default;
}
.stock .edit-bar {
  margin-top: 0.5rem;
}
.finish {
  margin-top: 0.6rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.1rem;
  animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.finish-head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.finish-bravo {
  font-size: 1.9rem;
  font-weight: 900;
  color: var(--ink);
}
.finish-stats {
  margin: -0.4rem 0 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--muted);
  text-align: center;
}
.finish-mark {
  width: 2.4rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 1.3rem;
  font-weight: 900;
  color: var(--on-color);
  background: var(--accent);
  box-shadow: var(--lift-sm);
  border: var(--outline-w) solid var(--outline);
}
.finish-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.7rem;
}
.finish .cta {
  padding: 0.85rem 1.9rem;
  font-size: 1.02rem;
  border-radius: 1.1rem;
}
</style>
