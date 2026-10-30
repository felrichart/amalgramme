<script setup>
/*
 * Dicorama's home: today's level, then the past days with their score. The admin
 * also sees the levels to come (dated later or drafts) and reaches the bank.
 */
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import '../theme.js';
import { isAdmin } from '../../composables/useAccount.js';
import { getToday } from '../../utils/today.js';
import { buildLevel, scoreOf, maxScore, isDone } from '../game.js';
import { loadProgress } from '../levels.js';
import { official, loadOfficial, playedLevels, upcomingLevels } from '../store.js';
import { dayColor, dayLabel, longDayLabel } from '../days.js';

const router = useRouter();
onMounted(() => loadOfficial());

const today = getToday();
const pad = (n) => String(n).padStart(2, '0');

function entry(l) {
  const level = buildLevel(l);
  const { found, revealed } = loadProgress(l.pattern);
  return {
    ...l,
    color: dayColor(l.date ?? today),
    mini: [...l.pattern],
    score: scoreOf(level, found),
    max: maxScore(level),
    started: found.length > 0 || revealed,
    done: revealed || isDone(level, found),
  };
}

// Recomputed when the levels refresh.
const played = computed(() => (official.levels, playedLevels().map(entry).reverse()));
const todays = computed(() => played.value.find((l) => l.date === today) ?? null);
const past = computed(() => played.value.filter((l) => l.date !== today));
const upcoming = computed(
  () => (official.levels, isAdmin.value ? upcomingLevels().map(entry) : []),
);

const play = (l) =>
  router.push(
    l.date && l.status === 'valid' ? `/dicorama/${l.date}` : `/dicorama/motif/${l.pattern}`,
  );
</script>

<template>
  <div class="dico home" :style="{ '--day': todays?.color ?? dayColor(today) }">
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
        <button
          v-if="isAdmin"
          class="dc-button quiet small"
          type="button"
          @click="router.push('/dicorama/banque')"
        >
          Banque
        </button>
      </header>
      <p class="pitch">Un motif, des lettres fixes : trouve tous les mots qui y entrent.</p>

      <section class="dc-board today">
        <p class="day">{{ longDayLabel(today) }}</p>
        <template v-if="todays">
          <span class="dc-mini big" aria-hidden="true">
            <span v-for="(ch, i) in todays.mini" :key="i" :class="ch === '_' ? 'blank' : 'fixed'">{{
              ch === '_' ? '' : ch
            }}</span>
          </span>
          <p v-if="todays.started" class="progress">
            <span class="big-score">{{ pad(todays.score.normal) }}</span>
            <span>sur {{ todays.max }} mots</span>
            <span v-if="todays.score.rare" class="bonus">+{{ todays.score.rare }}</span>
          </p>
          <p v-else class="progress muted">{{ todays.max }} mots à trouver</p>
          <button class="dc-button" type="button" @click="play(todays)">
            {{ todays.done ? 'Revoir' : todays.started ? 'Continuer' : 'Jouer' }}
          </button>
        </template>
        <p v-else class="none">Pas de Dicorama aujourd'hui, reviens demain.</p>
      </section>

      <section v-if="upcoming.length" class="section">
        <h2 class="heading">À venir <span class="count">admin</span></h2>
        <ul class="days">
          <li v-for="l in upcoming" :key="l.pattern">
            <button class="day-row" type="button" :style="{ '--day': l.color }" @click="play(l)">
              <span class="when">{{ l.date ? dayLabel(l.date) : 'sans date' }}</span>
              <span class="dc-mini" aria-hidden="true">
                <span v-for="(ch, i) in l.mini" :key="i" :class="ch === '_' ? 'blank' : 'fixed'">{{
                  ch === '_' ? '' : ch
                }}</span>
              </span>
              <span class="tag">{{ l.status === 'valid' ? 'validé' : 'brouillon' }}</span>
            </button>
            <button
              class="dc-icon"
              type="button"
              aria-label="éditer"
              @click="router.push(`/dicorama/editer/${l.pattern}`)"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M4 20h4L19 9l-4-4L4 16z" />
              </svg>
            </button>
          </li>
        </ul>
      </section>

      <section v-if="past.length" class="section">
        <h2 class="heading">Les jours passés</h2>
        <ul class="days">
          <li v-for="l in past" :key="l.pattern">
            <button class="day-row" type="button" :style="{ '--day': l.color }" @click="play(l)">
              <span class="when">{{ dayLabel(l.date) }}</span>
              <span class="dc-mini" aria-hidden="true">
                <span v-for="(ch, i) in l.mini" :key="i" :class="ch === '_' ? 'blank' : 'fixed'">{{
                  ch === '_' ? '' : ch
                }}</span>
              </span>
              <span v-if="l.started" class="row-score" :class="{ done: l.done }"
                >{{ pad(l.score.normal) }}<small>/{{ l.max }}</small></span
              >
              <span v-else class="row-score fresh">à jouer</span>
            </button>
            <button
              v-if="isAdmin"
              class="dc-icon"
              type="button"
              aria-label="éditer"
              @click="router.push(`/dicorama/editer/${l.pattern}`)"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M4 20h4L19 9l-4-4L4 16z" />
              </svg>
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
  min-height: 34px;
  padding: 0 12px;
  font-size: 13px;
}
.pitch {
  margin: 2px 0 18px 42px;
  font-size: 14px;
  color: var(--dc-muted);
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
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
  color: var(--dc-muted);
}
.progress.muted {
  color: var(--dc-faint);
}
.big-score {
  font-family: var(--dc-serif);
  font-size: 34px;
  line-height: 1;
  color: var(--day);
}
.bonus {
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--dc-yellow);
  color: var(--dc-yellow-ink);
  font-family: var(--dc-mono);
  font-weight: 700;
  font-size: 13px;
}
.none {
  color: var(--dc-muted);
  font-size: 15px;
}
.section {
  margin-top: 26px;
}
.heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 4px 10px;
  font-family: var(--dc-serif);
  font-weight: 400;
  font-size: 20px;
}
.count {
  font-family: var(--dc-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dc-faint);
}
.days {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.days li {
  display: flex;
  align-items: center;
  gap: 4px;
}
.day-row {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 58px;
  padding: 0 14px;
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
.when {
  width: 92px;
  flex: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--dc-muted);
}
.row-score,
.tag {
  margin-left: auto;
}
.row-score {
  font-family: var(--dc-serif);
  font-size: 22px;
  color: var(--day);
}
.row-score small {
  font-family: var(--dc-mono);
  font-weight: 700;
  font-size: 12px;
  color: var(--dc-faint);
}
.row-score.done::after {
  content: ' ✓';
  font-size: 15px;
}
.row-score.fresh,
.tag {
  font-family: var(--dc-mono);
  font-weight: 700;
  font-size: 12px;
  color: var(--dc-faint);
}
</style>
