<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '../../src/components/ui/PageHeader.vue';
import ConfirmModal from '../../src/components/ui/ConfirmModal.vue';
import { useShake } from '../../src/composables/useShake.js';
import { LEVELS, levelByPattern } from './levels.js';
import { BLANK, maxScore, tierOf, wordHint } from './game.js';
import { useLexilouhette } from './useLexilouhette.js';
import { definitionOf } from './definitions.js';
import LexKeyboard from './LexKeyboard.vue';

const route = useRoute();
const router = useRouter();

const level = levelByPattern(route.params.pattern);
const index = LEVELS.findIndex((l) => l.pattern === level.pattern);
const nav = {
  title: `${index + 1} / ${LEVELS.length}`,
  back: '/lexilouhette',
  next: LEVELS[index + 1] && `/lexilouhette/${LEVELS[index + 1].pattern}`,
};
const g = useLexilouhette(level);
const max = maxScore(level);
const shaking = useShake(() => g.shake.value);

/*
 * Scoring animation: a "+points" springs up from the word just found and flies
 * into the gauge; on arrival the gauge bumps and its number climbs one by one,
 * the fill following it. `shown` lags the real score until the climb catches up.
 */
const CLIMB_RATE = 0.35; // points per ms
const shown = ref(g.score.value);
const fill = computed(() => `${100 - (100 * shown.value) / max}%`);
const bump = ref(0);
const bumping = useShake(() => bump.value, 450);
let target = g.score.value;
let climb = 0;
let last = 0;
function tick(now) {
  const step = Math.max(1, Math.round((now - last) * CLIMB_RATE));
  shown.value = Math.min(target, shown.value + step);
  last = now;
  climb = shown.value < target ? requestAnimationFrame(tick) : 0;
}
function gain(points) {
  target += points;
  bump.value++;
  if (!climb) {
    last = performance.now();
    climb = requestAnimationFrame(tick);
  }
}
onUnmounted(() => cancelAnimationFrame(climb));

const gaugeEl = ref(null);
const floaters = ref([]);
let floaterId = 0;
const center = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const clampY = (y) => {
  const list = listEl.value.getBoundingClientRect();
  return Math.min(list.bottom, Math.max(list.top, y));
};

/*
 * A word found flies out of the silhouette into its row, hidden until it lands;
 * then its "+points", if any, springs up there and flies into the gauge.
 */
const silhouetteEl = ref(null);
const landing = ref([]);
const flights = ref([]);
let flightId = 0;
watch(
  () => g.feedback.value,
  async (f) => {
    if (!f || f.kind === 'unknown') return;
    const family = familyOf(f.key);
    const isExtra = family.extras.some((w) => w.key === f.key);
    if (f.kind === 'dup') {
      if (isExtra) open.value = family.lemma;
      return;
    }
    open.value = isExtra ? family.lemma : null;
    landing.value.push(f.key);
    await nextTick();
    await refit();
    const text = listEl.value?.querySelector(`[data-key="${f.key}"] .text`);
    if (!text) return land(f);
    const cell = silhouetteEl.value.querySelector('.cell');
    const size = parseFloat(getComputedStyle(text).fontSize);
    const { x, y } = center(text);
    flights.value.push({
      id: ++flightId,
      f,
      text: level.answers.get(f.key).display,
      x,
      y: clampY(y),
      from: center(silhouetteEl.value),
      scale: parseFloat(getComputedStyle(cell).fontSize) / size,
      size,
    });
  },
);
// Ref callback: runs once per new flight element.
const gliding = new WeakSet();
function glide(el, fl) {
  if (!el || gliding.has(el)) return;
  gliding.add(el);
  const at = (dx, dy, scale) =>
    `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`;
  const anim = el.animate(
    [{ transform: at(fl.from.x - fl.x, fl.from.y - fl.y, fl.scale) }, { transform: at(0, 0, 1) }],
    { duration: 480, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' },
  );
  anim.onfinish = () => {
    flights.value = flights.value.filter((x) => x.id !== fl.id);
    land(fl.f);
  };
}
function land(f) {
  landing.value = landing.value.filter((k) => k !== f.key);
  if (!f.points) return;
  const row = listEl.value?.querySelector(`[data-key="${f.key}"]`);
  if (!row) return gain(f.points);
  const { x, y } = center(row.querySelector('.pts') ?? row);
  floaters.value.push({
    id: ++floaterId,
    points: f.points,
    tier: tierOf(f.points),
    x,
    y: clampY(y),
  });
}
// Ref callback: runs once per new floater element.
const flying = new WeakSet();
function fly(el, f) {
  if (!el || flying.has(el)) return;
  flying.add(el);
  const to = center(gaugeEl.value);
  const at = (dx, dy, scale) =>
    `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`;
  const anim = el.animate(
    [
      { transform: at(0, 0, 0.4), opacity: 0 },
      { transform: at(0, 0, 1.25), opacity: 1, offset: 0.25 },
      { transform: at(0, 0, 1), opacity: 1, offset: 0.5 },
      { transform: at(to.x - f.x, to.y - f.y, 0.6), opacity: 0.5 },
    ],
    { duration: 950, easing: 'ease-in-out' },
  );
  anim.onfinish = () => {
    floaters.value = floaters.value.filter((x) => x.id !== f.id);
    gain(f.points);
  };
}

// Colour per 100-point tier, cool to hot: periwinkle, sage, mustard, rose, red.
const TINTS = ['var(--violet)', 'var(--teal)', 'var(--gold)', 'var(--pink)', 'var(--danger)'];

// A word still to find: the silhouette, its known letters lowercase like the words.
const ghost = [...level.pattern].map((ch) => (ch === BLANK ? ch : ch.toLowerCase()));

/*
 * A family's later finds show under its spot only while it's open: one family at
 * a time, the one just added to, until a word from another one is found. Tapping
 * a family opens or closes it.
 */
const open = ref(null);
const familyOf = (key) => {
  const { lemma } = level.answers.get(key);
  return g.families.value.find((f) => f.lemma === lemma);
};
function toggle(f) {
  if (f.extras.length) open.value = open.value === f.lemma ? null : f.lemma;
}
watch(open, async () => {
  await nextTick();
  await refit();
  placeHint();
});

/*
 * A bubble with a found word's lemma (wordHint) and, once fetched, its definition:
 * on hover with a mouse, on tap otherwise. Tapping a family's spot also folds or
 * unfolds it, but tapping one of its later finds keeps it open (folding would
 * hide the word).
 */
const HINT_MARGIN = 8; // px kept from the screen edges
const hint = ref(null);
const hintEl = ref(null);
let hintTarget = null;
function showHint(el, w) {
  if (hint.value?.key === w.key && hintTarget === el) return;
  hintTarget = el;
  // `definition`: undefined while fetching, null when there's none, false when the
  // request failed (nothing to show then).
  hint.value = { key: w.key, ...wordHint(w), definition: undefined };
  placeHint();
  const settle = (definition) => {
    if (hint.value?.key !== w.key) return;
    hint.value.definition = definition;
    placeHint();
  };
  definitionOf(hint.value.lemma).then(settle, () => settle(false));
}
function hideHint() {
  hint.value = null;
  hintTarget = null;
}
/* Above the word's letters (below when there's no room), centred on them unless
 * that spills off screen. */
async function placeHint() {
  if (!hint.value) return;
  await nextTick();
  const el = hintEl.value;
  if (!el || !hintTarget?.isConnected) return hideHint();
  const range = document.createRange();
  range.selectNodeContents(hintTarget);
  const r = range.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const w = el.offsetWidth;
  const left = Math.min(Math.max(HINT_MARGIN, x - w / 2), innerWidth - HINT_MARGIN - w);
  const below = r.top - el.offsetHeight - 2 * HINT_MARGIN < 0;
  el.classList.toggle('below', below);
  el.style.left = `${left}px`;
  el.style.top = `${below ? r.bottom : r.top}px`;
  el.style.setProperty('--tail', `${x - left}px`);
}
const hintOn = (w, extra = false) => ({
  pointerenter: (e) => e.pointerType === 'mouse' && showHint(e.currentTarget, w),
  pointerleave: (e) => e.pointerType === 'mouse' && hideHint(),
  click: (e) => {
    if (extra) e.stopPropagation();
    if (e.pointerType !== 'mouse' && hint.value?.key === w.key) hideHint();
    else showHint(e.currentTarget, w);
  },
});
// A tap anywhere but on the word closes the bubble; a tap on it toggles it.
const outsideHint = (e) => e.target.closest?.('.text') !== hintTarget && hideHint();
onMounted(() => window.addEventListener('pointerdown', outsideHint));
onUnmounted(() => window.removeEventListener('pointerdown', outsideHint));

const dup = computed(() => (g.feedback.value?.kind === 'dup' ? g.feedback.value.key : null));
const rowState = (key) =>
  key && {
    latest: key === g.latest.value,
    flash: key === dup.value,
    landing: landing.value.includes(key),
  };

const status = computed(() => {
  if (g.state.revealed) return { text: 'Solutions révélées' };
  if (g.exhausted.value) return { text: 'Toutes les familles trouvées, bravo !', tone: 'good' };
  const f = g.feedback.value;
  if (f?.kind === 'new') {
    const word = level.answers.get(f.key).display;
    return { text: f.points ? `${word} +${f.points}` : `${word} · même famille`, tone: 'good' };
  }
  if (f?.kind === 'dup') return { text: 'Déjà trouvé', tone: 'bad' };
  if (f?.kind === 'unknown') return { text: 'Pas dans le dictionnaire', tone: 'bad' };
  if (!g.state.found.length) return { text: 'Complète les cases vides' };
  return { text: '' };
});

/*
 * Columns: the fewest that show every spot without scrolling, as long as each
 * stays wide enough for the level's widest word and its points; failing that,
 * the same with smaller text, and past the smallest the list scrolls. Every word
 * gets that width, so the points line up.
 */
const listEl = ref(null);
const wordsEl = ref(null);
const cols = ref(2);
const textSize = ref(0);
const scrolls = ref(false);
const wordWidth = ref(0);
// List text sizes to try, in rem, largest first.
const TEXT_SIZES = [1.05, 0.95, 0.85];
// Room a row needs besides its word, in em: points, folded count, padding, column gap.
const ROW_EXTRA = 4.6;

function widestWord(style) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `800 ${style.fontSize} ${style.fontFamily}`;
  // Each gap of a word still to find is about as wide as an "n".
  const silhouette = level.pattern.replaceAll(BLANK, 'n').toLowerCase();
  const words = [silhouette, ...[...level.answers.values()].map((a) => a.display)];
  const widths = words.map((w) => ctx.measureText(w).width);
  return Math.ceil(Math.max(...widths));
}

async function fitColumns() {
  const el = wordsEl.value;
  if (!el) return;
  await document.fonts.ready;
  scrolls.value = false;
  for (const size of TEXT_SIZES) {
    textSize.value = size;
    await nextTick();
    const style = getComputedStyle(el);
    wordWidth.value = widestWord(style);
    const minWidth = wordWidth.value + ROW_EXTRA * parseFloat(style.fontSize);
    for (let k = 2; k === 2 || el.clientWidth / k >= minWidth; k++) {
      cols.value = k;
      await nextTick();
      if (el.scrollWidth <= el.clientWidth + 1) return;
    }
    cols.value = Math.max(2, cols.value - 1);
  }
  scrolls.value = true;
}
/* Refits once a family's extra word no longer fits. */
async function refit() {
  const el = wordsEl.value;
  if (el && !scrolls.value && el.scrollWidth > el.clientWidth + 1) await fitColumns();
}
const resizes = new ResizeObserver(() => fitColumns());
onMounted(() => resizes.observe(listEl.value));
onUnmounted(() => resizes.disconnect());

// Keep the highlighted word in view when the list scrolls.
watch(
  () => g.latest.value,
  async (key) => {
    if (!key) return;
    await nextTick();
    const chip = listEl.value?.querySelector(`[data-key="${key}"]`);
    chip?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
);

const confirming = ref(false);
function reveal() {
  confirming.value = false;
  g.reveal();
}

const LETTER = /^[a-zA-Zà-ÿÀ-ß]$/;
function onKeydown(e) {
  if (confirming.value || e.metaKey || e.ctrlKey || e.altKey) return;
  hideHint();
  if (LETTER.test(e.key)) g.type(e.key);
  else if (e.key === 'Backspace') {
    e.preventDefault();
    g.backspace();
  } else if (e.key === 'ArrowLeft') g.step(-1);
  else if (e.key === 'ArrowRight') g.step(1);
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="page fit lex">
    <PageHeader :title="nav.title" :back="nav.back" back-label="niveaux" />
    <div class="score-row">
      <div
        ref="gaugeEl"
        class="gauge"
        :class="{ bump: bumping }"
        role="meter"
        aria-label="score"
        :aria-valuenow="g.score.value"
        aria-valuemin="0"
        :aria-valuemax="max"
      >
        <span class="gauge-value">{{ shown }}</span>
        <span class="gauge-value gauge-fill" :style="{ '--rest': fill }" aria-hidden="true">
          {{ shown }}
        </span>
      </div>
      <span
        v-for="f in floaters"
        :key="f.id"
        :ref="(el) => fly(el, f)"
        class="floater"
        :class="{ big: f.tier >= 3 }"
        :style="{ left: `${f.x}px`, top: `${f.y}px`, '--tint': TINTS[f.tier] }"
        aria-hidden="true"
        >+{{ f.points }}</span
      >
      <span
        v-for="fl in flights"
        :key="fl.id"
        :ref="(el) => glide(el, fl)"
        class="flight"
        :style="{ left: `${fl.x}px`, top: `${fl.y}px`, fontSize: `${fl.size}px` }"
        aria-hidden="true"
        >{{ fl.text }}</span
      >
    </div>

    <section ref="listEl" class="found" :class="{ scrolls }" @scroll="hideHint">
      <ul
        ref="wordsEl"
        class="words"
        :style="{ '--cols': cols, '--word-w': `${wordWidth}px`, fontSize: `${textSize}rem` }"
      >
        <li
          v-for="f in g.families.value"
          :key="f.lemma"
          class="family"
          :class="{ foldable: f.extras.length }"
          :style="{ '--tint': TINTS[f.tier] }"
          @click="toggle(f)"
        >
          <span class="word" :data-key="f.lead?.key" :class="rowState(f.lead?.key)">
            <span v-if="f.lead" class="text" v-on="hintOn(f.lead)">{{ f.lead.display }}</span>
            <span v-else-if="g.state.revealed" class="text missed" v-on="hintOn(f.main)">{{
              f.main.display
            }}</span>
            <span v-else class="ghost" aria-label="mot à trouver">
              <template v-for="(ch, j) in ghost" :key="j">
                <span v-if="ch === BLANK" class="gap" />
                <template v-else>{{ ch }}</template>
              </template>
            </span>
            <span v-if="f.lead || g.state.revealed" class="pts" :class="{ unearned: !f.lead }">{{
              f.points
            }}</span>
            <span v-if="f.extras.length && open !== f.lemma" class="more">
              +{{ f.extras.length }}
            </span>
          </span>
          <span
            v-for="w in open === f.lemma ? f.extras : []"
            :key="w.key"
            :data-key="w.key"
            class="word extra"
            :class="rowState(w.key)"
          >
            <span class="text" v-on="hintOn(w, true)">{{ w.display }}</span>
          </span>
        </li>
      </ul>
    </section>
    <span v-if="hint" ref="hintEl" :key="hint.key" class="hint" aria-hidden="true">
      <span class="hint-lemma"
        >{{ hint.lead }}<em>{{ hint.lemma }}</em></span
      >
      <span v-if="hint.definition === undefined" class="spinner" aria-label="chargement" />
      <span v-else-if="hint.definition" class="hint-def">{{ hint.definition }}</span>
      <em v-else-if="hint.definition === null" class="hint-def">définition manquante</em>
    </span>

    <section class="play">
      <div
        ref="silhouetteEl"
        class="silhouette"
        :class="{ shake: shaking, wrong: g.rejected.value }"
        :style="{ '--n': g.slots.value.length }"
      >
        <button
          v-for="(s, i) in g.slots.value"
          :key="i"
          class="cell"
          :class="{
            fixed: s.fixed,
            set: !s.fixed && s.ch,
            caret: !s.fixed && g.playing.value && s.b === g.cursor.value,
          }"
          type="button"
          tabindex="-1"
          :disabled="s.fixed || !g.playing.value"
          @click="g.moveTo(s.b)"
        >
          {{ s.ch }}
        </button>
      </div>

      <p class="status" :class="status.tone">{{ status.text }}</p>

      <template v-if="g.playing.value">
        <LexKeyboard @key="g.type" @back="g.backspace" />
        <button class="reveal" type="button" @click="confirming = true">Voir les solutions</button>
      </template>
      <div v-else class="end">
        <button v-if="nav.next" class="cta press" type="button" @click="router.replace(nav.next)">
          Niveau suivant
        </button>
        <button class="cta ghost press" type="button" @click="router.push(nav.back)">
          Tous les niveaux
        </button>
      </div>
    </section>

    <ConfirmModal
      v-if="confirming"
      title="Voir les solutions ? Le niveau s'arrête là."
      confirm-label="Voir"
      @cancel="confirming = false"
      @confirm="reveal"
    />
  </div>
</template>

<style scoped>
.score-row {
  display: flex;
  justify-content: center;
  padding: 0.1rem 1rem 0.5rem;
}
/* Score gauge: a navy fill growing from the left, over which the number turns white. */
.gauge {
  position: relative;
  width: min(80%, 21rem);
  height: 2.3rem;
  overflow: hidden;
  border: var(--outline-w) solid var(--outline);
  border-radius: 999px;
  background: var(--panel);
  box-shadow: var(--lift-sm);
}
.gauge.bump {
  animation: bump 0.45s ease;
}
.gauge-value {
  display: grid;
  place-items: center;
  height: 100%;
  font-weight: 900;
  font-size: 1.2rem;
  color: var(--ink);
}
.gauge-fill {
  position: absolute;
  inset: 0;
  background: var(--ink);
  color: #fff;
  clip-path: inset(0 var(--rest) 0 0);
}
@keyframes bump {
  30% {
    transform: scale(1.08);
  }
}

/* One spot per family, alphabetical down the columns; scrolls once it outgrows
   the space. */
.found {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.found.scrolls {
  overflow-y: auto;
}
/* Filled column by column, top to bottom; fitColumns() picks how many. Placed
   absolutely so the columns get a fixed height to break at. */
.words {
  position: absolute;
  inset: 0.6rem;
  list-style: none;
  margin: 0;
  padding: 0;
  columns: var(--cols);
  column-fill: auto;
  column-gap: 0.6em;
}
.scrolls .words {
  position: static;
  margin: 0.6rem;
  column-fill: balance;
}
/* A family's spot, and under it its other words once found. */
.family {
  break-inside: avoid;
  margin-bottom: 0.1em;
}
/* A spot: its first word found (or the silhouette until then), then its points.
   Every spot is as tall and its word box as wide, so the points line up. */
.word {
  display: grid;
  grid-template-columns: calc(var(--word-w) + 0.3em) auto auto;
  align-items: center;
  column-gap: 0.15em;
  width: fit-content;
  height: 1.7em;
  padding: 0 0.15em 0 0.25em;
  border-radius: 0.5em;
  font-weight: 800;
  line-height: 1;
  color: var(--ink);
  white-space: nowrap;
}
.text {
  overflow: hidden;
  text-overflow: ellipsis;
}
/* How many later finds a closed family holds. */
.more {
  margin-left: 0.25em;
  padding: 0 0.35em;
  border: 1.5px solid color-mix(in srgb, var(--ink) 30%, transparent);
  border-radius: 999px;
  font-size: 0.62em;
  font-weight: 800;
  color: color-mix(in srgb, var(--ink) 60%, transparent);
}
.family.foldable {
  cursor: pointer;
}
/* A family's later finds: smaller, pointless, hanging off its spot. */
.word.extra {
  display: flex;
  align-items: baseline;
  height: 1.35em;
  margin-top: -0.15em;
  font-size: 0.8em;
  font-weight: 700;
  color: color-mix(in srgb, var(--ink) 70%, transparent);
}
.word.extra::before {
  content: '∟';
  flex: none;
  width: 0.9em;
  font-weight: 400;
  color: color-mix(in srgb, var(--ink) 35%, transparent);
}
/* Its row stays empty while a found word flies in. */
.word.landing {
  visibility: hidden;
}
/* A word still to find: its known letters, faded, and a line on the baseline per blank. */
.ghost {
  overflow: hidden;
  color: color-mix(in srgb, var(--ink) 45%, transparent);
}
.gap {
  display: inline-block;
  width: 0.5em;
  margin: 0 0.05em;
  border-bottom: 2px solid color-mix(in srgb, var(--ink) 40%, transparent);
}
/* Shown by the reveal: faded, they don't count. */
.missed {
  color: var(--muted);
  font-weight: 700;
}
/* The word's points, in the colour of their 100-point tier. */
.pts {
  justify-self: start;
  min-width: 2.2em;
  padding: 0.15em 0.35em;
  border-radius: 999px;
  text-align: center;
  font-size: 0.7em;
  font-weight: 900;
  color: var(--on-color);
  background: var(--tint);
}
/* What a word shown by the reveal would have brought. */
.pts.unearned {
  opacity: 0.4;
}
.word.flash {
  animation: shake 0.4s ease;
}
/* The word just found or retyped: ringed until the next one. */
.word.latest {
  outline: 2px solid var(--ink);
}

.play {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 0.8rem 0.6rem calc(1rem + env(safe-area-inset-bottom));
  border-top: 1px solid var(--line);
}

/* The lemma bubble, placed above its word by placeHint() (or below it), its tail
   pointing at the word. */
.hint {
  position: fixed;
  z-index: 60;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  max-width: calc(100vw - 16px);
  padding: 0.3rem 0.6rem;
  border: var(--outline-w) solid var(--outline);
  border-radius: 0.7rem;
  background: var(--panel);
  box-shadow: var(--lift-sm);
  top: 0;
  left: 0;
  font-weight: 800;
  font-size: 0.9rem;
  line-height: 1.1;
  color: var(--ink);
  transform: translateY(calc(-100% - 0.5rem));
  transform-origin: var(--tail) bottom;
  animation: hint-in 0.12s ease-out;
}
.hint.below {
  transform: translateY(0.5rem);
  transform-origin: var(--tail) top;
}
.hint-lemma {
  white-space: nowrap;
}
/* Its definition: narrow, 3 lines at most. */
.hint-def {
  max-width: 32ch;
  font-weight: 600;
  font-size: 0.8rem;
  line-height: 1.25;
  color: var(--muted);
}
span.hint-def {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
}
/* Shown while the definition loads. */
.spinner {
  width: 0.8rem;
  height: 0.8rem;
  border: 2px solid var(--line);
  border-top-color: var(--muted);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    rotate: 1turn;
  }
}
.hint::after {
  content: '';
  position: absolute;
  left: var(--tail);
  bottom: calc(-0.3rem - var(--outline-w) / 2);
  width: 0.55rem;
  height: 0.55rem;
  border: solid var(--outline);
  border-width: 0 var(--outline-w) var(--outline-w) 0;
  background: var(--panel);
  transform: translateX(-50%) rotate(45deg);
}
.hint.below::after {
  top: calc(-0.3rem - var(--outline-w) / 2);
  bottom: auto;
  transform: translateX(-50%) rotate(225deg);
}
@keyframes hint-in {
  from {
    opacity: 0;
    scale: 0.85;
  }
}

/* A word found, flown from the silhouette into its row by glide(). */
.flight {
  position: fixed;
  z-index: 70;
  pointer-events: none;
  font-weight: 800;
  line-height: 1;
  color: var(--ink);
  white-space: nowrap;
  transform: translate(-50%, -50%);
}

/* "+points": placed on the word found, flown into the gauge by fly(). */
.floater {
  position: fixed;
  z-index: 70;
  pointer-events: none;
  font-weight: 900;
  font-size: 1.5rem;
  color: color-mix(in srgb, var(--tint) 75%, var(--ink));
  transform: translate(-50%, -50%) scale(0.4);
  opacity: 0;
}
.floater.big {
  font-size: 1.9rem;
}

/* The silhouette: fixed letters as raised tiles, blanks as underlined slots. */
.silhouette {
  container-type: inline-size;
  display: flex;
  justify-content: center;
  gap: 0.35rem;
}
.silhouette.shake {
  animation: shake 0.4s ease;
}
.cell {
  flex: none;
  width: min(3rem, calc((100cqi - (var(--n) - 1) * 0.35rem) / var(--n)));
  aspect-ratio: 5 / 6;
  display: grid;
  place-items: center;
  padding: 0;
  font: inherit;
  font-weight: 900;
  font-size: min(1.9rem, calc(100cqi / var(--n) * 0.55));
  text-transform: uppercase;
  color: var(--ink);
  background: none;
  border-bottom: 3px solid color-mix(in srgb, var(--ink) 30%, transparent);
  border-radius: 0.4rem 0.4rem 0 0;
  cursor: pointer;
}
.cell:disabled {
  cursor: default;
}
.cell.fixed {
  border: var(--outline-w) solid var(--outline);
  border-radius: 0.6rem;
  color: var(--on-color);
  background: var(--accent);
  box-shadow: var(--lift-sm);
}
.cell.caret {
  border-bottom-color: var(--ink);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.cell.set {
  animation: pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.wrong .cell:not(.fixed) {
  color: var(--danger);
}

.status {
  min-height: 1.4em;
  text-align: center;
  font-weight: 800;
  color: var(--muted);
}
.status.good {
  color: var(--ink);
}
.status.bad {
  color: var(--danger);
}

.reveal {
  align-self: center;
  padding: 0.2rem 0.6rem;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--muted);
  background: none;
  text-decoration: underline;
  cursor: pointer;
}
.end {
  display: flex;
  justify-content: center;
  gap: 0.7rem;
}
</style>
