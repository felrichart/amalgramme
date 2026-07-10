<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { PUZZLES } from '../data/challenges.js'
import { levelProgress } from '../composables/useGameState.js'
import GiraffeMark from '../components/GiraffeMark.vue'

const router = useRouter()

const levels = computed(() =>
  PUZZLES.map((p, i) => {
    const prog = levelProgress(i)
    return {
      index: i,
      theme: p.theme,
      total: p.words.length,
      found: prog.found,
      completed: prog.completed,
    }
  })
)

const doneCount = computed(() => levels.value.filter((l) => l.completed).length)

function play(l) {
  router.push('/play/' + l.index)
}
</script>

<template>
  <div class="levels">
    <header class="top">
      <span class="mark"><GiraffeMark /></span>
      <h1>Mots Girafe</h1>
      <p class="tag">{{ doneCount }} / {{ levels.length }} niveaux réussis</p>
    </header>

    <div class="grid">
      <button
        v-for="l in levels"
        :key="l.index"
        class="lvl"
        :class="{ done: l.completed, started: !l.completed && l.found > 0 }"
        type="button"
        @click="play(l)"
      >
        <span class="no">{{ l.index + 1 }}</span>
        <span class="theme">{{ l.theme }}</span>
        <span class="score">
          <span v-if="l.completed" class="badge">🦒 réussi</span>
          <span v-else class="count">{{ l.found }} / {{ l.total }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.levels { max-width: 560px; margin: 0 auto; padding: 1.2rem 1rem 2.5rem; }
.top { text-align: center; margin-bottom: 1.4rem; }
.mark { display: block; width: 3rem; height: 3rem; margin: 0 auto 0.3rem; color: var(--orange); }
.top h1 { margin: 0; font-size: 1.8rem; color: var(--patch-dark); letter-spacing: 0.5px; }
.tag { margin: 0.3rem 0 0; font-size: 0.85rem; opacity: 0.6; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 0.7rem; }

.lvl {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.9rem 0.9rem 0.8rem;
  min-height: 6rem;
  text-align: left;
  border: none;
  background: var(--cream-2);
  border-radius: 1rem;
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--patch) 22%, transparent), 0 3px 0 var(--patch-dark);
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.12s ease;
}
.lvl:active { transform: translateY(3px); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--patch) 22%, transparent), 0 0 0 var(--patch-dark); }
.lvl.started { box-shadow: inset 0 0 0 2px var(--orange), 0 3px 0 var(--patch-dark); }
.lvl.done { background: var(--patch); box-shadow: 0 3px 0 var(--patch-dark); }

.no { font-size: 0.75rem; font-weight: 800; opacity: 0.45; }
.theme { flex: 1; font-size: 1.02rem; font-weight: 800; color: var(--patch-dark); line-height: 1.15; }
.lvl.done .theme, .lvl.done .no { color: var(--cream); }
.lvl.done .no { opacity: 0.7; }

.score { font-size: 0.85rem; font-weight: 700; }
.count { color: var(--ink); opacity: 0.7; }
.badge { color: var(--cream); }
</style>
