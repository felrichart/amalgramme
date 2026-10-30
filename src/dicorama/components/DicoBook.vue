<script setup>
/* The rare words' mark, 1em wide: an open book in the day's colour; `gold`, the
 * badge of every rare word found, in the current colour. */
defineProps({ gold: { type: Boolean, default: false } });
</script>

<template>
  <svg class="dc-book" viewBox="0 0 24 24" aria-hidden="true">
    <g :fill="gold ? 'currentColor' : 'var(--day)'">
      <path d="M11.3 6.4C8.9 4.7 5.9 4.3 2 4.8v14.1c3.9-.4 6.9 0 9.3 1.7z" />
      <path d="M12.7 6.4c2.4-1.7 5.4-2.1 9.3-1.6v14.1c-3.9-.4-6.9 0-9.3 1.7z" />
    </g>
    <path
      d="M4.5 8.6c1.8-.2 3.5 0 4.9.7M4.5 12c1.8-.2 3.5 0 4.9.7M4.5 15.4c1.8-.2 3.5 0 4.9.7M19.5 8.6c-1.8-.2-3.5 0-4.9.7M19.5 12c-1.8-.2-3.5 0-4.9.7M19.5 15.4c-1.8-.2-3.5 0-4.9.7"
      fill="none"
      stroke="rgb(255 255 255 / 0.6)"
      stroke-width="1.1"
      stroke-linecap="round"
    />
  </svg>
</template>

<style scoped>
.dc-book {
  display: block;
  width: 1em;
  height: 1em;
  flex: none;
  overflow: visible;
}
</style>
