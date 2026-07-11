<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { DAILY_INDEX } from '../data/challenges.js';
import { levelProgress } from '../composables/useGameState.js';
import { TILE_TINTS } from '../palette.js';

/* Title rendered as keyboard tiles: each letter cycles the five tints. */
const BRAND = 'Amalgramme';
const brandTiles = BRAND.split('').map((ch, i) => ({
  ch,
  tint: TILE_TINTS[i % TILE_TINTS.length],
}));

const router = useRouter();

/* Fresh read: the view remounts on every navigation (App keys on route). */
const daily = computed(() => levelProgress(DAILY_INDEX));
</script>

<template>
  <div class="menu">
    <header class="top">
      <h1 class="brand" aria-label="Amalgramme">
        <span
          v-for="(t, i) in brandTiles"
          :key="i"
          class="btile solid"
          :style="{ '--tint': t.tint }"
          aria-hidden="true"
          >{{ t.ch }}</span
        >
      </h1>
      <p class="credit">par Cara+</p>
    </header>

    <nav class="actions">
      <button
        class="action daily"
        :class="{ done: daily.completed, partial: daily.partial }"
        type="button"
        @click="router.push('/play/daily')"
      >
        Défi quotidien
        <span v-if="daily.completed" class="check" aria-label="terminé">✓</span>
        <span v-else-if="daily.partial" class="dot" aria-label="en cours"></span>
      </button>

      <button class="action past" type="button" @click="router.push('/challenges')">
        Défis passés
      </button>

      <button class="action tuto" type="button" @click="router.push('/play/tutoriel')">
        Tutoriel
      </button>
    </nav>
  </div>
</template>

<style scoped>
.menu {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2.6rem;
  max-width: 560px;
  margin: 0 auto;
  padding: 2.2rem 1.2rem 3rem;
}
/* Fit to the title so the credit can sit at its right edge. */
.top {
  width: fit-content;
}
/* Title as a row of keyboard tiles (see LetterKeyboard .key). */
.brand {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem;
}
.btile {
  font-size: 1.45rem;
  display: grid;
  place-items: center;
  min-width: 1.35em;
  height: 1.7em;
  padding: 0 0.2em;
  border-radius: 0.4em;
  font-weight: 900;
  text-transform: uppercase;
  color: #fff;
  background: var(--tint);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
/* Lift every other tile for a hand-set, playful baseline. */
.btile:nth-child(even) {
  transform: translateY(-0.28em);
}

.actions {
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.action {
  position: relative;
  padding: 1.1rem 1.4rem;
  border-radius: 1.1rem;
  font-weight: 900;
  font-size: 1.15rem;
  cursor: pointer;
  border: var(--outline-w-lg) solid var(--outline);
  box-shadow: var(--pop);
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.action:active {
  transform: translate(4px, 5px);
  box-shadow: 0 0 0 var(--outline);
}
/* Focus (keyboard): show the button pressed rather than ringed. */
.action:focus-visible {
  outline: none;
  transform: translate(4px, 5px);
  box-shadow: 0 0 0 var(--outline);
}
/* Daily: always solid accent; state shown only by the corner marker. */
.daily {
  background: var(--accent);
  color: #fff;
}
.past {
  background: var(--accent-wash);
  color: var(--ink);
}
.tuto {
  background: var(--panel);
  color: var(--ink);
}

/* Attribution, under the title. */
.credit {
  margin: 0.3rem 0 0;
  text-align: right;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--ink);
  opacity: 0.35;
}

/* Success mark, top-right corner. */
.check {
  position: absolute;
  top: 0.55rem;
  right: 0.7rem;
  font-size: 0.95rem;
  font-weight: 900;
  line-height: 1;
}
/* In-progress dot, top-right corner (white on the accent fill). */
.dot {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: #fff;
  border: 1.5px solid var(--outline);
}
</style>
