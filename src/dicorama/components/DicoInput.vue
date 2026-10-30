<script setup>
/*
 * The word being typed, a slot per letter: fixed letters are cards of the day's
 * colour, typed ones light cards rising into their slot (falling out when erased
 * or replaced). A found word's cards dip into their slots in a wave, the typed
 * ones turning over to the day's colour, then slide out to the right through the
 * slots; the fixed letters rise again after. A word already found only dips.
 *
 * Each slot shows, through its window, the whole row of cards shifted to its
 * place, so a card sliding right crosses the next slots.
 */
import { ref, computed, watch, onUnmounted } from 'vue';
import { WAVE_STAGGER, WAVE_MS } from '../useDicorama.js';

const props = defineProps({
  slots: { type: Array, required: true },
  // The blank the next letter goes to, or null.
  cursor: { type: Number, default: null },
  phase: { type: String, default: null },
  round: { type: Number, default: 0 },
  shake: { type: Number, default: 0 },
  // Counts the words retyped, each answered with a wave.
  wave: { type: Number, default: 0 },
});
const emit = defineEmits(['pick']);

// How long an erased card takes to fall, in ms.
const FALL_MS = 240;

const cursorAt = computed(() =>
  props.cursor == null ? -1 : props.slots.findIndex((s) => s.b === props.cursor),
);

/* Cards leaving their slot: the letter erased or replaced, where it was. */
const falling = ref([]);
let fallId = 0;
const timers = new Set();
onUnmounted(() => timers.forEach(clearTimeout));
watch(
  () => props.slots,
  (now, old) => {
    // A found word slides out instead.
    if (props.phase === 'in') return;
    now.forEach((s, j) => {
      const was = old[j];
      if (s.fixed || !was.ch || was.gen === s.gen) return;
      const id = ++fallId;
      falling.value.push({ id, j, ch: was.ch });
      const t = setTimeout(() => {
        timers.delete(t);
        falling.value = falling.value.filter((f) => f.id !== id);
      }, FALL_MS);
      timers.add(t);
    });
  },
);

/* Restarts the shake on each rejected word. */
const shaking = ref(false);
watch(
  () => props.shake,
  () => {
    shaking.value = false;
    requestAnimationFrame(() => (shaking.value = true));
  },
);

/*
 * The last retyped word's wave: the cards there then are remade to dip once, and
 * keep that class after so their rise doesn't replay.
 */
const waved = ref(null);
watch(
  () => props.wave,
  (n) => {
    const gen = Math.max(0, ...props.slots.map((s) => s.gen ?? 0));
    waved.value = { n, round: props.round, gen };
  },
);

const cards = computed(() => {
  const w = waved.value?.round === props.round ? waved.value : null;
  const list = props.slots.flatMap((s, j) => {
    const delay = j * WAVE_STAGGER;
    if (s.fixed) {
      // Remade per wave, a found word's or the last retyped one's, so each plays once.
      const wave = ['flip', 'out'].includes(props.phase) ? 'win' : w && `w${w.n}`;
      const cls = ['fixed', { dip: !!wave, 'rise-late': props.phase === 'in' }];
      return [{ id: `f${j}-${props.round}-${wave || ''}`, j, ch: s.ch, cls, delay }];
    }
    if (!s.ch) return [];
    const inWave = w && s.gen <= w.gen;
    const cls = [
      'typed',
      props.phase === 'flip' ? 'flip' : props.phase === 'out' ? 'solid' : inWave ? 'dip' : 'rise',
    ];
    const id = `t${j}-${s.gen}${inWave ? `-w${w.n}` : ''}`;
    return [{ id, j, ch: s.ch, cls, delay }];
  });
  return [
    ...falling.value.map((f) => ({ id: `x${f.id}`, j: f.j, ch: f.ch, cls: ['typed', 'fall'] })),
    ...list,
  ];
});

const label = (s, i) => (s.fixed ? `lettre fixe ${s.ch}` : `case ${i + 1}, ${s.ch ?? 'vide'}`);
</script>

<template>
  <div
    class="machine"
    :class="{ seven: slots.length >= 7 }"
    :style="{ '--n': slots.length, '--wave': `${WAVE_MS}ms` }"
    aria-live="polite"
  >
    <span v-for="(s, i) in slots" :key="i" class="seat">
      <span v-if="i === cursorAt" class="dc-arrow-down arrow" aria-hidden="true" />
      <button
        class="window"
        :class="{ current: i === cursorAt }"
        type="button"
        tabindex="-1"
        :disabled="s.fixed || cursor == null"
        :aria-label="label(s, i)"
        @click="emit('pick', s.b)"
      >
        <span v-if="!s.fixed" class="dash" />
        <span class="clip">
          <span
            class="strip"
            :class="{ out: phase === 'out', shaking: shaking && !phase }"
            :style="{ '--i': i }"
            @animationend.self="shaking = false"
          >
            <span
              v-for="c in cards"
              :key="c.id"
              class="card"
              :class="c.cls"
              :style="{ '--j': c.j, '--delay': `${c.delay ?? 0}ms` }"
              >{{ c.ch }}</span
            >
          </span>
        </span>
      </button>
    </span>
  </div>
</template>

<style scoped>
.machine {
  --gap: 8px;
  display: grid;
  grid-template-columns: repeat(var(--n), minmax(0, 50px));
  justify-content: center;
  gap: var(--gap);
}
.machine.seven {
  --gap: 6px;
}
@media (max-height: 720px) {
  .machine {
    grid-template-columns: repeat(var(--n), minmax(0, 44px));
  }
}
.seat {
  position: relative;
  display: block;
}
.arrow {
  position: absolute;
  left: 50%;
  top: -18px;
  animation: dico-bob 0.55s ease-in-out infinite alternate;
}
.window {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 50 / 62;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: var(--dc-slot);
  box-shadow:
    inset 0 4px 6px rgb(0 0 0 / 0.55),
    0 1px 0 rgb(255 255 255 / 0.35);
  container-type: inline-size;
  cursor: pointer;
}
.window:disabled {
  cursor: default;
}
.window.current {
  box-shadow:
    inset 0 4px 6px rgb(0 0 0 / 0.55),
    0 1px 0 rgb(255 255 255 / 0.35),
    0 0 0 2px var(--dc-yellow);
}
.dash {
  position: absolute;
  left: 28%;
  right: 28%;
  bottom: 19%;
  height: 2px;
  border-radius: 1px;
  background: var(--dc-dash);
}
.clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 6px;
  clip-path: inset(0 round 6px);
  transform: translateZ(0);
}
/* The whole row of cards, shifted so card i sits in slot i. */
.strip {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--i) * -1 * (100% + var(--gap)));
  width: 100%;
}
.strip.out {
  animation: dico-out 0.32s cubic-bezier(0.5, 0, 0.75, 0.4) both;
}
.strip.shaking {
  animation: dico-shake 0.4s ease-in-out both;
}
@keyframes dico-out {
  to {
    transform: translateX(calc(var(--n) * (100% + var(--gap))));
  }
}
/* A card runs on well below its slot (its letter kept centred in the visible
   part), so a rebound never shows the slot's floor. */
.card {
  position: absolute;
  left: calc(var(--j) * (100% + var(--gap)) + 8%);
  width: 84%;
  top: 8%;
  bottom: -40cqw;
  padding-bottom: 36cqw;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 24cqw 24cqw 4cqw 4cqw;
  font-family: var(--dc-serif);
  font-size: 72cqw;
  line-height: 1;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.35),
    inset 0 -2px 0 rgb(0 0 0 / 0.08);
}
.card.fixed {
  background: var(--day);
  color: var(--dc-cream);
}
.card.dip {
  animation: dico-dip var(--wave) var(--delay) both;
}
.card.rise-late {
  animation: dico-rise 0.3s cubic-bezier(0.25, 0.8, 0.3, 1) 60ms both;
}
.card.typed {
  background: var(--dc-tint);
  color: var(--dc-day-ink);
}
.card.rise {
  animation: dico-rise 0.24s cubic-bezier(0.25, 0.8, 0.3, 1) both;
}
.card.fall {
  animation: dico-fall 0.2s cubic-bezier(0.5, 0, 0.75, 0.4) both;
}
.card.flip {
  animation: dico-flip var(--wave) var(--delay) both;
}
.card.solid {
  background: var(--day);
  color: var(--dc-cream);
}
</style>
