<script setup>
import { computed, ref, reactive, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameState, resetLevel } from '../composables/useGameState.js';
import {
  todayDate,
  TUTORIAL_DATE,
  puzzleForDate,
  dateForSlug,
  slugForDate,
  olderDate,
  formatChallengeDate,
} from '../data/challenges.js';
import {
  isCommunityId,
  communityRecord,
  challengesByAuthor,
  COMMUNITY_PREFIX,
} from '../data/community.js';
import { dailyRecord } from '../data/dailies.js';
import { recordAttempt, recordSolve, loadCommunityLevels } from '../services/community.js';
import {
  recordAttempt as recordDailyAttempt,
  recordSolve as recordDailySolve,
  loadDailies,
} from '../services/dailies.js';
import LetterWheel from '../components/LetterWheel.vue';
import LetterKeyboard from '../components/LetterKeyboard.vue';
import TutorialCoach from '../components/TutorialCoach.vue';
import { WHEEL_TINTS } from '../palette.js';

const route = useRoute();
const router = useRouter();

/* Resolve the route slug to a puzzle date. Unknown slug → menu; a future
 * (not-yet-released) puzzle → today's daily. Either way fall back to today so
 * this (about-to-be-replaced) render stays valid. */
const today = todayDate();
const requested = dateForSlug(route.params.slug);
const isCommunity = isCommunityId(requested);
const playable =
  !!puzzleForDate(requested) && (requested === TUTORIAL_DATE || isCommunity || requested <= today);
if (!puzzleForDate(requested)) router.replace(isCommunity ? '/community' : '/');
else if (!playable) router.replace('/play/daily');
const date = playable ? requested : today;

const isTutorial = date === TUTORIAL_DATE;
const isDaily = !isCommunity && date === today;
/* The tutorial always starts fresh — wipe its saved state before state loads. */
if (isTutorial) resetLevel(date);

/* Community level: resolve its author + display number for the title/back link. */
const community = isCommunity ? communityRecord(date) : null;
const communityNumber = community
  ? (challengesByAuthor(community.author).find((c) => c.id === community.id)?.number ?? null)
  : null;

const title = isTutorial
  ? 'Tutoriel'
  : isDaily
    ? 'Défi quotidien'
    : isCommunity
      ? `Défi de ${community?.author ?? ''}${communityNumber ? ` #${communityNumber}` : ''}`
      : formatChallengeDate(date);
/* Back lands where the player likely came from: menu for daily/tutorial, the
 * author's list for community, the challenge list otherwise. */
const backTo =
  isDaily || isTutorial
    ? '/'
    : isCommunity
      ? `/community/${community?.author ?? ''}`
      : '/challenges';

/* Coach popups over the board. Steps alternate between "action" (advances when
 * the parent sees the taught gesture) and "manual" (a Suivant button). It can't
 * be skipped — it ends only once the player reaches the last step's gesture. */
const coachOpen = ref(isTutorial);
const coachStep = ref(0);
const WHEELS = [0, 1, 2, 3].map((i) => `[data-cell="${i}"] .wheel`);

const tutorialSteps = [
  {
    holes: WHEELS,
    html: 'Il y a 4 <span style="color:var(--gold);font-weight:900">indices</span>, dont les lettres sont mélangées.',
  },
  {
    selector: '[data-tut="dock"]',
    shape: 'rect',
    text: 'Glisse d’une lettre à l’autre pour écrire le mot.',
  },
  {
    selector: '[data-cell="0"]',
    manual: true,
    html: 'Bravo, plus que 3 <span style="color:var(--gold);font-weight:900">indices</span> à trouver !',
  },
  {
    selector: '[data-tut="secret"]',
    shape: 'rect',
    manual: true,
    cta: 'Compris',
    html: 'Devine le <strong>mot énigme</strong> au centre grâce aux 4 indices.',
  },
];
function coachNext() {
  if (coachStep.value >= tutorialSteps.length - 1) coachOpen.value = false;
  else coachStep.value++;
}

/* A lone popup, split from the main walkthrough: it fires the first time the
 * player opens the secret keyboard, once the main coach is done. Single step,
 * so no advancement dots. */
const secretCoachOpen = ref(false);
let secretCoachSeen = false;
const secretCoachSteps = [
  {
    selector: '[data-tut="dock"]',
    shape: 'rect',
    manual: true,
    cta: 'Compris',
    html: 'Appuie sur les lettres pour taper le <strong>mot énigme</strong>.',
  },
];

/* The challenge one day older, mirroring the newest-first list; null at the
 * oldest, where the "next" button is hidden. */
const older = olderDate(date);
function goOlderChallenge() {
  if (older) router.push(`/play/${slugForDate(older)}`);
}

/* The next community challenge by the same author, in reverse order (the one
 * below in their newest-first list); null when this is their oldest. */
const communityNext = (() => {
  if (!isCommunity || !community) return null;
  const list = challengesByAuthor(community.author);
  const i = list.findIndex((c) => c.id === community.id);
  return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
})();
function goCommunityNext() {
  if (communityNext) router.push(`/play/${COMMUNITY_PREFIX}${communityNext.id}`);
}

const g = useGameState(date);

/* Play stats for the finish screen — community levels and dailies both carry
 * attempts/successes; null for the tutorial. The cached seed is floored to 1
 * (reaching the finish panel proves this player attempted and solved) so it
 * never flashes "0 sur 0"; refreshFinishStats then replaces it with the exact
 * server count once this solve has been recorded. */
const statRecord = isCommunity ? community : isTutorial ? null : dailyRecord(date);
const finishStats = ref(
  statRecord && {
    attempts: Math.max(statRecord.attempts ?? 0, 1),
    successes: Math.max(statRecord.successes ?? 0, 1),
  },
);

/* Refetch this level's stats and show the exact counts. Called after the solve
 * post settles, so the server has counted this player (a solve inserts a stat
 * row even without a prior attempt, so both numbers include them). */
async function refreshFinishStats() {
  if (isTutorial) return;
  if (isCommunity) await loadCommunityLevels(0);
  else await loadDailies(0);
  const rec = isCommunity ? communityRecord(date) : dailyRecord(date);
  if (rec) finishStats.value = { attempts: rec.attempts ?? 0, successes: rec.successes ?? 0 };
}

/* Community play stats: count this player's attempt on open (no sign-in needed)
 * and their success on completion. Both are deduped per device, so a revisit or
 * an already-finished level costs at most one no-op call. */
if (isCommunity && community) {
  recordAttempt(community.id);
  if (g.state.completed) recordSolve(community.id).then(refreshFinishStats);
  else
    watch(
      () => g.state.completed,
      (done) => done && recordSolve(community.id).then(refreshFinishStats),
    );
}

/* Daily play stats (today's daily or a past one): same anonymous per-device
 * count as community, keyed by the puzzle date. Excludes the tutorial. */
if (!isCommunity && !isTutorial) {
  recordDailyAttempt(date);
  if (g.state.completed) recordDailySolve(date).then(refreshFinishStats);
  else
    watch(
      () => g.state.completed,
      (done) => done && recordDailySolve(date).then(refreshFinishStats),
    );
}

/* Tutorial: the intro's one action step (writing the first word) advances when
 * a word is solved; the rest advance via Suivant/Compris. */
if (isTutorial) {
  watch(
    () => g.solved.filter(Boolean).length,
    (n, o) => {
      if (coachOpen.value && coachStep.value === 1 && n > o) coachStep.value = 2;
    },
  );
  /* Reveal the keyboard popup on the first secret focus after the walkthrough. */
  watch(
    () => g.secretActive.value,
    (active) => {
      if (active && !secretCoachSeen && !coachOpen.value) {
        secretCoachSeen = true;
        nextTick(() => (secretCoachOpen.value = true));
      }
    },
  );
}

/* A word wheel is docked when the active target is a word (not the secret). */
const wordActive = g.wordActive;

/* Cross layout: words fill the four corners, the secret sits between them. */
const AREAS = ['w0', 'w1', 'w2', 'w3'];

/* Slots above the wheel that fill in as the path is drawn. */
const slots = computed(() => {
  if (!wordActive.value) return [];
  const w = g.words[g.state.wordIndex];
  const cur = g.current.value;
  /* `spaceAfter` renders a gap where the answer had a space (see buildWords). */
  return w.layout.map((spaceAfter, i) => ({ ch: cur[i] || '', spaceAfter }));
});

/* Secret boxes: one per letter, filled as the player types; gap where spaced. */
const secretSlots = computed(() =>
  g.secret.layout.map((spaceAfter, i) => ({ ch: g.secretInput.value[i] || '', spaceAfter })),
);

/* Remount the keyboard on each reveal so its shuffle-in animation replays. */
const revealTick = ref(0);
function openSecret() {
  revealTick.value++;
  g.activateSecret();
}

/* Flash a shake on the secret boxes when a full guess is wrong. */
const secretShaking = ref(false);
let secretShakeTimer = null;
watch(
  () => g.secretShake.value,
  () => {
    secretShaking.value = true;
    clearTimeout(secretShakeTimer);
    secretShakeTimer = setTimeout(() => (secretShaking.value = false), 400);
  },
);
onUnmounted(() => clearTimeout(secretShakeTimer));

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
        tint: WHEEL_TINTS[i],
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
/* Re-measure on selection changes too, so the links stay pinned to each disc. */
watch(
  () => [wordActive.value, g.secretActive.value, g.state.wordIndex],
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
      <button
        class="icon-btn"
        :class="{ 'over-coach': coachOpen }"
        type="button"
        @click="router.push(backTo)"
        aria-label="retour"
      >
        ←
      </button>
      <h1 class="title">{{ title }}</h1>
      <span class="icon-btn spacer" aria-hidden="true"></span>
    </header>

    <TutorialCoach v-if="coachOpen" :steps="tutorialSteps" :step="coachStep" @next="coachNext" />
    <TutorialCoach
      v-if="secretCoachOpen"
      :steps="secretCoachSteps"
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

      <template v-for="(w, i) in g.words" :key="i">
        <div
          class="cell"
          :ref="(el) => setCell(el, i)"
          :data-cell="i"
          :style="{ gridArea: AREAS[i], '--tint': WHEEL_TINTS[i] }"
        >
          <div v-if="g.solved[i]" class="slot done">
            <span class="answer">{{ w.display }}</span>
          </div>
          <button
            v-else
            class="slot"
            :class="{ active: wordActive && g.state.wordIndex === i }"
            type="button"
            @click="g.activate(i)"
            @focus="g.activate(i)"
          >
            <LetterWheel :tiles="g.wheelTiles(i)" :active="wordActive && g.state.wordIndex === i" />
          </button>
        </div>
      </template>

      <!-- Wrapper stays put; the button inside translates on press so the
           connector lines (anchored here) don't shift when it's selected. -->
      <div ref="secretEl" class="secret-cell" data-tut="secret" style="grid-area: secret">
        <button
          class="secret"
          type="button"
          :class="{ found: g.state.secretFound, active: g.secretActive.value }"
          :disabled="g.state.secretFound"
          @click="openSecret"
          @focus="openSecret"
        >
          <span class="secret-boxes" :class="{ shake: secretShaking, wrong: g.secretWrong.value }">
            <span
              v-for="(s, i) in secretSlots"
              :key="i"
              class="sbox"
              :class="{ set: s.ch, 'gap-after': s.spaceAfter }"
              >{{ s.ch }}</span
            >
          </span>
        </button>
      </div>
    </main>

    <div
      class="dock"
      data-tut="dock"
      :style="wordActive ? { '--tint': WHEEL_TINTS[g.state.wordIndex] } : undefined"
    >
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
            :tiles="g.wheelTiles(g.state.wordIndex)"
            :path="g.path"
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
          <span class="finish-bravo">Bravo</span>
        </div>
        <p v-if="finishStats" class="finish-stats">
          Réussi par {{ finishStats.successes }} joueur{{
            finishStats.successes > 1 ? 's' : ''
          }}
          sur {{ finishStats.attempts }}
        </p>
        <div class="finish-actions">
          <template v-if="isTutorial">
            <button class="cta cta-ghost" type="button" @click="router.push('/')">
              Retour au menu
            </button>
          </template>
          <template v-else-if="isDaily">
            <button class="cta cta-wash" type="button" @click="router.push('/challenges')">
              Défis passés
            </button>
            <button class="cta cta-ghost" type="button" @click="router.push('/')">
              Retour au menu
            </button>
          </template>
          <template v-else-if="isCommunity">
            <button
              v-if="communityNext"
              class="cta cta-community"
              type="button"
              @click="goCommunityNext"
            >
              Prochain défi
            </button>
            <button class="cta cta-ghost" type="button" @click="router.push(backTo)">Liste</button>
          </template>
          <template v-else>
            <button v-if="older" class="cta" type="button" @click="goOlderChallenge">
              Prochain défi
            </button>
            <button class="cta cta-ghost" type="button" @click="router.push('/challenges')">
              Liste des défis
            </button>
          </template>
        </div>
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
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.icon-btn:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
.icon-btn:focus-visible {
  outline: 2px solid var(--outline);
  outline-offset: 2px;
}
/* Balances the back button so the title stays centred. */
.icon-btn.spacer {
  visibility: hidden;
  pointer-events: none;
  box-shadow: none;
}
/* During the tutorial the coach overlay (z 60) covers everything; keep the
   back button above it so leaving is always one tap away. */
.icon-btn.over-coach {
  position: relative;
  z-index: 61;
}
.title {
  flex: 1;
  margin: 0;
  text-align: center;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--ink);
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
/* Wrong full guess: fade the tiles and strike each with a diagonal bar. */
.secret-boxes.wrong .sbox {
  position: relative;
  opacity: 0.45;
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
@keyframes pop {
  from {
    transform: scale(0.4);
  }
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
  animation: answer-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
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
.cta {
  background: var(--accent);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 1.02rem;
  padding: 0.85rem 1.9rem;
  border-radius: 1.1rem;
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop);
  cursor: pointer;
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.cta-wash {
  background: var(--accent-wash);
  color: var(--ink);
}
.cta-ghost {
  background: var(--panel);
  color: var(--ink);
}
.cta-community {
  background: var(--violet);
}
.cta:active {
  transform: translate(4px, 5px);
  box-shadow: 0 0 0 var(--outline);
}
/* Focus (keyboard): show the button pressed rather than ringed. */
.cta:focus-visible {
  outline: none;
  transform: translate(4px, 5px);
  box-shadow: 0 0 0 var(--outline);
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
