<script setup>
/*
 * The days played, oldest on the left, a chip each: its weekday, its date's
 * figures in its colour, its month and the marks it won. Thin arrows on both
 * sides step to the day before or after, as a swipe does; the picked day stays
 * scrolled into view.
 */
import { ref, watch, onMounted, nextTick } from 'vue';
import { dayOfMonth, shortMonth, shortWeekday } from '../days.js';
import DicoMarks from './DicoMarks.vue';

const props = defineProps({
  // `{ date, color, marks }`, oldest first.
  days: { type: Array, required: true },
  picked: { type: String, required: true },
  today: { type: String, required: true },
});
const emit = defineEmits(['pick', 'step']);

const strip = ref(null);
function center(smooth) {
  const el = strip.value;
  const chip = el?.querySelector('[aria-current="date"]');
  if (!chip) return;
  const left = chip.offsetLeft - el.clientWidth / 2 + chip.offsetWidth / 2;
  el.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
}
onMounted(() => center(false));
watch(
  () => [props.picked, props.days.length],
  () => nextTick(() => center(true)),
);

const first = () => props.days[0]?.date === props.picked;
const last = () => props.days.at(-1)?.date === props.picked;
</script>

<template>
  <nav class="frieze" aria-label="les jours">
    <button
      class="thin"
      type="button"
      aria-label="jour d'avant"
      :disabled="first()"
      @click="emit('step', -1)"
    >
      <svg viewBox="0 0 10 40" aria-hidden="true"><path d="M8 4 2 20l6 16" /></svg>
    </button>
    <div ref="strip" class="strip">
      <button
        v-for="d in days"
        :key="d.date"
        class="chip"
        :class="{ on: d.date === picked }"
        type="button"
        :aria-current="d.date === picked ? 'date' : undefined"
        :style="{ '--c': d.color }"
        @click="emit('pick', d.date)"
      >
        <span class="wd">{{ d.date === today ? 'auj.' : shortWeekday(d.date) }}</span>
        <span class="dn">{{ dayOfMonth(d.date) }}</span>
        <span class="mo">{{ shortMonth(d.date) }}</span>
        <DicoMarks class="marks" :level="d.marks" />
      </button>
    </div>
    <button
      class="thin"
      type="button"
      aria-label="jour d'après"
      :disabled="last()"
      @click="emit('step', 1)"
    >
      <svg viewBox="0 0 10 40" aria-hidden="true"><path d="m2 4 6 16-6 16" /></svg>
    </button>
  </nav>
</template>

<style scoped>
.frieze {
  flex: none;
  display: flex;
  align-items: stretch;
  padding: 0 4px;
}
.thin {
  flex: none;
  width: 20px;
  padding: 0 0 6px;
  border: 0;
  background: none;
  color: var(--dc-dash);
  cursor: pointer;
}
.thin:disabled {
  opacity: 0.3;
  cursor: default;
}
.thin svg {
  width: 10px;
  height: 40px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.strip {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 6px;
  padding: 4px 4px 10px;
  overflow-x: auto;
  scrollbar-width: none;
}
.strip::-webkit-scrollbar {
  display: none;
}
.chip {
  flex: none;
  width: 46px;
  min-height: 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 6px 0 5px;
  border: 0;
  border-radius: 12px;
  background: var(--dc-board);
  box-shadow: inset 0 -2px 0 var(--dc-board-edge);
  cursor: pointer;
}
.chip.on {
  box-shadow:
    inset 0 -2px 0 var(--dc-board-edge),
    inset 0 0 0 2px var(--dc-ink);
}
.wd {
  font-family: var(--dc-mono);
  font-size: 10px;
  color: var(--dc-faint);
}
.dn {
  font-family: var(--dc-serif);
  font-size: 19px;
  line-height: 1.1;
  color: color-mix(in srgb, var(--c) 78%, black);
}
.mo {
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  color: var(--dc-faint);
}
/* Shown, not explained here: a tap picks the day. */
.marks {
  margin-top: 3px;
  font-size: 10px;
  pointer-events: none;
}
</style>
