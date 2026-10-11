<script setup>
import { useRouter } from 'vue-router';
import { todayDate } from '../data/dailies.js';
import { hasNewCommunityLevels } from '../data/community.js';
import { isAdmin } from '../composables/useUsername.js';
import { levelProgress } from '../data/progress.js';
import { TILE_TINTS } from '../palette.js';
import UserBadge from '../components/UserBadge.vue';
import ProgressMark from '../components/ui/ProgressMark.vue';

/* Title rendered as keyboard tiles: each letter cycles the five tints. */
const BRAND = 'Amalgramme';
const brandTiles = BRAND.split('').map((ch, i) => ({
  ch,
  tint: TILE_TINTS[i % TILE_TINTS.length],
}));

const router = useRouter();

// Read once: the view remounts on every navigation (App keys on route).
const daily = levelProgress(todayDate());
const communityNew = hasNewCommunityLevels();

function openSondage() {
  window.open('https://forms.gle/X7Kqgeq3u1ZqyqPa9', '_blank');
}
</script>

<template>
  <div class="menu">
    <div class="badge-corner">
      <UserBadge />
    </div>
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
      <button class="action daily press" type="button" @click="router.push('/play/daily')">
        Défi quotidien
        <ProgressMark class="mark" :completed="daily.completed" :partial="daily.partial" />
      </button>

      <button class="action past press" type="button" @click="router.push('/challenges')">
        Défis passés
      </button>

      <button class="action community press" type="button" @click="router.push('/community')">
        Défis de la communauté
        <span v-if="communityNew" class="notif" aria-label="nouveaux défis">!</span>
      </button>

      <button class="action sondage press" type="button" @click="openSondage">
        Aidez moi à améliorer le jeu !
      </button>

      <button
        v-if="isAdmin"
        class="action admin press"
        type="button"
        @click="router.push('/admin')"
      >
        Admin
      </button>
    </nav>
  </div>
</template>

<style scoped>
.menu {
  position: relative;
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
/* Permanent user icon, pinned top-right. */
.badge-corner {
  position: absolute;
  top: calc(0.9rem + env(safe-area-inset-top));
  right: 1rem;
}
/* Fit to the title so the credit can sit at its right edge. */
.top {
  width: fit-content;
}
/* Title as a row of keyboard tiles. */
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
  border-width: var(--outline-w-lg);
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
.community {
  --tint: var(--violet);
  background: var(--tint-wash);
  color: var(--ink);
}
.sondage {
  background: var(--gold);
  color: var(--ink);
}
/* Admin: only rendered for the cara+ account; a quiet dashed panel. */
.admin {
  background: var(--panel);
  color: var(--ink);
  border-style: dashed;
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

/* Completion marker, top-right corner (white dot on the accent fill). */
.mark {
  --dot: #fff;
  position: absolute;
  top: 0.6rem;
  right: 0.7rem;
}
/* New-content badge, top-right corner (violet on the community wash). */
.notif {
  position: absolute;
  top: 0.55rem;
  right: 0.7rem;
  font-size: 1.2rem;
  font-weight: 900;
  line-height: 1;
  color: var(--violet);
}
</style>
