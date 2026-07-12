<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createCommunityLevel, updateCommunityLevel } from '../services/community.js';
import { communityRecord } from '../data/community.js';
import { username, pin, pinValid, isAdmin } from '../composables/useUsername.js';
import ChallengeForm from '../components/ChallengeForm.vue';
import UsernamePrompt from '../components/UsernamePrompt.vue';

const route = useRoute();
const router = useRouter();

const editId = route.params.id ?? null;
const isEdit = !!editId;

const initialWords = reactive(['', '', '', '']);
const initialSecret = ref('');

/* Original author of the level being edited (kept for the recap and preserved
 * server-side when the admin edits someone else's level). */
const editAuthor = ref('');

/* Edit mode: prefill from the cached level; bounce unless it's the player's own
 * (or they're the admin, who may edit anyone's). */
onMounted(() => {
  if (!isEdit) return;
  const rec = communityRecord(editId);
  if (!rec || (rec.author !== username.value && !isAdmin.value)) {
    router.replace('/community');
    return;
  }
  editAuthor.value = rec.author;
  rec.words.forEach((w, i) => (initialWords[i] = w));
  initialSecret.value = rec.secret;
});

/* No identity yet → force the name/PIN prompt open. */
const nameOpen = ref(!username.value || !pinValid(pin.value));

const submitting = ref(false);
const error = ref('');

async function submit(normalized) {
  submitting.value = true;
  error.value = '';
  const payload = { ...normalized, pin: pin.value };
  const res = isEdit
    ? await updateCommunityLevel(editId, payload)
    : await createCommunityLevel(payload);
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
      <h1 class="title">{{ isEdit ? 'Modifier le défi' : 'Créer un défi' }}</h1>
      <div class="spacer" />
    </header>

    <div class="who">
      <span class="who-name">Auteur : {{ username || 'Sans nom' }}</span>
      <button class="switch" type="button" @click="nameOpen = true">Changer de compte</button>
    </div>

    <ChallengeForm
      :author="username"
      :initial-words="initialWords"
      :initial-secret="initialSecret"
      :is-edit="isEdit"
      :submitting="submitting"
      :error="error"
      :recap-byline="`par ${isEdit ? editAuthor : username}`"
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
