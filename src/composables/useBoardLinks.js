import { ref, reactive, watch, nextTick, onMounted, onUnmounted } from 'vue';

/*
 * Connector lines from the secret to each word cell, measured from the DOM.
 * Bind `svgEl` / `secretEl` / `setCell(el, i)`; re-measures on resize and
 * whenever `deps()` changes (a solved word or a selection shifts the cells).
 */
export function useBoardLinks(tints, deps) {
  const svgEl = ref(null);
  const secretEl = ref(null);
  const cells = [];
  const setCell = (el, i) => {
    if (el) cells[i] = el;
  };
  const links = reactive({ w: 0, h: 0, lines: [] });

  function measure() {
    if (!svgEl.value || !secretEl.value) return;
    const o = svgEl.value.getBoundingClientRect();
    const center = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - o.left, y: r.top + r.height / 2 - o.top };
    };
    const from = center(secretEl.value);
    links.w = o.width;
    links.h = o.height;
    links.lines = cells.flatMap((el, i) => {
      if (!el) return [];
      const to = center(el);
      return [{ x1: from.x, y1: from.y, x2: to.x, y2: to.y, tint: tints[i] }];
    });
  }

  let ro;
  onMounted(() => {
    nextTick(measure);
    ro = new ResizeObserver(measure);
    if (svgEl.value) ro.observe(svgEl.value);
  });
  onUnmounted(() => ro?.disconnect());
  watch(deps, () => nextTick(measure));

  return { svgEl, secretEl, setCell, links };
}
