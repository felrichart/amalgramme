<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  authors,
  isAuthorNew,
  initCommunitySeen,
  challengesByAuthor,
  COMMUNITY_PREFIX,
} from '../data/community.js';
import { levelProgress } from '../data/progress.js';
import { loadCommunityLevels } from '../services/levels.js';
import { connected } from '../composables/useUsername.js';
import { useCachedList } from '../composables/useCachedList.js';
import PageHeader from '../components/ui/PageHeader.vue';
import UserBadge from '../components/UserBadge.vue';
import UsernamePrompt from '../components/UsernamePrompt.vue';

const router = useRouter();

/* Per author: whether they have unseen levels (cleared only by opening their page)
 * and how many of their levels this device finished. */
const { items, ready } = useCachedList(
  () =>
    authors().map((name) => {
      const list = challengesByAuthor(name);
      return {
        name,
        isNew: isAuthorNew(name),
        done: list.filter((c) => levelProgress(COMMUNITY_PREFIX + c.id).completed).length,
        total: list.length,
      };
    }),
  async (maxAge) => {
    await loadCommunityLevels(maxAge);
    // Baseline on the very first visit, rendered without badges.
    initCommunitySeen();
  },
);

/* Creating needs an identity first. */
const gateOpen = ref(false);
function onCreate() {
  if (connected.value) router.push('/community/create');
  else gateOpen.value = true;
}
</script>

<template>
  <div class="page fit">
    <PageHeader title="Défis de la communauté" back="/" back-label="menu">
      <UserBadge />
    </PageHeader>

    <ul class="list">
      <li v-for="a in items" :key="a.name">
        <button class="row press" type="button" @click="router.push(`/community/${a.name}`)">
          Défis de {{ a.name }}
          <span v-if="a.isNew" class="notif">NOUVEAU !</span>
          <span class="count" :aria-label="`${a.done} sur ${a.total} terminés`"
            >{{ a.done }}/{{ a.total }}</span
          >
        </button>
      </li>
      <li v-if="ready && !items.length" class="empty">
        Aucun défi pour l’instant. Créez le premier !
      </li>
    </ul>

    <footer class="foot">
      <button class="big-btn press" type="button" @click="onCreate">Créer un défi</button>
    </footer>

    <UsernamePrompt
      :open="gateOpen"
      @close="gateOpen = false"
      @saved="router.push('/community/create')"
    />
  </div>
</template>

<style scoped>
.page {
  --tint: var(--violet);
}
.list {
  padding-bottom: 1rem;
}
.row {
  gap: 0;
}
/* Trailing badges: the first takes the auto margin. */
.notif {
  margin-left: auto;
  padding: 0.2rem 0.5rem;
  color: var(--violet);
  font-size: 0.75rem;
}
.count {
  margin-left: auto;
  padding: 0.2rem 0.55rem;
  border-radius: 0.7rem;
  background: var(--tint);
  color: #fff;
  border: 1.5px solid var(--outline);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}
.notif + .count {
  margin-left: 0.4rem;
}
</style>
