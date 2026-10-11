<script setup>
/* Line icons for the answer edit bar. */
defineProps({
  name: { type: String, required: true }, // 'shuffle' | 'clear' | 'back'
  size: { type: Number, default: 22 },
});

const PATHS = {
  shuffle: 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  clear: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5',
  back: 'M21 5H9l-6 7 6 7h12ZM17 9l-6 6M11 9l6 6',
};
</script>

<template>
  <svg viewBox="0 0 24 24" :width="size" :height="size" aria-hidden="true">
    <path
      :d="PATHS[name]"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
