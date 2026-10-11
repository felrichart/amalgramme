<script setup>
/* Asked once at sign-in when this device holds progress the account doesn't have. */
import { prompt, answerPrompt } from '../services/sync.js';
import { username } from '../composables/useAccount.js';
import BaseModal from './ui/BaseModal.vue';
</script>

<template>
  <BaseModal v-if="prompt" label="Progression de cet appareil" locked>
    <h2 class="modal-title">Progression de cet appareil</h2>
    <p class="body">
      Cet appareil a {{ prompt.count }} niveau{{ prompt.count > 1 ? 'x' : '' }} joué{{
        prompt.count > 1 ? 's' : ''
      }}
      hors du compte <strong>{{ username }}</strong
      >. Les ajouter à ton historique ?
    </p>
    <p class="fine">Rien n’est perdu : sinon, ils reviennent à la déconnexion.</p>
    <div class="modal-actions">
      <button class="cta ghost press" type="button" @click="answerPrompt(false)">Non</button>
      <button class="cta press" type="button" @click="answerPrompt(true)">Ajouter</button>
    </div>
  </BaseModal>
</template>

<style scoped>
.body,
.fine {
  margin: 0;
  text-align: center;
  font-weight: 700;
  line-height: 1.35;
}
.fine {
  font-size: 0.8rem;
  color: var(--muted);
}
</style>
