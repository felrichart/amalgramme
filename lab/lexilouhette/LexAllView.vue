<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '../../src/components/ui/PageHeader.vue';
import { WORD_TINTS } from '../../src/palette.js';
import { LEVELS, loadProgress } from './levels.js';
import { buildLevel, scoreOf, maxScore, familiesOf } from './game.js';

/* Every level the generator found, to pick any: filter by length or by a piece of
 * pattern ("RE_E", blanks typed as _ . or space), or draw one at random. */
const router = useRouter();
const LENGTHS = [5, 6, 7, 8];
const PAGE = 150;

const rows = LEVELS.map((l) => {
  const { found, revealed } = loadProgress(l.pattern);
  const row = {
    pattern: l.pattern,
    families: new Set(l.words.map((w) => w[2])).size,
    tint: WORD_TINTS[(l.pattern.length - LENGTHS[0]) % WORD_TINTS.length],
  };
  if (!found.length && !revealed) return row;
  const level = buildLevel(l);
  const done = revealed || familiesOf(level, found).every((f) => f.lead);
  return { ...row, score: scoreOf(level, found), max: maxScore(level), done };
});

const length = ref(null);
const query = ref('');
const shown = ref(PAGE);
const needle = computed(() => query.value.toUpperCase().replace(/[.·\s]/g, '_'));
const filtered = computed(() =>
  rows.filter(
    (r) => (!length.value || r.pattern.length === length.value) && r.pattern.includes(needle.value),
  ),
);

function setLength(len) {
  length.value = length.value === len ? null : len;
  shown.value = PAGE;
}

const play = (pattern) => router.push(`/lexilouhette/${pattern}`);
function playRandom() {
  const list = filtered.value;
  if (list.length) play(list[Math.floor(Math.random() * list.length)].pattern);
}
</script>

<template>
  <div class="page fit">
    <PageHeader title="Lexilouhette" back="/" back-label="labo" />
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
          placeholder="Motif : RE_E, BOU…"
          autocapitalize="characters"
          spellcheck="false"
          @input="shown = PAGE"
        />
        <button class="pill" type="button" :disabled="!filtered.length" @click="playRandom">
          Au hasard
        </button>
      </div>
      <p class="count">{{ filtered.length }} niveaux</p>
    </div>
    <ul class="list">
      <li v-for="r in filtered.slice(0, shown)" :key="r.pattern">
        <button
          class="row press"
          :class="{ done: r.done }"
          :style="{ '--tint': r.tint }"
          type="button"
          @click="play(r.pattern)"
        >
          <span class="pattern">{{ r.pattern.replaceAll('_', '·') }}</span>
          <span v-if="r.max" class="score"
            >{{ r.score }}<span class="max">/{{ r.max }}</span></span
          >
          <span v-else class="families">{{ r.families }} familles</span>
        </button>
      </li>
      <li v-if="filtered.length > shown">
        <button class="cta ghost press more" type="button" @click="shown += PAGE">
          Afficher plus
        </button>
      </li>
      <li v-if="!filtered.length" class="empty">Aucun niveau ne contient ce motif.</li>
    </ul>
  </div>
</template>

<style scoped>
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
.score,
.families {
  margin-left: auto;
  font-size: 0.85rem;
}
.families {
  font-weight: 800;
  opacity: 0.7;
}
.max {
  font-size: 0.75rem;
  opacity: 0.7;
}
.more {
  width: 100%;
}
</style>
