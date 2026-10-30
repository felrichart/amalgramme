<script setup>
/* A yes/no question on a Dicorama card; a tap outside cancels. */
defineProps({
  title: { type: String, required: true },
  text: { type: String, default: '' },
  confirmLabel: { type: String, required: true },
});
const emit = defineEmits(['cancel', 'confirm']);
</script>

<template>
  <div class="overlay" @click.self="emit('cancel')">
    <div class="card" role="alertdialog" aria-modal="true" :aria-label="title">
      <h2 class="title">{{ title }}</h2>
      <p v-if="text" class="text">{{ text }}</p>
      <div class="actions">
        <button class="dc-button" type="button" @click="emit('confirm')">
          {{ confirmLabel }}
        </button>
        <button class="dc-button quiet" type="button" @click="emit('cancel')">Annuler</button>
      </div>
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
  padding: 20px;
  background: rgb(30 26 20 / 0.42);
}
.card {
  width: 100%;
  max-width: 320px;
  padding: 24px 22px 22px;
  border-radius: 22px;
  background: var(--dc-board);
  box-shadow:
    inset 0 -4px 0 var(--dc-board-edge),
    0 18px 40px rgb(0 0 0 / 0.25);
  text-align: center;
  animation: dico-appear 0.18s ease-out both;
}
.title {
  margin: 0 0 10px;
  font-family: var(--dc-serif);
  font-weight: 400;
  font-size: 24px;
  line-height: 1.15;
  color: var(--day);
}
.text {
  margin: 0;
  font-size: 15px;
  line-height: 1.45;
  color: var(--dc-muted);
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}
</style>
