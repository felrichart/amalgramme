<script setup>
import { useRouter } from 'vue-router';
import { pastChallenges } from '../data/dailies.js';
import { levelProgress } from '../data/progress.js';
import { loadDailies } from '../services/levels.js';
import { formatChallengeDate } from '../utils/format.js';
import { useCachedList } from '../composables/useCachedList.js';
import PageHeader from '../components/ui/PageHeader.vue';
import LevelRow from '../components/LevelRow.vue';

const router = useRouter();

/* Today's daily lives on the menu; this lists the earlier ones, newest first. */
const { items } = useCachedList(
  () => pastChallenges().map((p) => ({ ...p, progress: levelProgress(p.date) })),
  loadDailies,
);
</script>

<template>
  <div class="page">
    <PageHeader title="Défis passés" back="/" back-label="menu" />
    <ul class="list">
      <li v-for="c in items" :key="c.date">
        <LevelRow
          :progress="c.progress"
          :attempts="c.attempts"
          :successes="c.successes"
          @click="router.push(`/play/${c.date}`)"
        >
          <span class="date">{{ formatChallengeDate(c.date) }}</span>
          <template v-if="c.progress.secretFound" #aside>
            <span class="secret">{{ c.secret }}</span>
          </template>
        </LevelRow>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.list {
  --tint: var(--accent);
}
.date {
  text-transform: capitalize;
}
.secret {
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
</style>
