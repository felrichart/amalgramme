<script setup>
/* Community levels are create-only: once posted nobody can edit them. */
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { createCommunityLevel } from '../services/levels.js';
import { username, connected } from '../composables/useAccount.js';
import { useRequest } from '../composables/useRequest.js';
import PageHeader from '../components/ui/PageHeader.vue';
import ChallengeForm from '../components/ChallengeForm.vue';
import AccountModal from '../components/AccountModal.vue';

const router = useRouter();

const nameOpen = ref(!connected.value);

const { busy, error, run } = useRequest(createCommunityLevel);
async function submit(normalized) {
  const res = await run(normalized);
  if (res.ok) router.push(`/community/${res.data.author}`);
}
</script>

<template>
  <div class="page fit">
    <PageHeader title="Créer un défi" back="/community" back-label="communauté" />

    <div class="who">
      <span class="who-name">Auteur : {{ username || 'Sans nom' }}</span>
      <button class="switch press sm" type="button" @click="nameOpen = true">Mon compte</button>
    </div>

    <ChallengeForm
      :author="username"
      :submitting="busy"
      :error="error"
      :recap-byline="`par ${username}`"
      confirm-note="Vous ne pourrez plus modifier ce défi une fois publié."
      @submit="submit"
    />

    <AccountModal
      :open="nameOpen"
      @close="nameOpen = false"
      @logout="router.replace('/community')"
    />
  </div>
</template>

<style scoped>
/* Who's posting, plus a way to switch account. */
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
}
.switch {
  flex: none;
  padding: 0.45rem 0.7rem;
  border-radius: 0.7rem;
  font-weight: 800;
  font-size: 0.82rem;
  color: var(--ink);
  background: var(--panel);
}
</style>
