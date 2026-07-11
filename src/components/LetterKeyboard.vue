<script setup>
import { computed } from 'vue';

const props = defineProps({
  /* One row of letters per source word, in wheel/corner order (w0..w3). */
  rows: { type: Array, required: true },
  /* Total tiles per letter (fixed): total minus remaining = how many are spent. */
  pool: { type: Object, required: true },
  /* Tiles left per letter (drops as the guess is typed): drives the spent grey-out. */
  remaining: { type: Object, required: true },
  /* Per-row solved flag: a solved word's row is filled solid instead of outlined. */
  solved: { type: Array, default: () => [] },
});

const emit = defineEmits(['key', 'backspace', 'clear']);

/* Per-row accent, matched to each corner wheel in GameView (w0..w3). */
const ROW_TINTS = ['var(--sky)', 'var(--rose)', 'var(--lemon)', 'var(--mint)'];

/*
 * Tray cells with a spent flag. Spend is count-based (pool - remaining per letter),
 * so we grey the earliest tiles of each letter in tray order until the spent budget
 * for that letter is used up — a letter shared by two words greys its first tile first.
 */
const grid = computed(() => {
  const budget = {};
  for (const ch in props.pool) budget[ch] = (props.pool[ch] ?? 0) - (props.remaining[ch] ?? 0);
  const used = {};
  return props.rows.map((row, r) =>
    row.map((ch, c) => {
      const spent = (used[ch] ?? 0) < (budget[ch] ?? 0);
      if (spent) used[ch] = (used[ch] ?? 0) + 1;
      return { ch, spent, key: `${r}-${c}` };
    }),
  );
});

function rowStyle(r) {
  return { '--tint': ROW_TINTS[r] ?? ROW_TINTS[0] };
}
</script>

<template>
  <div class="tray">
    <div v-for="(row, r) in grid" :key="r" class="trow" :style="rowStyle(r)">
      <button
        v-for="cell in row"
        :key="cell.key"
        class="key"
        type="button"
        :class="{ spent: cell.spent, filled: solved[r] }"
        :disabled="cell.spent"
        @click="emit('key', cell.ch)"
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
