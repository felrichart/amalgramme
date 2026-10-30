<script setup>
/*
 * Dicorama's one screen for players: the day picked in the URL played under the
 * frieze of the days played, its summary (date and marks) beside the words. A
 * swipe right goes to the day before, left to the day after, as the frieze's
 * arrows do; the words slide in from that side.
 */
import { ref, reactive, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import '../theme.js';
import { isAdmin } from '../../composables/useAccount.js';
import { getToday } from '../../utils/today.js';
import { buildLevel, progressOf, marksOf } from '../game.js';
import { levelFor, loadProgress } from '../levels.js';
import { official, playedLevels } from '../store.js';
import { dayColor, dayOfMonth, shortMonth, relativeDay } from '../days.js';
import { useSwipe } from '../useSwipe.js';
import DicoBoard from '../components/DicoBoard.vue';
import DicoFrieze from '../components/DicoFrieze.vue';
import DicoMarks from '../components/DicoMarks.vue';

const route = useRoute();
const router = useRouter();
const today = getToday();

// The marks won while playing here, by date, over the saved ones.
const live = reactive({});
const saved = computed(() =>
  // Recomputed when the levels refresh.
  (official.levels, playedLevels()).map((l) => ({
    date: l.date,
    color: dayColor(l.date),
    marks: marksOf(progressOf(buildLevel(l), loadProgress(l.pattern).found)),
  })),
);
const days = computed(() => saved.value.map((d) => ({ ...d, marks: live[d.date] ?? d.marks })));

const picked = computed(() => route.params.date);
const level = computed(() => (picked.value ? levelFor('day', picked.value) : null));
const marks = computed(() => days.value.find((d) => d.date === picked.value)?.marks ?? 0);

// The side the words come in from: -1 the left (an older day), 1 the right.
const enter = ref(0);
const indexOf = (date) => days.value.findIndex((d) => d.date === date);
function pick(date) {
  if (!date || date === picked.value) return;
  enter.value = indexOf(date) < indexOf(picked.value) ? -1 : 1;
  router.replace(`/dicorama/${date}`);
}
const step = (delta) => pick(days.value[indexOf(picked.value) + delta]?.date);

const screen = ref(null);
// A swipe right brings the day before, as turning a page back.
useSwipe(screen, (dir) => step(-dir), '.housing, .strip');

const soon = ref(false);
let soonTimer = null;
function showSoon(on = true) {
  clearTimeout(soonTimer);
  soon.value = on;
  if (on) soonTimer = setTimeout(() => (soon.value = false), 1600);
}
</script>

<template>
  <div class="dico days" :style="{ '--day': dayColor(picked ?? today) }">
    <div ref="screen" class="screen">
      <header class="bar">
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
      </header>

      <template v-if="level">
        <DicoFrieze :days="days" :picked="picked" :today="today" @pick="pick" @step="step" />
        <DicoBoard
          :key="level.pattern"
          :level="level"
          :enter="enter"
          @progress="(p) => (live[picked] = marksOf(p))"
        >
          <template #side>
            <aside class="summary">
              <span class="when">{{ relativeDay(picked, today) }}</span>
              <span class="big">{{ dayOfMonth(picked) }}</span>
              <span class="month">{{ shortMonth(picked) }}</span>
              <DicoMarks class="marks" :level="marks" />
              <button
                class="league"
                type="button"
                aria-label="ligues, à venir"
                @click="showSoon()"
                @pointerenter="$event.pointerType === 'mouse' && showSoon()"
                @pointerleave="$event.pointerType === 'mouse' && showSoon(false)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="8" cy="8" r="3.2" />
                  <circle cx="16.5" cy="9" r="2.6" />
                  <path
                    d="M2.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5M14 14.3c.8-.3 1.6-.4 2.5-.4 2.4 0 4.3 1.5 4.9 4.6"
                  />
                </svg>
                ligues
                <span v-if="soon" class="bubble" role="tooltip">À venir</span>
              </button>
            </aside>
          </template>
        </DicoBoard>
      </template>
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
  padding: max(8px, env(safe-area-inset-top)) 10px 4px 6px;
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
.summary {
  flex: none;
  width: 92px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0 8px;
}
.when {
  font-size: 13px;
  font-weight: 600;
  color: var(--dc-faint);
}
.when::first-letter {
  text-transform: uppercase;
}
.big {
  margin-top: 4px;
  font-family: var(--dc-serif);
  font-size: 44px;
  line-height: 1;
  color: var(--dc-day-ink);
}
.month {
  font-size: 13px;
  font-weight: 600;
  color: var(--dc-faint);
}
.marks {
  margin-top: 10px;
  font-size: 22px;
}
.league {
  position: relative;
  margin-top: auto;
  width: 86px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1.5px dashed var(--dc-faint);
  border-radius: 12px;
  background: none;
  color: var(--dc-faint);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.league svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}
.bubble {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  /* Not `transform`, which the appear animation sets. */
  translate: -50% 0;
  padding: 6px 10px;
  border-radius: 7px;
  background: var(--dc-ink);
  color: var(--dc-cream);
  font-size: 12.5px;
  white-space: nowrap;
  pointer-events: none;
  animation: dico-appear 0.14s ease-out both;
}
.none {
  margin: 40px 20px;
  text-align: center;
  color: var(--dc-muted);
}
</style>
