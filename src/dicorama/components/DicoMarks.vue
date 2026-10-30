<script setup>
/*
 * A level's marks, 1em high: a star, won once the level is finished, and a
 * trophy, won once it's complete, hollow until won, yellow once won; then, only
 * once every rare word is found too, a crown. Hovering a mark, or tapping it
 * (which then doesn't reach a row it sits in), shows what it's won for in a
 * bubble above it. `pop` animates the mark just won on mount.
 */
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import DicoStar from './DicoStar.vue';

defineProps({
  // 0: not finished, 1: finished, 2: complete, 3: perfect.
  level: { type: Number, required: true },
  pop: { type: Boolean, default: false },
});
const LABELS = [
  'niveau pas fini',
  'niveau fini',
  'niveau complet',
  'niveau complet, rares compris',
];
const TIPS = {
  star: '10 mots trouvés',
  trophy: 'Tous les mots trouvés',
  crown: 'Tous les mots rares trouvés',
};

// The mark whose bubble shows.
const tip = ref(null);
const hover = (name) => (e) => e.pointerType === 'mouse' && (tip.value = name);
const unhover = (e) => e.pointerType === 'mouse' && (tip.value = null);
const tap = (name) => (tip.value = tip.value === name ? null : name);

/* How far the bubble moves sideways to stay on the screen, its tail kept on the
 * mark. */
const EDGE = 8;
let bubbleEl = null;
const setBubble = (el) => (bubbleEl = el);
const shift = ref(0);
watch(tip, async () => {
  shift.value = 0;
  await nextTick();
  if (!bubbleEl || !tip.value) return;
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
  <span ref="root" class="marks" :class="{ pop }" role="img" :aria-label="LABELS[level]">
    <span
      v-for="name in level === 3 ? ['star', 'trophy', 'crown'] : ['star', 'trophy']"
      :key="name"
      class="slot"
      @pointerenter="hover(name)($event)"
      @pointerleave="unhover"
      @click.stop.prevent="tap(name)"
    >
      <DicoStar
        v-if="name === 'star'"
        class="mark star"
        :class="{ won: level > 0, fresh: level === 1 }"
        :hollow="!level"
      />
      <svg
        v-else-if="name === 'trophy'"
        class="mark trophy"
        :class="{ won: level >= 2, fresh: level === 2 }"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <g
          :fill="level >= 2 ? 'currentColor' : 'none'"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M7 6H4.6a2.6 2.6 0 0 0 2.9 4.6M17 6h2.4a2.6 2.6 0 0 1-2.9 4.6" fill="none" />
          <path d="M6.8 3.5h10.4v5.3a5.2 5.2 0 0 1-10.4 0z" />
          <path d="M12 14.2v3.6" />
          <path d="M8 18.6h8v2.6H8z" />
        </g>
      </svg>
      <svg v-else class="mark crown won fresh" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 17.5 3 7.5l5.4 4L12 4.5l3.6 7 5.4-4-1 10z"
          fill="currentColor"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
        <path d="M4 19.2h16v2.4H4z" fill="currentColor" />
        <circle cx="12" cy="13.6" r="1.4" fill="var(--dc-yellow-ink)" />
      </svg>
      <span
        v-if="tip === name"
        :ref="setBubble"
        class="bubble"
        role="tooltip"
        :style="{ '--shift': `${shift}px` }"
        >{{ TIPS[name] }}</span
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
  display: block;
  width: 1em;
  height: 1em;
  flex: none;
  overflow: visible;
  color: var(--dc-dash);
}
.mark.won {
  color: var(--dc-yellow);
  filter: drop-shadow(0 0.05em 0 rgb(60 40 0 / 0.55));
}
/* Above the mark, its tail at the mark's middle, the text running left: the
 * marks often sit at the right of a row. */
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
