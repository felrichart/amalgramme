import { ref, watch, onUnmounted } from 'vue';

/* True for one shake animation each time `signal` changes; restarts mid-shake. */
export function useShake(signal, ms = 400) {
  const shaking = ref(false);
  let timer = null;
  watch(signal, () => {
    shaking.value = false;
    clearTimeout(timer);
    requestAnimationFrame(() => {
      shaking.value = true;
      timer = setTimeout(() => (shaking.value = false), ms);
    });
  });
  onUnmounted(() => clearTimeout(timer));
  return shaking;
}
