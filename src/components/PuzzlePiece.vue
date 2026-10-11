<script setup>
import { computed } from 'vue';
import { answerSlots } from '../game/puzzle.js';
import EditIcon from './ui/EditIcon.vue';

const props = defineProps({
  /* Corner 0..3; picks where the tab and the hole sit so the four pieces interlock. */
  index: { type: Number, required: true },
  word: { type: Object, required: true },
  /* 'overview' (on the board), 'merged' (assembled around the secret) or 'open'
   * (the enlarged editor under the board). */
  mode: { type: String, required: true },
  solved: { type: Boolean, default: false },
  /* Being edited below (highlighted on the board). */
  active: { type: Boolean, default: false },
  /* Not the piece being edited (unsolved ones then fade back). */
  dimmed: { type: Boolean, default: false },
  /* Letters in display order, as { id, ch }. */
  tiles: { type: Array, required: true },
  /* One char per answer box ('' when empty). */
  typed: { type: Array, default: () => [] },
  /* Count of leading letters given by help (shown locked). */
  given: { type: Number, default: 0 },
  /* Box the next letter goes to, when open. */
  cursor: { type: Number, default: -1 },
  /* Ids of tiles already placed (greyed out). */
  used: { type: Array, default: () => [] },
  shake: { type: Boolean, default: false },
});

const emit = defineEmits(['open', 'tile', 'shuffle', 'cursor', 'back', 'clear', 'close']);

/* Tab and hole per corner, so the four interlock when merged (w0 → w1 → w3 → w2 → w0). */
const SHAPES = [
  ['tab-right', 'hole-bottom'],
  ['tab-bottom', 'hole-left'],
  ['tab-top', 'hole-right'],
  ['tab-left', 'hole-top'],
];

const slots = computed(() => answerSlots(props.word, props.typed));
const opens = computed(() => props.mode !== 'open' && !props.solved && !props.active);
</script>

<template>
  <div
    class="piece puzzle"
    :class="[
      `is-${mode}`,
      `p${index}`,
      mode === 'open' ? [] : SHAPES[index],
      { solved, active, dimmed, opens },
    ]"
    :style="{ '--n': word.length }"
    :role="opens ? 'button' : undefined"
    :tabindex="opens ? 0 : undefined"
    :aria-label="opens ? `mot ${index + 1}` : undefined"
    @click="opens && emit('open')"
    @keydown.enter="opens && emit('open')"
  >
    <div class="body puzzle-body">
      <span v-if="solved" class="word"
        ><span class="check" aria-hidden="true">✓</span>{{ word.display }}</span
      >
      <template v-else-if="mode === 'open'">
        <span class="slots" :class="{ shake }">
          <button
            v-for="(s, i) in slots"
            :key="i"
            class="slot"
            type="button"
            tabindex="-1"
            :class="{ set: s.ch, given: i < given, caret: i === cursor, 'gap-after': s.gapAfter }"
            :disabled="i < given"
            @click="emit('cursor', i)"
          >
            {{ s.ch }}
          </button>
        </span>
        <div class="tiles">
          <button
            v-for="t in tiles"
            :key="t.id"
            class="tile"
            type="button"
            tabindex="-1"
            :disabled="used.includes(t.id)"
            @click="emit('tile', t.id)"
          >
            {{ t.ch }}
          </button>
        </div>
        <div class="edit-bar">
          <button
            class="pill"
            type="button"
            tabindex="-1"
            aria-label="mélanger"
            @click="emit('shuffle')"
          >
            <EditIcon name="shuffle" />
          </button>
          <button
            class="pill"
            type="button"
            tabindex="-1"
            aria-label="tout effacer"
            @click="emit('clear')"
          >
            <EditIcon name="clear" />
          </button>
          <button
            class="pill"
            type="button"
            tabindex="-1"
            aria-label="effacer une lettre"
            @click="emit('back')"
          >
            <EditIcon name="back" />
          </button>
        </div>
      </template>
      <span v-else class="letters">
        <span v-for="t in tiles" :key="t.id">{{ t.ch }}</span>
      </span>
    </div>
    <span v-if="mode !== 'open'" class="puzzle-tab" aria-hidden="true" />
  </div>
</template>

<style scoped>
.piece {
  --fill: var(--piece);
  min-width: 0;
  display: flex;
  flex-direction: column;
  color: var(--ink);
  user-select: none;
}
/* Keep the content clear of the hole (and its outline). */
.hole-left .body {
  padding-left: calc(0.8rem + var(--rx));
}
.hole-right .body {
  padding-right: calc(0.8rem + var(--rx));
}
.hole-top .body {
  padding-top: calc(1rem + var(--ry));
}
.hole-bottom .body {
  padding-bottom: calc(1rem + var(--ry));
}
.body {
  flex: 1;
  min-width: 0;
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1rem 0.8rem;
}
/* Found: the piece locks in its full colour. */
.solved {
  --fill: var(--tint);
}

/* Being edited: lifted off the board on a taller ledge. */
.active:not(.is-open) {
  --ledge: 7px;
  transform: translateY(-4px);
}
.opens {
  cursor: pointer;
}
/* Unsolved and not being edited: step back so the open one (or none) stands out. */
.dimmed:not(.solved) {
  /* Paler fill and ink rather than opacity, which would let neighbouring tabs
     and outlines show through where merged pieces overlap. */
  --fill: color-mix(in srgb, var(--piece) 55%, var(--bg));
  color: color-mix(in srgb, var(--ink) 55%, var(--bg));
}
.opens:active {
  --ledge: 0px;
  transform: translateY(3px);
}
.opens:focus-visible {
  outline: none;
}
.opens:focus-visible .body {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}

/* The editor under the board: a plain card, knobs gone. */
.is-open .body {
  gap: 1.1rem;
  padding: 2rem 1rem 1rem;
}

/* Assembled: square inner corners so the four read as one block, and push the
   content to the outer edge, away from the secret laid over the centre. */
.is-merged .body {
  padding: 0.8rem;
}
.is-merged.p0 .body,
.is-merged.p1 .body {
  justify-content: flex-start;
}
.is-merged.p2 .body,
.is-merged.p3 .body {
  justify-content: flex-end;
}
.is-merged.p0 .body {
  border-radius: 1rem 0 0 0;
}
.is-merged.p1 .body {
  border-radius: 0 1rem 0 0;
}
.is-merged.p2 .body {
  border-radius: 0 0 0 1rem;
}
.is-merged.p3 .body {
  border-radius: 0 0 1rem 0;
}

.word {
  font-weight: 900;
  /* Shrinks with the word's length (+2 for the check) to stay on one line. */
  font-size: clamp(0.6rem, calc(100cqi / (var(--n) + 2) / 0.8), 1.1rem);
  letter-spacing: 0.06em;
  white-space: nowrap;
  text-transform: uppercase;
  text-align: center;
  animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.check {
  display: inline-grid;
  place-items: center;
  width: 1.3em;
  height: 1.3em;
  margin-right: 0.35em;
  border-radius: 50%;
  font-size: 0.75em;
  letter-spacing: 0;
  vertical-align: 0.15em;
  color: var(--tint);
  background: var(--on-color);
}
.is-open .word {
  font-size: 2rem;
}
.is-merged .letters {
  font-size: clamp(0.6rem, calc(100cqi / var(--n) / 1.05), 0.95rem);
}
.is-merged .word {
  font-size: clamp(0.6rem, calc(100cqi / (var(--n) + 2) / 0.8), 0.95rem);
}

/* Shuffled letters on the board: what the player has to work with. */
.letters {
  display: flex;
  justify-content: center;
  gap: 0.25em;
  font-weight: 900;
  /* One line, shrinking with the word's length (`--n`) to fit the piece. */
  font-size: clamp(0.6rem, calc(100cqi / var(--n) / 1.05), 1.3rem);
  line-height: 1;
  text-transform: uppercase;
}

/* Answer: one underline per letter. */
.slots {
  display: flex;
  justify-content: center;
  gap: 0.22rem;
  max-width: 100%;
}
.slots.shake {
  animation: shake 0.4s ease;
}
.slot {
  flex: 0 1 auto;
  width: min(0.7rem, calc(100cqi / var(--n) - 0.22rem));
  min-width: 0;
  height: 1rem;
  display: grid;
  place-items: end center;
  font-weight: 900;
  font-size: 0.8rem;
  line-height: 1;
  text-transform: uppercase;
  border-bottom: 2px solid color-mix(in srgb, var(--ink) 30%, transparent);
}
.slot.given {
  color: color-mix(in srgb, var(--ink) 55%, var(--tint));
}
.slot.gap-after {
  margin-right: 0.4rem;
}
.is-open .slots {
  gap: 0.5rem;
}
.is-open .slot {
  width: min(2rem, calc(100cqi / var(--n) - 0.5rem));
  height: 2.6rem;
  padding: 0 0 0.2rem;
  font: inherit;
  font-weight: 900;
  font-size: 1.8rem;
  color: var(--ink);
  background: none;
  border: 0;
  border-bottom: 3px solid color-mix(in srgb, var(--ink) 30%, transparent);
  border-radius: 0.3rem 0.3rem 0 0;
  cursor: pointer;
}
.is-open .slot:focus-visible {
  outline: none;
}
.is-open .slot.given {
  color: color-mix(in srgb, var(--ink) 55%, var(--tint));
  cursor: default;
}
.is-open .slot.caret {
  background: color-mix(in srgb, var(--panel) 45%, transparent);
  border-bottom-color: var(--ink);
}
.is-open .slot.set {
  animation: pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.is-open .slot.gap-after {
  margin-right: 1.1rem;
}

.tiles {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  max-width: 20rem;
}
.tile {
  width: 2.6rem;
  height: 2.8rem;
  display: grid;
  place-items: center;
  padding: 0;
  font: inherit;
  font-weight: 900;
  font-size: 1.35rem;
  text-transform: uppercase;
  color: var(--ink);
  background: var(--tile);
  border: var(--outline-w) solid var(--outline);
  border-radius: 0.6rem;
  box-shadow: var(--lift);
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    transform 0.08s ease;
}
.tile:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: none;
}
.tile:disabled {
  opacity: 0.35;
  box-shadow: none;
  cursor: default;
}
</style>
