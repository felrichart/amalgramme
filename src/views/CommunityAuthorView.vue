<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { challengesByAuthor, markAuthorSeen, COMMUNITY_PREFIX } from '../data/community.js';
import { levelProgress } from '../data/progress.js';
import { loadCommunityLevels, deleteCommunityLevel } from '../services/levels.js';
import { username, isAdmin, credentials } from '../composables/useUsername.js';
import { useCachedList } from '../composables/useCachedList.js';
import { useRequest } from '../composables/useRequest.js';
import PageHeader from '../components/ui/PageHeader.vue';
import ConfirmModal from '../components/ui/ConfirmModal.vue';
import LevelRow from '../components/LevelRow.vue';

const route = useRoute();
const router = useRouter();
const author = route.params.author;

/* Community levels can't be edited; the owner or the admin may delete them
 * (the PIN is checked server-side). */
const mine = computed(() => username.value === author || isAdmin.value);

const { items, rebuild } = useCachedList(
  () =>
    challengesByAuthor(author).map((c) => ({
      ...c,
      progress: levelProgress(COMMUNITY_PREFIX + c.id),
    })),
  async (maxAge) => {
    await loadCommunityLevels(maxAge);
    markAuthorSeen(author);
  },
);

const pending = ref(null); // level id awaiting delete confirmation
const {
  busy: deleting,
  error,
  run: remove,
} = useRequest((id) => deleteCommunityLevel(id, credentials()));
async function confirmDelete() {
  if ((await remove(pending.value)).ok) {
    pending.value = null;
    rebuild();
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="`Défis de ${author}`" back="/community" back-label="communauté" />

    <ul class="list">
      <li v-for="c in items" :key="c.id" class="item">
        <LevelRow
          :progress="c.progress"
          :attempts="c.attempts"
          :successes="c.successes"
          @click="router.push(`/play/${COMMUNITY_PREFIX}${c.id}`)"
        >
          #{{ c.number }}
        </LevelRow>
        <button
          v-if="mine"
          class="act press sm"
          type="button"
          aria-label="supprimer"
          @click="pending = c.id"
        >
          ✕
        </button>
      </li>
      <li v-if="!items.length" class="empty">Aucun défi.</li>
    </ul>

    <ConfirmModal
      v-if="pending"
      title="Supprimer ce défi ?"
      :busy="deleting"
      :error="error"
      @cancel="pending = null"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.list {
  --tint: var(--gold);
}
</style>
