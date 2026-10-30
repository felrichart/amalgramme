<script setup>
/*
 * Dicorama's one screen for players: the day picked in the URL, its date small
 * in the header, its marks beside the words, and a way to the days played before.
 */
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import '../theme.js';
import { isAdmin } from '../../composables/useAccount.js';
import { getToday } from '../../utils/today.js';
import { progressOf } from '../game.js';
import { levelFor, loadProgress } from '../levels.js';
import { dayColor, dayOfMonth, shortMonth, shortWeekday } from '../days.js';
import DicoBoard from '../components/DicoBoard.vue';
import DicoMarks from '../components/DicoMarks.vue';

const route = useRoute();
const router = useRouter();
const today = getToday();

const picked = computed(() => route.params.date);
const level = computed(() => (picked.value ? levelFor('day', picked.value) : null));

// The progress while playing here, else the saved one.
const live = ref(null);
watch(picked, () => (live.value = null));
const stars = computed(() => {
  const l = level.value;
  return l ? (live.value ?? progressOf(l, loadProgress(l.pattern).found)).stars : 0;
});

// "ve 30 oct.", or "aujourd'hui".
const dateLabel = computed(() =>
  picked.value === today
    ? "aujourd'hui"
    : `${shortWeekday(picked.value)} ${dayOfMonth(picked.value)} ${shortMonth(picked.value)}`,
);
</script>

<template>
  <div class="dico days" :style="{ '--day': dayColor(picked ?? today) }">
    <div class="screen">
      <header class="bar">
        <h1 class="brand">Dicorama</h1>
        <template v-if="isAdmin">
          <button
            class="dc-button quiet small"
            type="button"
            @click="router.push('/dicorama/a-venir')"
          >
            À venir
          </button>
          <button
            class="dc-button quiet small"
            type="button"
            @click="router.push('/dicorama/banque')"
          >
            Banque
          </button>
        </template>
        <span v-if="level" class="date">{{ dateLabel }}</span>
      </header>

      <DicoBoard v-if="level" :key="level.pattern" :level="level" @progress="(p) => (live = p)">
        <template #side>
          <DicoMarks class="marks" :stars="stars" />
        </template>
        <template #foot>
          <button
            class="past"
            type="button"
            aria-label="niveaux passés"
            @click="router.push('/dicorama/jours')"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
              <path d="M3.5 10h17M8 3v4M16 3v4" />
              <path d="M7.5 14h2M11 14h2M14.5 14h2M7.5 17h2M11 17h2" />
            </svg>
            <span class="past-label">niveaux passés</span>
          </button>
        </template>
      </DicoBoard>
      <p v-else class="none">Pas encore de Dicorama, reviens demain.</p>
    </div>
  </div>
</template>

<style scoped>
.days {
  position: fixed;
  inset: 0;
  overflow: hidden;
}
.screen {
  height: 100%;
  max-width: 430px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}
.bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: max(10px, env(safe-area-inset-top)) 14px 6px 14px;
}
.brand {
  flex: 1;
  margin: 0;
  font-family: var(--dc-serif);
  font-weight: 400;
  font-size: 24px;
  color: var(--day);
}
.small {
  min-height: 32px;
  padding: 0 10px;
  font-size: 12.5px;
}
.date {
  flex: none;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: var(--dc-faint);
}
.date::first-letter {
  text-transform: uppercase;
}
.marks {
  margin-top: 18px;
  font-size: 22px;
}
.past {
  width: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px 9px;
  border: 0;
  border-radius: 12px;
  background: var(--dc-cream);
  box-shadow: 0 3px 0 #b3ab9a;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.15;
  color: var(--dc-day-ink);
  cursor: pointer;
}
/* Short screens: the icon alone, so the side column fits. */
@media (max-height: 600px) {
  .past-label {
    display: none;
  }
}
.past:active {
  transform: translateY(3px);
  box-shadow: none;
}
.past svg {
  width: 26px;
  height: 26px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.none {
  margin: 40px 20px;
  text-align: center;
  color: var(--dc-muted);
}
</style>
