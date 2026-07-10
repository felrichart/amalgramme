<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { PUZZLES, DIFFICULTIES } from '../data/challenges.js'
import { levelProgress } from '../composables/useGameState.js'

const router = useRouter()

const levels = computed(() =>
  PUZZLES.map((p, i) => {
    const prog = levelProgress(i)
    return {
      index: i,
      theme: p.theme,
      difficulty: p.difficulty,
      total: p.words.length,
      found: prog.found,
      completed: prog.completed,
    }
  })
)

const doneCount = computed(() => levels.value.filter((l) => l.completed).length)

/* One block per difficulty; empty buckets still render so new levels have a home. */
const sections = computed(() =>
  DIFFICULTIES.map((d) => {
    const items = levels.value.filter((l) => l.difficulty === d.key)
    return { ...d, items, done: items.filter((l) => l.completed).length }
  })
)

function play(l) {
  router.push('/play/' + l.index)
}
</script>

<template>
  <div class="levels">
    <header class="top">
      <h1 class="brand">Lexic<span class="oo">😎</span>l</h1>
      <p class="tag">{{ doneCount }} / {{ levels.length }} niveaux terminés</p>
    </header>

    <section v-for="d in sections" :key="d.key" class="section">
      <div class="sec-head">
        <span class="sec-name" :class="d.key">{{ d.label }}</span>
        <span class="sec-count">{{ d.done }} / {{ d.items.length }}</span>
      </div>

      <div v-if="d.items.length" class="grid">
        <button
          v-for="l in d.items"
          :key="l.index"
          class="lvl glass"
          :class="{ done: l.completed, started: !l.completed && l.found > 0 }"
          type="button"
          @click="play(l)"
        >
          <span class="no">{{ String(l.index + 1).padStart(2, '0') }}</span>
          <span class="theme">{{ l.theme }}</span>
          <span class="score">
            <span v-if="l.completed" class="badge">😎 terminé</span>
            <span v-else class="count">{{ l.found }} / {{ l.total }}</span>
          </span>
        </button>
      </div>
      <p v-else class="empty glass">Bientôt de nouveaux niveaux.</p>
    </section>
  </div>
</template>

<style scoped>
.levels { max-width: 560px; margin: 0 auto; padding: 2.2rem 1rem 3rem; }
.top { text-align: center; margin-bottom: 2rem; }
.brand {
  margin: 0;
  font-size: 2.6rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.oo { font-size: 0.86em; margin: 0 0.02em; }
.tag { margin: 0.6rem 0 0; font-size: 0.9rem; font-weight: 600; color: var(--muted); }

.section { margin-bottom: 1.7rem; }
.sec-head {
  display: flex; align-items: center; justify-content: space-between;
  margin: 0 0.2rem 0.7rem;
}
.sec-name {
  font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
  padding: 0.3rem 0.8rem; border-radius: 999px;
  color: var(--ink);
}
.sec-name.facile { background: color-mix(in srgb, var(--sky) 75%, #fff); }
.sec-name.normal { background: color-mix(in srgb, var(--lemon) 75%, #fff); }
.sec-name.difficile { background: color-mix(in srgb, var(--rose) 75%, #fff); }
.sec-count { font-size: 0.82rem; font-weight: 700; color: var(--muted); }

.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
@media (min-width: 480px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.empty {
  margin: 0; padding: 1.2rem; text-align: center; font-size: 0.9rem; color: var(--muted);
  border-radius: 1.1rem;
}

.lvl {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.9rem 0.95rem 0.85rem;
  min-height: 6.2rem;
  text-align: left;
  border-radius: 1.2rem;
  cursor: pointer;
  color: var(--ink);
  transition: transform 0.14s ease, box-shadow 0.2s ease;
}
.lvl:hover { transform: translateY(-3px); box-shadow: 0 14px 30px rgba(70, 100, 150, 0.18); }
.lvl:active { transform: translateY(0); }
.lvl:focus-visible { outline: 2px solid var(--sky-ink); outline-offset: 2px; }
.lvl.started { box-shadow: 0 8px 26px rgba(70, 100, 150, 0.12), inset 0 0 0 1.5px color-mix(in srgb, var(--sky-ink) 45%, transparent); }
.lvl.done {
  background: linear-gradient(160deg, color-mix(in srgb, var(--sky) 55%, #fff), color-mix(in srgb, var(--rose) 45%, #fff));
}

.no { font-size: 0.72rem; font-weight: 800; color: var(--muted); }
.theme { flex: 1; font-size: 1.04rem; font-weight: 800; line-height: 1.15; }

.score { font-size: 0.82rem; font-weight: 700; }
.count { color: var(--muted); }
.badge { color: var(--ink); }
</style>
