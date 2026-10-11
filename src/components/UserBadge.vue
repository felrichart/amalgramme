<script setup>
/* Header account button. A "!" flags an account that needs something (securing a
 * PIN account, confirming the email); with `hint`, a PIN account also gets a
 * spelled-out nudge beside it. */
import { ref, computed } from 'vue';
import AccountModal from './AccountModal.vue';
import { username, needsSecuring, needsVerification } from '../composables/useAccount.js';

defineProps({ hint: { type: Boolean, default: false } });

const open = ref(false);
const alert = computed(() => needsSecuring.value || needsVerification.value);
</script>

<template>
  <div class="wrap">
    <button v-if="hint && needsSecuring" class="nudge press" type="button" @click="open = true">
      Sécurise ton compte !
    </button>
    <button
      class="icon-btn badge press sm"
      :class="{ unset: !username }"
      type="button"
      :aria-label="
        username ? `Joueur : ${username}${alert ? ' (action requise)' : ''}` : 'Se connecter'
      "
      :title="username || 'Se connecter'"
      @click="open = true"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2.2" />
        <path
          d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
        />
      </svg>
      <span v-if="alert" class="dot" aria-hidden="true">!</span>
    </button>
  </div>
  <AccountModal :open="open" @close="open = false" />
</template>

<style scoped>
.wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.badge {
  position: relative;
  color: var(--on-color);
  background: var(--accent);
}
.badge.unset {
  background: var(--panel);
  color: var(--ink);
}
.dot {
  position: absolute;
  top: -0.35rem;
  right: -0.35rem;
  display: grid;
  place-items: center;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 900;
  color: #fff;
  background: var(--danger);
  border: 2px solid var(--outline);
}
.nudge {
  padding: 0.4rem 0.7rem;
  border-radius: 0.8rem;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 900;
  color: #fff;
  background: var(--danger);
}
</style>
