<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';

/*
 * Guided walkthrough overlay. Each step dims the screen and reveals its target:
 * a single `selector` spotlight (circle, or rounded rect via `shape`) or several
 * at once via `holes` (circular cutouts). Interaction is locked to the one
 * allowed thing: a `manual` step blocks the whole game and waits on its button
 * (label from `cta`, default "Suivant"); an action step blocks everything except
 * the spotlighted piece and advances when the parent detects the taught gesture.
 * Can't be dismissed. A step may carry `text` or, for emphasis, `html`.
 */
const props = defineProps({
  steps: { type: Array, required: true },
  step: { type: Number, required: true }, // active step index, driven by parent
});
const emit = defineEmits(['next']);

const PAD = 10; // spotlight padding around the target
const GAP = 16; // bubble offset from the spotlight
const BUBBLE_W = Math.min(320, window.innerWidth - 32);

const spot = ref(null); // { x, y, w, h } for a single-target step, else null
const holes = ref([]); // [{ cx, cy, r }] circular cutouts for a multi-reveal step
const viewport = ref({ w: window.innerWidth, h: window.innerHeight });
const place = ref('center'); // 'above' | 'below' | 'center'

const current = computed(() => props.steps[props.step]);

function rectOf(sel) {
  const el = sel ? document.querySelector(sel) : null;
  return el ? el.getBoundingClientRect() : null;
}

function measure() {
  viewport.value = { w: window.innerWidth, h: window.innerHeight };
  const s = current.value;
  if (s?.holes) {
    spot.value = null;
    holes.value = s.holes
      .map(rectOf)
      .filter(Boolean)
      .map((r) => ({
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        r: Math.min(r.width, r.height) / 2 + PAD,
      }));
    return;
  }
  holes.value = [];
  const r = rectOf(s?.selector);
  if (!r) {
    spot.value = null;
    place.value = 'center';
    return;
  }
  spot.value = { x: r.left - PAD, y: r.top - PAD, w: r.width + 2 * PAD, h: r.height + 2 * PAD };
  place.value = window.innerHeight - r.bottom > r.top ? 'below' : 'above';
}

const spotStyle = computed(() => {
  const s = spot.value;
  if (!s) return null;
  return {
    left: `${s.x}px`,
    top: `${s.y}px`,
    width: `${s.w}px`,
    height: `${s.h}px`,
    borderRadius: current.value.shape === 'rect' ? '1.2rem' : '50%',
  };
});

/* Manual steps, reveal steps, or a missing target lock the entire game. */
const blockAll = computed(() => current.value?.manual || current.value?.holes || !spot.value);

const px = (n) => `${Math.max(0, n)}px`;
/* Four transparent panels framing the spotlight, so only the hole stays live. */
const panels = computed(() => {
  const s = spot.value;
  if (!s) return [];
  return [
    { left: 0, top: 0, width: '100%', height: px(s.y) },
    { left: 0, top: px(s.y + s.h), right: 0, bottom: 0 },
    { left: 0, top: px(s.y), width: px(s.x), height: px(s.h) },
    { left: px(s.x + s.w), top: px(s.y), right: 0, height: px(s.h) },
  ];
});

const bubbleStyle = computed(() => {
  const s = spot.value;
  /* Reveal step: sit just below the lowest cutout. */
  if (holes.value.length) {
    const bottom = Math.max(...holes.value.map((h) => h.cy + h.r));
    return {
      left: '50%',
      top: `${bottom + GAP}px`,
      transform: 'translateX(-50%)',
      width: `${BUBBLE_W}px`,
    };
  }
  /* Other centred steps: park the instruction near the bottom. */
  if (!s)
    return { left: '50%', bottom: '2rem', transform: 'translateX(-50%)', width: `${BUBBLE_W}px` };
  const cx = s.x + s.w / 2;
  const left = Math.max(16, Math.min(cx - BUBBLE_W / 2, window.innerWidth - BUBBLE_W - 16));
  const base = { left: `${left}px`, width: `${BUBBLE_W}px` };
  return place.value === 'above'
    ? { ...base, bottom: `${window.innerHeight - s.y + GAP}px` }
    : { ...base, top: `${s.y + s.h + GAP}px` };
});

/* Re-measure whenever the step changes; the layout may have shifted with it. */
watch(
  () => props.step,
  () => nextTick(measure),
);
onMounted(() => {
  nextTick(measure);
  window.addEventListener('resize', measure);
});
onUnmounted(() => window.removeEventListener('resize', measure));
</script>

<template>
  <Teleport to="body">
    <div class="coach" role="dialog" aria-modal="false" aria-label="Tutoriel">
      <div v-if="spotStyle" class="spot" :style="spotStyle" aria-hidden="true"></div>
      <!-- Multi-reveal: one dark layer with a circular cutout per target. -->
      <svg
        v-else-if="holes.length"
        class="reveal"
        :viewBox="`0 0 ${viewport.w} ${viewport.h}`"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <mask id="tut-holes">
            <rect x="0" y="0" :width="viewport.w" :height="viewport.h" fill="white" />
            <circle v-for="(h, k) in holes" :key="k" :cx="h.cx" :cy="h.cy" :r="h.r" fill="black" />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          :width="viewport.w"
          :height="viewport.h"
          fill="rgba(20, 22, 29, 0.55)"
          mask="url(#tut-holes)"
        />
        <circle
          v-for="(h, k) in holes"
          :key="`r${k}`"
          :cx="h.cx"
          :cy="h.cy"
          :r="h.r"
          fill="none"
          stroke="#fff"
          stroke-width="3"
        />
      </svg>
      <div v-else class="dim" aria-hidden="true"></div>

      <!-- Interaction guard: a full cover for locked steps, else four panels
           leaving the spotlight live. -->
      <div v-if="blockAll" class="block" style="inset: 0" aria-hidden="true"></div>
      <template v-else>
        <div v-for="(p, k) in panels" :key="k" class="block" :style="p" aria-hidden="true"></div>
      </template>

      <div class="bubble" :style="bubbleStyle">
        <p v-if="current.html" class="text" v-html="current.html"></p>
        <p v-else class="text">{{ current.text }}</p>
        <div class="foot">
          <button
            v-if="current.manual || current.holes"
            class="next"
            type="button"
            @click="emit('next')"
          >
            {{ current.cta || 'Suivant' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Click-through: only the "Suivant" button and the .block traps capture input;
   every taught gesture goes to the real game through the open hole. */
.coach {
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: none;
}
.dim {
  position: absolute;
  inset: 0;
  background: rgba(20, 22, 29, 0.55);
  animation: fade 0.15s ease;
}
.block {
  position: absolute;
  pointer-events: auto;
}
.spot {
  position: absolute;
  border: 3px solid #fff;
  box-shadow: 0 0 0 9999px rgba(20, 22, 29, 0.55);
  transition:
    left 0.2s ease,
    top 0.2s ease,
    width 0.2s ease,
    height 0.2s ease;
  animation: halo 1.6s ease-in-out infinite;
}
.reveal {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  animation: fade 0.15s ease;
}
.bubble {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.1rem 1.2rem;
  border-radius: 1.2rem;
  background: var(--panel);
  border: var(--outline-w-lg) solid var(--outline);
  box-shadow: var(--pop-lg);
  animation: pop-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.text {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--ink);
}
.text :deep(strong) {
  color: var(--accent);
  font-weight: 900;
}
.foot {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-height: 2.4rem;
}
.next {
  margin-left: auto;
  pointer-events: auto;
  background: var(--accent);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 1rem;
  padding: 0.7rem 1.4rem;
  border-radius: 1rem;
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop);
  cursor: pointer;
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.next:active,
.next:focus-visible {
  outline: none;
  transform: translate(4px, 5px);
  box-shadow: 0 0 0 var(--outline);
}

@keyframes fade {
  from {
    opacity: 0;
  }
}
@keyframes pop-in {
  from {
    transform: scale(0.85);
    opacity: 0;
  }
}
@keyframes halo {
  50% {
    border-color: var(--accent);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spot {
    animation: none;
  }
}
</style>
