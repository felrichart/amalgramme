<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameState, HELP_MAX } from '../composables/useGameState.js';
import { useLevel } from '../composables/useLevel.js';
import { usePlayStats } from '../composables/usePlayStats.js';
import { useCoach } from '../composables/useCoach.js';
import { useBoardLinks } from '../composables/useBoardLinks.js';
import { useShake } from '../composables/useShake.js';
import { aideHintSeen, markAideHintSeen } from '../data/tutorial.js';
import { answerSlots } from '../game/puzzle.js';
import { solvedBy } from '../utils/format.js';
import { WHEEL_TINTS } from '../palette.js';
import PageHeader from '../components/ui/PageHeader.vue';
import BulbIcon from '../components/ui/BulbIcon.vue';
import LetterWheel from '../components/LetterWheel.vue';
import LetterKeyboard from '../components/LetterKeyboard.vue';
import TutorialCoach from '../components/TutorialCoach.vue';
import AidePopup from '../components/AidePopup.vue';

const route = useRoute();
const router = useRouter();

const level = useLevel(route.params.slug, router);
const g = useGameState(level.date);
const stats = usePlayStats(level.date, () => g.state.completed);
const {
  open: coachOpen,
  step: coachStep,
  steps: coachSteps,
  next: coachNext,
  secretOpen: secretCoachOpen,
  secretSteps,
} = useCoach(g);

/* Corners hold the words, the secret sits between them. */
const AREAS = ['w0', 'w1', 'w2', 'w3'];

const isDocked = (i) => g.wordActive.value && g.state.wordIndex === i;

/* Answer boxes above the docked wheel, filled as the path is drawn. */
const slots = computed(() =>
  g.wordActive.value ? answerSlots(g.words[g.state.wordIndex], g.current.value) : [],
);
/* Secret boxes; the help-revealed leading ones are `given` (locked). */
const secretSlots = computed(() =>
  answerSlots(g.secret, g.secretInput.value).map((s, i) => ({
    ...s,
    given: i < g.state.secretReveal,
  })),
);

/* Remount the keyboard on each opening so its shuffle-in animation replays. */
const keyboardTick = ref(0);
function openSecret() {
  keyboardTick.value++;
  g.activateSecret();
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

const secretShaking = useShake(() => g.secretShake.value);

const { svgEl, secretEl, setCell, links } = useBoardLinks(WHEEL_TINTS, () => [
  ...g.solved,
  g.state.focus,
  g.state.wordIndex,
]);

/* Physical keyboard: typing goes to the secret keyboard or the docked wheel. */
const LETTER = /^[a-zA-Zà-ÿÀ-ß]$/;
function onKeydown(e) {
  if (g.state.completed || aideOpen.value) return;
  const secret = g.secretActive.value;
  if (!secret && !g.wordActive.value) return;
  if (LETTER.test(e.key)) (secret ? g.typeSecret : g.typeLetter)(e.key);
  else if (e.key === 'Backspace') {
    e.preventDefault();
    (secret ? g.backspaceSecret : g.backspace)();
  } else if (secret) return;
  else if (e.key === 'Escape') g.clearPath();
  else if (e.key === 'Enter') g.commit();
  else if (e.key === ' ') {
    e.preventDefault();
    g.shuffleWheel();
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="page fit game">
    <PageHeader :title="level.title" :back="level.back" :back-on-top="coachOpen">
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
      <div v-if="!hintSeen && canHelp" class="aide-hint" aria-hidden="true">
        <span>Nouveau&nbsp;!</span>
        <span class="aide-hint-arrow">→</span>
      </div>
    </PageHeader>

    <TutorialCoach v-if="coachOpen" :steps="coachSteps" :step="coachStep" @next="coachNext" />
    <TutorialCoach
      v-if="secretCoachOpen"
      :steps="secretSteps"
      :step="0"
      @next="secretCoachOpen = false"
    />

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
          opacity="0.8"
        />
      </svg>

      <div
        v-for="(w, i) in g.words"
        :key="i"
        :ref="(el) => setCell(el, i)"
        class="cell"
        :data-cell="i"
        :style="{ gridArea: AREAS[i], '--tint': WHEEL_TINTS[i] }"
      >
        <div v-if="g.solved[i]" class="slot done">
          <span class="answer">{{ w.display }}</span>
        </div>
        <button
          v-else
          class="slot"
          :class="{ active: isDocked(i) }"
          type="button"
          @pointerdown="g.activate(i)"
          @focus="g.activate(i)"
        >
          <LetterWheel :tiles="g.wheelTiles(i)" :active="isDocked(i)" :revealed="g.revealed[i]" />
        </button>
      </div>

      <!-- The wrapper anchors the connector lines; only the button inside moves on press. -->
      <div ref="secretEl" class="secret-cell" data-tut="secret" style="grid-area: secret">
        <button
          class="secret"
          type="button"
          :class="{ found: g.state.secretFound, active: g.secretActive.value }"
          :disabled="g.state.secretFound"
          @pointerdown="openSecret"
          @focus="openSecret"
        >
          <span class="secret-boxes" :class="{ shake: secretShaking, wrong: g.secretWrong.value }">
            <span
              v-for="(s, i) in secretSlots"
              :key="i"
              class="sbox"
              :class="{ set: s.ch && !s.given, given: s.given, 'gap-after': s.gapAfter }"
              >{{ s.ch }}</span
            >
          </span>
        </button>
      </div>
    </main>

    <div
      class="dock"
      data-tut="dock"
      :style="g.wordActive.value ? { '--tint': WHEEL_TINTS[g.state.wordIndex] } : undefined"
    >
      <template v-if="g.state.completed">
        <div class="finish">
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
      </template>

      <template v-else-if="g.wordActive.value">
        <div class="track" :class="{ full: g.current.value.length === slots.length }">
          <span
            v-for="(s, i) in slots"
            :key="i"
            class="tick"
            :class="{ set: s.ch, 'gap-after': s.gapAfter }"
            >{{ s.ch }}</span
          >
        </div>
        <div class="stage">
          <LetterWheel
            interactive
            active
            :tiles="g.wheelTiles(g.state.wordIndex)"
            :path="g.path"
            :revealed="g.revealed[g.state.wordIndex]"
            :shake="g.shakeSignal.value"
            @begin="g.clearPath"
            @enter="g.appendTile"
            @backtrack="g.backspace"
            @end="g.commit"
            @shuffle="g.shuffleWheel"
          />
        </div>
      </template>

      <LetterKeyboard
        v-else-if="g.secretActive.value"
        :key="keyboardTick"
        :rows="g.trayRows.value"
        :solved="g.solved"
        :spent="g.spentTiles.value"
        @key="g.typeSecret"
        @backspace="g.backspaceSecret"
        @clear="g.clearSecret"
      />
    </div>

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
/* One-off nudge towards the help button: faded blue text + arrow, gently pulsing. */
.aide-hint {
  position: absolute;
  top: 50%;
  right: 6rem;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #3b82f6;
  font-weight: 700;
  font-size: 0.8rem;
  white-space: nowrap;
  pointer-events: none;
  animation: aide-hint-fade 1.6s ease-in-out infinite;
}
.aide-hint-arrow {
  font-size: 1rem;
}
@keyframes aide-hint-fade {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 0.9;
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

/* Stable wrapper the connector lines anchor to; the button translates within. */
.secret-cell {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
}
/* Secret: a button at the centre of the cross; tapping it docks the keyboard. */
.secret {
  max-width: 100%;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.7rem 1rem;
  border-radius: 1.1rem;
  background: var(--accent-wash);
  border: var(--outline-w-lg) solid var(--outline);
  box-shadow: var(--pop-lg);
  cursor: pointer;
  transition:
    transform 0.1s ease,
    box-shadow 0.1s ease,
    background 0.2s ease;
}
/* Focus (keyboard): show the coin selected rather than ringed. */
.secret:focus-visible {
  outline: none;
  box-shadow: 0 0 0 var(--outline);
  transform: translate(5px, 7px);
}
/* Press: the coin drops into its offset shadow, like a keyboard key. */
.secret:active {
  transform: translate(5px, 7px);
  box-shadow: 0 0 0 var(--outline);
}
/* Selected: stays pressed into its shadow — the coin is held at the shadow
   offset so releasing the press doesn't shift it back up. */
.secret.active {
  /* Same wash as the base; press feedback stays via shadow + translate. */
  box-shadow: 0 0 0 var(--outline);
  transform: translate(5px, 7px);
}
.secret-boxes {
  display: flex;
  gap: 0.4rem;
  max-width: 100%;
  min-width: 0;
}
.secret-boxes.shake {
  animation: shake 0.4s ease;
}
.sbox {
  flex: 1 1 1.95rem;
  width: 1.95rem; /* remove the fixed width */
  min-width: 0;
  height: 2.5rem;
  display: grid;
  place-items: center;
  border-radius: 0.5rem;
  font-weight: 800;
  font-size: 1.35rem;
  text-transform: uppercase;
  font-weight: 900;
  color: var(--ink);
  background: var(--tile);
  border: var(--outline-w) solid var(--outline);
}
.sbox.set {
  color: #fff;
  background: var(--accent);
  animation: press 0.14s ease;
}
/* Help-given leading letter: pre-filled and locked, filled in the secret's accent
   like a typed letter but ringed in lime so it reads as a given clue. */
.sbox.given {
  color: #fff;
  background: var(--accent);
  border-color: var(--lime);
}
/* Wrong full guess: fade the tiles and strike each with a diagonal bar. */
.secret-boxes.wrong .sbox {
  position: relative;
  opacity: 0.75;
}
.secret-boxes.wrong .sbox::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom right,
    transparent calc(50% - 1.5px),
    var(--outline) calc(50% - 1.5px),
    var(--outline) calc(50% + 1.5px),
    transparent calc(50% + 1.5px)
  );
  opacity: 0.5;
  border-radius: inherit;
}
/* Secret had a space after this box: widen the gap between the parts. */
.sbox.gap-after {
  margin-right: 0.9rem;
}
/* Found: the strip locks solid in the secret's colour, keeping its ink outline. */
.secret.found {
  background: var(--accent);
  box-shadow: var(--pop-lg);
  /* Solved: lock the coin raised — no press/select movement, not interactive. */
  transform: none;
  cursor: default;
  pointer-events: none;
}
.secret.found .sbox {
  background: rgba(255, 255, 255, 0.22);
  border-color: transparent;
  color: #fff;
  animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.board {
  position: relative;
  flex: 1;
  min-height: 0;
  /* Clip (never scroll): the column is sized to fit 100dvh via the root-font
     clamp, so a scrollbar here is spurious. The clip-margin lets each piece's
     hard offset shadow paint past the board edge instead of being cut off —
     and avoids the overflow-y:auto → overflow-x:auto promotion that a
     right-offset shadow would otherwise turn into a horizontal scrollbar. */
  overflow: clip;
  overflow-clip-margin: 12px;
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
}
/* Press: the coin drops into its offset shadow, like a keyboard key. The
   shadow lives on the inner .wheel, so translate that rather than the wrapper. */
.slot:active .wheel {
  transform: translate(5px, 7px);
  box-shadow: 0 0 0 var(--outline);
}
/* Selected: held at the press offset so releasing doesn't shift it back up. */
.slot.active .wheel {
  transform: translate(5px, 7px);
}
/* Focus (keyboard): show the wheel selected (pressed into its shadow), not ringed. */
.slot:focus-visible {
  outline: none;
}
.slot:focus-visible .wheel {
  transform: translate(5px, 7px);
  box-shadow: 0 0 0 var(--outline);
}
.slot .wheel {
  max-width: 6.4rem;
}

/* Solved word: a compact accent pill, centred in the cell so the row keeps
   the wheel's height and nothing above/below shifts. */
.slot.done {
  cursor: default;
}
.answer {
  padding: 0.9rem 0.9rem;
  border-radius: 0.8rem;
  background: var(--tint);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop);
  font-weight: 900;
  font-size: 1.05rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #fff;
  animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/*
 * Input zone: a fixed-height dock so the board above never reflows when the
 * player switches between a word wheel, the secret keyboard, or nothing.
 */
.dock {
  flex: none;
  /* Fixed (not min): the board above must not reflow when the dock swaps
     between the word wheel, the secret keyboard, and the finish panel —
     any reflow would shift the wheels and drag the connector lines with them. */
  height: 22.5rem;
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
  max-width: 100%;
  min-width: 0;
}
.track.full {
  animation: nudge 0.3s ease;
}
.tick {
  flex: 1 1 1.9rem;
  width: 1.9rem;
  min-width: 0;
  height: 2.4rem;
  display: grid;
  place-items: center;
  border-radius: 0.55rem;
  font-weight: 900;
  font-size: 1.2rem;
  text-transform: uppercase;
  color: var(--ink);
  background: var(--tile);
  border: var(--outline-w) solid var(--outline);
}
/* Word had a space after this letter: widen the gap so parts read apart. */
.tick.gap-after {
  margin-right: 1rem;
}
.tick.set {
  color: #fff;
  background: var(--tint);
  animation: pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
/* Same press feedback as a touched wheel node (scale 1.12). */
@keyframes press {
  50% {
    transform: scale(1.12);
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

.stage {
  /*
   * Cap by the height left after the sections above the dock (header + board +
   * track + dock padding, ~30rem). The reserve is in rem, so it shrinks with the
   * root-font clamp and the whole column keeps fitting 100dvh without scrolling.
   */
  width: min(66vw, 285px, calc(100dvh - 30rem));
}
</style>
