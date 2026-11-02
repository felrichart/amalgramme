<script setup>
/*
 * A level's badges, 1em high: the star once every riddle is found, then the
 * trophy once every word is. `hollow` shows the star's outline until it's won
 * (none otherwise). Hovering a badge, or tapping it (which then doesn't reach a
 * row it sits in), shows what it's won for in a bubble above it. `pop` animates
 * the last one on mount.
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import DicoStar from './DicoStar.vue';
import DicoTrophy from './DicoTrophy.vue';

const props = defineProps({
  star: { type: Boolean, default: false },
  trophy: { type: Boolean, default: false },
  hollow: { type: Boolean, default: false },
  pop: { type: Boolean, default: false },
});

const badges = computed(() => [
  ...(props.star || props.hollow
    ? [{ tip: props.star ? 'Toutes les énigmes' : 'Trouve toutes les énigmes', won: props.star }]
    : []),
  ...(props.trophy ? [{ tip: 'Tous les mots', won: true, trophy: true }] : []),
]);
const label = computed(() =>
  [props.star ? 'étoile' : '', props.trophy ? 'trophée' : ''].filter(Boolean).join(', '),
);

// The star whose bubble shows.
const tip = ref(null);
const hover = (i) => (e) => e.pointerType === 'mouse' && (tip.value = i);
const unhover = (e) => e.pointerType === 'mouse' && (tip.value = null);
const tap = (i) => (tip.value = tip.value === i ? null : i);

/* How far the bubble moves sideways to stay on the screen, its tail kept on the
 * star, and whether it goes under the star, for want of room above it. */
const EDGE = 8;
let bubbleEl = null;
const setBubble = (el) => (bubbleEl = el);
const shift = ref(0);
const under = ref(false);
watch(tip, async () => {
  shift.value = 0;
  under.value = false;
  await nextTick();
  if (!bubbleEl || tip.value == null) return;
  const r = bubbleEl.getBoundingClientRect();
  const right = document.documentElement.clientWidth - EDGE;
  shift.value = r.left < EDGE ? EDGE - r.left : r.right > right ? right - r.right : 0;
  under.value = r.top < EDGE;
});

const root = ref(null);
const outside = (e) => !root.value?.contains(e.target) && (tip.value = null);
onMounted(() => window.addEventListener('pointerdown', outside));
onUnmounted(() => window.removeEventListener('pointerdown', outside));
</script>

<template>
  <span
    v-if="badges.length"
    ref="root"
    class="marks"
    :class="{ pop }"
    role="img"
    :aria-label="label || 'pas encore d’étoile'"
  >
    <span
      v-for="(b, i) in badges"
      :key="i"
      class="slot"
      :class="{ apart: b.trophy }"
      @pointerenter="hover(i)($event)"
      @pointerleave="unhover"
      @click.stop.prevent="tap(i)"
    >
      <DicoTrophy v-if="b.trophy" class="mark" :class="{ fresh: i === badges.length - 1 }" />
      <DicoStar
        v-else
        class="mark"
        :class="{ fresh: b.won && i === badges.length - 1, hollow: !b.won }"
        :hollow="!b.won"
      />
      <span
        v-if="tip === i"
        :ref="setBubble"
        class="bubble"
        :class="{ under }"
        role="tooltip"
        :style="{ '--shift': `${shift}px` }"
        >{{ b.tip }}</span
      >
    </span>
  </span>
</template>

<style scoped>
.marks {
  display: inline-flex;
  align-items: center;
  gap: 0.18em;
}
.slot {
  position: relative;
  display: block;
  cursor: default;
}
.slot.apart {
  margin-left: 0.12em;
}
.mark {
  color: var(--dc-yellow);
  filter: drop-shadow(0 0.05em 0 rgb(60 40 0 / 0.55));
}
/* The star still to win: an outline in the day's colour. */
.mark.hollow {
  color: var(--dc-day-soft);
  filter: none;
}
/* Above the star (under it at the top of the screen), its tail at the star's
 * middle, the text running left: the stars often sit at the right of a row. */
.bubble {
  position: absolute;
  right: calc(50% - 16px);
  bottom: calc(100% + 8px);
  z-index: 30;
  padding: 6px 9px;
  border-radius: 7px;
  background: var(--dc-ink);
  color: var(--dc-cream);
  font-family: 'Instrument Sans', system-ui, sans-serif;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.18);
  pointer-events: none;
  translate: var(--shift, 0) 0;
  animation: dico-appear 0.14s ease-out both;
}
.bubble::after {
  content: '';
  position: absolute;
  top: 100%;
  right: calc(11px + var(--shift, 0px));
  border: 5px solid transparent;
  border-top-color: var(--dc-ink);
}
.bubble.under {
  top: calc(100% + 8px);
  bottom: auto;
}
.under::after {
  top: auto;
  bottom: 100%;
  border-top-color: transparent;
  border-bottom-color: var(--dc-ink);
}
.pop .mark.fresh {
  animation: mark-in 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) 0.25s both;
}
@keyframes mark-in {
  from {
    transform: scale(0) rotate(-30deg);
  }
}
</style>
