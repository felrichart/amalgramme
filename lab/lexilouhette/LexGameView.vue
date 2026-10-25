<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '../../src/components/ui/PageHeader.vue';
import ConfirmModal from '../../src/components/ui/ConfirmModal.vue';
import { useShake } from '../../src/composables/useShake.js';
import { bankLevel, playableLevel, levelsOf } from './levels.js';
import { isAdmin } from './official.js';
import { BLANK, maxScore, deBefore } from './game.js';
import { useLexilouhette } from './useLexilouhette.js';
import { definitionOf } from './definitions.js';
import LexKeyboard from './LexKeyboard.vue';

// `source`: the list played, 'official' or 'bank'.
const props = defineProps({ source: { type: String, required: true } });
const route = useRoute();
const router = useRouter();

const inBank = props.source === 'bank';
const level = (inBank ? bankLevel : playableLevel)(route.params.pattern);
const list = levelsOf(props.source);
const index = list.findIndex((l) => l.pattern === level.pattern);
const home = inBank ? '/lexilouhette/banque' : '/lexilouhette';
const nav = {
  title: `${index + 1} / ${list.length}`,
  back: home,
  next: list[index + 1] && `${home}/${list[index + 1].pattern}`,
  edit: isAdmin && `/lexilouhette/editer/${level.pattern}`,
};
const g = useLexilouhette(level);
const max = maxScore(level);
const shaking = useShake(() => g.shake.value);

/*
 * Scoring animation: a "+1" springs up from a family's first find and flies into
 * the score; on arrival the score bumps and its count, normal or rare, goes up.
 * `shown` lags the real score until then.
 */
const shown = ref({ ...g.score.value });
const bump = ref(0);
const bumping = useShake(() => bump.value, 450);
function gain(rare) {
  shown.value[rare ? 'rare' : 'normal']++;
  bump.value++;
}

const scoreEl = ref(null);
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
 * then its "+1", if it's its family's first find, springs up there and flies into
 * the score.
 */
const silhouetteEl = ref(null);
const landing = ref([]);
const flights = ref([]);
let flightId = 0;
watch(
  () => g.feedback.value,
  async (f) => {
    if (!f || f.kind === 'unknown') return;
    open.value = f.key;
    if (f.kind === 'dup') return;
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
  if (!f.opens) return;
  const row = listEl.value?.querySelector(`[data-key="${f.key}"]`);
  if (!row) return gain(f.rare);
  const { x, y } = center(row.querySelector('.text') ?? row);
  floaters.value.push({
    id: ++floaterId,
    rare: f.rare,
    x,
    y: clampY(y),
  });
}
// Ref callback: runs once per new floater element.
const flying = new WeakSet();
function fly(el, f) {
  if (!el || flying.has(el)) return;
  flying.add(el);
  const to = center(scoreEl.value);
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
    gain(f.rare);
  };
}

// A word still to find: the silhouette, its known letters lowercase like the words.
const ghost = [...level.pattern].map((ch) => (ch === BLANK ? ch : ch.toLowerCase()));

/*
 * A word's homonyms (tigrés under tigres) show only while it's open: one word at a
 * time, the one just found or retyped, until another one is. Tapping a word opens
 * or closes it.
 */
const open = ref(null);
const homonyms = (r) => r.spellings.slice(1);
function toggle(r) {
  if (homonyms(r).length) open.value = open.value === r.key ? null : r.key;
}
watch(open, async () => {
  await nextTick();
  await refit();
  placeHint();
});

/*
 * A bubble on hover with a mouse, on tap otherwise: over a spelling, its base's
 * definition once fetched, under what it is of its base when it's only a form of
 * it (portés: part. passé plur. de porter); over a rare family's dot, that it's
 * rare.
 */
const HINT_MARGIN = 8; // px kept from the screen edges
const hint = ref(null);
const hintEl = ref(null);
let hintTarget = null;
function showHint(el, content) {
  if (hint.value?.id === content.id && hintTarget === el) return;
  hintTarget = el;
  hint.value = content;
  placeHint();
}
function showWord(el, { form, label, base }) {
  const lead = form === base ? '' : `${label} ${deBefore(base)}`;
  // `definition`: undefined while fetching, null when there's none, false when the
  // request failed (nothing to show then).
  showHint(el, { id: form, lead, base, definition: undefined });
  const settle = (definition) => {
    if (hint.value?.id !== form) return;
    hint.value.definition = definition;
    placeHint();
  };
  definitionOf(base).then(settle, () => settle(false));
}
function hideHint() {
  hint.value = null;
  hintTarget = null;
}
/* Above the word's letters, or the dot (below when there's no room), centred on
 * them unless that spills off screen. */
async function placeHint() {
  if (!hint.value) return;
  await nextTick();
  const el = hintEl.value;
  if (!el || !hintTarget?.isConnected) return hideHint();
  const range = document.createRange();
  range.selectNodeContents(hintTarget);
  const r = (hintTarget.hasChildNodes() ? range : hintTarget).getBoundingClientRect();
  const x = r.left + r.width / 2;
  const w = el.offsetWidth;
  const left = Math.min(Math.max(HINT_MARGIN, x - w / 2), innerWidth - HINT_MARGIN - w);
  const below = r.top - el.offsetHeight - 2 * HINT_MARGIN < 0;
  el.classList.toggle('below', below);
  el.style.left = `${left}px`;
  el.style.top = `${below ? r.bottom : r.top}px`;
  el.style.setProperty('--tail', `${x - left}px`);
}
// `keepOpen`: a tap doesn't fold the word's homonyms (folding a homonym would hide it).
const hintOn = (id, show, keepOpen = false) => ({
  pointerenter: (e) => e.pointerType === 'mouse' && show(e.currentTarget),
  pointerleave: (e) => e.pointerType === 'mouse' && hideHint(),
  click: (e) => {
    if (keepOpen) e.stopPropagation();
    if (e.pointerType !== 'mouse' && hint.value?.id === id) hideHint();
    else show(e.currentTarget);
  },
});
const wordHint = (spelling, homonym = false) =>
  hintOn(spelling.form, (el) => showWord(el, spelling), homonym);
const rareHint = (f) => {
  const id = `rare:${f.id}`;
  return hintOn(id, (el) => showHint(el, { id, text: 'mot rare' }));
};
// Fetch a word's definitions as soon as it's found, so its bubbles open complete.
watch(
  () => g.state.found[0],
  (key) => {
    if (!key) return;
    const bases = new Set(level.answers.get(key).spellings.map((sp) => sp.base));
    for (const base of bases) definitionOf(base).catch(() => {});
  },
);
// A tap anywhere but on the bubble's word or dot closes it; a tap on them toggles it.
const outsideHint = (e) => e.target.closest?.('.text, .rare-dot') !== hintTarget && hideHint();
onMounted(() => window.addEventListener('pointerdown', outsideHint));
onUnmounted(() => window.removeEventListener('pointerdown', outsideHint));

const dup = computed(() => (g.feedback.value?.kind === 'dup' ? g.feedback.value.key : null));
const rowState = (key) =>
  key && {
    flash: key === dup.value,
    landing: landing.value.includes(key),
  };

const status = computed(() => {
  if (g.state.revealed) return { text: 'Solutions révélées' };
  if (g.exhausted.value) return { text: 'Toutes les réponses trouvées, bravo !', tone: 'good' };
  const f = g.feedback.value;
  if (f?.kind === 'new') {
    const word = level.answers.get(f.key).display;
    return { text: f.opens ? word : `${word} · même famille`, tone: 'good' };
  }
  if (f?.kind === 'dup') return { text: 'Déjà trouvé', tone: 'bad' };
  if (f?.kind === 'unknown') return { text: 'Pas dans le dictionnaire', tone: 'bad' };
  if (!g.state.found.length) return { text: 'Complète les cases vides' };
  return { text: '' };
});

/*
 * Columns: the fewest that show every spot without scrolling, as long as each
 * stays wide enough for the level's widest word and its number; failing that, the
 * same with smaller text, and past the smallest the list scrolls. Every word gets
 * that width, and the columns pack to the left.
 */
const listEl = ref(null);
const wordsEl = ref(null);
const cols = ref(2);
const textSize = ref(0);
const scrolls = ref(false);
const wordWidth = ref(0);
const columnWidth = ref(0);
// List text sizes to try, in rem, largest first.
const TEXT_SIZES = [1.05, 0.95, 0.85];
// Room a row needs besides its word, in em: number, homonyms count, padding, column
// gap.
const ROW_EXTRA = 3.9;

const numberOf = (n) => String(n).padStart(2, '0');

function widestWord(style) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `800 ${style.fontSize} ${style.fontFamily}`;
  // Each gap of a word still to find is about as wide as an "n".
  const silhouette = level.pattern.replaceAll(BLANK, 'n').toLowerCase();
  const forms = [...level.answers.values()].flatMap((a) => a.spellings.map((sp) => sp.form));
  const words = [silhouette, ...forms];
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
    columnWidth.value = wordWidth.value + ROW_EXTRA * parseFloat(style.fontSize);
    const room = listEl.value.clientWidth - 2 * parseFloat(style.left);
    for (let k = 2; k === 2 || room / k >= columnWidth.value; k++) {
      cols.value = k;
      await nextTick();
      if (el.scrollWidth <= el.clientWidth + 1) return;
    }
    cols.value = Math.max(2, cols.value - 1);
  }
  scrolls.value = true;
}
/* Refits once a found word's rows no longer fit. */
async function refit() {
  const el = wordsEl.value;
  if (el && !scrolls.value && el.scrollWidth > el.clientWidth + 1) await fitColumns();
}
// The reveal adds each family's words not found yet: the columns are refitted.
watch(
  () => g.state.revealed,
  async () => {
    await nextTick();
    await fitColumns();
  },
);
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

// The action waiting for confirmation: 'reveal' or 'reset'.
const confirming = ref(null);
const CONFIRMS = {
  reveal: { title: "Voir les solutions ? Le niveau s'arrête là.", label: 'Voir' },
  reset: {
    title: 'Recommencer ce niveau ? Tes mots trouvés seront effacés.',
    label: 'Recommencer',
  },
};
async function confirm() {
  const action = confirming.value;
  confirming.value = null;
  hideHint();
  g[action]();
  if (action !== 'reset') return;
  shown.value = { normal: 0, rare: 0 };
  open.value = null;
  await nextTick();
  await fitColumns();
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
    <PageHeader :title="nav.title" :back="nav.back" back-label="niveaux">
      <button
        v-if="nav.edit"
        class="icon-btn press sm"
        type="button"
        aria-label="éditer"
        @click="router.push(nav.edit)"
      >
        ✎
      </button>
    </PageHeader>
    <div class="score-row">
      <p
        ref="scoreEl"
        class="score"
        :class="{ bump: bumping }"
        :aria-label="`${g.score.value.normal} sur ${max}, ${g.score.value.rare} rares`"
      >
        {{ shown.normal }}<span v-if="shown.rare" class="rare">+{{ shown.rare }}</span>
      </p>
      <span
        v-for="f in floaters"
        :key="f.id"
        :ref="(el) => fly(el, f)"
        class="floater"
        :class="{ rare: f.rare }"
        :style="{ left: `${f.x}px`, top: `${f.y}px` }"
        aria-hidden="true"
        >+1</span
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
        :style="{
          '--cols': cols,
          '--word-w': `${wordWidth}px`,
          '--col-w': `${columnWidth}px`,
          fontSize: `${textSize}rem`,
        }"
      >
        <li v-for="f in g.families.value" :key="f.id" class="spot">
          <span v-if="f.rare" class="rare-dot" v-on="rareHint(f)" />
          <span v-else class="num" aria-hidden="true">{{ numberOf(f.num) }}</span>
          <div v-if="!f.rows.length" class="entry">
            <span class="word">
              <span class="unfound" aria-label="mot à trouver">
                <template v-for="(ch, j) in ghost" :key="j">
                  <span v-if="ch === BLANK" class="gap" />
                  <template v-else>{{ ch }}</template>
                </template>
              </span>
            </span>
          </div>
          <div
            v-for="(r, i) in f.rows"
            :key="r.key"
            class="entry"
            :class="{
              continues: i < f.rows.length - 1,
              later: i > 0,
              foldable: homonyms(r).length,
              latest: r.found && r.key === g.latest.value,
            }"
            @click="toggle(r)"
          >
            <span
              class="word"
              :data-key="r.found ? r.key : null"
              :class="r.found && rowState(r.key)"
            >
              <span class="text" :class="{ missed: !r.found }" v-on="wordHint(r.spellings[0])">{{
                r.display
              }}</span>
              <span v-if="homonyms(r).length && open !== r.key" class="more">
                +{{ homonyms(r).length }}
              </span>
            </span>
            <span v-for="sp in open === r.key ? homonyms(r) : []" :key="sp.form" class="word other">
              <span class="text" :class="{ missed: !r.found }" v-on="wordHint(sp, true)">{{
                sp.form
              }}</span>
            </span>
          </div>
        </li>
      </ul>
    </section>
    <span v-if="hint" ref="hintEl" :key="hint.id" class="hint" aria-hidden="true">
      <span v-if="hint.text" class="hint-rarity"><span class="dot" />{{ hint.text }}</span>
      <template v-else>
        <span class="hint-base"
          >{{ hint.lead }}<em>{{ hint.base }}</em></span
        >
        <span v-if="hint.definition === undefined" class="spinner" aria-label="chargement" />
        <template v-else-if="hint.definition">
          <span class="hint-def">{{ hint.definition }}</span>
          <span class="hint-source">Wiktionnaire</span>
        </template>
        <em v-else-if="hint.definition === null" class="hint-def">définition manquante</em>
      </template>
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
        <button class="link" type="button" @click="confirming = 'reveal'">
          Voir les solutions
        </button>
      </template>
      <template v-else>
        <div class="end">
          <button v-if="nav.next" class="cta press" type="button" @click="router.replace(nav.next)">
            Niveau suivant
          </button>
          <button class="cta ghost press" type="button" @click="router.push(nav.back)">
            Tous les niveaux
          </button>
        </div>
        <button class="link" type="button" @click="confirming = 'reset'">Recommencer</button>
      </template>
    </section>

    <ConfirmModal
      v-if="confirming"
      :title="CONFIRMS[confirming].title"
      :confirm-label="CONFIRMS[confirming].label"
      @cancel="confirming = null"
      @confirm="confirm"
    />
  </div>
</template>

<style scoped>
.score-row {
  display: flex;
  justify-content: center;
  padding: 0 1rem 0.4rem;
}
/* Normal families found, +rare ones once there are some. */
.score {
  margin: 0;
  font-weight: 900;
  font-size: 1.6rem;
  line-height: 1;
  color: var(--ink);
}
.score.bump {
  animation: bump 0.45s ease;
}
.score .rare {
  font-size: 0.8em;
  color: var(--rare);
}
@keyframes bump {
  30% {
    transform: scale(1.08);
  }
}

/* One spot per word, alphabetical down the columns; scrolls once it outgrows
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
   absolutely so the columns get a fixed height to break at. Only as wide as its
   columns (--col-w includes a gap), so they pack to the left. */
.words {
  position: absolute;
  inset: 0.6rem;
  width: calc(var(--cols) * var(--col-w) - 0.6em);
  max-width: calc(100% - 1.2rem);
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
/* A family's spot: its number, then its words found, first find first, each with
   its homonyms under it. */
.spot {
  position: relative;
  break-inside: avoid;
  margin-bottom: 0.1em;
  padding-left: 1.2em;
}
/* Lined up with the spot's first row (1.7em high), like a rare family's dot. */
.num {
  position: absolute;
  left: 0;
  top: 0;
  font-size: 0.65em;
  line-height: calc(1.7em / 0.65);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: color-mix(in srgb, var(--ink) 22%, transparent);
}
.rare-dot {
  position: absolute;
  left: 0.12em;
  top: 0.6em;
  width: 0.5em;
  height: 0.5em;
  border-radius: 50%;
  background: var(--rare);
}
/* A wider target than the dot, for its bubble. */
.rare-dot::before {
  content: '';
  position: absolute;
  inset: -0.4em;
}
/* A family's later finds hang off a grey line in the margin, from under the
   spot's number (0.37em from the spot's edge, the entries 1.2em in) down to each
   of them. */
.entry {
  --chain: color-mix(in srgb, var(--ink) 22%, transparent);
  position: relative;
  width: fit-content;
  border-radius: 0.5em;
}
.entry.continues::after {
  content: '';
  position: absolute;
  left: calc(0.37em - 1.2em - 1px);
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--chain);
}
.entry.continues:not(.later)::after {
  top: 1.45em;
}
.entry.later::before {
  content: '';
  position: absolute;
  left: calc(0.37em - 1.2em - 1px);
  top: 0;
  width: 0.6em;
  height: 0.85em;
  border: solid var(--chain);
  border-width: 0 0 2px 2px;
  border-bottom-left-radius: 0.3em;
}
/* A spot: its word once found (or the silhouette until then), then how many
   homonyms it holds. Every spot is as tall and its word box as wide. */
.word {
  display: grid;
  grid-template-columns: calc(var(--word-w) + 0.3em) auto;
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
/* How many homonyms a closed word holds. */
.more {
  margin-left: 0.25em;
  padding: 0 0.35em;
  border: 1.5px solid color-mix(in srgb, var(--ink) 30%, transparent);
  border-radius: 999px;
  font-size: 0.62em;
  font-weight: 800;
  color: color-mix(in srgb, var(--ink) 60%, transparent);
}
.entry.foldable {
  cursor: pointer;
}
/* A word's homonyms: smaller, pointless, hanging off it. */
.word.other {
  display: flex;
  align-items: baseline;
  height: 1.35em;
  margin-top: -0.15em;
  font-size: 0.8em;
  font-weight: 700;
  color: color-mix(in srgb, var(--ink) 70%, transparent);
}
.word.other::before {
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
.unfound {
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
.word.flash {
  animation: shake 0.4s ease;
}
/* The word just found or retyped, with its homonyms: ringed until the next one. */
.entry.latest {
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

/* The definition bubble, placed above its word by placeHint() (or below it), its
   tail pointing at the word. */
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
.hint-base {
  white-space: nowrap;
}
/* Its definition: narrow, 6 lines at most. */
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
  -webkit-line-clamp: 6;
  line-clamp: 6;
  overflow: hidden;
}
/* That a family is rare, after its dot. */
.hint-rarity {
  display: flex;
  align-items: center;
  gap: 0.35em;
  white-space: nowrap;
}
.hint-rarity .dot {
  flex: none;
  width: 0.7em;
  height: 0.7em;
  border-radius: 50%;
  background: var(--rare);
}
/* Credited on its own line, so the clamp never hides it. */
.hint-source {
  align-self: flex-end;
  font-weight: 700;
  font-size: 0.65rem;
  font-style: italic;
  color: var(--muted);
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

/* "+1": placed on the word found, flown into the score by fly(). */
.floater {
  position: fixed;
  z-index: 70;
  pointer-events: none;
  font-weight: 900;
  font-size: 1.5rem;
  color: var(--ink);
  transform: translate(-50%, -50%) scale(0.4);
  opacity: 0;
}
.floater.rare {
  font-size: 1.9rem;
  color: var(--rare);
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

.link {
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
