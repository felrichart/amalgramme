<script setup>
const props = defineProps({
  word: { type: Object, required: true },
  input: { type: Array, required: true },
  wordIndex: { type: Number, required: true },
  pool: { type: Object, required: true },
  active: Boolean,
  activeSlot: { type: Number, default: null },
  solved: Boolean,
})
const emit = defineEmits(['select-word', 'select-slot', 'tap-letter'])

function buzz(ms = 12) {
  if (navigator.vibrate) navigator.vibrate(ms)
}
function tapLetter(t) {
  if (!props.active || props.pool.used.has(t.id)) return
  buzz()
  emit('tap-letter', t.letter)
}
</script>

<template>
  <div class="word" :class="{ active, solved }">
    <div class="cells" @click="emit('select-word', wordIndex)">
      <template v-for="(slot, i) in word.slots" :key="i">
        <span v-if="slot.gap" class="gap" />
        <button
          v-else
          class="cell"
          :class="{ filled: !!input[slot.letterIndex], cursor: active && activeSlot === slot.letterIndex }"
          type="button"
          @click.stop="emit('select-slot', wordIndex, slot.letterIndex)"
        >
          <Transition name="pop">
            <span v-if="input[slot.letterIndex]" :key="input[slot.letterIndex]">{{ input[slot.letterIndex] }}</span>
          </Transition>
        </button>
      </template>
    </div>

    <div class="pool" :class="{ active }">
      <TransitionGroup name="key">
        <button
          v-for="t in pool.tiles"
          :key="t.id"
          class="pkey"
          :class="{ used: pool.used.has(t.id) }"
          type="button"
          tabindex="-1"
          @click.stop="tapLetter(t)"
        >{{ t.letter }}</button>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.word {
  padding: 0.5rem 0.4rem;
  border-radius: 0.9rem;
  transition: background 0.2s ease, transform 0.2s ease;
}
.word.active { background: color-mix(in srgb, var(--accent) 32%, transparent); }

.cells {
  display: flex;
  justify-content: center;
  gap: var(--cell-gap, 0.28rem);
  cursor: pointer;
}
.gap { width: 0.6rem; }

/* Crossword slot: an inset square on the "board". */
.cell {
  position: relative;
  width: var(--cell, 2.1rem);
  height: var(--cell, 2.1rem);
  border: none;
  padding: 0;
  border-radius: 0.28rem;
  background: color-mix(in srgb, var(--patch) 12%, #fff);
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--patch) 40%, transparent),
    inset 0 2px 4px rgba(90, 59, 30, 0.14);
  font-family: inherit;
  font-weight: 800;
  font-size: calc(var(--cell, 2.1rem) * 0.55);
  color: var(--ink);
  text-transform: uppercase;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}
/* Filled slot: a raised scrabble tile. */
.cell.filled {
  background: linear-gradient(180deg, #fbf0d2, #f2ddaf);
  box-shadow: inset 0 0 0 1px rgba(90, 59, 30, 0.25), 0 3px 0 var(--patch),
    0 4px 6px rgba(90, 59, 30, 0.22);
  color: var(--patch-dark);
}
.cell.cursor {
  box-shadow: inset 0 0 0 2.5px var(--orange), 0 3px 0 var(--patch);
  transform: translateY(-1px);
}
.cell:active { transform: scale(0.94); }
.word.solved .cell.filled { background: linear-gradient(180deg, #f6d9a0, #eec078); }

/* The word's own letters, always visible; enlarge + become tappable when active. */
.pool {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 0.35rem;
  min-height: 1rem;
  opacity: 0.4;
  transition: opacity 0.2s ease;
}
.pool.active { opacity: 1; }
.pkey {
  width: 1.35rem;
  height: 1.55rem;
  border: none;
  border-radius: 0.22rem;
  background: var(--tan);
  color: var(--patch-dark);
  font-family: inherit;
  font-weight: 800;
  font-size: 0.85rem;
  text-transform: uppercase;
  pointer-events: none;
  transition: width 0.18s ease, height 0.18s ease, font-size 0.18s ease,
    transform 0.1s ease, opacity 0.2s ease, background 0.2s ease;
}
.pool.active .pkey {
  width: 2.4rem;
  height: 2.7rem;
  font-size: 1.3rem;
  pointer-events: auto;
  box-shadow: 0 3px 0 var(--patch-dark);
  cursor: pointer;
}
.pool.active .pkey:active { transform: translateY(3px); box-shadow: 0 0 0 var(--patch-dark); }
.pkey.used { opacity: 0.25; }
.pool.active .pkey.used {
  background: color-mix(in srgb, var(--patch) 12%, #fff);
  box-shadow: none;
  pointer-events: none;
}

.pop-enter-active { animation: pop-in 0.24s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes pop-in {
  0% { transform: scale(0.3); opacity: 0; }
  60% { transform: scale(1.18); }
  100% { transform: scale(1); opacity: 1; }
}
.key-move { transition: transform 0.4s cubic-bezier(0.34, 1.2, 0.4, 1); }
</style>
