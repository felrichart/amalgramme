<script setup>
import { computed } from 'vue';
import { WHEEL_TINTS } from '../palette.js';

const props = defineProps({
  /* One row of { id, ch } tiles per source word, in wheel/corner order (w0..w3). */
  rows: { type: Array, required: true },
  /* Set of `${row}-${id}` keys for tiles already spent on the guess (grey-out). */
  spent: { type: Object, default: () => new Set() },
  /* Per-row solved flag: a solved word's row is filled solid instead of outlined. */
  solved: { type: Array, default: () => [] },
  /* The puzzle carries an extra hint → show the lightbulb (hidden on old levels). */
  hasHint: { type: Boolean, default: false },
  /* The extra hint is already unlocked → the bulb becomes the revealed word chip. */
  hintRevealed: { type: Boolean, default: false },
  /* The extra hint's display text, shown in the chip once revealed. */
  hint: { type: String, default: '' },
});

const emit = defineEmits(['key', 'backspace', 'clear', 'hint']);

/* Tray cells keyed by their exact tile so the pressed tile — not a look-alike — greys out. */
const grid = computed(() =>
  props.rows.map((row, r) =>
    row.map((t) => ({ r, id: t.id, ch: t.ch, spent: props.spent.has(`${r}-${t.id}`) })),
  ),
);

function rowStyle(r) {
  /* --n drives per-key font shrink so a row always stays on one line. */
  return { '--tint': WHEEL_TINTS[r] ?? WHEEL_TINTS[0], '--n': grid.value[r].length };
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
        tabindex="-1"
        :class="{ spent: cell.spent, filled: solved[r] }"
        :disabled="cell.spent"
        @pointerdown="emit('key', { r: cell.r, id: cell.id, ch: cell.ch })"
      >
        {{ cell.ch }}
      </button>
    </div>
    <div class="trow bar">
      <!-- Revealed: the bulb becomes a lime chip showing the hint word, right where
           the secret is built. Unrevealed: the tappable lightbulb opens the Aide popup. -->
      <div v-if="hasHint && hintRevealed" class="hint-chip">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2h5c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>{{ hint }}</span>
      </div>
      <button
        v-else-if="hasHint"
        class="key bulb"
        type="button"
        tabindex="-1"
        @click="emit('hint')"
        aria-label="aide"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2h5c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        class="key wide"
        type="button"
        tabindex="-1"
        @click="emit('backspace')"
        aria-label="reculer"
      >
        ⌫
      </button>
      <button
        class="key wide"
        type="button"
        tabindex="-1"
        @click="emit('clear')"
        aria-label="tout effacer"
      >
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
  flex-wrap: nowrap;
  gap: 0.35rem;
  padding: 0.28rem 0.4rem;
  border-radius: 0.9rem;
  width: 100%;
  container-type: inline-size;
}
.trow.bar {
  gap: 0.5rem;
  /* Inset the hint/backspace/clear group ~10% each side so they don't hug the edges. */
  padding: 0 10%;
  margin-top: 0.15rem;
}
.key {
  position: relative;
  /* Keys share the row evenly and may shrink below content so the row never wraps. */
  flex: 1 1 0;
  min-width: 0;
  max-width: 2.8rem;
  height: 2.8rem;
  padding: 0 0.3rem;
  display: grid;
  place-items: center;
  border-radius: 0.6rem;
  font-weight: 900;
  /* ~half a key's width (each key ≈ 100cqi/n), clamped for readability. */
  font-size: clamp(0.55rem, calc(48 / var(--n, 7) * 1cqi), 1.15rem);
  text-transform: uppercase;
  color: var(--ink);
  cursor: pointer;
  /* Unsolved: a light wash of the row's accent. Solved rows lock solid (.filled). */
  background: var(--tint-wash);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
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
  flex: 0 0 auto;
  min-width: 4.4rem;
  max-width: none;
  padding: 0 0.9rem;
  font-size: 1.3rem;
  color: var(--ink);
  background: var(--panel);
}
.key.wide:active {
  background: var(--ink);
  color: var(--panel);
}
/* Lightbulb: sits on the left of the bar row; margin-right:auto pushes the
   backspace/clear controls apart to the right, so the bulb reads as separate. */
.key.bulb {
  flex: 0 0 auto;
  min-width: 3.4rem;
  max-width: none;
  margin-right: auto;
  color: #000;
  background: color-mix(in srgb, var(--lime) 20%, #fff);
}
.key.bulb:not(:disabled):active {
  background: var(--lime);
  color: #fff;
}
/* Revealed hint chip: replaces the bulb in place, showing the word in the lime
   tint. margin-right:auto keeps the backspace/clear controls pushed apart. */
.hint-chip {
  flex: 0 1 auto;
  min-width: 0;
  margin-right: auto;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  height: 2.8rem;
  padding: 0 0.7rem;
  border-radius: 0.6rem;
  font-weight: 900;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: #fff;
  background: var(--lime);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.hint-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
