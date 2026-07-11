<script setup>
import { computed } from 'vue';

const props = defineProps({
  /* One row of { id, ch } tiles per source word, in wheel/corner order (w0..w3). */
  rows: { type: Array, required: true },
  /* Set of `${row}-${id}` keys for tiles already spent on the guess (grey-out). */
  spent: { type: Object, default: () => new Set() },
  /* Per-row solved flag: a solved word's row is filled solid instead of outlined. */
  solved: { type: Array, default: () => [] },
});

const emit = defineEmits(['key', 'backspace', 'clear']);

/* Per-row accent, matched to each corner wheel in GameView (w0..w3). */
const ROW_TINTS = ['var(--sky)', 'var(--rose)', 'var(--lemon)', 'var(--mint)'];

/* Tray cells keyed by their exact tile so the pressed tile — not a look-alike — greys out. */
const grid = computed(() =>
  props.rows.map((row, r) =>
    row.map((t) => ({ r, id: t.id, ch: t.ch, spent: props.spent.has(`${r}-${t.id}`) })),
  ),
);

function rowStyle(r) {
  return { '--tint': ROW_TINTS[r] ?? ROW_TINTS[0] };
}
</script>

<template>
  <div class="tray">
    <div v-for="(row, r) in grid" :key="r" class="trow" :style="rowStyle(r)">
      <button
        v-for="cell in row"
        :key="`${cell.r}-${cell.id}`"
        class="key"
        type="button"
        :class="{ spent: cell.spent, filled: solved[r] }"
        :disabled="cell.spent"
        @click="emit('key', { r: cell.r, id: cell.id, ch: cell.ch })"
      >
        {{ cell.ch }}
      </button>
    </div>
    <div class="trow bar">
      <button class="key wide" type="button" @click="emit('backspace')" aria-label="reculer">
        ⌫
      </button>
      <button class="key wide" type="button" @click="emit('clear')" aria-label="tout effacer">
        ✕
      </button>
    </div>
  </div>
</template>

<style scoped>
.tray {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
}
.trow {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.28rem 0.4rem;
  border-radius: 0.9rem;
}
.trow.bar {
  gap: 0.5rem;
  padding: 0;
  margin-top: 0.15rem;
}
.key {
  position: relative;
  min-width: 2.2rem;
  height: 2.8rem;
  padding: 0 0.4rem;
  display: grid;
  place-items: center;
  border-radius: 0.6rem;
  font-weight: 900;
  font-size: 1.15rem;
  text-transform: uppercase;
  color: var(--ink);
  cursor: pointer;
  /* Unsolved: a light wash of the row's accent. Solved rows lock solid (.filled). */
  background: color-mix(in srgb, var(--tint, var(--sky-ink)) 20%, #fff);
  border: 2.5px solid var(--outline);
  box-shadow: 3px 4px 0 var(--outline);
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease,
    opacity 0.18s ease;
}
/* Press: the key drops into its shadow. */
.key:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
  background: var(--tint);
  color: #fff;
}
.key:focus-visible {
  outline: 2.5px solid var(--outline);
  outline-offset: 2px;
}
/* Solved word: its row locks filled solid in the accent with white glyphs. */
.key.filled {
  color: #fff;
  background: var(--tint);
  border-color: var(--outline);
}
.key.spent {
  cursor: default;
  opacity: 0.32;
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
.key.wide {
  min-width: 4.4rem;
  padding: 0 0.9rem;
  font-size: 1.3rem;
  color: var(--ink);
  background: var(--panel);
}
.key.wide:active {
  background: var(--ink);
  color: var(--panel);
}
</style>
