<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { todayDate } from '../data/dailies.js';
import { hasNewCommunityLevels } from '../data/community.js';
import { isAdmin } from '../composables/useUsername.js';
import { levelProgress } from '../data/progress.js';
import { WORD_TINTS } from '../palette.js';
import UserBadge from '../components/UserBadge.vue';
import ProgressMark from '../components/ui/ProgressMark.vue';
import ContactModal from '../components/ContactModal.vue';

/* Logo: the name in ink, its A, A, A and E set as tilted puzzle pieces in the word tints. */
const PIECES = [
  ['tab-bottom', -5],
  ['tab-top', 4],
  ['tab-bottom', -3],
  ['tab-top', 5],
];
const BRAND = [...'AMALGRAMME'].map((ch, i) => {
  const n = [0, 2, 6, 9].indexOf(i);
  if (n < 0) return { ch };
  const [tab, tilt] = PIECES[n];
  return { ch, shape: tab, style: { '--fill': WORD_TINTS[n], rotate: `${tilt}deg` } };
});

const router = useRouter();

// Read once: the view remounts on every navigation (App keys on route).
const daily = levelProgress(todayDate());
const communityNew = hasNewCommunityLevels();

const showContact = ref(false);
</script>

<template>
  <div class="menu">
    <div class="badge-corner">
      <UserBadge />
    </div>
    <header class="top">
      <h1 class="brand" aria-label="Amalgramme">
        <template v-for="(l, i) in BRAND" :key="i">
          <span
            v-if="l.shape"
            class="bpiece puzzle"
            :class="l.shape"
            :style="l.style"
            aria-hidden="true"
            ><span class="puzzle-body">{{ l.ch }}</span
            ><span class="puzzle-tab"
          /></span>
          <span v-else class="bletter" aria-hidden="true">{{ l.ch }}</span>
        </template>
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

      <button
        v-if="isAdmin"
        class="action admin press"
        type="button"
        @click="router.push('/admin')"
      >
        Admin
      </button>
    </nav>

    <button class="contact" type="button" @click="showContact = true">Contact</button>
    <ContactModal v-if="showContact" @close="showContact = false" />
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
/* Logo: ink letters, with four of them as puzzle pieces. */
.brand {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.06em;
  font-size: min(2.1rem, 7.2vw);
  font-weight: 900;
  line-height: 1;
  color: var(--ink);
}
.bpiece {
  --k: 0.14em;
  --rx: 0.22em;
  --ry: 0.17em;
  margin: 0 0.1em;
}
.bpiece .puzzle-body {
  display: grid;
  place-items: center;
  width: 1.3em;
  height: 1.3em;
  border-radius: 0.28em;
  color: var(--ink);
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
}
/* Daily: always solid accent; state shown only by the corner marker. */
.daily {
  background: var(--accent);
  color: var(--on-color);
}
.past {
  background: color-mix(in srgb, var(--accent) 20%, var(--panel));
  color: var(--ink);
}
.community {
  --tint: var(--gold);
  background: color-mix(in srgb, var(--tint) 20%, var(--panel));
  color: var(--ink);
}
/* Admin: only rendered for the cara+ account; a quiet dashed panel. */
.admin {
  background: var(--panel);
  color: var(--ink);
  border: 2px dashed var(--line);
  box-shadow: none;
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

/* Quiet text link under the actions. */
.contact {
  padding: 0.4rem 0.8rem;
  border: none;
  background: none;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--ink);
  opacity: 0.5;
  cursor: pointer;
}

/* Completion marker, top-right corner (white dot on the accent fill). */
.mark {
  --dot: #fff;
  position: absolute;
  top: 0.6rem;
  right: 0.7rem;
}
/* New-content badge, top-right corner (deep mustard on the community wash). */
.notif {
  position: absolute;
  top: 0.55rem;
  right: 0.7rem;
  font-size: 1.2rem;
  font-weight: 900;
  line-height: 1;
  color: color-mix(in srgb, var(--gold) 70%, var(--ink));
}
</style>
