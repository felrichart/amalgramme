<script setup>
/* The "Aide" popup: reveal a letter of an indice or of the énigme, each disabled
 * once nothing's left to uncover there. Presentational: emits `reveal`
 * ('word' | 'secret') and `close`. */
import BaseModal from './ui/BaseModal.vue';
import BulbIcon from './ui/BulbIcon.vue';

defineProps({
  canWord: { type: Boolean, default: false },
  canSecret: { type: Boolean, default: false },
  /* Reveals the player has left. */
  left: { type: Number, default: 0 },
});
const emit = defineEmits(['reveal', 'close']);
</script>

<template>
  <BaseModal label="Aide" style="align-items: center; gap: 0.7rem" @close="emit('close')">
    <div class="bulb"><BulbIcon :size="30" /></div>
    <h2 class="modal-title">Besoin d’aide ?</h2>
    <p class="sub">
      Révèle une lettre pour te débloquer.
      <br />
      Il te reste {{ left }} aide{{ left > 1 ? 's' : '' }}.
    </p>
    <div class="actions">
      <button
        class="cta lime press"
        type="button"
        :disabled="!canWord"
        @click="emit('reveal', 'word')"
      >
        Révéler une lettre d’un indice
      </button>
      <button
        class="cta lime press"
        type="button"
        :disabled="!canSecret"
        @click="emit('reveal', 'secret')"
      >
        Révéler une lettre de l’énigme
      </button>
      <button class="cta ghost press" type="button" @click="emit('close')">
        Pas besoin d’aide
      </button>
    </div>
  </BaseModal>
</template>

<style scoped>
.bulb {
  display: grid;
  place-items: center;
  width: 3.2rem;
  height: 3.2rem;
  border-radius: 50%;
  color: #fff;
  background: var(--lime);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.modal-title {
  font-size: 1.2rem;
}
.sub {
  text-align: center;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--muted);
  line-height: 1.35;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
  margin-top: 0.4rem;
}
</style>
