<script setup>
/*
 * The rare words' box, the list's last spot: empty until one is found, then a
 * small button to see them ("✦ 3"), at the spot's start. A rare word landing
 * grows it into a slot as wide as the spot: the word's card slides out, shows
 * itself and slides back in, then the slot shrinks into the button again.
 */
import { ref, computed, watch, onUnmounted } from 'vue';
import { RARE_MS } from '../useDicorama.js';
import DicoBook from './DicoBook.vue';

const props = defineProps({
  // The rare families found.
  count: { type: Number, required: true },
  // `{ word, fresh }`: the rare word landing, `fresh` when its family is new.
  arrival: { type: Object, default: null },
  // Changes with each rare word typed again.
  nudge: { type: Number, default: null },
  pointed: { type: Boolean, default: false },
});
const emit = defineEmits(['open']);

// The word going in, with the count before it, while it plays.
const playing = ref(null);
let runs = 0;
let timer = null;
watch(
  () => props.arrival,
  (a) => {
    if (!a) return;
    clearTimeout(timer);
    playing.value = { word: a.word, before: props.count - (a.fresh ? 1 : 0), n: ++runs };
    timer = setTimeout(() => (playing.value = null), RARE_MS);
  },
);
onUnmounted(() => clearTimeout(timer));

const nudging = ref(false);
watch(
  () => props.nudge,
  (n) => n != null && (nudging.value = true),
);

const shown = computed(() => playing.value?.before ?? props.count);
const label = computed(() => `${shown.value} mot${shown.value > 1 ? 's rares' : ' rare'}`);
</script>

<template>
  <div class="rare-line" :class="{ arrive: playing }" :style="{ '--rare-ms': `${RARE_MS}ms` }">
    <span class="mark" aria-hidden="true" />
    <div class="box">
      <button
        v-if="count"
        :key="playing ? `p${playing.n}` : 'idle'"
        class="open"
        :class="{ playing, first: playing && !playing.before, nudge: nudging }"
        type="button"
        :aria-label="label"
        @click="emit('open')"
        @animationend="nudging = false"
      >
        <DicoBook class="book" />
        <span class="count">{{ shown }}</span>
      </button>
      <span v-if="playing" :key="`h${playing.n}`" class="hole" aria-hidden="true">
        <span class="card"
          ><span class="text">{{ playing.word }}</span></span
        >
      </span>
    </div>
    <span class="pointer">
      <span v-if="pointed && !playing" class="dc-arrow-left" />
    </span>
  </div>
</template>

<style scoped>
.mark {
  flex: none;
  width: var(--num-w);
  height: var(--row);
}
.pointer {
  flex: none;
  width: var(--pointer-w);
  height: var(--row);
  display: flex;
  align-items: center;
}
.box {
  --small: 50px;
  position: relative;
  flex: 1;
  min-width: 0;
  height: var(--row);
}
.open {
  position: absolute;
  top: 0;
  bottom: 3px;
  left: 0;
  min-width: var(--small);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 9px;
  border: 0;
  border-radius: 8px;
  background: var(--dc-tint);
  box-shadow: 0 3px 0 var(--dc-day-soft);
  color: var(--dc-day-ink);
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}
.open:active {
  transform: translateY(3px);
  box-shadow: none;
}
.book {
  font-size: 15px;
}
.count {
  font-family: var(--dc-mono);
}
.open.playing {
  animation: open-away var(--rare-ms) ease-in-out both;
}
.open.first {
  animation-name: open-first;
}
.open.nudge {
  animation: dico-nudge 0.42s ease-in-out both;
}
/* The slot the word goes into, as a list's. */
.hole {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 3px;
  background: var(--dc-slot);
  box-shadow:
    inset 0 2px 3px rgb(0 0 0 / 0.6),
    0 1px 0 rgb(255 255 255 / 0.4);
  animation: hole var(--rare-ms) cubic-bezier(0.3, 0.7, 0.3, 1) both;
}
.card {
  position: absolute;
  left: 0;
  right: 3px;
  top: calc((var(--row) - var(--card)) / 2);
  height: var(--card);
  display: flex;
  align-items: center;
  padding: 0 6px 0 9px;
  border-radius: 0 7px 7px 0;
  background: var(--dc-tint);
  box-shadow:
    inset 3px 0 0 var(--day),
    inset 0 1px 0 rgb(255 255 255 / 0.5);
  color: var(--dc-day-ink);
  animation: card-in-out var(--rare-ms) cubic-bezier(0.25, 0.8, 0.3, 1) both;
}
.text {
  min-width: 0;
  font-family: var(--dc-serif);
  font-size: var(--fs);
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* The button gives way to the slot growing from it, and comes back once it has
 * shrunk again. */
@keyframes open-away {
  0% {
    opacity: 1;
  }
  6%,
  92% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
@keyframes open-first {
  0%,
  92% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
@keyframes hole {
  0% {
    clip-path: inset(0 calc(100% - var(--small)) 3px 0 round 8px);
  }
  14%,
  80% {
    clip-path: inset(0 0 0 0 round 3px);
  }
  96%,
  100% {
    clip-path: inset(0 calc(100% - var(--small)) 3px 0 round 8px);
  }
}
@keyframes card-in-out {
  0%,
  14% {
    transform: translateX(-104%);
  }
  32%,
  62% {
    transform: translateX(0);
  }
  78%,
  100% {
    transform: translateX(-104%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .open.playing,
  .hole,
  .card {
    animation-duration: 1ms;
  }
}
</style>
