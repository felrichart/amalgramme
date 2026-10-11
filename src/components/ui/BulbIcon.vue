<script setup>
defineProps({ size: { type: Number, default: 20 } });
</script>

<template>
  <svg viewBox="0 0 24 24" :width="size" :height="size" aria-hidden="true">
    <path
      d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2h5c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
