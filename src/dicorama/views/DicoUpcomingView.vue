<script setup>
/* The admin's levels to come (dated later, or drafts), to play or edit. */
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import '../theme.js';
import { getToday } from '../../utils/today.js';
import { official, loadOfficial, upcomingLevels } from '../store.js';
import { dayColor, dayLabel } from '../days.js';

const router = useRouter();
onMounted(() => loadOfficial());

const today = getToday();
// Recomputed when the levels refresh.
const upcoming = computed(() =>
  (official.levels, upcomingLevels()).map((l) => ({
    ...l,
    color: dayColor(l.date ?? today),
    mini: [...l.pattern],
  })),
);
</script>

<template>
  <div class="dico home" :style="{ '--day': dayColor(today) }">
    <div class="column">
      <header class="top">
        <button class="dc-icon" type="button" aria-label="retour" @click="router.push('/dicorama')">
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
        <h1 class="title">À venir</h1>
      </header>

      <ul v-if="upcoming.length" class="days">
        <li v-for="l in upcoming" :key="l.pattern">
          <button
            class="day-row"
            type="button"
            :style="{ '--day': l.color }"
            @click="router.push(`/dicorama/motif/${l.pattern}`)"
          >
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
      <p v-else class="none">Aucun niveau à venir.</p>
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
.tag {
  margin-left: auto;
  font-family: var(--dc-mono);
  font-weight: 700;
  font-size: 12px;
  color: var(--dc-faint);
}
</style>
