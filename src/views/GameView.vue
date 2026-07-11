<script setup>
import { computed, ref, reactive, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameState } from '../composables/useGameState.js';
import { PUZZLES_NEW as PUZZLES } from '../data/challenges.js';
import LetterWheel from '../components/LetterWheel.vue';
import LetterKeyboard from '../components/LetterKeyboard.vue';

const route = useRoute();
const router = useRouter();

const levelIndex = Number(route.params.level);
if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= PUZZLES.length) {
  router.replace('/');
}

const g = useGameState(levelIndex);

/* A word wheel is docked when the active target is a word index (not the secret). */
const wordActive = computed(() => typeof g.state.active === 'number');

/* Cross layout: words fill the four corners, the secret sits between them. */
const AREAS = ['w0', 'w1', 'w2', 'w3'];
/* Per-corner accent, matched to the secret tray's rows (see LetterKeyboard). */
const CORNER_TINTS = ['var(--sky)', 'var(--rose)', 'var(--lemon)', 'var(--mint)'];

/* Slots above the wheel that fill in as the path is drawn. */
const slots = computed(() => {
  if (!wordActive.value) return [];
  const w = g.words[g.state.active];
  const cur = g.current.value;
  /* `spaceAfter` renders a gap where the answer had a space (see buildWords). */
  return w.layout.map((spaceAfter, i) => ({ ch: cur[i] || '', spaceAfter }));
});

/* Secret boxes: one per letter, filled as the player types; gap where spaced. */
const secretSlots = computed(() =>
  g.secret.layout.map((spaceAfter, i) => ({ ch: g.secretInput.value[i] || '', spaceAfter })),
);

/* Finish time, shown in the dock once the level is completed. */
const finishTime = computed(() => {
  const total = Math.round(g.elapsedMs.value / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
});

/* Remount the keyboard on each reveal so its shuffle-in animation replays. */
const revealTick = ref(0);
function openSecret() {
  revealTick.value++;
  g.activateSecret();
}

/* Flash a shake on the secret boxes when a full guess is wrong. */
const secretShaking = ref(false);
watch(
  () => g.secretShake.value,
  () => {
    secretShaking.value = true;
    setTimeout(() => (secretShaking.value = false), 400);
  },
);

/* Connector lines drawn from the secret to each of the 4 corner wheels. */
const svgEl = ref(null);
const secretEl = ref(null);
const cellEls = [];
const setCell = (el, i) => {
  if (el) cellEls[i] = el;
};
const links = reactive({ w: 0, h: 0, lines: [] });

function measureLinks() {
  const svg = svgEl.value;
  const sec = secretEl.value;
  if (!svg || !sec) return;
  const o = svg.getBoundingClientRect();
  links.w = o.width;
  links.h = o.height;
  const s = sec.getBoundingClientRect();
  const cx = s.left + s.width / 2 - o.left;
  const cy = s.top + s.height / 2 - o.top;
  links.lines = cellEls
    .map((el, i) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x1: cx,
        y1: cy,
        x2: r.left + r.width / 2 - o.left,
        y2: r.top + r.height / 2 - o.top,
        tint: CORNER_TINTS[i],
      };
    })
    .filter(Boolean);
}

let ro;
onMounted(() => {
  nextTick(measureLinks);
  ro = new ResizeObserver(measureLinks);
  if (svgEl.value) ro.observe(svgEl.value);
});
onUnmounted(() => ro?.disconnect());
/* Solved words swap a wheel for a bar; re-measure so the lines stay centred. */
watch(
  () => [...g.solved],
  () => nextTick(measureLinks),
);

/* Physical keyboard: routes to the secret keyboard or the active wheel. */
function onKeydown(e) {
  if (g.state.completed) return;
  if (g.secretActive.value) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      g.backspaceSecret();
    } else if (/^[a-zA-Zà-ÿÀ-ß]$/.test(e.key)) {
      g.typeSecret(e.key);
    }
    return;
  }
  if (!wordActive.value) return;
  if (e.key === 'Backspace') {
    e.preventDefault();
    g.backspace();
  } else if (e.key === 'Escape') {
    g.clearPath();
  } else if (e.key === 'Enter') {
    g.commit();
  } else if (e.key === ' ') {
    e.preventDefault();
    g.shuffleWheel();
  } else if (/^[a-zA-Zà-ÿÀ-ß]$/.test(e.key)) {
    g.typeLetter(e.key);
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="game">
    <header class="top">
      <button class="icon-btn" type="button" @click="router.push('/')" aria-label="niveaux">
        ←
      </button>
      <div class="spacer" />
    </header>

    <main class="board">
      <svg
        ref="svgEl"
        class="links"
        :viewBox="`0 0 ${links.w} ${links.h}`"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          v-for="(ln, i) in links.lines"
          :key="i"
          :x1="ln.x1"
          :y1="ln.y1"
          :x2="ln.x2"
          :y2="ln.y2"
          :stroke="ln.tint"
          stroke-width="5"
          stroke-linecap="round"
          opacity="0.45"
        />
      </svg>

      <template v-for="(w, i) in g.words" :key="i">
        <div
          class="cell"
          :ref="(el) => setCell(el, i)"
          :style="{ gridArea: AREAS[i], '--tint': CORNER_TINTS[i] }"
        >
          <div v-if="g.solved[i]" class="slot done">
            <span class="answer">{{ w.display }}</span>
          </div>
          <button
            v-else
            class="slot"
            :class="{ active: g.state.active === i }"
            type="button"
            @click="g.activate(i)"
          >
            <LetterWheel :tiles="g.wheelTiles(i)" :active="g.state.active === i" />
          </button>
        </div>
      </template>

      <button
        ref="secretEl"
        class="secret"
        style="grid-area: secret"
        type="button"
        :class="{ found: g.state.secretFound, active: g.secretActive.value }"
        :disabled="g.state.secretFound"
        @click="openSecret"
      >
        <span class="secret-boxes" :class="{ shake: secretShaking }">
          <span
            v-for="(s, i) in secretSlots"
            :key="i"
            class="sbox"
            :class="{ set: s.ch, 'gap-after': s.spaceAfter }"
            >{{ s.ch }}</span
          >
        </span>
      </button>
    </main>

    <div class="dock" :style="wordActive ? { '--tint': CORNER_TINTS[g.state.active] } : undefined">
      <template v-if="wordActive && !g.state.completed">
        <div class="track" :class="{ full: g.current.value.length === slots.length }">
          <span
            v-for="(s, i) in slots"
            :key="i"
            class="tick"
            :class="{ set: s.ch, 'gap-after': s.spaceAfter }"
            >{{ s.ch }}</span
          >
        </div>

        <div class="stage">
          <LetterWheel
            interactive
            active
            :tiles="g.wheelTiles(g.state.active)"
            :path="g.path"
            :shake="g.shakeSignal.value"
            @begin="g.beginPath"
            @enter="g.appendTile"
            @backtrack="g.backspace"
            @end="g.commit"
            @shuffle="g.shuffleWheel"
          />
        </div>
      </template>

      <LetterKeyboard
        v-else-if="g.secretActive.value && !g.state.completed"
        :key="revealTick"
        :rows="g.trayRows.value"
        :solved="g.solved"
        :spent="g.spentTiles.value"
        @key="g.typeSecret"
        @backspace="g.backspaceSecret"
        @clear="g.clearSecret"
      />

      <div v-else-if="g.state.completed" class="finish">
        <div class="finish-head">
          <span class="finish-mark" aria-hidden="true">✓</span>
          <span class="finish-time">{{ finishTime }}</span>
        </div>
        <button class="cta" type="button" @click="router.push('/')">Autres niveaux</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game {
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
  padding: 0.9rem 1rem 0.5rem;
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
  border: 1px solid var(--line);
  transition:
    transform 0.12s ease,
    background 0.2s ease;
}
.icon-btn:hover {
  background: var(--tile);
}
.icon-btn:active {
  transform: scale(0.92);
}
.icon-btn:focus-visible {
  outline: 2px solid var(--sky-ink);
  outline-offset: 2px;
}
.spacer {
  width: 2.6rem;
  flex: none;
}

/* Secret: a button at the centre of the cross; tapping it docks the keyboard. */
.secret {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.7rem 1rem;
  border-radius: 1.1rem;
  background: var(--panel);
  border: 2px solid color-mix(in srgb, var(--secret) 55%, var(--line));
  cursor: pointer;
  transition:
    transform 0.14s ease,
    box-shadow 0.2s ease,
    background 0.2s ease,
    border-color 0.2s ease;
}
.secret:not(.found):active {
  transform: scale(0.97);
}
.secret:focus-visible {
  outline: 2px solid var(--secret);
  outline-offset: 2px;
}
.secret.active {
  border-color: var(--secret);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--secret) 22%, transparent);
}
.secret-boxes {
  display: flex;
  gap: 0.4rem;
}
.secret-boxes.shake {
  animation: shake 0.4s ease;
}
@keyframes shake {
  10%,
  90% {
    transform: translateX(-2px);
  }
  30%,
  70% {
    transform: translateX(4px);
  }
  50% {
    transform: translateX(-5px);
  }
}
.sbox {
  width: 1.95rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  border-radius: 0.5rem;
  font-weight: 800;
  font-size: 1.35rem;
  text-transform: uppercase;
  color: var(--ink);
  background: var(--tile);
  border: 2px solid var(--line);
}
.sbox.set {
  border-color: var(--secret);
  color: var(--secret);
}
/* Secret had a space after this box: widen the gap between the parts. */
.sbox.gap-after {
  margin-right: 0.9rem;
}
/* Found: the strip locks with a solid fill in the secret's own colour. */
.secret.found {
  background: var(--secret);
  border-color: var(--secret);
}
.secret.found .sbox {
  background: color-mix(in srgb, var(--bg) 22%, var(--secret));
  border-color: transparent;
  color: var(--bg);
  animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.board {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-areas:
    'w0 w1'
    'secret secret'
    'w2 w3';
  align-content: start;
  justify-items: center;
  gap: 0.7rem;
  padding: 0.2rem 1rem 0.4rem;
}
.cell {
  position: relative;
  z-index: 1;
  width: 100%;
}
/* Faint links tying the secret to its four feeder wheels. */
.links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
.slot {
  /* Transparent wrapper: the wheel supplies its own solid disc. */
  width: 100%;
  box-sizing: border-box;
  padding: 0.4rem;
  min-height: 6.8rem;
  display: grid;
  place-items: center;
  background: none;
  border: 0;
  cursor: pointer;
  transition: transform 0.14s ease;
}
.slot:active {
  transform: scale(0.97);
}
.slot:focus-visible {
  outline: 2px solid var(--tint, var(--sky-ink));
  outline-offset: 2px;
  border-radius: 1rem;
}
.slot .wheel {
  max-width: 6.4rem;
}

/* Solved word: a compact accent pill, centred in the cell so the row keeps
   the wheel's height and nothing above/below shifts. */
.slot.done {
  cursor: default;
}
.slot.done:active {
  transform: none;
}
.answer {
  padding: 0.9rem 0.9rem;
  border-radius: 0.8rem;
  background: var(--tint);
  font-weight: 800;
  font-size: 1.05rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--bg);
  animation: answer-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes answer-in {
  from {
    transform: scale(0.7);
    opacity: 0;
  }
}

/*
 * Input zone: a fixed-height dock so the board above never reflows when the
 * player switches between a word wheel, the secret keyboard, or nothing.
 */
.dock {
  flex: none;
  min-height: 21rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  padding: 0.6rem 1rem calc(1rem + env(safe-area-inset-bottom));
}
.track {
  display: flex;
  gap: 0.35rem;
  min-height: 2.4rem;
}
.track.full {
  animation: nudge 0.3s ease;
}
.tick {
  width: 1.9rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  border-radius: 0.55rem;
  font-weight: 800;
  font-size: 1.2rem;
  text-transform: uppercase;
  color: var(--muted);
  background: var(--tile);
  border: 1.5px solid var(--line);
}
/* Word had a space after this letter: widen the gap so parts read apart. */
.tick.gap-after {
  margin-right: 1rem;
}
.tick.set {
  color: var(--bg);
  background: var(--tint, var(--sky-ink));
  border-color: transparent;
  animation: pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes pop {
  from {
    transform: scale(0.4);
  }
}
@keyframes nudge {
  50% {
    transform: translateY(-3px);
  }
}

/* Completion panel: replaces the input so the solved board stays in view. */
.finish {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.1rem;
  animation: answer-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.finish-head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.finish-mark {
  width: 2.4rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 1.3rem;
  font-weight: 900;
  color: var(--bg);
  background: var(--sky-ink);
}
.finish-time {
  font-size: 1.9rem;
  font-weight: 800;
  color: var(--sky-ink);
}
.cta {
  border: 0;
  background: var(--sky-ink);
  color: var(--bg);
  font-family: inherit;
  font-weight: 800;
  font-size: 1.02rem;
  padding: 0.85rem 1.9rem;
  border-radius: 1.1rem;
  cursor: pointer;
  transition: transform 0.12s ease;
}
.cta:active {
  transform: scale(0.96);
}
.cta:focus-visible {
  outline: 2px solid var(--sky-ink);
  outline-offset: 2px;
}

.stage {
  /*
   * Cap by the height left after the sections above the dock (header + board +
   * track + dock padding, ~30rem). The reserve is in rem, so it shrinks with the
   * root-font clamp and the whole column keeps fitting 100dvh without scrolling.
   */
  width: min(66vw, 285px, calc(100dvh - 30rem));
}
</style>
