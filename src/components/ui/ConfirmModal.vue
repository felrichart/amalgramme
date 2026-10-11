<script setup>
/* Yes/no confirmation with an inline error and a busy state. */
import BaseModal from './BaseModal.vue';

defineProps({
  title: { type: String, required: true },
  confirmLabel: { type: String, default: 'Supprimer' },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
});
const emit = defineEmits(['cancel', 'confirm']);
</script>

<template>
  <BaseModal :label="title" :locked="busy" @close="emit('cancel')">
    <h2 class="modal-title">{{ title }}</h2>
    <p v-if="error" class="err">{{ error }}</p>
    <div class="modal-actions">
      <button class="cta ghost press" type="button" :disabled="busy" @click="emit('cancel')">
        Annuler
      </button>
      <button class="cta danger press" type="button" :disabled="busy" @click="emit('confirm')">
        {{ busy ? '…' : confirmLabel }}
      </button>
    </div>
  </BaseModal>
</template>
