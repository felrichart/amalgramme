<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authors, isAuthorNew, initCommunitySeen } from '../data/community.js';
import { loadCommunityLevels } from '../services/community.js';
import { username, pin, pinValid } from '../composables/useUsername.js';
import UserBadge from '../components/UserBadge.vue';
import UsernamePrompt from '../components/UsernamePrompt.vue';

const router = useRouter();

const names = ref(authors());
const loading = ref(true);
/* Authors with a level newer than the user last saw for them; each dot clears
 * only when its author page is opened, not by viewing this list. */
const newByAuthor = ref({});

onMounted(async () => {
  await loadCommunityLevels();
  names.value = authors();
  const flags = {};
  for (const name of names.value) flags[name] = isAuthorNew(name);
  newByAuthor.value = flags;
  /* First-ever visit sets the baseline (no dots); later visits are a no-op. */
  initCommunitySeen();
  loading.value = false;
});

/* "Créer un défi": needs a name + PIN first — open the prompt, then head to the form. */
const gateOpen = ref(false);
function onCreate() {
  if (username.value && pinValid(pin.value)) router.push('/community/create');
  else gateOpen.value = true;
}
</script>

<template>
  <div class="community">
    <header class="top">
      <button class="icon-btn" type="button" @click="router.push('/')" aria-label="menu">←</button>
      <h1 class="title">Défis de la communauté</h1>
      <UserBadge />
    </header>

    <ul class="list">
      <li v-for="name in names" :key="name">
        <button class="row" type="button" @click="router.push(`/community/${name}`)">
          Défis de {{ name }}
          <span v-if="newByAuthor[name]" class="new-dot" aria-label="nouveaux défis"></span>
        </button>
      </li>
      <li v-if="!loading && !names.length" class="empty">
        Aucun défi pour l’instant. Créez le premier !
      </li>
    </ul>

    <footer class="foot">
      <button class="create" type="button" @click="onCreate">Créer un défi</button>
    </footer>

    <UsernamePrompt
      :open="gateOpen"
      @close="gateOpen = false"
      @saved="router.push('/community/create')"
    />
  </div>
</template>

<style scoped>
.community {
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
  padding: 0.9rem 1rem 0.5rem;
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
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.icon-btn:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
.icon-btn:focus-visible {
  outline: 2px solid var(--outline);
  outline-offset: 2px;
}
.title {
  flex: 1;
  margin: 0;
  text-align: center;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--ink);
}

.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.6rem 1rem 1rem;
}
.row {
  --tint: var(--violet);
  width: 100%;
  display: flex;
  align-items: center;
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  font-weight: 900;
  font-size: 1.1rem;
  cursor: pointer;
  color: var(--ink);
  background: var(--tint-wash);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop);
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.row:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
.row:focus-visible {
  outline: none;
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
/* New-content badge, pushed to the row's trailing edge. */
.new-dot {
  margin-left: auto;
  flex: none;
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 50%;
  background: var(--violet);
  border: 1.5px solid var(--outline);
}
.empty {
  text-align: center;
  color: var(--muted);
  font-weight: 700;
  padding: 2rem 1rem;
}

/* Fixed footer: always present under the scrolling list. */
.foot {
  flex: none;
  padding: 0.8rem 1rem calc(1.2rem + env(safe-area-inset-bottom));
  border-top: var(--outline-w) solid var(--outline);
  background: var(--bg);
}
.create {
  width: 100%;
  padding: 1rem 1.2rem;
  border-radius: 1.1rem;
  font-family: inherit;
  font-weight: 900;
  font-size: 1.12rem;
  color: #fff;
  cursor: pointer;
  background: var(--violet);
  border: var(--outline-w-lg) solid var(--outline);
  box-shadow: var(--pop);
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.create:active {
  transform: translate(4px, 5px);
  box-shadow: 0 0 0 var(--outline);
}
.create:focus-visible {
  outline: none;
  transform: translate(4px, 5px);
  box-shadow: 0 0 0 var(--outline);
}
</style>
