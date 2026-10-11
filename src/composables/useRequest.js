import { ref } from 'vue';

/* Busy/error state around a backend call resolving to { ok, error } (see services/api.js). */
export function useRequest(fn) {
  const busy = ref(false);
  const error = ref('');
  async function run(...args) {
    busy.value = true;
    error.value = '';
    const res = await fn(...args);
    busy.value = false;
    if (!res.ok) error.value = res.error;
    return res;
  }
  return { busy, error, run };
}
