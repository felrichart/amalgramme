<script setup>
import { computed } from 'vue';
import { answerSlots } from '../game/puzzle.js';

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

const slots = computed(() => answerSlots(props.word, props.typed));
const opens = computed(() => props.mode !== 'open' && !props.solved && !props.active);
</script>

<template>
  <div
    class="piece"
    :class="[`is-${mode}`, `p${index}`, { solved, active, opens }]"
    :role="opens ? 'button' : undefined"
    :tabindex="opens ? 0 : undefined"
    :aria-label="opens ? `mot ${index + 1}` : undefined"
    @click="opens && emit('open')"
    @keydown.enter="opens && emit('open')"
  >
    <div class="body">
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
          <button class="pill" type="button" tabindex="-1" @click="emit('shuffle')">
            ⟲ Mélanger
          </button>
          <button class="pill" type="button" tabindex="-1" @click="emit('clear')">Effacer</button>
          <button
            class="pill"
            type="button"
            tabindex="-1"
            aria-label="effacer une lettre"
            @click="emit('back')"
          >
            ⌫
          </button>
        </div>
      </template>
      <template v-else>
        <span v-if="mode === 'overview'" class="slots">
          <span
            v-for="(s, i) in slots"
            :key="i"
            class="slot"
            :class="{ set: s.ch, given: i < given, 'gap-after': s.gapAfter }"
            >{{ s.ch }}</span
          >
        </span>
        <span v-if="mode === 'overview'" class="letters">
          <span v-for="t in tiles" :key="t.id">{{ t.ch }}</span>
        </span>
      </template>
    </div>
    <span class="tab" aria-hidden="true" />
  </div>
</template>

<style scoped>
/*
 * Each piece has one tab and one hole, placed so the four interlock when merged
 * (w0 → w1 → w3 → w2 → w0). A tab is centred `--k` past its edge; the matching
 * hole sits `--k` inside the neighbour's edge, so they coincide once flush.
 */
.piece {
  --k: 0.3rem;
  --rx: 0.62rem;
  --ry: 0.5rem;
  --fill: var(--piece);
  --edge: color-mix(in srgb, var(--tint) 55%, var(--piece));
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  color: var(--ink);
  /* One soft ledge under body + tab together (a box-shadow would be masked off). */
  filter: drop-shadow(0 4px 0 var(--edge));
  view-transition-name: var(--vt);
}
.p0 {
  --tx: calc(100% + var(--k));
  --ty: 50%;
  --hole: 50% calc(100% - var(--k));
}
.p1 {
  --tx: 50%;
  --ty: calc(100% + var(--k));
  --hole: var(--k) 50%;
}
.p2 {
  --tx: 50%;
  --ty: calc(-1 * var(--k));
  --hole: calc(100% - var(--k)) 50%;
}
.p3 {
  --tx: calc(-1 * var(--k));
  --ty: 50%;
  --hole: 50% var(--k);
}
.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1rem 0.8rem;
  border-radius: 1rem;
  background: var(--fill);
  mask: radial-gradient(var(--rx) var(--ry) at var(--hole), #0000 99%, #000 100%);
}
.tab {
  position: absolute;
  left: calc(var(--tx) - var(--rx));
  top: calc(var(--ty) - var(--ry));
  width: calc(2 * var(--rx));
  height: calc(2 * var(--ry));
  border-radius: 50%;
  background: var(--fill);
}
/* Found: the piece locks in its full colour, the word knocked out in white. */
.solved {
  --fill: var(--tint);
  --edge: color-mix(in srgb, var(--tint) 70%, #000);
  color: #fff;
}

/* Being edited: an ink outline that follows the shape, tab included (four
   offset drop-shadows, since a mask would clip a real outline). */
.active:not(.is-open) {
  --o: 2.5px;
  filter: drop-shadow(var(--o) 0 0 var(--ink)) drop-shadow(calc(-1 * var(--o)) 0 0 var(--ink))
    drop-shadow(0 var(--o) 0 var(--ink)) drop-shadow(0 calc(-1 * var(--o)) 0 var(--ink))
    drop-shadow(0 4px 0 var(--edge));
}
.opens {
  cursor: pointer;
  transition: transform 0.12s ease;
}
.opens:active {
  transform: translateY(2px);
}
.opens:focus-visible {
  outline: none;
}
.opens:focus-visible .body {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}

/* The editor under the board: a plain card, knobs gone. */
.is-open .tab {
  display: none;
}
.is-open .body {
  mask: none;
  gap: 1.1rem;
  padding: 1.3rem 1rem 1rem;
}

/* Assembled: square inner corners so the four read as one block, and push the
   content to the outer edge, away from the secret laid over the centre. */
.is-merged {
  filter: none;
}
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
  font-size: 1.1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
  overflow-wrap: anywhere;
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
  background: #fff;
}
.is-open .word {
  font-size: 2rem;
}
.is-merged .word {
  font-size: 0.95rem;
}

/* Shuffled letters on the board: what the player has to work with. */
.letters {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.2rem 0.55rem;
  font-weight: 900;
  font-size: 1.15rem;
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
  width: 0.7rem;
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
  width: 2rem;
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
  border: 0;
  border-radius: 0.6rem;
  box-shadow: 0 3px 0 var(--edge);
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    transform 0.08s ease;
}
.tile:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--edge);
}
.tile:disabled {
  opacity: 0.35;
  box-shadow: none;
  cursor: default;
}
.edit-bar {
  display: flex;
  gap: 0.5rem;
}
.pill {
  background: color-mix(in srgb, var(--tile) 55%, transparent);
}
</style>
