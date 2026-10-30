<script setup>
/*
 * The celebration over the board: 'goal' when the level is finished, its star
 * won, telling how many words the level holds in all; 'all' when it's complete,
 * its trophy won; 'perfect' once the rare words are all found too, its medal won. Tiles burst out over it.
 */
import { computed } from 'vue';
import DicoStar from './DicoStar.vue';
import DicoMarks from './DicoMarks.vue';
import DicoBonus from './DicoBonus.vue';

const props = defineProps({
  kind: { type: String, required: true },
  // See progressOf (game.js).
  progress: { type: Object, required: true },
});
const emit = defineEmits(['more']);

const all = computed(() => props.kind === 'all');
const perfect = computed(() => props.kind === 'perfect');
const rareLeft = computed(() => props.progress.rare < props.progress.rareTotal);
const TITLES = { goal: 'Bravo !', all: 'Tout trouvé !', perfect: 'Absolument tout !' };
const LEVELS = { goal: 1, all: 2, perfect: 3 };
const common = computed(() => props.progress.total - props.progress.rare);
// The common words still to find, the trophy's price.
const left = computed(() => common.value - (props.progress.score - props.progress.rare));
const rareWord = computed(() => (props.progress.rare > 1 ? 'rares' : 'rare'));
const rares = computed(() => {
  const n = props.progress.rare;
  return n ? `${n} rare${n > 1 ? 's' : ''}` : '';
});
const moreLabel = computed(() =>
  props.kind === 'goal'
    ? 'Trouver plus de mots'
    : all.value && rareLeft.value
      ? 'Chercher les rares'
      : 'Revoir la liste',
);

// Spread on the golden angle, so they look scattered with no randomness.
const TILES = 26;
const tiles = Array.from({ length: TILES }, (_, i) => {
  const angle = (i * 137.5 * Math.PI) / 180;
  const reach = 150 + ((i * 53) % 110);
  return {
    kind: i % 5 === 0 ? 'star' : i % 3 === 0 ? 'yellow' : i % 4 === 1 ? 'cream' : 'day',
    style: {
      '--x': `${Math.cos(angle) * reach}px`,
      '--y': `${Math.sin(angle) * reach * 0.8 - 30}px`,
      '--turn': `${((i * 97) % 300) - 150}deg`,
      '--delay': `${(i % 6) * 25}ms`,
      '--size': `${8 + ((i * 7) % 7)}px`,
    },
  };
});
</script>

<template>
  <div class="overlay" @click.self="emit('more')">
    <div class="burst" aria-hidden="true">
      <span v-for="(t, i) in tiles" :key="i" class="tile" :class="t.kind" :style="t.style">
        <DicoStar v-if="t.kind === 'star'" />
      </span>
    </div>
    <div class="card" role="dialog" aria-modal="true" :aria-label="TITLES[kind]">
      <DicoMarks class="marks" :level="LEVELS[kind]" pop />
      <h2 class="title">{{ TITLES[kind] }}</h2>
      <template v-if="kind === 'goal'">
        <p class="text">
          <strong>{{ progress.goal }} mots</strong> trouvés.
        </p>
        <p class="text nudge">
          Plus que <strong>{{ left }}</strong> pour obtenir le trophée.
        </p>
      </template>
      <template v-else-if="perfect">
        <p class="text">
          Les <strong>{{ common }} mots</strong> du niveau et les <strong>{{ rares }}</strong
          >&#8239;: il n'y a plus rien à trouver.
        </p>
      </template>
      <template v-else>
        <p class="text">
          Les <strong>{{ common }} mots</strong> du niveau, trouvés.
        </p>
        <p v-if="rares" class="text rare-line">
          <DicoBonus class="tag-bonus" :count="progress.rare" />
          <strong>{{ rareWord }}</strong
          >&nbsp;en prime&#8239;!
        </p>
        <p v-if="rareLeft" class="text quiet">Des mots rares se cachent peut-être encore…</p>
      </template>
      <div class="actions">
        <button class="dc-button" type="button" @click="emit('more')">
          {{ moreLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(30 26 20 / 0.42);
  animation: finish-fade 0.25s ease-out both;
}
.card {
  position: relative;
  width: 100%;
  max-width: 320px;
  padding: 26px 22px 22px;
  border-radius: 22px;
  background: var(--dc-board);
  box-shadow:
    inset 0 -4px 0 var(--dc-board-edge),
    inset 0 2px 0 rgb(255 255 255 / 0.5),
    0 18px 40px rgb(0 0 0 / 0.25);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: finish-in 0.5s cubic-bezier(0.3, 1.5, 0.5, 1) both;
}
.marks {
  margin: 6px 0 16px;
  font-size: 42px;
}
.title {
  margin: 0 0 10px;
  font-family: var(--dc-serif);
  font-weight: 400;
  font-size: 30px;
  line-height: 1.1;
  color: var(--day);
}
.text {
  margin: 0 0 8px;
  font-size: 15px;
  line-height: 1.45;
  color: var(--dc-muted);
}
.text strong {
  color: var(--dc-day-ink);
}
.text.nudge {
  font-style: italic;
}
.text.quiet {
  font-style: italic;
  color: var(--dc-faint);
}
.rare-line {
  display: flex;
  align-items: center;
  justify-content: center;
}
.tag-bonus {
  margin-right: 5px;
  font-size: 18px;
}
.actions {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}
.burst {
  position: absolute;
  z-index: 1;
  pointer-events: none;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
}
.tile {
  position: absolute;
  left: calc(var(--size) / -2);
  top: calc(var(--size) / -2);
  width: var(--size);
  height: calc(var(--size) * 1.2);
  border-radius: 3px 3px 1px 1px;
  background: var(--day);
  box-shadow: 0 1px 0 rgb(0 0 0 / 0.25);
  opacity: 0;
  animation: finish-burst 1.3s cubic-bezier(0.15, 0.7, 0.3, 1) calc(0.12s + var(--delay)) both;
}
.tile.yellow {
  background: var(--dc-yellow);
}
.tile.cream {
  background: var(--dc-cream);
}
.tile.star {
  width: calc(var(--size) * 1.6);
  height: calc(var(--size) * 1.6);
  background: none;
  box-shadow: none;
  color: var(--dc-yellow);
  font-size: calc(var(--size) * 1.6);
}
@keyframes finish-fade {
  from {
    opacity: 0;
  }
}
@keyframes finish-in {
  from {
    opacity: 0;
    transform: scale(0.82) translateY(14px);
  }
}
@keyframes finish-star {
  0% {
    transform: scale(0) rotate(-40deg);
  }
  100% {
    transform: scale(1) rotate(0);
  }
}
@keyframes finish-burst {
  0% {
    opacity: 1;
    transform: translate(0, 0) rotate(0) scale(0.4);
  }
  55% {
    opacity: 1;
    transform: translate(var(--x), var(--y)) rotate(var(--turn)) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(var(--x), calc(var(--y) + 90px)) rotate(calc(var(--turn) * 2)) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .burst {
    display: none;
  }
}
</style>
