<script setup>
/* A day's level, played: back to the home, the day small beside it. */
import { useRoute, useRouter } from 'vue-router';
import '../theme.js';
import { getToday } from '../../utils/today.js';
import { levelFor } from '../levels.js';
import { dayColor, dayOfMonth, shortMonth, shortWeekday } from '../days.js';
import DicoBoard from '../components/DicoBoard.vue';

const route = useRoute();
const router = useRouter();
const today = getToday();

const date = route.params.date;
const level = levelFor('day', date);
// "ven 30 oct.", or "aujourd'hui".
const dateLabel =
  date === today ? "aujourd'hui" : `${shortWeekday(date)} ${dayOfMonth(date)} ${shortMonth(date)}`;
</script>

<template>
  <div class="dico day-game" :style="{ '--day': dayColor(date) }">
    <div class="screen">
      <DicoBoard :level="level">
        <template #lead>
          <button
            class="dc-icon"
            type="button"
            aria-label="accueil"
            @click="router.push('/dicorama')"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <span class="date">{{ dateLabel }}</span>
        </template>
      </DicoBoard>
    </div>
  </div>
</template>

<style scoped>
.day-game {
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
.date {
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: var(--dc-faint);
}
.date::first-letter {
  text-transform: uppercase;
}
</style>
