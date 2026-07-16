<script setup>
/*
 * Admin dashboard: the daily bank, newest first, with play stats. Today/future
 * rows open the editor and can be deleted; past dailies are locked (their played
 * puzzle can't change — the Worker enforces this too) and shown read-only.
 * Also mints a full-DB backup download. Admin-only (cara+).
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getToday } from '../utils/today.js';
import { formatChallengeDate } from '../data/challenges.js';
import { getDailies } from '../data/dailies.js';
import { loadDailies, deleteDaily, exportBackup } from '../services/dailies.js';
import { username, pin, isAdmin } from '../composables/useUsername.js';

const router = useRouter();
const today = getToday();

if (!isAdmin.value) router.replace('/');

function build() {
  return getDailies()
    .slice()
    .reverse()
    .map((d) => ({
      date: d.date,
      label: formatChallengeDate(d.date),
      secret: d.secret,
      attempts: d.attempts ?? 0,
      successes: d.successes ?? 0,
      /* Full edit + delete for today/future; past dailies are locked. */
      editable: d.date >= today,
    }));
}

const items = ref(build());

onMounted(async () => {
  await loadDailies(0);
  items.value = build();
});

/* Delete flow (today/future only). */
const pending = ref(null);
const deleting = ref(false);
const error = ref('');

async function confirmDelete() {
  deleting.value = true;
  error.value = '';
  const res = await deleteDaily(pending.value, { author: username.value, pin: pin.value });
  deleting.value = false;
  if (res.ok) {
    pending.value = null;
    items.value = build();
  } else {
    error.value = res.error;
  }
}

/* Backup: fetch the full DB dump and download it as a JSON file. */
const exporting = ref(false);
const exportError = ref('');

async function downloadBackup() {
  exporting.value = true;
  exportError.value = '';
  const res = await exportBackup({ author: username.value, pin: pin.value });
  exporting.value = false;
  if (!res.ok) {
    exportError.value = res.error;
    return;
  }
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `amalgramme-backup-${today}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="admin">
    <header class="top">
      <button class="icon-btn" type="button" @click="router.push('/')" aria-label="menu">←</button>
      <h1 class="title">Admin</h1>
      <div class="spacer" />
    </header>

    <div class="toolbar">
      <button class="tool primary" type="button" @click="router.push('/admin/new')">
        + Nouveau défi
      </button>
      <button class="tool" type="button" :disabled="exporting" @click="downloadBackup">
        {{ exporting ? '…' : 'Télécharger la sauvegarde' }}
      </button>
    </div>
    <p v-if="exportError" class="err toolbar-err">{{ exportError }}</p>

    <ul class="list">
      <li v-for="c in items" :key="c.date" class="item">
        <component
          :is="c.editable ? 'button' : 'div'"
          class="row"
          :class="{ past: !c.editable }"
          :type="c.editable ? 'button' : undefined"
          :aria-label="c.editable ? 'modifier' : undefined"
          @click="c.editable && router.push(`/admin/edit/${c.date}`)"
        >
          <span class="date">{{ c.label }}</span>
          <span class="secret">{{ c.secret }}</span>
          <span class="stats">
            <span class="stat" :aria-label="`${c.attempts} joueurs`">▶ {{ c.attempts }}</span>
            <span class="stat" :aria-label="`${c.successes} réussites`">✓ {{ c.successes }}</span>
          </span>
        </component>
        <button
          v-if="c.editable"
          class="act danger"
          type="button"
          aria-label="supprimer"
          @click="pending = c.date"
        >
          ✕
        </button>
      </li>
      <li v-if="!items.length" class="empty">Aucun défi.</li>
    </ul>

    <!-- Delete confirmation -->
    <div v-if="pending" class="overlay" @click.self="!deleting && (pending = null)">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Supprimer le défi">
        <h2 class="modal-title">Supprimer le défi du {{ formatChallengeDate(pending) }} ?</h2>
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
.admin {
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
}
.icon-btn:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
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

.toolbar {
  display: flex;
  gap: 0.6rem;
  padding: 0.2rem 1rem 0.6rem;
}
.tool {
  flex: 1;
  padding: 0.7rem 0.9rem;
  border-radius: 0.9rem;
  font-family: inherit;
  font-weight: 800;
  font-size: 0.9rem;
  cursor: pointer;
  color: var(--ink);
  background: var(--panel);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.tool.primary {
  background: var(--accent);
  color: #fff;
}
.tool:disabled {
  opacity: 0.5;
  cursor: default;
}
.tool:not(:disabled):active {
  transform: translate(2px, 3px);
  box-shadow: 0 0 0 var(--outline);
}
.toolbar-err {
  margin: -0.2rem 1rem 0.4rem;
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
  padding: 0.4rem 1rem calc(2rem + env(safe-area-inset-bottom));
}
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
  gap: 0.7rem;
  padding: 0.9rem 1.1rem;
  border-radius: 1rem;
  font-weight: 900;
  text-align: left;
  color: var(--ink);
  background: var(--accent-wash);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop);
}
/* Today/future rows navigate to the editor. */
.row {
  cursor: pointer;
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.row:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
/* Past rows read quieter and are locked (not interactive). */
.row.past {
  background: var(--panel);
  opacity: 0.85;
  cursor: default;
}
.row.past:active {
  transform: none;
  box-shadow: var(--pop);
}
.date {
  font-size: 0.92rem;
  text-transform: capitalize;
  flex: none;
}
.secret {
  flex: 1;
  text-transform: uppercase;
  color: var(--accent);
  letter-spacing: 0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stats {
  flex: none;
  display: flex;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--muted);
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
  background: var(--accent);
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
