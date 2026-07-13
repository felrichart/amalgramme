<script setup>
import { ref } from 'vue';
import UsernamePrompt from './UsernamePrompt.vue';
import { username } from '../composables/useUsername.js';

const open = ref(false);
</script>

<template>
  <button
    class="badge"
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
  position: relative;
  width: 2.6rem;
  height: 2.6rem;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 0.9rem;
  color: #fff;
  cursor: pointer;
  background: var(--accent);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.badge.unset {
  background: var(--panel);
  color: var(--ink);
}
.badge:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
.badge:focus-visible {
  outline: 2px solid var(--outline);
  outline-offset: 2px;
}
</style>
