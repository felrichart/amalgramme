<script setup>
/*
 * The level's words on the cream board, a slot each (see listOf), in 2 columns,
 * roomy when they fit, else compact and scrolling, a fading arrow showing there's
 * more below. A found word is a light card in its slot; tapping it shows
 * its definition, and opens its other spellings when it has some (one word open
 * at a time); its bubble opens beside it. The yellow arrow points at the word
 * last tapped, else the latest one.
 */
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { deBefore } from '../game.js';
import { definitionOf } from '../definitions.js';

const props = defineProps({
  rows: { type: Array, required: true },
  // The key of the word pointed at.
  latest: { type: String, default: null },
  // The key of the word that just landed, to slide in.
  arrival: { type: String, default: null },
  // `{ key, n }`: the word typed again, nudged on each retry.
  nudge: { type: Object, default: null },
});

// Sizes in px, for 2 roomy columns, 2 and 3: row, card and sub-word heights.
const SIZES = {
  big: { cols: 2, row: 34, card: 27, kid: 22, kidGap: 4, gap: 8 },
  2: { cols: 2, row: 26, card: 20, kid: 18, kidGap: 3, gap: 5 },
};

const boardEl = ref(null);
const room = ref(0);
let resizes = null;
onMounted(() => {
  resizes = new ResizeObserver(() => {
    const el = boardEl.value;
    const style = getComputedStyle(el);
    room.value = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  });
  resizes.observe(boardEl.value);
});
onUnmounted(() => resizes?.disconnect());

const fits = (layout) => {
  const s = SIZES[layout];
  return Math.ceil(props.rows.length / s.cols) * (s.row + s.gap) - s.gap <= room.value;
};
const layout = computed(() => (room.value && fits('big') ? 'big' : 2));
const size = computed(() => SIZES[layout.value]);
const cols = computed(() => size.value.cols);
const scrolls = computed(() => !!room.value && !fits(2));

/* Whether words are hidden below, while the list scrolls. */
const below = ref(false);
function onScroll() {
  hideTip();
  const el = boardEl.value;
  below.value = !!el && el.scrollTop + el.clientHeight < el.scrollHeight - 4;
}
watch([scrolls, () => props.rows.length], () => nextTick(onScroll), { immediate: true });
const columns = computed(() => {
  const per = Math.ceil(props.rows.length / cols.value);
  return Array.from({ length: cols.value }, (_, c) => props.rows.slice(c * per, (c + 1) * per));
});

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n) => String(n).padStart(2, '0');
const others = (r) => (r.found ? r.answer.spellings.slice(1) : []);

/* The word whose other spellings show, and the bubble: `{ id, spelling }`. */
const open = ref(null);
const tip = ref(null);
const definitions = reactive({});

// The bubble's width, and the room it keeps from the board's edges and the word.
const TIP_W = 196;
const TIP_MIN_W = 120;
const TIP_MARGIN = 6;
const tipEl = ref(null);

/* Beside the word's line, on the side with room for it (the bubble narrows when
 * neither has), its tail at the word's height. */
async function placeTip(el) {
  const board = boardEl.value;
  const line = el.closest('.line');
  if (!board || !line) return;
  const b = board.getBoundingClientRect();
  const l = line.getBoundingClientRect();
  const w = el.getBoundingClientRect();
  const right = b.right - TIP_MARGIN - l.right;
  const left = l.left - b.left - TIP_MARGIN;
  const onRight = right >= TIP_W || right >= left;
  const width = Math.max(TIP_MIN_W, Math.min(TIP_W, onRight ? right : left));
  const x = onRight ? l.right - b.left + TIP_MARGIN / 2 : l.left - b.left - width - TIP_MARGIN / 2;
  const middle = w.top + w.height / 2 - b.top + board.scrollTop;
  tip.value.box = { x: Math.max(TIP_MARGIN, x), y: middle - 18, width, middle, onRight };
  await nextTick();
  const h = tipEl.value?.offsetHeight ?? 0;
  const bottom = board.scrollTop + board.clientHeight - TIP_MARGIN;
  const box = tip.value?.box;
  if (box && box.y + h > bottom) box.y = Math.max(board.scrollTop + TIP_MARGIN, bottom - h);
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
  () => props.rows.filter((r) => r.found).flatMap((r) => r.answer.spellings.map((sp) => sp.base)),
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
  const key = r.answer.key;
  if (r.found) pointed.value = key;
  if (others(r).length && open.value === key) {
    open.value = null;
    return hideTip();
  }
  open.value = others(r).length ? key : null;
  if (tip.value?.id === r.id && tip.value.spelling.form === r.answer.display) hideTip();
  else showTip(r, r.answer.spellings[0], e.currentTarget);
}
function tapOther(r, sp, e) {
  pointed.value = r.answer.key;
  showTip(r, sp, e.currentTarget);
}
const hover = (r, spelling) => (e) =>
  e.pointerType === 'mouse' && showTip(r, spelling, e.currentTarget);
const unhover = (e) => e.pointerType === 'mouse' && hideTip();

// A tap elsewhere closes the bubble.
const outside = (e) => !e.target.closest?.('.word') && hideTip();
onMounted(() => window.addEventListener('pointerdown', outside));
onUnmounted(() => window.removeEventListener('pointerdown', outside));

// A new word closes the open one.
watch(
  () => props.arrival,
  (key) => {
    if (!key) return;
    open.value = null;
    hideTip();
    // Brought into view if the list scrolls past it.
    nextTick(() =>
      boardEl.value
        ?.querySelector('.card.arrive')
        ?.closest('.line')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
  },
);

/* What a found word adds beyond its family's point, if anything: a rare
 * family's bonus, or nothing for a family's later finds and a word's other
 * spellings. */
function worthOf(row, spelling) {
  if (!row?.found) return null;
  if (spelling.form !== row.answer.display) return { text: 'Homonyme (0 point)' };
  if (row.kind === 'rare') return { text: 'Rare (+1 bonus)', bonus: true };
  if (row.kind === 'variant') return { text: 'Variante (0 point)' };
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

function slotHeight(r) {
  const s = size.value;
  if (open.value !== r.answer?.key) return s.row;
  return s.row + others(r).length * (s.kid + s.kidGap) + 2;
}
const kidTop = (i) => size.value.row + i * (size.value.kid + size.value.kidGap);

const cardKey = (r) =>
  r.answer.key + (props.nudge?.key === r.answer.key ? `-${props.nudge.n}` : '');
</script>

<template>
  <section ref="boardEl" class="dc-board board" :class="{ scrolls }" @scroll="onScroll">
    <div class="columns" :class="`c${layout}`">
      <div v-for="(column, ci) in columns" :key="ci" class="column">
        <div v-for="(r, ri) in column" :key="r.id" class="line">
          <span class="mark" aria-hidden="true">
            <span v-if="r.kind === 'main'" class="num" :class="{ on: r.found }">{{
              pad(r.num)
            }}</span>
            <span v-else-if="r.kind === 'rare'" class="rare"><span class="plus" />1</span>
            <span v-else class="variant" />
          </span>
          <div class="slot" :style="{ height: `${slotHeight(r)}px` }">
            <template v-if="r.answer">
              <button
                v-for="(sp, i) in others(r)"
                :key="sp.form"
                class="word kid"
                type="button"
                :tabindex="open === r.answer.key ? 0 : -1"
                :class="{ shown: open === r.answer.key }"
                :style="{
                  top: `${kidTop(i)}px`,
                  transitionDelay: `${open === r.answer.key ? 110 + i * 60 : (others(r).length - 1 - i) * 40}ms`,
                }"
                @click="tapOther(r, sp, $event)"
                @pointerenter="hover(r, sp)($event)"
                @pointerleave="unhover"
              >
                <span class="text">{{ cap(sp.form) }}</span>
              </button>
              <button
                :key="cardKey(r)"
                class="word card"
                :class="{
                  missed: !r.found,
                  arrive: r.answer.key === arrival,
                  nudge: nudge?.key === r.answer.key,
                }"
                type="button"
                :aria-expanded="others(r).length ? open === r.answer.key : undefined"
                :aria-label="
                  others(r).length
                    ? `${r.answer.display}, ${others(r).length + 1} formes`
                    : r.answer.display
                "
                @click="tapWord(r, $event)"
                @pointerenter="hover(r, r.answer.spellings[0])($event)"
                @pointerleave="unhover"
              >
                <span class="text">{{ cap(r.answer.display) }}</span>
                <span
                  v-if="others(r).length"
                  class="chevron"
                  :class="{ up: open === r.answer.key }"
                />
              </button>
            </template>
            <span v-else class="sr-only">mot à trouver</span>
          </div>
          <span class="pointer">
            <span v-if="r.found && r.answer.key === pointer" class="dc-arrow-left" />
          </span>
        </div>
      </div>
    </div>
    <div
      v-if="tip?.box"
      ref="tipEl"
      :key="tip.spelling.form"
      class="tip"
      :class="{ left: !tip.box.onRight }"
      :style="{
        left: `${tip.box.x}px`,
        top: `${tip.box.y}px`,
        width: `${tip.box.width}px`,
        '--tail-y': `${tip.box.middle - tip.box.y}px`,
      }"
      role="tooltip"
    >
      <div class="tip-head">
        <span class="tip-word">{{ tipText.word }}</span>
        <span v-if="tipText.nature" class="tip-nature">{{ tipText.nature }}</span>
      </div>
      <div class="tip-def" :class="{ loading: tipText.loading }">{{ tipText.definition }}</div>
      <span v-if="tipText.worth" class="worth" :class="{ bonus: tipText.worth.bonus }">{{
        tipText.worth.text
      }}</span>
      <span class="tail" />
    </div>
    <div v-if="scrolls" class="more" :class="{ shown: below }" aria-hidden="true">
      <span class="dc-arrow-down" />
    </div>
  </section>
</template>

<style scoped>
.board {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 0 12px;
  padding: 14px 12px 14px 10px;
}
.board.scrolls {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--dc-dash) transparent;
}
/* Pinned to the board's bottom edge, over the words left below. */
.more {
  position: sticky;
  bottom: -14px;
  z-index: 2;
  height: 40px;
  margin: -40px -12px -14px -10px;
  background: linear-gradient(to bottom, transparent, var(--dc-board) 75%);
  border-radius: 0 0 18px 18px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}
.more.shown {
  opacity: 1;
}
.more .dc-arrow-down {
  position: absolute;
  left: 50%;
  bottom: 10px;
  animation: dico-bob 0.55s ease-in-out infinite alternate;
}
.columns {
  --row: 26px;
  --card: 20px;
  --num-w: 20px;
  --pointer-w: 11px;
  --gap: 5px;
  --fs: 14px;
  --kid-fs: 12.5px;
  --num-fs: 11.5px;
  --row-gap: 5px;
  --kid: 18px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.columns.cbig {
  --row: 34px;
  --card: 27px;
  --num-w: 22px;
  --pointer-w: 12px;
  --fs: 17px;
  --kid-fs: 14.5px;
  --num-fs: 12.5px;
  --row-gap: 8px;
  --kid: 22px;
}
.column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--row-gap);
}
.line {
  position: relative;
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
.rare {
  display: flex;
  align-items: center;
  gap: 1px;
  height: 15px;
  padding: 0 3px;
  border-radius: 4px;
  background: var(--dc-yellow);
  box-shadow: 0 1px 0 rgb(60 40 0 / 0.5);
  font-family: var(--dc-mono);
  font-weight: 700;
  font-size: calc(var(--num-fs) - 1px);
  line-height: 1;
  color: var(--dc-yellow-ink);
}
.plus {
  display: block;
  width: 6px;
  height: 6px;
  background:
    linear-gradient(var(--dc-yellow-ink), var(--dc-yellow-ink)) center / 100% 1.5px no-repeat,
    linear-gradient(var(--dc-yellow-ink), var(--dc-yellow-ink)) center / 1.5px 100% no-repeat;
}
.variant {
  display: block;
  width: 8px;
  height: 1.75px;
  margin-right: 3px;
  border-radius: 1px;
  background: var(--day);
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
  padding: 0 6px 0 9px;
  background: var(--dc-tint);
  box-shadow:
    inset 3px 0 0 var(--dc-day-soft),
    inset 0 1px 0 rgb(255 255 255 / 0.5);
}
.card.missed {
  background: transparent;
  box-shadow: none;
  color: var(--dc-dash);
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
  position: absolute;
  z-index: 20;
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
/* What the word is worth, at the foot of its bubble: the rare bonus stands out. */
.worth {
  align-self: flex-start;
  margin-top: 3px;
  font-size: 11.5px;
  font-style: italic;
  font-weight: 600;
  color: var(--dc-faint);
}
.worth.bonus {
  padding: 2px 7px;
  font-style: normal;
  border-radius: 4px;
  background: var(--dc-yellow);
  color: var(--dc-yellow-ink);
  font-weight: 700;
  box-shadow: 0 1px 0 rgb(60 40 0 / 0.35);
}
/* Points at the word, from the bubble's side facing it. */
.tail {
  position: absolute;
  top: calc(var(--tail-y) - 5px);
  left: -4px;
  width: 9px;
  height: 9px;
  background: var(--day);
  transform: rotate(45deg);
}
.left .tail {
  left: auto;
  right: -4px;
  background: #fffdf8;
  box-shadow: 1px -1px 0 rgb(42 38 32 / 0.08);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
