<script setup>
/* Completion marker: a tick when done, a dot while in progress, else nothing. */
defineProps({ completed: Boolean, partial: Boolean });
</script>

<template>
  <span v-if="completed" class="check" aria-label="terminé">✓</span>
  <span v-else-if="partial" class="dot" aria-label="en cours"></span>
</template>

<style scoped>
.check {
  font-size: 1rem;
  font-weight: 900;
  line-height: 1;
}
.dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: var(--dot, var(--tint));
  border: 1.5px solid var(--outline);
}
</style>
