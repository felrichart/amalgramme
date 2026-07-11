<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { PUZZLES_NEW as PUZZLES } from '../data/challenges.js';
import { levelProgress, resetAllProgress } from '../composables/useGameState.js';

const router = useRouter();

/* Bumped after a reset so the computed re-reads localStorage. */
const version = ref(0);

const levels = computed(() => {
  version.value;
  return PUZZLES.map((p, i) => {
    const prog = levelProgress(i);
    return { index: i, completed: prog.completed, partial: prog.partial };
  });
});

const doneCount = computed(() => levels.value.filter((l) => l.completed).length);

function play(l) {
  router.push('/play/' + l.index);
}

function resetAll() {
  if (!confirm('Réinitialiser toute la progression ?')) return;
  resetAllProgress();
  version.value++;
}
</script>

<template>
  <div class="levels">
    <header class="top">
      <h1 class="brand">Amalgramme</h1>
      <p class="tag">{{ doneCount }} / {{ levels.length }} niveaux terminés</p>
    </header>

    <div class="grid">
      <button
        v-for="l in levels"
        :key="l.index"
        class="lvl glass"
        :class="{ done: l.completed, partial: l.partial }"
        type="button"
        @click="play(l)"
      >
        <span class="no">{{ l.index + 1 }}</span>
        <span v-if="l.completed" class="check" aria-label="terminé">✓</span>
        <span v-else-if="l.partial" class="dot" aria-label="commencé"></span>
      </button>
    </div>

    <button
      v-if="doneCount || levels.some((l) => l.partial)"
      class="reset"
      type="button"
      @click="resetAll"
    >
      Réinitialiser la progression
    </button>
  </div>
</template>

<style scoped>
.levels {
  max-width: 560px;
  margin: 0 auto;
  padding: 2.2rem 1rem 3rem;
}
.top {
  text-align: center;
  margin-bottom: 2rem;
}
.brand {
  margin: 0;
  font-size: 2.6rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.tag {
  margin: 0.6rem 0 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
@media (min-width: 480px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.lvl {
  position: relative;
  display: grid;
  place-items: center;
  padding: 0.9rem;
  min-height: 5.4rem;
  border-radius: 1.2rem;
  cursor: pointer;
  color: var(--ink);
  transition:
    transform 0.14s ease,
    border-color 0.2s ease;
}
.lvl:hover {
  transform: translateY(-3px);
  border-color: var(--muted);
}
.lvl:active {
  transform: translateY(0);
}
.lvl:focus-visible {
  outline: 2px solid var(--sky-ink);
  outline-offset: 2px;
}
/* Done: solid accent fill, dark number. */
.lvl.done {
  background: var(--sky-ink);
  border-color: var(--sky-ink);
  color: var(--bg);
}
/* Started but unfinished: accent outline, no fill. */
.lvl.partial {
  border-color: var(--sky-ink);
}

.no {
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1;
}

/* Success mark, top-right corner. */
.check {
  position: absolute;
  top: 0.5rem;
  right: 0.6rem;
  font-size: 1rem;
  font-weight: 900;
  line-height: 1;
}

/* In-progress dot, top-right corner. */
.dot {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--sky-ink);
}

.reset {
  display: block;
  margin: 2rem auto 0;
  padding: 0.6rem 1.1rem;
  border: none;
  background: none;
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.reset:hover {
  color: var(--ink);
}
</style>
