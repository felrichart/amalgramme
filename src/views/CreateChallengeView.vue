<script setup>
/* Community levels are create-only: once posted, they can't be edited by anyone
 * (authors or admin). Admin edits live in the daily editor instead. */
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { createCommunityLevel } from '../services/community.js';
import { username, pin, pinValid } from '../composables/useUsername.js';
import ChallengeForm from '../components/ChallengeForm.vue';
import UsernamePrompt from '../components/UsernamePrompt.vue';

const router = useRouter();

/* No identity yet → force the name/PIN prompt open. */
const nameOpen = ref(!username.value || !pinValid(pin.value));

const submitting = ref(false);
const error = ref('');

async function submit(normalized) {
  submitting.value = true;
  error.value = '';
  const res = await createCommunityLevel({ ...normalized, pin: pin.value });
  submitting.value = false;
  if (res.ok) router.push(`/community/${res.level.author}`);
  else error.value = res.error;
}
</script>

<template>
  <div class="create">
    <header class="top">
      <button
        class="icon-btn"
        type="button"
        @click="router.push('/community')"
        aria-label="communauté"
      >
        ←
      </button>
      <h1 class="title">Créer un défi</h1>
      <div class="spacer" />
    </header>

    <div class="who">
      <span class="who-name">Auteur : {{ username || 'Sans nom' }}</span>
      <button class="switch" type="button" @click="nameOpen = true">Changer de compte</button>
    </div>

    <ChallengeForm
      :author="username"
      :submitting="submitting"
      :error="error"
      :recap-byline="`par ${username}`"
      confirm-note="Vous ne pourrez plus modifier ce défi une fois publié."
      @submit="submit"
    />

    <UsernamePrompt
      :open="nameOpen"
      @close="nameOpen = false"
      @logout="router.replace('/community')"
    />
  </div>
</template>

<style scoped>
.create {
  min-height: 100dvh;
  max-height: 100dvh;
  display: flex;
  flex-direction: column;
  max-width: 560px;
  margin: 0 auto;
}
.top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.9rem 1rem 0.3rem;
}
.icon-btn {
  width: 2.6rem;
  height: 2.6rem;
  flex: none;
  display: grid;
  place-items: center;
  font-size: 1.3rem;
  border-radius: 0.9rem;
  color: var(--ink);
  cursor: pointer;
  background: var(--panel);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.icon-btn:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
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

/* Author strip: who's posting + a way to switch account. */
.who {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.2rem 1rem 0.4rem;
}
.who-name {
  font-weight: 900;
  font-size: 1.05rem;
  color: var(--ink);
}
.switch {
  flex: none;
  padding: 0.45rem 0.7rem;
  border-radius: 0.7rem;
  font-family: inherit;
  font-weight: 800;
  font-size: 0.82rem;
  cursor: pointer;
  color: var(--ink);
  background: var(--panel);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.switch:active {
  transform: translate(2px, 3px);
  box-shadow: 0 0 0 var(--outline);
}
</style>
