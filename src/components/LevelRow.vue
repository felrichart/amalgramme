<script setup>
/* A playable level in a list: label (slot), play stats and completion mark.
 * An `aside` slot goes on the right, above the stats, which then shrink. */
import ProgressMark from './ui/ProgressMark.vue';
import { solvedBy } from '../utils/format.js';

defineProps({
  progress: { type: Object, required: true },
  attempts: { type: Number, default: 0 },
  successes: { type: Number, default: 0 },
});
</script>

<template>
  <button class="row press" :class="{ done: progress.completed }" type="button">
    <slot />
    <span class="meta">
      <span class="info">
        <slot name="aside" />
        <span
          class="stat"
          :class="{ small: $slots.aside }"
          :aria-label="`${successes} réussites sur ${attempts}`"
        >
          {{ solvedBy(successes, attempts) }}
        </span>
      </span>
      <ProgressMark :completed="progress.completed" :partial="progress.partial" />
    </span>
  </button>
</template>

<style scoped>
.meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.stat {
  font-size: 0.85rem;
  font-weight: 800;
  white-space: nowrap;
  opacity: 0.85;
}
.stat.small {
  font-size: 0.7rem;
}
</style>
