<script setup>
/* Centred dialog over a dimmed backdrop; a backdrop tap closes it unless `locked`
 * (e.g. while a request is in flight). Attributes land on the dialog box. */
defineOptions({ inheritAttrs: false });
defineProps({
  label: { type: String, required: true },
  locked: { type: Boolean, default: false },
});
const emit = defineEmits(['close']);
</script>

<template>
  <div class="overlay" @click.self="!locked && emit('close')">
    <div class="modal" role="dialog" aria-modal="true" :aria-label="label" v-bind="$attrs">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1.2rem;
  background: color-mix(in srgb, var(--ink) 45%, transparent);
}
.modal {
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.6rem 1.4rem;
  border: var(--outline-w) solid var(--outline);
  border-radius: 1.3rem;
  background: var(--panel);
  box-shadow: var(--lift-lg);
}
</style>
