<script setup>
/*
 * A Dicorama level the admin plays from its pattern: the bank's, or an official
 * one not yet out. Its pattern heads it; the day's colour tints it (today's when
 * undated).
 */
import { useRoute, useRouter } from 'vue-router';
import '../theme.js';
import { getToday } from '../../utils/today.js';
import { levelFor } from '../levels.js';
import { dayColor } from '../days.js';
import DicoBoard from '../components/DicoBoard.vue';

// `source`: 'official' or 'bank' (see levelFor).
const props = defineProps({ source: { type: String, required: true } });
const route = useRoute();
const router = useRouter();

const level = levelFor(props.source, route.params.pattern);
const color = dayColor(level.date ?? getToday());
const back = props.source === 'bank' ? '/dicorama/banque' : '/dicorama/a-venir';
</script>

<template>
  <div class="dico game" :style="{ '--day': color }">
    <div class="screen">
      <header class="bar">
        <button class="dc-icon" type="button" aria-label="retour" @click="router.push(back)">
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
        <h1 class="title">{{ level.pattern.replaceAll('_', '·') }}</h1>
      </header>
      <DicoBoard :level="level" />
    </div>
  </div>
</template>

<style scoped>
.game {
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
  display: flex;
  align-items: center;
  gap: 4px;
  padding: max(10px, env(safe-area-inset-top)) 8px 8px 10px;
}
.title {
  margin: 0;
  font-family: var(--dc-mono);
  font-size: 16px;
  letter-spacing: 0.15em;
  color: var(--dc-muted);
}
</style>
