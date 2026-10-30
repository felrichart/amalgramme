<script setup>
/*
 * A level's stars, 1em high, none until the first is won: one at 10 words, two
 * once the list is found, three once the rare words are too. Hovering a star, or
 * tapping it (which then doesn't reach a row it sits in), shows what it's won
 * for in a bubble above it. `pop` animates the star just won on mount.
 */
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import DicoStar from './DicoStar.vue';
import { GOAL } from '../game.js';

defineProps({
  stars: { type: Number, required: true },
  pop: { type: Boolean, default: false },
});
const LABELS = ['aucune étoile', '1 étoile', '2 étoiles', '3 étoiles'];
const TIPS = [`${GOAL} mots trouvés`, 'Toute la liste trouvée', 'Tous les mots rares trouvés'];

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
    v-if="stars"
    ref="root"
    class="marks"
    :class="{ pop }"
    role="img"
    :aria-label="LABELS[stars]"
  >
    <span
      v-for="i in stars"
      :key="i"
      class="slot"
      @pointerenter="hover(i)($event)"
      @pointerleave="unhover"
      @click.stop.prevent="tap(i)"
    >
      <DicoStar class="mark" :class="{ fresh: i === stars }" />
      <span
        v-if="tip === i"
        :ref="setBubble"
        class="bubble"
        role="tooltip"
        :style="{ '--shift': `${shift}px` }"
        >{{ TIPS[i - 1] }}</span
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
