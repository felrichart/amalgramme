<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameState, HELP_MAX } from '../composables/useGameState.js';
import { useLevel } from '../composables/useLevel.js';
import { usePlayStats } from '../composables/usePlayStats.js';
import { useShake } from '../composables/useShake.js';
import { aideHintSeen, markAideHintSeen } from '../data/tutorial.js';
import { answerSlots, tileKey } from '../game/puzzle.js';
import { solvedBy } from '../utils/format.js';
import { WORD_TINTS } from '../palette.js';
import PageHeader from '../components/ui/PageHeader.vue';
import BulbIcon from '../components/ui/BulbIcon.vue';
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

function morph(update) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) return update();
  document.startViewTransition(async () => {
    update();
    await nextTick();
  });
}

let userMove = false;
let settle = null;
watch(target, (t) => {
  clearTimeout(settle);
  const apply = () => morph(() => (view.value = t));
  if (userMove) apply();
  else settle = setTimeout(apply, 450);
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
/* One-off "Nouveau !" nudge towards the help button, gone once it's opened. */
const hintSeen = ref(aideHintSeen());
function openAide() {
  aideOpen.value = true;
  hintSeen.value = true;
  markAideHintSeen();
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

/* A piece's letters and answer, live-typed while it's the one being edited. */
function pieceProps(i) {
  const word = g.words[i];
  const editing = g.wordActive.value && g.state.wordIndex === i;
  return {
    index: i,
    word,
    solved: g.solved[i],
    tiles: g.shuffledTiles(i),
    typed: editing ? g.wordChars.value : [...word.text.slice(0, g.revealed[i])],
    given: g.revealed[i],
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
      <span v-if="!hintSeen && canHelp" class="aide-hint" aria-hidden="true">Nouveau</span>
    </PageHeader>

    <main class="board" :class="{ merged }">
      <PuzzlePiece
        v-for="(w, i) in g.words"
        :key="i"
        v-bind="pieceProps(i)"
        :mode="merged ? 'merged' : 'overview'"
        :active="openWord === i"
        :style="{ gridArea: AREAS[i], '--vt': `piece-${i}`, ...tint(i) }"
        @open="go(() => g.activate(i))"
      />

      <div
        class="secret"
        :class="{ found: g.state.secretFound, active: merged }"
        :role="merged ? undefined : 'button'"
        :tabindex="merged || g.state.secretFound ? undefined : 0"
        aria-label="mot énigme"
        @click="!merged && !g.state.secretFound && go(g.activateSecret)"
        @keydown.enter="!merged && go(g.activateSecret)"
      >
        <template v-if="!merged && !g.state.secretFound">
          <svg
            v-for="c in ['tl', 'tr', 'bl', 'br']"
            :key="c"
            class="arrow"
            :class="c"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M2 2 L13 13 M13 6 V13 H6" />
          </svg>
        </template>
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
              caret: merged && i === g.secretCursor.value,
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

      <div v-else-if="openWord != null" class="editor">
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

      <div v-else-if="merged" class="editor stock">
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
          <button class="pill" type="button" tabindex="-1" @click="g.clearInput">Effacer</button>
          <button
            class="pill"
            type="button"
            tabindex="-1"
            aria-label="effacer une lettre"
            @click="g.backspace"
          >
            ⌫
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
/* One-off "Nouveau !" badge pinned on the help button, gently pulsing. */
.aide-hint {
  position: absolute;
  top: 0.45rem;
  right: 0.5rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  font-weight: 800;
  font-size: 0.68rem;
  white-space: nowrap;
  color: #fff;
  background: #3b82f6;
  pointer-events: none;
  animation: aide-hint-fade 1.6s ease-in-out infinite;
}
@keyframes aide-hint-fade {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}
/* Help button: a lime pill in the top-right, lightbulb + remaining count in a row. */
.help-btn {
  width: auto;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.3rem;
  padding: 0 0.6rem;
  font-size: 1rem;
  color: #fff;
  background: var(--lime);
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
  border: 0;
  border-radius: 1.1rem;
  background: var(--panel);
  box-shadow: 0 4px 0 color-mix(in srgb, var(--ink) 12%, var(--bg));
  cursor: pointer;
  font: inherit;
  view-transition-name: secret;
  transition: transform 0.12s ease;
}
.secret:active:not(:disabled) {
  transform: translateY(2px);
}
.secret:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}
/* Inward arrows at each corner: this is where the pieces come together. */
.arrow {
  position: absolute;
  width: 0.9rem;
  height: 0.9rem;
  fill: none;
  stroke: color-mix(in srgb, var(--ink) 45%, var(--bg));
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  animation: arrow-in 1.8s ease-in-out infinite;
}
.arrow.tl {
  --r: 0deg;
  top: -1.2rem;
  left: -1.2rem;
}
.arrow.tr {
  --r: 90deg;
  top: -1.2rem;
  right: -1.2rem;
}
.arrow.br {
  --r: 180deg;
  bottom: -1.2rem;
  right: -1.2rem;
}
.arrow.bl {
  --r: 270deg;
  bottom: -1.2rem;
  left: -1.2rem;
}
@keyframes arrow-in {
  0%,
  100% {
    transform: rotate(var(--r)) translate(0, 0);
  }
  50% {
    transform: rotate(var(--r)) translate(3px, 3px);
  }
}
/* Assembled: the secret is the empty slot the four pieces close around. */
/* Assembled: the secret sits in the hollow the four pieces close around. */
.secret.active {
  cursor: default;
  padding: 0.7rem 0.9rem;
  background: var(--bg);
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--ink) 8%, var(--bg));
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
  color: var(--pink);
}
/* Secret had a space after this box: widen the gap between the parts. */
.sbox.gap-after {
  margin-right: 1.1rem;
}
.secret.found {
  background: var(--accent);
  box-shadow: none;
  cursor: default;
}
.secret.found .sbox {
  color: #fff;
  border-bottom-color: rgba(255, 255, 255, 0.5);
  animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
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
  gap: 1.6rem 1.7rem;
  padding: 0.9rem 1.2rem 0.6rem;
}
.board > .piece {
  min-height: 6.4rem;
}
/* Assembled: pieces flush in a 2×2 block, the secret in the hollow at its centre. */
.board.merged {
  grid-template-areas:
    'w0 w1'
    'w2 w3';
  gap: 0;
}
.board.merged > .piece {
  min-height: 6.2rem;
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
  padding: 1rem 1.2rem calc(1rem + env(safe-area-inset-bottom));
}
.editor {
  position: relative;
}
.close {
  position: absolute;
  top: 0.55rem;
  right: 0.55rem;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  padding: 0;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 900;
  color: var(--ink);
  background: color-mix(in srgb, var(--panel) 60%, transparent);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
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
  gap: 0.5rem;
  padding: 2.6rem 0.8rem 1rem;
  border-radius: 1rem;
  background: var(--panel);
}
.stock-row {
  display: flex;
  justify-content: center;
  gap: 0.3rem;
  max-width: 100%;
}
.stock-key {
  --edge: color-mix(in srgb, var(--tint) 45%, var(--panel));
  flex: 0 1 auto;
  width: 2rem;
  min-width: 0;
  height: 2.3rem;
  padding: 0;
  font: inherit;
  font-weight: 900;
  font-size: 1.05rem;
  text-transform: uppercase;
  color: var(--ink);
  background: var(--bg);
  border: 0;
  border-radius: 0.45rem;
  box-shadow: 0 3px 0 var(--edge);
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.stock-key.solved {
  background: color-mix(in srgb, var(--tint) 30%, var(--panel));
}
.stock-key:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--edge);
}
.stock-key:disabled {
  opacity: 0.3;
  box-shadow: none;
  cursor: default;
}
.edit-bar {
  display: flex;
  gap: 0.5rem;
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
  color: #fff;
  background: var(--accent);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
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

<style>
::view-transition-group(*) {
  animation-duration: 0.38s;
  animation-timing-function: cubic-bezier(0.3, 0.7, 0.2, 1);
}
</style>
