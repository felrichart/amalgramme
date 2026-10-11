import { reactive } from 'vue';

/*
 * A fixed-length answer being typed: one cell per letter (null = empty), the
 * leading `floor` cells locked (help-given), and a cursor the player can park on
 * any unlocked cell. Placing a value fills the cursor cell and jumps to the next
 * empty one.
 */
export function useEntry() {
  const cells = reactive([]);
  const state = reactive({ floor: 0, cursor: 0 });

  /* Every unlocked cell set (locked ones may hold nothing: the secret shows its
   * help-given letters itself). */
  const isFull = () => cells.length > 0 && cells.every((c, i) => i < state.floor || c != null);

  /* First empty unlocked cell at or after `from`, wrapping; `fallback` when none. */
  function nextEmpty(from, fallback) {
    for (let k = 0; k < cells.length; k++) {
      const i = (from + k) % cells.length;
      if (i >= state.floor && cells[i] == null) return i;
    }
    return fallback;
  }

  /* Empty `len` cells, the first `floor` locked and pre-filled from `prefix`. */
  function reset(len, floor = 0, prefix = []) {
    cells.splice(0, cells.length, ...Array.from({ length: len }, (_, i) => prefix[i] ?? null));
    state.floor = Math.min(floor, len);
    state.cursor = nextEmpty(state.floor, Math.max(0, len - 1));
  }

  /* Lock `floor` leading cells (pre-filled from `prefix`), keeping the rest. */
  function lock(floor, prefix = []) {
    for (let i = 0; i < floor; i++) cells[i] = prefix[i] ?? null;
    state.floor = Math.min(floor, cells.length);
    if (state.cursor < state.floor) state.cursor = nextEmpty(state.floor, cells.length - 1);
  }

  /* Fill the cursor cell (replacing what was there); true once every cell is set. */
  function place(value) {
    cells[state.cursor] = value;
    state.cursor = nextEmpty(state.cursor + 1, state.cursor);
    return isFull();
  }

  /* Clear the cursor cell, or the one before it when the cursor sits on an empty cell. */
  function back() {
    let i = state.cursor;
    if (cells[i] == null && i > state.floor) i--;
    if (i < state.floor) return;
    cells[i] = null;
    state.cursor = i;
  }

  function move(i) {
    if (i >= state.floor && i < cells.length) state.cursor = i;
  }

  function step(delta) {
    move(state.cursor + delta);
  }

  function clear() {
    for (let i = state.floor; i < cells.length; i++) cells[i] = null;
    state.cursor = nextEmpty(state.floor, state.floor);
  }

  return { cells, state, isFull, reset, lock, place, back, move, step, clear };
}
