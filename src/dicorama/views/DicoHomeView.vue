<script setup>
/*
 * Dicorama's home: today's pattern, big, to play, then the days before, each
 * with its score and badges. The admin also reaches the levels to come and the
 * bank.
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import '../theme.js';
import { isAdmin } from '../../composables/useAccount.js';
import { getToday } from '../../utils/today.js';
import { official, playedLevels } from '../store.js';
import { resultOf } from '../levels.js';
import { dayColor, longDayLabel, dayOfMonth, shortMonth, shortWeekday } from '../days.js';
import DicoMarks from '../components/DicoMarks.vue';

const router = useRouter();
const today = getToday();
const pad = (n) => String(n).padStart(2, '0');

// Recomputed when the levels refresh; newest first.
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
const todays = computed(() => days.value.find((d) => d.date === today) ?? null);
const past = computed(() => days.value.filter((d) => d.date !== today));

const started = (d) => d.score > 0 || d.rare > 0;
const done = (d) => d.stars === 3 && (d.book || !d.rareTotal);
const play = (d) => router.push(`/dicorama/${d.date}`);
</script>

<template>
  <div class="dico home" :style="{ '--day': dayColor(today) }">
    <div class="column">
      <header class="top">
        <button class="dc-icon" type="button" aria-label="Amalgramme" @click="router.push('/')">
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
        <h1 class="title">Dicorama</h1>
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
      </header>

      <section class="dc-board today">
        <p class="day">{{ longDayLabel(today) }}</p>
        <template v-if="todays">
          <span class="dc-mini big" aria-hidden="true">
            <span
              v-for="(ch, i) in todays.pattern"
              :key="i"
              :class="ch === '_' ? 'blank' : 'fixed'"
              >{{ ch === '_' ? '' : ch }}</span
            >
          </span>
          <p v-if="started(todays)" class="progress">
            <span class="big-score">{{ pad(todays.score) }}</span>
            <span class="big-max">/{{ todays.total }}</span>
          </p>
          <DicoMarks
            class="marks big"
            :stars="todays.stars"
            :book="todays.book"
            :steps="todays.steps"
          />
          <button class="dc-button play" type="button" @click="play(todays)">
            {{ done(todays) ? 'Revoir' : started(todays) ? 'Continuer' : 'Jouer' }}
          </button>
        </template>
        <p v-else class="none">Pas de Dicorama aujourd'hui, reviens demain.</p>
      </section>

      <section v-if="past.length" class="section">
        <h2 class="heading">Les jours passés</h2>
        <ul class="days">
          <li v-for="d in past" :key="d.date">
            <button class="day-row" type="button" :style="{ '--day': d.color }" @click="play(d)">
              <span class="date">
                <span class="small weekday">{{ shortWeekday(d.date) }}</span>
                <span class="big-day">{{ dayOfMonth(d.date) }}</span>
                <span class="small">{{ shortMonth(d.date) }}</span>
              </span>
              <span class="dc-mini pattern" :aria-label="d.pattern.join('').replaceAll('_', ' ')">
                <span
                  v-for="(ch, i) in d.pattern"
                  :key="i"
                  :class="ch === '_' ? 'blank' : 'fixed'"
                  >{{ ch === '_' ? '' : ch }}</span
                >
              </span>
              <span class="result">
                <span
                  v-if="started(d)"
                  class="score"
                  :aria-label="`score ${d.score} sur ${d.total}`"
                >
                  <span class="value">{{ pad(d.score) }}</span>
                  <span class="max">/{{ d.total }}</span>
                </span>
                <DicoMarks class="marks" :stars="d.stars" :book="d.book" :steps="d.steps" />
              </span>
            </button>
          </li>
        </ul>
      </section>
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
  font-size: 32px;
  color: var(--day);
}
.small {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--dc-faint);
}
.dc-button.small {
  min-height: 34px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--dc-ink);
}
.today {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 22px 16px 24px;
  text-align: center;
}
.day {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--dc-muted);
}
.day::first-letter {
  text-transform: uppercase;
}
.dc-mini.big {
  gap: 6px;
}
.dc-mini.big > span {
  width: 38px;
  height: 47px;
  border-radius: 10px 10px 2px 2px;
  font-size: 28px;
}
.dc-mini.big > .blank {
  border-radius: 5px;
}
.progress {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.big-score {
  font-family: var(--dc-serif);
  font-size: 34px;
  line-height: 1;
  color: var(--day);
}
.big-max {
  font-family: var(--dc-serif);
  font-size: 24px;
  color: var(--dc-faint);
}
.marks.big {
  font-size: 34px;
}
.play {
  min-width: 160px;
}
.none {
  margin: 0;
  color: var(--dc-muted);
  font-size: 15px;
}
.section {
  margin-top: 26px;
}
.heading {
  margin: 0 4px 10px;
  font-family: var(--dc-serif);
  font-weight: 400;
  font-size: 20px;
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
.big-day {
  font-family: var(--dc-serif);
  font-size: 24px;
  line-height: 1.05;
  color: var(--dc-day-ink);
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
