<script setup>
/*
 * The level's words, a slot each (see listOf), in its parent (the cream board),
 * scrolling once they outgrow it: fades show there's more above or below. A
 * riddle's slot shows its clue, and once found its word's card, the clue small
 * beside it. With `bonus`, the bonus words' box comes last (see DicoBonusBox);
 * `fit` shrinks the rows when they'd overflow. Left of a slot: its number for a
 * riddle, a book for a bonus word. Tapping a found word shows its definition,
 * and opens its homonyms' sub-list when it has one, one at a time; its bubble
 * opens over it. The yellow arrow points at the word last tapped, else the
 * latest one.
 */
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { deBefore } from '../game.js';
import { definitionOf } from '../definitions.js';
import DicoBook from './DicoBook.vue';
import DicoBonusBox from './DicoBonusBox.vue';

const props = defineProps({
  rows: { type: Array, required: true },
  // The key of the word pointed at.
  latest: { type: String, default: null },
  // The key of the word that just landed, to slide in.
  arrival: { type: String, default: null },
  // `{ key, n }`: the word typed again, nudged on each retry.
  nudge: { type: Object, default: null },
  // The bonus words found (rows too), for their box after the list; null: no box.
  bonus: { type: Array, default: null },
  fit: { type: Boolean, default: false },
});
const emit = defineEmits(['bonus']);

// Sizes in px (as in the CSS): sub-word, the gap between sub-words, the board's
// vertical padding, and each row size's row and gap between rows.
const KID = 22;
const KID_GAP = 4;
const PAD_Y = 24;
const SIZES = { roomy: { row: 35, gap: 4 }, compact: { row: 29, gap: 3 } };
const kidsHeight = (n) => (n ? n * (KID + KID_GAP) + 2 : 0);

const boardEl = ref(null);
const rowsEl = ref(null);
/* Whether words are hidden above or below. Checked on scroll and whenever the
 * board or its content resizes (a word landing, a sub-list opening). */
const above = ref(false);
const below = ref(false);
const room = ref(Infinity);
function measure() {
  const el = boardEl.value;
  if (!el) return;
  room.value = el.clientHeight - PAD_Y;
  above.value = el.scrollTop > 4;
  below.value = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
}
function onScroll() {
  hideTip();
  measure();
}
let resizes = null;
onMounted(() => {
  resizes = new ResizeObserver(measure);
  resizes.observe(boardEl.value);
  resizes.observe(rowsEl.value);
});
onUnmounted(() => resizes?.disconnect());

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n) => String(n).padStart(2, '0');
/* The row whose sub-list shows (its id), and the bubble: `{ id, spelling }`. */
const open = ref(null);
const tip = ref(null);
const definitions = reactive({});

// The room the bubble keeps from the board's sides and the screen's top, and
// from the word.
const TIP_MARGIN = 6;
const TIP_GAP = 7;
const tipEl = ref(null);

/* Over the word, as wide as the board, free to spill out of it (fixed on the
 * screen; a scroll closes it), its tail pointing at the word's start. Under the
 * word only when there's no room above it on the screen. */
async function placeTip(el) {
  const board = boardEl.value;
  if (!board) return;
  const b = board.getBoundingClientRect();
  const w = el.getBoundingClientRect();
  const width = b.width - 2 * TIP_MARGIN;
  const tailX = Math.min(width - 18, Math.max(14, w.left - b.left - TIP_MARGIN + 22));
  // Measured off screen first, then put in place.
  tip.value.box = { x: b.left + TIP_MARGIN, y: -9999, width, tailX, above: true };
  await nextTick();
  const box = tip.value?.box;
  if (!box) return;
  const h = tipEl.value?.offsetHeight ?? 0;
  const over = w.top - TIP_GAP - h;
  Object.assign(box, over >= TIP_MARGIN ? { y: over } : { y: w.bottom + TIP_GAP, above: false });
}

function loadDefinition(base) {
  if (base in definitions) return;
  definitions[base] = undefined;
  definitionOf(base).then(
    (text) => (definitions[base] = text),
    () => (definitions[base] = false),
  );
}

// Fetched as soon as a word is found, not when its bubble opens: the Wiktionnaire is slow.
watch(
  () =>
    props.rows
      .filter((r) => r.found)
      .flatMap((r) => [r.answer.spellings, r.kids.map((k) => k.spelling)].flat())
      .map((sp) => sp.base),
  (bases) => bases.forEach(loadDefinition),
  { immediate: true },
);

function showTip(r, spelling, el) {
  tip.value = { id: r.id, spelling, box: null };
  if (el) placeTip(el);
  loadDefinition(spelling.base);
}
const hideTip = () => (tip.value = null);

/* The word last tapped, pointed at until the next word lands or is retyped. */
const pointed = ref(null);
watch(
  () => props.latest,
  () => (pointed.value = null),
);
const pointer = computed(() => pointed.value ?? props.latest);

function tapWord(r, e) {
  if (!r.found) return;
  if (r.keys.length) pointed.value = r.keys[0];
  if (r.kids.length && open.value === r.id) {
    open.value = null;
    return hideTip();
  }
  open.value = r.kids.length ? r.id : null;
  if (tip.value?.id === r.id && tip.value.spelling.form === r.answer.display) hideTip();
  else showTip(r, r.answer.spellings[0], e.currentTarget);
}
function tapKid(r, kid, e) {
  showTip(r, kid.spelling, e.currentTarget);
}
const hover = (r, spelling) => (e) =>
  r.found && e.pointerType === 'mouse' && showTip(r, spelling, e.currentTarget);
const unhover = (e) => e.pointerType === 'mouse' && hideTip();

// A tap elsewhere closes the bubble.
const outside = (e) => !e.target.closest?.('.word') && hideTip();
onMounted(() => window.addEventListener('pointerdown', outside));
onUnmounted(() => window.removeEventListener('pointerdown', outside));

/* A new word closes the open sub-list, and brings its slot into view. */
watch(
  () => props.arrival,
  (key) => {
    if (!key) return;
    open.value = null;
    hideTip();
    nextTick(() =>
      boardEl.value
        ?.querySelector('.arrive')
        ?.closest('.line')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
  },
);

/* A bonus word's homonyms say whose they are. */
function worthOf(row, spelling) {
  if (!row) return null;
  const kid = row.kids.find((k) => k.spelling === spelling);
  if (row.of) return `Homonyme de ${row.of.display}`;
  if (kid) return `Homonyme de ${row.answer.display}`;
  return null;
}

const tipText = computed(() => {
  if (!tip.value) return null;
  const { form, label, base } = tip.value.spelling;
  const definition = definitions[base];
  const row = props.rows.find((r) => r.id === tip.value.id);
  return {
    worth: worthOf(row, tip.value.spelling),
    word: cap(form),
    nature: form === base ? label : `${label} ${deBefore(base)}${base}`.trim(),
    loading: definition === undefined,
    definition:
      definition === undefined
        ? 'Chargement…'
        : definition === null
          ? 'Définition manquante.'
          : definition === false
            ? 'Wiktionnaire injoignable.'
            : definition,
  };
});

const cells = computed(() => [...props.rows, ...(props.bonus ? [{ id: 'bonus', box: true }] : [])]);
/* Roomy rows when they all fit, else compact ones, scrolling past that. */
const size = computed(() => {
  if (!props.fit) return 'roomy';
  const { row, gap } = SIZES.roomy;
  return cells.value.length * (row + gap) - gap <= room.value ? 'roomy' : 'compact';
});
const ROW = computed(() => SIZES[size.value].row);
const slotHeight = (r) => ROW.value + (open.value === r.id ? kidsHeight(r.kids.length) : 0);
const kidTop = (i) => ROW.value + i * (KID + KID_GAP);

// The bonus words' box: the word landing in it, pointed at or nudged there. A
// riddle's homonyms go in with it.
const inBonus = (key) => props.bonus?.find((r) => r.keys.includes(key));
const bonusArrival = computed(() => {
  const key = props.arrival;
  const r = key && props.bonus?.find((b) => b.keys.includes(key) || b.of?.key === key);
  return r ? { word: cap(r.answer.display) } : null;
});
const bonusNudge = computed(() => (props.nudge && inBonus(props.nudge.key) ? props.nudge.n : null));

// Remade on each retry, so the nudge replays.
const nudgeKey = (key) => key + (props.nudge?.key === key ? `-${props.nudge.n}` : '');
const nudged = (key) => props.nudge?.key === key;
</script>

<template>
  <section ref="boardEl" class="board" @scroll="onScroll">
    <div class="less" :class="{ shown: above }" aria-hidden="true" />
    <div ref="rowsEl" class="rows" :class="size">
      <template v-for="r in cells" :key="r.id">
        <DicoBonusBox
          v-if="r.box"
          class="line"
          :count="bonus.length"
          :arrival="bonusArrival"
          :nudge="bonusNudge"
          :pointed="!!inBonus(pointer)"
          @open="emit('bonus')"
        />
        <div v-else class="line">
          <span class="mark" aria-hidden="true">
            <span v-if="r.kind === 'clue'" class="num" :class="{ on: r.found }">{{
              pad(r.num)
            }}</span>
            <DicoBook v-else class="book" />
          </span>
          <div class="slot" :style="{ height: `${slotHeight(r)}px` }">
            <template v-if="r.found">
              <button
                v-for="(kid, i) in r.kids"
                :key="kid.spelling.form"
                class="word kid"
                type="button"
                :tabindex="open === r.id ? 0 : -1"
                :class="{ shown: open === r.id }"
                :style="{
                  top: `${kidTop(i)}px`,
                  transitionDelay: `${open === r.id ? 110 + i * 60 : (r.kids.length - 1 - i) * 40}ms`,
                }"
                @click="tapKid(r, kid, $event)"
                @pointerenter="hover(r, kid.spelling)($event)"
                @pointerleave="unhover"
              >
                <span class="text">{{ cap(kid.spelling.form) }}</span>
              </button>
              <button
                :key="nudgeKey(r.keys[0] ?? r.id)"
                class="word card"
                :class="{
                  clued: !!r.clue,
                  arrive: r.keys[0] === arrival,
                  nudge: nudged(r.keys[0]),
                }"
                type="button"
                :aria-expanded="r.kids.length ? open === r.id : undefined"
                :aria-label="
                  [r.clue, r.answer.display, r.kids.length ? `${r.kids.length + 1} formes` : '']
                    .filter(Boolean)
                    .join(', ')
                "
                @click="tapWord(r, $event)"
                @pointerenter="hover(r, r.answer.spellings[0])($event)"
                @pointerleave="unhover"
              >
                <span class="text">{{ cap(r.answer.display) }}</span>
                <span v-if="r.clue" class="card-clue">{{ r.clue }}</span>
                <span v-if="r.kids.length" class="chevron" :class="{ up: open === r.id }" />
              </button>
            </template>
            <span v-else class="clue">
              {{ r.clue }}<span class="sr-only">, mot à trouver</span>
            </span>
          </div>
          <span class="pointer">
            <span v-if="r.keys.includes(pointer)" class="dc-arrow-left" />
          </span>
        </div>
      </template>
    </div>
    <div
      v-if="tip?.box"
      ref="tipEl"
      :key="tip.spelling.form"
      class="tip"
      :class="{ below: !tip.box.above }"
      :style="{
        left: `${tip.box.x}px`,
        top: `${tip.box.y}px`,
        width: `${tip.box.width}px`,
        '--tail-x': `${tip.box.tailX}px`,
      }"
      role="tooltip"
    >
      <div class="tip-head">
        <span class="tip-word">{{ tipText.word }}</span>
        <span v-if="tipText.nature" class="tip-nature">{{ tipText.nature }}</span>
      </div>
      <div class="tip-def" :class="{ loading: tipText.loading }">{{ tipText.definition }}</div>
      <span v-if="tipText.worth" class="worth">{{ tipText.worth }}</span>
      <span class="tail" />
    </div>
    <div class="more" :class="{ shown: below }" aria-hidden="true" />
  </section>
</template>

<style scoped>
.board {
  position: relative;
  flex: 1;
  min-height: 0;
  padding: 12px 8px 12px 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
  scrollbar-width: thin;
  scrollbar-color: var(--dc-dash) transparent;
}
/* Pinned to the board's top and bottom edges, over the words scrolled past. */
.less,
.more {
  position: sticky;
  z-index: 2;
  margin-left: -4px;
  margin-right: -8px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}
.less {
  top: -12px;
  height: 30px;
  margin-top: -12px;
  margin-bottom: -16px;
  background: linear-gradient(to top, transparent, var(--dc-board) 70%);
}
/* A thin cream fade at the foot, over the words further down. */
.more {
  bottom: -12px;
  height: 26px;
  margin-top: -26px;
  margin-bottom: -12px;
  background: linear-gradient(to bottom, transparent, var(--dc-board) 80%);
}
.less.shown,
.more.shown {
  opacity: 1;
}
.rows {
  --row: 35px;
  --card: 27px;
  --num-w: 22px;
  --pointer-w: 12px;
  --gap: 6px;
  --fs: 17px;
  --clue-fs: 13.5px;
  --card-clue-fs: 12px;
  --kid-fs: 14px;
  --num-fs: 12px;
  --row-gap: 4px;
  --kid: 22px;
  display: flex;
  flex-direction: column;
  gap: var(--row-gap);
}
.rows.compact {
  --row: 29px;
  --card: 23px;
  --fs: 15px;
  --clue-fs: 12.5px;
  --card-clue-fs: 11px;
  --row-gap: 3px;
}

.line {
  position: relative;
  /* Brought into view clear of the fades. */
  scroll-margin: 30px 0;
  display: flex;
  align-items: flex-start;
  gap: var(--gap);
}
.mark,
.pointer {
  flex: none;
  height: var(--row);
  display: flex;
  align-items: center;
}
.mark {
  width: var(--num-w);
  justify-content: flex-end;
}
.pointer {
  width: var(--pointer-w);
}
.num {
  font-family: var(--dc-mono);
  font-weight: 700;
  font-size: var(--num-fs);
  color: var(--dc-faint);
}
.num.on {
  color: var(--day);
}
.book {
  margin-right: 1px;
  font-size: 14px;
}
.slot {
  position: relative;
  flex: 1;
  min-width: 0;
  border-radius: 3px;
  overflow: hidden;
  background: var(--dc-slot);
  box-shadow:
    inset 0 2px 3px rgb(0 0 0 / 0.6),
    0 1px 0 rgb(255 255 255 / 0.4);
  transition: height 0.3s cubic-bezier(0.25, 0.8, 0.3, 1);
}
.word {
  position: absolute;
  left: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  border: 0;
  border-radius: 0 7px 7px 0;
  color: var(--dc-day-ink);
  text-align: left;
  cursor: pointer;
}
.card {
  right: 3px;
  top: calc((var(--row) - var(--card)) / 2);
  height: var(--card);
  gap: 9px;
  padding: 0 8px 0 11px;
  background: var(--dc-tint);
  box-shadow:
    inset 3px 0 0 var(--dc-day-soft),
    inset 0 1px 0 rgb(255 255 255 / 0.5);
}
.card.arrive {
  animation: dico-arrive 0.36s cubic-bezier(0.25, 0.8, 0.3, 1) both;
}
.card.nudge {
  animation: dico-nudge 0.42s ease-in-out both;
}
.kid {
  right: 14px;
  height: var(--kid);
  padding-left: 15px;
  background: var(--dc-tint-light);
  box-shadow: inset 2px 0 0 var(--dc-day-soft);
  transform: translateX(-104%);
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.3, 1);
}
.kid.shown {
  transform: translateX(0);
}
/* A riddle's clue, read in its empty slot. */
.clue {
  position: absolute;
  inset: 0 8px 0 12px;
  display: flex;
  align-items: center;
  font-size: var(--clue-fs);
  font-style: italic;
  font-weight: 500;
  color: #d6cdbb;
  white-space: nowrap;
  overflow: hidden;
}
.clue,
.card-clue {
  text-overflow: ellipsis;
}
.card-clue {
  flex: 1;
  min-width: 0;
  font-size: var(--card-clue-fs);
  font-style: italic;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  color: color-mix(in srgb, var(--dc-day-ink) 78%, var(--dc-tint));
}
.text {
  flex: 1;
  min-width: 0;
  font-family: var(--dc-serif);
  font-size: var(--fs);
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kid .text {
  font-size: var(--kid-fs);
}
/* Beside its clue, the word takes only its width. */
.clued .text {
  flex: none;
}
.chevron {
  flex: none;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--dc-day-ink);
  transition: transform 0.25s;
}
.chevron.up {
  transform: rotate(180deg);
}
/* The definition: a paper slip beside the word, banded like its card. */
.tip {
  position: fixed;
  z-index: 95;
  padding: 8px 10px 9px 13px;
  border-radius: 4px 9px 9px 4px;
  background: #fffdf8;
  color: var(--dc-ink);
  display: flex;
  flex-direction: column;
  gap: 3px;
  box-shadow:
    inset 3px 0 0 var(--day),
    0 0 0 1px rgb(42 38 32 / 0.08),
    0 6px 16px rgb(42 38 32 / 0.16);
  pointer-events: none;
  animation: dico-appear 0.14s ease-out both;
}
.tip-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 6px;
}
.tip-word {
  font-family: var(--dc-serif);
  font-size: 15px;
  line-height: 1.15;
  color: var(--dc-day-ink);
}
.tip-nature {
  font-size: 11px;
  font-style: italic;
  color: var(--dc-faint);
}
.tip-def {
  font-size: 12px;
  line-height: 1.35;
  color: var(--dc-muted);
  display: -webkit-box;
  -webkit-line-clamp: 7;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tip-def.loading {
  font-style: italic;
}
/* Whose homonym the word is, at the foot of its bubble. */
.worth {
  margin-top: 3px;
  font-size: 11.5px;
  font-style: italic;
  font-weight: 600;
  color: var(--dc-faint);
}
/* Points down at the word, or up when the bubble is under it. */
.tail {
  position: absolute;
  bottom: -4px;
  left: var(--tail-x);
  width: 9px;
  height: 9px;
  background: #fffdf8;
  box-shadow: 1px 1px 0 rgb(42 38 32 / 0.08);
  transform: rotate(45deg);
}
.below .tail {
  top: -4px;
  bottom: auto;
  box-shadow: -1px -1px 0 rgb(42 38 32 / 0.08);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
