<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { pastChallenges, formatChallengeDate } from '../data/challenges.js';
import { levelProgress } from '../composables/useGameState.js';

const router = useRouter();

/* Past challenges only (today's daily lives on the menu), newest first. */
const items = computed(() =>
  pastChallenges().map((p) => {
    const prog = levelProgress(p.date);
    return {
      date: p.date,
      label: formatChallengeDate(p.date),
      completed: prog.completed,
      partial: prog.partial,
    };
  }),
);
</script>

<template>
  <div class="challenges">
    <header class="top">
      <button class="icon-btn" type="button" @click="router.push('/')" aria-label="menu">←</button>
      <h1 class="title">Défis passés</h1>
      <div class="spacer" />
    </header>

    <ul class="list">
      <li v-for="c in items" :key="c.date">
        <button
          class="row"
          :class="{ done: c.completed, partial: c.partial }"
          type="button"
          @click="router.push(`/play/${c.date}`)"
        >
          <span class="date">{{ c.label }}</span>
          <span v-if="c.completed" class="check" aria-label="terminé">✓</span>
          <span v-else-if="c.partial" class="dot" aria-label="en cours"></span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.challenges {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  max-width: 560px;
  margin: 0 auto;
}
.top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.9rem 1rem 0.5rem;
}
.icon-btn {
  width: 2.6rem;
  height: 2.6rem;
  flex: none;
  display: grid;
  place-items: center;
  font-size: 1.3rem;
  border-radius: 0.9rem;
  color: var(--ink);
  cursor: pointer;
  background: var(--panel);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.icon-btn:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
.icon-btn:focus-visible {
  outline: 2px solid var(--outline);
  outline-offset: 2px;
}
.title {
  flex: 1;
  margin: 0;
  text-align: center;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--ink);
}
.spacer {
  width: 2.6rem;
  flex: none;
}

.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.6rem 1rem calc(2rem + env(safe-area-inset-bottom));
}
.row {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  font-weight: 900;
  font-size: 1.1rem;
  text-transform: capitalize;
  cursor: pointer;
  /* Default (todo): faint accent wash. */
  color: var(--ink);
  background: var(--accent-wash);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop);
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.row:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
/* Focus (keyboard): show the row pressed rather than ringed. */
.row:focus-visible {
  outline: none;
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
/* Done: solid accent with a tick. In progress stays washed (a strong dot marks it). */
.row.done {
  background: var(--accent);
  color: #fff;
}

.date {
  letter-spacing: 0.01em;
}
.check {
  margin-left: auto;
  font-size: 1rem;
  font-weight: 900;
  line-height: 1;
}
/* Strong accent circle: reads against the washed in-progress row. */
.dot {
  margin-left: auto;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: var(--accent);
  border: 1.5px solid var(--outline);
}
</style>
