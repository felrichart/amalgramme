<script setup>
/* The rare words found, "+2", in the day's colour: on top of a score's max. */
defineProps({ count: { type: Number, required: true } });
</script>

<template>
  <span class="dc-bonus" :aria-label="`plus ${count} rare${count > 1 ? 's' : ''}`"
    >+{{ count }}</span
  >
</template>

<style scoped>
.dc-bonus {
  font-family: var(--dc-serif);
  line-height: 1;
  white-space: nowrap;
  color: var(--day);
}
</style>
