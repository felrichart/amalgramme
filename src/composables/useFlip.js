import { nextTick } from 'vue';

/*
 * FLIP layout animation (https://aerotwist.com/blog/flip-your-animations/):
 * measure `selector` children of `root()` before and after `update`, then play
 * each from its old box to its new one with transforms only — composited, no
 * snapshot or repaint, unlike a view transition.
 */
export function useFlip(root, selector, { duration = 320 } = {}) {
  const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return async function flip(update) {
    const els = root.value ? [...root.value.querySelectorAll(selector)] : [];
    if (!els.length || reduce()) return update();
    const first = new Map(els.map((el) => [el, el.getBoundingClientRect()]));
    update();
    await nextTick();
    for (const [el, a] of first) {
      if (!el.isConnected) continue;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      const sx = a.width / b.width;
      const sy = a.height / b.height;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01) continue;
      // End on the element's own resting transform (e.g. a lifted piece), not 'none'.
      const rest = getComputedStyle(el).transform;
      const end = rest === 'none' ? '' : rest;
      el.animate(
        [
          {
            transformOrigin: 'top left',
            transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) ${end}`,
          },
          { transformOrigin: 'top left', transform: end || 'none' },
        ],
        { duration, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)' },
      );
    }
  };
}
