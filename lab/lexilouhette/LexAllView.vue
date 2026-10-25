<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '../../src/components/ui/PageHeader.vue';
import { WORD_TINTS } from '../../src/palette.js';
import { levelsOf, loadProgress } from './levels.js';
import { isAdmin, officialLevel } from './official.js';
import { buildLevel, scoreOf, maxScore, isDone, keyOf } from './game.js';

/* A list of levels, the official ones or the bank (every level the generator
 * found, admin only, each with a button to edit it into an official one), to pick
 * any: filter by length, by a piece of pattern ("RE_E", blanks typed as _ . or
 * space) or by a word it holds (frivole, also matching its family: frivoles), or
 * draw one at random. */
const props = defineProps({ source: { type: String, required: true } });
const router = useRouter();
const LENGTHS = [4, 5, 6, 7];
const PAGE = 150;
const inBank = props.source === 'bank';
const home = inBank ? '/lexilouhette/banque' : '/lexilouhette';
const STATUS = { draft: 'brouillon', valid: 'officiel' };

const rows = levelsOf(props.source).map((l) => {
  const { found, revealed } = loadProgress(l.pattern);
  const level = buildLevel(l);
  const row = {
    pattern: l.pattern,
    // Beside a level not played: how many families in the bank, answers otherwise.
    size: inBank ? `${l.words.length} familles` : `${maxScore(level)} réponses`,
    status: isAdmin && STATUS[(inBank ? officialLevel(l.pattern) : l)?.status],
    tint: WORD_TINTS[(l.pattern.length - LENGTHS[0]) % WORD_TINTS.length],
    words: new Set([...level.answers.keys(), ...level.families.map((f) => keyOf(f.base))]),
  };
  if (!found.length && !revealed) return row;
  const done = revealed || isDone(level, found);
  return { ...row, score: scoreOf(level, found), max: maxScore(level), done };
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

const play = (pattern) => router.push(`${home}/${pattern}`);
const edit = (pattern) => router.push(`/lexilouhette/editer/${pattern}`);
function playRandom() {
  const list = filtered.value;
  if (list.length) play(list[Math.floor(Math.random() * list.length)].pattern);
}
</script>

<template>
  <div class="page fit">
    <PageHeader v-if="inBank" title="Banque" back="/lexilouhette" back-label="niveaux" />
    <PageHeader v-else title="Lexilouhette" back="/" back-label="labo">
      <button
        v-if="isAdmin"
        class="pill bank"
        type="button"
        @click="router.push('/lexilouhette/banque')"
      >
        Banque
      </button>
    </PageHeader>
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
        <button
          class="row press"
          :class="{ done: r.done }"
          :style="{ '--tint': r.tint }"
          type="button"
          @click="play(r.pattern)"
        >
          <span class="pattern">{{ r.pattern.replaceAll('_', '·') }}</span>
          <span v-if="r.status" class="status">{{ r.status }}</span>
          <span v-if="r.score" class="score"
            >{{ r.score.normal }}<span v-if="r.score.rare" class="rare">+{{ r.score.rare }}</span
            ><span class="max">/{{ r.max }}</span></span
          >
          <span v-else class="size">{{ r.size }}</span>
        </button>
        <button
          v-if="inBank"
          class="act press"
          type="button"
          aria-label="éditer"
          @click="edit(r.pattern)"
        >
          ✎
        </button>
      </li>
      <li v-if="filtered.length > shown">
        <button class="cta ghost press more" type="button" @click="shown += PAGE">
          Afficher plus
        </button>
      </li>
      <li v-if="!rows.length" class="empty">
        Aucun niveau officiel pour l'instant<template v-if="isAdmin"
          >, ajoute-en depuis la banque</template
        >.
      </li>
      <li v-else-if="!filtered.length" class="empty">
        Aucun niveau ne contient ce motif ni ce mot.
      </li>
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
.rare {
  color: var(--rare);
}
.row.done .rare {
  color: inherit;
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
