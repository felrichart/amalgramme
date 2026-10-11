<script setup>
import { ref } from 'vue';
import BaseModal from './ui/BaseModal.vue';

const EMAIL = 'fel.richart@gmail.com';

const emit = defineEmits(['close']);
const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(EMAIL);
    copied.value = true;
  } catch {
    // Clipboard blocked: the address stays selectable by hand.
  }
}
</script>

<template>
  <BaseModal label="Contact" @close="emit('close')">
    <h2 class="modal-title">Contact</h2>
    <p class="email">{{ EMAIL }}</p>
    <div class="modal-actions">
      <button class="cta ghost press" type="button" @click="emit('close')">Fermer</button>
      <button class="cta press" type="button" @click="copy">
        {{ copied ? 'Copié !' : 'Copier' }}
      </button>
    </div>
  </BaseModal>
</template>

<style scoped>
.email {
  margin: 0;
  text-align: center;
  font-weight: 800;
  color: var(--ink);
  user-select: all;
  overflow-wrap: anywhere;
}
</style>
