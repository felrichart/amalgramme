import { onMounted, onUnmounted } from 'vue';

// How far a finger travels sideways, at least, and how much more than up or down.
const MIN_PX = 50;
const RATIO = 1.5;

/*
 * Calls `onSwipe(1)` when a finger (or the mouse) sweeps right over `target` (a
 * template ref), `onSwipe(-1)` when it sweeps left. Ignored when it starts on an
 * element matching `skip`. The target needs `touch-action: pan-y`, or the browser
 * takes sideways moves for itself.
 */
export function useSwipe(target, onSwipe, skip = '') {
  let start = null;
  const down = (e) => {
    start = skip && e.target.closest?.(skip) ? null : { x: e.clientX, y: e.clientY };
  };
  const up = (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) >= MIN_PX && Math.abs(dx) > RATIO * Math.abs(dy)) onSwipe(Math.sign(dx));
  };
  const cancel = () => (start = null);
  onMounted(() => {
    const el = target.value;
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
  });
  onUnmounted(() => {
    const el = target.value;
    el?.removeEventListener('pointerdown', down);
    el?.removeEventListener('pointerup', up);
    el?.removeEventListener('pointercancel', cancel);
  });
}
