<script setup>
import { ref } from 'vue';
import UsernamePrompt from './UsernamePrompt.vue';
import { username } from '../composables/useUsername.js';

const open = ref(false);
</script>

<template>
  <button
    class="icon-btn badge press sm"
    :class="{ unset: !username }"
    type="button"
    :aria-label="username ? `Joueur : ${username}` : 'Choisir un nom de joueur'"
    :title="username || 'Nom de joueur'"
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
  </button>
  <UsernamePrompt :open="open" @close="open = false" />
</template>

<style scoped>
.badge {
  color: var(--on-color);
  background: var(--accent);
}
.badge.unset {
  background: var(--panel);
  color: var(--ink);
}
</style>
