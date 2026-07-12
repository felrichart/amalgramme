<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  authors,
  isAuthorNew,
  initCommunitySeen,
  challengesByAuthor,
  COMMUNITY_PREFIX,
} from '../data/community.js';
import { loadCommunityLevels } from '../services/community.js';
import { levelProgress } from '../composables/useGameState.js';
import { username, pin, pinValid } from '../composables/useUsername.js';
import UserBadge from '../components/UserBadge.vue';
import UsernamePrompt from '../components/UsernamePrompt.vue';

const router = useRouter();

const names = ref(authors());
const loading = ref(true);
/* Authors with a level newer than the user last saw for them; each dot clears
 * only when its author page is opened, not by viewing this list. */
const newByAuthor = ref({});
/* Per-author { done, total }: how many of their challenges this device finished. */
const progressByAuthor = ref({});

function refresh() {
  names.value = authors();
  const flags = {};
  const progress = {};
  for (const name of names.value) {
    flags[name] = isAuthorNew(name);
    const list = challengesByAuthor(name);
    const done = list.filter((c) => levelProgress(COMMUNITY_PREFIX + c.id).completed).length;
    progress[name] = { done, total: list.length };
  }
  newByAuthor.value = flags;
  progressByAuthor.value = progress;
}

/* Force a fresh fetch on every open so play counts stay current. */
onMounted(async () => {
  await loadCommunityLevels(0);
  refresh();
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
          <span v-if="newByAuthor[name]" class="notif">NOUVEAU !</span>
          <span
            v-if="progressByAuthor[name]"
            class="count"
            :aria-label="`${progressByAuthor[name].done} sur ${progressByAuthor[name].total} terminés`"
            >{{ progressByAuthor[name].done }}/{{ progressByAuthor[name].total }}</span
          >
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
.notif {
  margin-left: auto;
  flex: none;
  padding: 0.2rem 0.5rem;
  color: var(--violet);
  font-size: 0.75rem;
  font-weight: 900;
}
/* Completed-count "N/Q", pinned to the trailing edge (after the badge if any). */
.count {
  margin-left: auto;
  flex: none;
  padding: 0.2rem 0.55rem;
  border-radius: 0.7rem;
  background: var(--tint);
  color: #fff;
  border: 1.5px solid var(--outline);
  font-size: 0.85rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}
/* When the "new" badge is present, it takes the auto margin; the count follows. */
.notif + .count {
  margin-left: 0.4rem;
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
