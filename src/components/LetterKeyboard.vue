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
  min-width: 2.1rem;
  height: 2.7rem;
  padding: 0 0.35rem;
  display: grid;
  place-items: center;
  border-radius: 0.55rem;
  font-weight: 800;
  font-size: 1.15rem;
  text-transform: uppercase;
  color: var(--tint);
  cursor: pointer;
  background: var(--tile);
  border: 2px solid var(--tint);
  transition:
    transform 0.1s ease,
    opacity 0.18s ease;
}
.key:active {
  transform: scale(0.9);
  background: var(--tint);
  color: var(--bg);
}
.key:focus-visible {
  outline: 2px solid var(--tint);
  outline-offset: 2px;
}
/* Solved word: its row is filled solid in the accent with dark glyphs. */
.key.filled {
  color: var(--bg);
  background: var(--tint);
  border-color: var(--tint);
}
.key.spent {
  cursor: default;
  opacity: 0.24;
}
.key.wide {
  min-width: 4.4rem;
  padding: 0 0.9rem;
  font-size: 1.3rem;
  color: var(--muted);
  background: var(--panel);
  border-color: var(--line);
}
.key.wide:active {
  background: var(--tile);
  color: var(--ink);
}
</style>
