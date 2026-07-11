<script setup>
import { ref, computed, watch } from 'vue';

/*
 * A ring of letter tiles. When interactive, a press-and-drag traces a path from
 * tile to tile (emitting begin/enter/end); a tap in the centre emits shuffle.
 * Geometry is normalised to a 0-100 square so it scales with any container size.
 */
const props = defineProps({
  tiles: { type: Array, required: true }, // [{ id, ch }] in ring order
  path: { type: Array, default: () => [] }, // tile ids drawn so far
  interactive: { type: Boolean, default: false },
  shake: { type: Number, default: 0 }, // bump to play the "wrong" shake
});
const emit = defineEmits(['begin', 'enter', 'backtrack', 'end', 'shuffle']);

const RING = 35; // ring radius
const HIT = 13; // tile hit radius
const CENTER = 15; // centre (shuffle) hit radius

const box = ref(null);
const pointer = ref(null);
let dragging = false;
let pendingShuffle = false;

/* Fixed positions around the ring; first tile at the top, clockwise. */
const centers = computed(() =>
  props.tiles.map((_, k) => {
    const a = (-90 + (360 * k) / props.tiles.length) * (Math.PI / 180);
    return { x: 50 + RING * Math.cos(a), y: 50 + RING * Math.sin(a) };
  }),
);
const posById = computed(() => {
  const m = {};
  props.tiles.forEach((t, k) => (m[t.id] = centers.value[k]));
  return m;
});
const pathSet = computed(() => new Set(props.path));
const linkPoints = computed(() =>
  props.path.map((id) => `${posById.value[id].x},${posById.value[id].y}`).join(' '),
);
const lastCenter = computed(() =>
  props.path.length ? posById.value[props.path[props.path.length - 1]] : null,
);

/*
 * Node diameter shrinks with tile count so neighbours never overlap, letting
 * the ring hold up to ~10 letters. Value is a % of the wheel; capped so small
 * words don't get oversized tiles. Glyphs track the tile size.
 */
const nodeSize = computed(() => {
  const n = props.tiles.length;
  const fit = 2 * RING * Math.sin(Math.PI / n) * 0.86;
  return Math.min(27, fit);
});
const glyph = computed(
  () => (nodeSize.value * (props.interactive ? 0.32 : 0.42)).toFixed(2) + 'cqw',
);

function nodeStyle(k) {
  const c = centers.value[k];
  return { left: c.x + '%', top: c.y + '%', width: nodeSize.value + '%', fontSize: glyph.value };
}

function toLocal(e) {
  const r = box.value.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function hitTile(p) {
  let best = null;
  let bd = HIT;
  centers.value.forEach((c, k) => {
    const d = dist(p, c);
    if (d <= bd) {
      bd = d;
      best = props.tiles[k].id;
    }
  });
  return best;
}

function onDown(e) {
  if (!props.interactive) return;
  box.value.setPointerCapture?.(e.pointerId);
  const p = toLocal(e);
  pointer.value = p;
  const id = hitTile(p);
  if (id != null) {
    dragging = true;
    pendingShuffle = false;
    emit('begin');
    emit('enter', id);
  } else if (dist(p, { x: 50, y: 50 }) <= CENTER) {
    pendingShuffle = true;
    dragging = false;
  } else {
    dragging = true;
    pendingShuffle = false;
    emit('begin');
  }
}
function onMove(e) {
  if (!props.interactive || (!dragging && !pendingShuffle)) return;
  const p = toLocal(e);
  pointer.value = p;
  if (pendingShuffle && dist(p, { x: 50, y: 50 }) > CENTER) {
    pendingShuffle = false;
    dragging = true;
    emit('begin');
  }
  if (dragging) {
    const id = hitTile(p);
    if (id == null) return;
    // Dragging back onto the previous letter undoes the last one.
    if (props.path.length >= 2 && id === props.path[props.path.length - 2]) emit('backtrack');
    else emit('enter', id);
  }
}
function onUp() {
  if (!props.interactive) return;
  if (pendingShuffle) emit('shuffle');
  else if (dragging) emit('end');
  dragging = false;
  pendingShuffle = false;
  pointer.value = null;
}

const shaking = ref(false);
let shakeTimer = null;
watch(
  () => props.shake,
  () => {
    shaking.value = false;
    clearTimeout(shakeTimer);
    requestAnimationFrame(() => {
      shaking.value = true;
      shakeTimer = setTimeout(() => (shaking.value = false), 400);
    });
  },
);
</script>

<template>
  <div
    ref="box"
    class="wheel"
    :class="{ mini: !interactive, shaking }"
    @pointerdown.prevent="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  >
    <svg class="links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        v-if="path.length > 1"
        :points="linkPoints"
        fill="none"
        stroke="var(--sky-ink)"
        stroke-width="2.4"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <line
        v-if="interactive && pointer && lastCenter"
        :x1="lastCenter.x"
        :y1="lastCenter.y"
        :x2="pointer.x"
        :y2="pointer.y"
        stroke="var(--sky-ink)"
        stroke-width="2.4"
        stroke-linecap="round"
        opacity="0.55"
      />
    </svg>

    <div
      v-for="(t, k) in tiles"
      :key="t.id"
      class="node"
      :class="{ on: pathSet.has(t.id) }"
      :style="nodeStyle(k)"
    >
      <span>{{ t.ch }}</span>
    </div>

    <div v-if="interactive" class="hub" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M4 12a8 8 0 0 1 13.7-5.6L20 8M20 3v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 16M4 21v-5h5"
        />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.wheel {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.wheel.shaking {
  animation: shake 0.4s ease-in-out;
}

.links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  overflow: visible;
}

.node {
  position: absolute;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  border-radius: 50%;
  z-index: 2;
  /* Liquid-glass tile: translucent, blurred, with a soft specular top edge. */
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.45));
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.9),
    0 4px 12px rgba(60, 80, 120, 0.14);
  backdrop-filter: blur(6px);
  color: var(--ink);
  font-weight: 700;
  text-transform: uppercase;
  transition:
    transform 0.14s ease,
    background 0.14s ease,
    box-shadow 0.14s ease;
}
.node span {
  display: block;
  line-height: 1;
}
.node.on {
  background: linear-gradient(160deg, var(--sky), color-mix(in srgb, var(--sky) 60%, #fff));
  border-color: #fff;
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.9),
    0 0 0 3px color-mix(in srgb, var(--sky-ink) 30%, transparent),
    0 6px 16px rgba(60, 90, 140, 0.28);
  transform: translate(-50%, -50%) scale(1.08);
}

.wheel {
  container-type: size;
}

/* Centre hub doubles as the shuffle affordance; hit-testing lives in JS. */
.hub {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 22%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  border-radius: 50%;
  z-index: 1;
  pointer-events: none;
  color: color-mix(in srgb, var(--ink) 45%, transparent);
  background: rgba(255, 255, 255, 0.35);
  border: 1px dashed rgba(90, 110, 150, 0.3);
}
.hub svg {
  width: 46%;
  height: 46%;
}

.mini .node {
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.4));
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.8),
    0 2px 6px rgba(60, 80, 120, 0.1);
}

/* A soft damped wobble — enough to read as "no", never jarring. */
@keyframes shake {
  15% {
    transform: translateX(-1.5%);
  }
  35% {
    transform: translateX(1.2%);
  }
  55% {
    transform: translateX(-0.8%);
  }
  75% {
    transform: translateX(0.4%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .wheel.shaking {
    animation: none;
  }
}
</style>
