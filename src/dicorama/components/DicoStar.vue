<script setup>
/* A five-pointed star in the current colour, 1em wide; `hollow`, just its outline. */
defineProps({ hollow: { type: Boolean, default: false } });
</script>

<template>
  <svg class="dc-star" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 2.8l2.75 5.9 6.45.75-4.78 4.43 1.27 6.37L12 17.07l-5.69 3.18 1.27-6.37L2.8 9.45l6.45-.75z"
      :fill="hollow ? 'none' : 'currentColor'"
      stroke="currentColor"
      :stroke-width="hollow ? 2.2 : 1.6"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.dc-star {
  display: block;
  width: 1em;
  height: 1em;
  flex: none;
  overflow: visible;
}
</style>
