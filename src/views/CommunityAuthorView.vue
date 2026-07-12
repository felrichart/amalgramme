<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { challengesByAuthor, markAuthorSeen, COMMUNITY_PREFIX } from '../data/community.js';
import { loadCommunityLevels, deleteCommunityLevel } from '../services/community.js';
import { levelProgress } from '../composables/useGameState.js';
import { username, pin, isAdmin } from '../composables/useUsername.js';

const route = useRoute();
const router = useRouter();
const author = route.params.author;

/* The player may edit/delete this list when it's their own, or they're the
 * admin (the PIN is checked server-side on the actual edit/delete). */
const mine = computed(() => username.value === author || isAdmin.value);

function build() {
  return challengesByAuthor(author).map((c) => {
    const prog = levelProgress(COMMUNITY_PREFIX + c.id);
    return {
      id: c.id,
      number: c.number,
      completed: prog.completed,
      partial: prog.partial,
      attempts: c.attempts ?? 0,
      successes: c.successes ?? 0,
    };
  });
}

const items = ref(build());

/* Refresh if arriving cold (e.g. a direct link with an empty cache), then clear
 * this author's "new" badge now that the player has opened their list. */
onMounted(async () => {
  if (!items.value.length) {
    await loadCommunityLevels();
    items.value = build();
  }
  markAuthorSeen(author);
});

/* Delete flow: confirm, then call the backend and drop the row. */
const pending = ref(null); // level id awaiting delete confirmation
const deleting = ref(false);
const error = ref('');

async function confirmDelete() {
  deleting.value = true;
  error.value = '';
  const res = await deleteCommunityLevel(pending.value, {
    author: username.value,
    pin: pin.value,
  });
  deleting.value = false;
  if (res.ok) {
    pending.value = null;
    items.value = build();
  } else {
    error.value = res.error;
  }
}
</script>

<template>
  <div class="challenges">
    <header class="top">
      <button
        class="icon-btn"
        type="button"
        @click="router.push('/community')"
        aria-label="communauté"
      >
        ←
      </button>
      <h1 class="title">Défis de {{ author }}</h1>
      <div class="spacer" />
    </header>

    <ul class="list">
      <li v-for="c in items" :key="c.id" class="item">
        <button
          class="row"
          :class="{ done: c.completed, partial: c.partial }"
          type="button"
          @click="router.push(`/play/${COMMUNITY_PREFIX}${c.id}`)"
        >
          <span class="num">#{{ c.number }}</span>
          <span class="meta">
            <span class="stats">
              <span class="stat" :aria-label="`${c.attempts} joueurs`"
                >Essayé par {{ c.attempts }} joueur{{ c.attempts > 1 ? 's' : '' }}</span
              >
              <span class="stat" :aria-label="`${c.successes} réussites`"
                >Réussi par {{ c.successes }} joueur{{ c.successes > 1 ? 's' : '' }}</span
              >
            </span>
            <span v-if="c.completed" class="check" aria-label="terminé">✓</span>
            <span v-else-if="c.partial" class="dot" aria-label="en cours"></span>
          </span>
        </button>
        <template v-if="mine">
          <button
            class="act"
            type="button"
            aria-label="modifier"
            @click="router.push(`/community/edit/${c.id}`)"
          >
            ✎
          </button>
          <button class="act danger" type="button" aria-label="supprimer" @click="pending = c.id">
            ✕
          </button>
        </template>
      </li>
      <li v-if="!items.length" class="empty">Aucun défi.</li>
    </ul>

    <!-- Delete confirmation -->
    <div v-if="pending" class="overlay" @click.self="!deleting && (pending = null)">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Supprimer le défi">
        <h2 class="modal-title">Supprimer ce défi ?</h2>
        <p v-if="error" class="err">{{ error }}</p>
        <div class="modal-actions">
          <button class="cta cta-ghost" type="button" :disabled="deleting" @click="pending = null">
            Annuler
          </button>
          <button class="cta danger" type="button" :disabled="deleting" @click="confirmDelete">
            {{ deleting ? '…' : 'Supprimer' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.challenges {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  max-width: 560px;
  margin: 0 auto;
}
.top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.9rem 1rem 0.5rem;
}
.icon-btn {
  width: 2.6rem;
  height: 2.6rem;
  flex: none;
  display: grid;
  place-items: center;
  font-size: 1.3rem;
  border-radius: 0.9rem;
  color: var(--ink);
  cursor: pointer;
  background: var(--panel);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.icon-btn:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
.icon-btn:focus-visible {
  outline: 2px solid var(--outline);
  outline-offset: 2px;
}
.title {
  flex: 1;
  margin: 0;
  text-align: center;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--ink);
}
.spacer {
  width: 2.6rem;
  flex: none;
}

.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.6rem 1rem calc(2rem + env(safe-area-inset-bottom));
}
/* Row + owner actions on one line. */
.item {
  display: flex;
  align-items: stretch;
  gap: 0.5rem;
}
.row {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  font-weight: 900;
  font-size: 1.1rem;
  cursor: pointer;
  color: var(--ink);
  --tint: var(--violet);
  background: var(--tint-wash);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop);
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.row:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
.row:focus-visible {
  outline: none;
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
.row.done {
  background: var(--tint);
  color: #fff;
}
.num {
  letter-spacing: 0.02em;
}
/* Trailing group: play stats plus the completion mark, pushed to the row's end. */
.meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end; /* optional: right-align text */
  gap: 0.15rem;
}
.stat {
  font-size: 0.9rem;
  font-weight: 800;
  white-space: nowrap;
  opacity: 0.85;
}
.check {
  font-size: 1rem;
  font-weight: 900;
  line-height: 1;
}
.dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: var(--violet);
  border: 1.5px solid var(--outline);
}
/* Owner edit/delete buttons. */
.act {
  flex: none;
  width: 2.9rem;
  display: grid;
  place-items: center;
  border-radius: 0.9rem;
  font-size: 1.05rem;
  font-weight: 900;
  cursor: pointer;
  color: var(--ink);
  background: var(--panel);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.act:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
.act.danger {
  color: var(--pink);
}
.empty {
  text-align: center;
  color: var(--muted);
  font-weight: 700;
  padding: 2rem 1rem;
}

/* Delete confirmation modal. */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1.2rem;
  background: rgba(22, 24, 31, 0.45);
}
.modal {
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.6rem 1.4rem;
  border-radius: 1.3rem;
  background: var(--panel);
  border: var(--outline-w-lg) solid var(--outline);
  box-shadow: var(--pop-lg);
}
.modal-title {
  margin: 0;
  text-align: center;
  font-size: 1.1rem;
  font-weight: 900;
}
.err {
  text-align: center;
  color: var(--pink);
  font-weight: 800;
  font-size: 0.9rem;
}
.modal-actions {
  display: flex;
  gap: 0.7rem;
}
.cta {
  flex: 1;
  background: var(--violet);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 1rem;
  padding: 0.8rem 1rem;
  border-radius: 1rem;
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop);
  cursor: pointer;
}
.cta-ghost {
  background: var(--panel);
  color: var(--ink);
}
.cta.danger {
  background: var(--pink);
}
.cta:disabled {
  opacity: 0.5;
  cursor: default;
}
.cta:not(:disabled):active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
</style>
