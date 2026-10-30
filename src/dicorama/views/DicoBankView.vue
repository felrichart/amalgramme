<script setup>
/* The bank, every level the generator found (admin only), to play any or edit it
 * into an official one: filter by length, by a piece of pattern ("RE_E", blanks
 * typed as _ . or space) or by a word it holds (frivole, also matching its
 * family: frivoles), or draw one at random. */
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import '../theme.js';
import { getToday } from '../../utils/today.js';
import { bank, loadProgress } from '../levels.js';
import { officialLevel } from '../store.js';
import { buildLevel, progressOf, scoreOf, keyOf } from '../game.js';
import { dayColor } from '../days.js';

const router = useRouter();
const LENGTHS = [4, 5, 6, 7];
const PAGE = 150;
const STATUS = { draft: 'brouillon', valid: 'validé' };

const rows = bank().map((l) => {
  const { found } = loadProgress(l.pattern);
  const level = buildLevel(l);
  const row = {
    pattern: l.pattern,
    size: `${l.words.length} familles`,
    status: STATUS[officialLevel(l.pattern)?.status],
    words: new Set([...level.answers.keys(), ...level.families.map((f) => keyOf(f.base))]),
  };
  if (!found.length) return row;
  const progress = progressOf(level, found);
  return { ...row, score: scoreOf(progress), done: progress.stars >= 2 };
});

const length = ref(null);
const query = ref('');
const shown = ref(PAGE);
const needle = computed(() => query.value.toUpperCase().replace(/[.·\s]/g, '_'));
const word = computed(() => keyOf(query.value.trim()));
const filtered = computed(() =>
  rows.filter(
    (r) =>
      (!length.value || r.pattern.length === length.value) &&
      (r.pattern.includes(needle.value) || r.words.has(word.value)),
  ),
);

function setLength(len) {
  length.value = length.value === len ? null : len;
  shown.value = PAGE;
}

const play = (pattern) => router.push(`/dicorama/banque/${pattern}`);
const edit = (pattern) => router.push(`/dicorama/editer/${pattern}`);
function playRandom() {
  const list = filtered.value;
  if (list.length) play(list[Math.floor(Math.random() * list.length)].pattern);
}
</script>

<template>
  <div class="dico admin" :style="{ '--day': dayColor(getToday()) }">
    <header class="bar">
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
      <h1 class="title">Banque</h1>
    </header>
    <div class="filters">
      <div class="lengths">
        <button
          v-for="len in LENGTHS"
          :key="len"
          class="pill"
          :class="{ on: length === len }"
          type="button"
          @click="setLength(len)"
        >
          {{ len }} lettres
        </button>
      </div>
      <div class="search">
        <input
          v-model="query"
          class="query"
          type="search"
          placeholder="Motif ou mot : RE_E, frivole…"
          autocapitalize="characters"
          spellcheck="false"
          @input="shown = PAGE"
        />
        <button class="pill" type="button" :disabled="!filtered.length" @click="playRandom">
          Au hasard
        </button>
      </div>
      <p class="count">{{ filtered.length }} niveau{{ filtered.length > 1 ? 'x' : '' }}</p>
    </div>
    <ul class="list">
      <li v-for="r in filtered.slice(0, shown)" :key="r.pattern" class="item">
        <button class="row press" :class="{ done: r.done }" type="button" @click="play(r.pattern)">
          <span class="pattern">{{ r.pattern.replaceAll('_', '·') }}</span>
          <span v-if="r.status" class="status">{{ r.status }}</span>
          <span v-if="r.score" class="score"
            >{{ r.score.value }}<span class="max">/{{ r.score.max }}</span></span
          >
          <span v-else class="size">{{ r.size }}</span>
        </button>
        <button class="act press" type="button" aria-label="éditer" @click="edit(r.pattern)">
          ✎
        </button>
      </li>
      <li v-if="filtered.length > shown">
        <button class="cta ghost press more" type="button" @click="shown += PAGE">
          Afficher plus
        </button>
      </li>
      <li v-if="!filtered.length" class="empty">Aucun niveau ne contient ce motif ni ce mot.</li>
    </ul>
  </div>
</template>

<style scoped>
/* Dicorama's colours on the shared list bits (pills, rows). */
.admin {
  --ink: var(--dc-ink);
  --muted: var(--dc-muted);
  --panel: var(--dc-board);
  --line: var(--dc-board-edge);
  --rare: #b07d00;
  --on-color: var(--dc-cream);
  --tint: var(--dc-board);
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: 100dvh;
}
.admin .list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: max(10px, env(safe-area-inset-top)) 12px 4px 10px;
}
.title {
  margin: 0;
  font-family: var(--dc-serif);
  font-weight: 400;
  font-size: 28px;
  color: var(--day);
}
.pattern {
  font-family: var(--dc-mono);
}
.filters {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.2rem 1rem 0.4rem;
}
.lengths {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.4rem;
}
.lengths .pill {
  min-width: 0;
  height: 2.4rem;
  padding: 0 0.4rem;
  font-size: 0.8rem;
}
.pill.on {
  color: var(--on-color);
  background: var(--ink);
}
.search {
  display: flex;
  gap: 0.5rem;
}
.query {
  flex: 1;
  min-width: 0;
  height: 2.8rem;
  padding: 0 1rem;
  font: inherit;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink);
  background: var(--panel);
  border: var(--outline-w) solid var(--outline);
  border-radius: 999px;
}
.query::placeholder {
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
  color: var(--muted);
}
.count {
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--muted);
}
.pattern {
  font-size: 1.05rem;
  letter-spacing: 0.18em;
}
/* Whether the level is a draft or official, for the admin. */
.status {
  padding: 0.1rem 0.45rem;
  border: 1.5px solid currentColor;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 800;
  opacity: 0.6;
}
.score,
.size {
  margin-left: auto;
  font-size: 0.85rem;
}
.size {
  font-weight: 800;
  opacity: 0.7;
}
.pill.bank {
  min-width: 0;
  height: 2.6rem;
  padding: 0 0.8rem;
  font-size: 0.8rem;
}
.act {
  color: var(--ink);
}
.max {
  font-size: 0.75rem;
  opacity: 0.7;
}
.more {
  width: 100%;
}
</style>
