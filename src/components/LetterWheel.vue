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
  active: { type: Boolean, default: false }, // highlight the disc (docked word)
  shake: { type: Number, default: 0 }, // bump to play the "wrong" shake
  revealed: { type: Number, default: 0 }, // count of leading answer letters revealed by help
});
const emit = defineEmits(['begin', 'enter', 'backtrack', 'end', 'shuffle']);

const CENTER = 15; // centre (shuffle) hit radius
const GAP = 0.86; // neighbour clearance factor
const OUTER = 46.5; // where a tile's outer edge sits, as % from centre
const MAX_NODE = 27; // cap so few-letter rings don't get oversized tiles

const box = ref(null);
const pointer = ref(null);
let dragging = false;
let pendingShuffle = false;

/*
 * Ring radius adapts to tile count: with many (small) letters it grows so the
 * tiles' outer edge stays near the rim, instead of leaving them stranded near
 * the centre. When the node size hits its cap, the cap governs the radius.
 */
const ring = computed(() => {
  const s = Math.sin(Math.PI / props.tiles.length);
  const uncapped = OUTER / (1 + GAP * s);
  return 2 * uncapped * s * GAP > MAX_NODE ? OUTER - MAX_NODE / 2 : uncapped;
});

/* Fixed positions around the ring; first tile at the top, clockwise. */
const centers = computed(() =>
  props.tiles.map((_, k) => {
    const a = (-90 + (360 * k) / props.tiles.length) * (Math.PI / 180);
    return { x: 50 + ring.value * Math.cos(a), y: 50 + ring.value * Math.sin(a) };
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
 * the ring hold up to ~11 letters. Value is a % of the wheel; capped so small
 * words don't get oversized tiles.
 */
const nodeSize = computed(() => {
  const fit = 2 * ring.value * Math.sin(Math.PI / props.tiles.length) * GAP;
  return Math.min(MAX_NODE, fit);
});
// Slightly smaller that the selection ring (because scaled up by 1.12)
const hitRadius = computed(() => nodeSize.value / 2);
/*
 * Glyphs track the tile size, but small tiles (many letters) get a
 * proportionally larger glyph so letters stay legible near the rim.
 */
const glyph = computed(() => {
  const base = props.interactive ? 0.56 : 0.6;
  const boost = Math.min(1.2, MAX_NODE / nodeSize.value);
  return (nodeSize.value * base * boost).toFixed(2) + 'cqw';
});

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
  let bd = hitRadius.value;
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
    :class="{ mini: !interactive, active, shaking }"
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
        stroke="var(--tint)"
        stroke-width="5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <line
        v-if="interactive && pointer && lastCenter"
        :x1="lastCenter.x"
        :y1="lastCenter.y"
        :x2="pointer.x"
        :y2="pointer.y"
        stroke="var(--tint)"
        stroke-width="5"
        stroke-linecap="round"
        opacity="0.35"
      />
    </svg>

    <div
      v-for="(t, k) in tiles"
      :key="t.id"
      class="node"
      :class="{ on: pathSet.has(t.id), revealed: t.id < revealed }"
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
  /* Comic coin: one white disc, thick ink outline, hard offset shadow. */
  border-radius: 50%;
  background: var(--panel);
  border: var(--outline-w-lg) solid var(--outline);
  box-shadow: var(--pop-lg);
  transition:
    transform 0.1s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}
/* Selected word: the coin sits flush with the board — offset shadow drops
   away, ink outline stays. Center stays put so the links don't shift. */
.wheel.active {
  background: var(--tint-wash);
  box-shadow: none;
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
  z-index: 2;
  /* Flat bold glyph sitting directly on the disc — no tile behind it. */
  color: var(--ink);
  font-weight: 900;
  text-transform: uppercase;
  border-radius: 50%;
  transition:
    transform 0.12s ease,
    background 0.12s ease,
    color 0.12s ease;
}
.node span {
  display: block;
  line-height: 1;
}
/* Touched: a solid accent circle with a white knock-out glyph, so it stays
   readable under the drawn line. */
.node.on {
  background: var(--tint);
  color: #fff;
  transform: translate(-50%, -50%) scale(1.12);
}
/* Revealed by help: the tile fills with the wheel's tint (like a touched letter)
   and gains a lime ring so a given letter reads as a clue — shown the same on the
   interactive input wheel and the corner preview. */
.node.revealed {
  background: var(--tint);
  color: #fff;
  box-shadow: 0 0 0 max(2px, 1cqw) var(--lime);
}

.wheel {
  container-type: size;
}

/* Centre hub doubles as the shuffle affordance; hit-testing lives in JS. */
.hub {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 24%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  z-index: 1;
  pointer-events: none;
  color: var(--muted);
  opacity: 0.55;
}
.hub svg {
  width: 100%;
  height: 100%;
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
