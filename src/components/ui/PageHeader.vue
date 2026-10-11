<script setup>
/* Page header: back button, centred title, and a right slot (a spacer by default
 * so the title stays centred). */
import { useRouter } from 'vue-router';

defineProps({
  title: { type: String, required: true },
  back: { type: String, required: true },
  backLabel: { type: String, default: 'retour' },
  /* Keep the back button above the coach overlay so leaving is always one tap away. */
  backOnTop: { type: Boolean, default: false },
});

const router = useRouter();
</script>

<template>
  <header class="top">
    <button
      class="icon-btn press sm"
      :class="{ 'on-top': backOnTop }"
      type="button"
      :aria-label="backLabel"
      @click="router.push(back)"
    >
      ←
    </button>
    <h1 class="title">{{ title }}</h1>
    <slot><div class="spacer" /></slot>
  </header>
</template>

<style scoped>
.top {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.9rem 1rem 0.5rem;
}
.title {
  flex: 1;
  margin: 0;
  text-align: center;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--ink);
}
.spacer {
  width: 2.6rem;
  flex: none;
}
/* The coach overlay sits at z 60. */
.on-top {
  position: relative;
  z-index: 61;
}
</style>
