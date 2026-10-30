<script setup>
/*
 * A level's badges, 1em high, none until the first is won: a star at a third of
 * the list, two at two thirds, three with all of it, then the golden book once
 * every rare word is found. Hovering a badge, or tapping it (which then doesn't reach a
 * row it sits in), shows what it's won for in a bubble above it. `pop` animates
 * the last one on mount.
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import DicoStar from './DicoStar.vue';
import DicoBook from './DicoBook.vue';

const props = defineProps({
  stars: { type: Number, required: true },
  book: { type: Boolean, default: false },
  // The list words found to win each star (see progressOf).
  steps: { type: Array, required: true },
  pop: { type: Boolean, default: false },
});
const BOOK_TIP = 'Tous les mots rares';

const badges = computed(() => [
  ...[`${props.steps[0]} mots trouvés`, `${props.steps[1]} mots trouvés`, 'Toute la liste']
    .slice(0, props.stars)
    .map((tip) => ({ tip, book: false })),
  ...(props.book ? [{ tip: BOOK_TIP, book: true }] : []),
]);
const label = computed(() =>
  [
    props.stars ? `${props.stars} étoile${props.stars > 1 ? 's' : ''}` : '',
    props.book ? 'tous les mots rares' : '',
  ]
    .filter(Boolean)
    .join(', '),
);

// The star whose bubble shows.
const tip = ref(null);
const hover = (i) => (e) => e.pointerType === 'mouse' && (tip.value = i);
const unhover = (e) => e.pointerType === 'mouse' && (tip.value = null);
const tap = (i) => (tip.value = tip.value === i ? null : i);

/* How far the bubble moves sideways to stay on the screen, its tail kept on the
 * star. */
const EDGE = 8;
let bubbleEl = null;
const setBubble = (el) => (bubbleEl = el);
const shift = ref(0);
watch(tip, async () => {
  shift.value = 0;
  await nextTick();
  if (!bubbleEl || tip.value == null) return;
  const r = bubbleEl.getBoundingClientRect();
  const right = document.documentElement.clientWidth - EDGE;
  shift.value = r.left < EDGE ? EDGE - r.left : r.right > right ? right - r.right : 0;
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
    :aria-label="label"
  >
    <span
      v-for="(b, i) in badges"
      :key="i"
      class="slot"
      :class="{ apart: b.book }"
      @pointerenter="hover(i)($event)"
      @pointerleave="unhover"
      @click.stop.prevent="tap(i)"
    >
      <DicoBook v-if="b.book" gold class="mark" :class="{ fresh: i === badges.length - 1 }" />
      <DicoStar v-else class="mark" :class="{ fresh: i === badges.length - 1 }" />
      <span
        v-if="tip === i"
        :ref="setBubble"
        class="bubble"
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
/* Above the star, its tail at the star's middle, the text running left: the
 * stars often sit at the right of a row. */
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
.pop .mark.fresh {
  animation: mark-in 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) 0.25s both;
}
@keyframes mark-in {
  from {
    transform: scale(0) rotate(-30deg);
  }
}
</style>
