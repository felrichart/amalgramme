<script setup>
/* The days played, newest first, each with its pattern, score and stars: a tap
 * plays it. */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import '../theme.js';
import { getToday } from '../../utils/today.js';
import { official, playedLevels } from '../store.js';
import { resultOf } from '../levels.js';
import { dayColor, dayOfMonth, shortMonth, shortWeekday } from '../days.js';
import DicoMarks from '../components/DicoMarks.vue';

const router = useRouter();
const today = getToday();

// Recomputed when the levels refresh.
const days = computed(() =>
  (official.levels, playedLevels())
    .map((l) => ({
      date: l.date,
      pattern: [...l.pattern],
      color: dayColor(l.date),
      ...resultOf(l),
    }))
    .reverse(),
);
const pad = (n) => String(n).padStart(2, '0');

// Back to the day it was opened from, else the latest one.
const back = () => (window.history.state?.back ? router.back() : router.push('/dicorama'));
</script>

<template>
  <div class="dico past" :style="{ '--day': dayColor(today) }">
    <div class="column">
      <header class="top">
        <button class="dc-icon" type="button" aria-label="retour" @click="back">
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
        <h1 class="title">Niveaux passés</h1>
      </header>

      <ul v-if="days.length" class="days">
        <li v-for="d in days" :key="d.date">
          <button
            class="day-row"
            type="button"
            :style="{ '--day': d.color }"
            @click="router.push(`/dicorama/${d.date}`)"
          >
            <span class="date">
              <span class="small weekday">{{
                d.date === today ? 'auj.' : shortWeekday(d.date)
              }}</span>
              <span class="big">{{ dayOfMonth(d.date) }}</span>
              <span class="small">{{ shortMonth(d.date) }}</span>
            </span>
            <span class="dc-mini pattern" :aria-label="d.pattern.join('').replaceAll('_', ' ')">
              <span v-for="(ch, i) in d.pattern" :key="i" :class="ch === '_' ? 'blank' : 'fixed'">{{
                ch === '_' ? '' : ch
              }}</span>
            </span>
            <span class="result">
              <span
                class="score"
                :aria-label="`score ${d.score.value}` + (d.score.max ? ` sur ${d.score.max}` : '')"
              >
                <span class="value">{{ pad(d.score.value) }}</span>
                <span v-if="d.score.max" class="max">/{{ d.score.max }}</span>
              </span>
              <DicoMarks class="marks" :stars="d.stars" />
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="none">Pas encore de Dicorama, reviens demain.</p>
    </div>
  </div>
</template>

<style scoped>
.column {
  max-width: 430px;
  margin: 0 auto;
  padding: max(10px, env(safe-area-inset-top)) 14px 40px;
}
.top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 18px;
}
.title {
  flex: 1;
  margin: 0;
  font-family: var(--dc-serif);
  font-weight: 400;
  font-size: 28px;
}
.none {
  color: var(--dc-muted);
  font-size: 15px;
}
.days {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.day-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 72px;
  padding: 8px 14px;
  border: 0;
  border-radius: 14px;
  background: var(--dc-board);
  box-shadow: inset 0 -2px 0 var(--dc-board-edge);
  text-align: left;
  cursor: pointer;
}
.day-row:active {
  transform: translateY(1px);
}
.date {
  width: 40px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.big {
  font-family: var(--dc-serif);
  font-size: 24px;
  line-height: 1.05;
  color: var(--dc-day-ink);
}
.small {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--dc-faint);
}
.weekday {
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.pattern {
  flex: 1;
  justify-content: flex-start;
}
.result {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.score {
  display: flex;
  align-items: baseline;
  gap: 3px;
  font-family: var(--dc-serif);
}
.value {
  font-size: 22px;
  color: var(--day);
}
.max {
  font-size: 14px;
  color: var(--dc-faint);
}
.marks {
  font-size: 16px;
}
</style>
