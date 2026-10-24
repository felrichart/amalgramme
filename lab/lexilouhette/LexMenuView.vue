<script setup>
import { useRouter } from 'vue-router';
import PageHeader from '../../src/components/ui/PageHeader.vue';
import { formatChallengeDate } from '../../src/utils/format.js';
import { WORD_TINTS } from '../../src/palette.js';
import { LEVELS, loadProgress } from './levels.js';
import { scoreOf, maxScore } from './game.js';

const router = useRouter();

const rows = LEVELS.map((l, i) => {
  const { found, revealed } = loadProgress(l.date);
  return {
    ...l,
    n: i + 1,
    score: scoreOf(l, found),
    max: maxScore(l),
    done: revealed || found.length === l.answers.size,
    tint: WORD_TINTS[i % WORD_TINTS.length],
  };
});
</script>

<template>
  <div class="page fit">
    <PageHeader title="Lexilouhette" back="/" back-label="labo" />
    <ul class="list">
      <li v-for="r in rows" :key="r.date">
        <button
          class="row press"
          :class="{ done: r.done }"
          :style="{ '--tint': r.tint }"
          type="button"
          @click="router.push(`/lexilouhette/${r.date}`)"
        >
          <span class="label">
            <span class="n">Niveau {{ r.n }}</span>
            <span class="date">{{ formatChallengeDate(r.date) }}</span>
          </span>
          <span class="pattern">{{ r.pattern.replaceAll('_', '·') }}</span>
          <span class="score"
            >{{ r.score }}<span class="max">/{{ r.max }}</span></span
          >
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.label {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}
.date {
  font-size: 0.75rem;
  font-weight: 800;
  opacity: 0.75;
}
.pattern {
  margin-left: auto;
  font-size: 1.05rem;
  letter-spacing: 0.18em;
}
.score {
  min-width: 5.2rem;
  text-align: right;
  font-size: 0.9rem;
}
.max {
  font-size: 0.75rem;
  opacity: 0.7;
}
</style>
