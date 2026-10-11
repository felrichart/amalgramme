import { ref, onMounted } from 'vue';

/*
 * A list built from a local cache, shown at once, then rebuilt after a forced
 * refresh on mount so play counts reflect the visit that just happened.
 */
export function useCachedList(build, load) {
  const items = ref(build());
  const rebuild = () => (items.value = build());
  const ready = ref(false);
  onMounted(async () => {
    await load(0);
    rebuild();
    ready.value = true;
  });
  return { items, rebuild, ready };
}
