<script setup>
/*
 * Admin dashboard: the daily bank, newest first, with play stats. Today/future
 * dailies open the editor and can be deleted; past ones are locked (the Worker
 * enforces it too). Also downloads a full-DB backup.
 */
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { getToday } from '../utils/today.js';
import { formatChallengeDate } from '../utils/format.js';
import { getDailies } from '../data/dailies.js';
import { loadDailies, deleteDaily, exportBackup } from '../services/levels.js';
import { useCachedList } from '../composables/useCachedList.js';
import { useRequest } from '../composables/useRequest.js';
import PageHeader from '../components/ui/PageHeader.vue';
import ConfirmModal from '../components/ui/ConfirmModal.vue';

const router = useRouter();
const today = getToday();

const { items, rebuild } = useCachedList(
  () =>
    getDailies()
      .reverse()
      .map((d) => ({ ...d, editable: d.date >= today })),
  loadDailies,
);

const pending = ref(null); // date awaiting delete confirmation
const { busy: deleting, error: deleteError, run: remove } = useRequest(deleteDaily);
async function confirmDelete() {
  if ((await remove(pending.value)).ok) {
    pending.value = null;
    rebuild();
  }
}

const { busy: exporting, error: exportError, run: runExport } = useRequest(exportBackup);
async function downloadBackup() {
  const res = await runExport();
  if (!res.ok) return;
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `amalgramme-backup-${today}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
</script>

<template>
  <div class="page">
    <PageHeader title="Admin" back="/" back-label="menu" />

    <div class="toolbar">
      <button class="tool primary press sm" type="button" @click="router.push('/admin/new')">
        + Nouveau défi
      </button>
      <button class="tool press sm" type="button" :disabled="exporting" @click="downloadBackup">
        {{ exporting ? '…' : 'Télécharger la sauvegarde' }}
      </button>
    </div>
    <p v-if="exportError" class="err toolbar-err">{{ exportError }}</p>

    <ul class="list">
      <li v-for="c in items" :key="c.date" class="item">
        <button
          class="row press"
          :class="{ past: !c.editable }"
          type="button"
          :disabled="!c.editable"
          :aria-label="c.editable ? 'modifier' : undefined"
          @click="router.push(`/admin/edit/${c.date}`)"
        >
          <span class="date">{{ formatChallengeDate(c.date) }}</span>
          <span class="secret">{{ c.secret }}</span>
          <span class="stats">
            <span :aria-label="`${c.attempts ?? 0} joueurs`">▶ {{ c.attempts ?? 0 }}</span>
            <span :aria-label="`${c.successes ?? 0} réussites`">✓ {{ c.successes ?? 0 }}</span>
          </span>
        </button>
        <button
          v-if="c.editable"
          class="act press sm"
          type="button"
          aria-label="supprimer"
          @click="pending = c.date"
        >
          ✕
        </button>
      </li>
      <li v-if="!items.length" class="empty">Aucun défi.</li>
    </ul>

    <ConfirmModal
      v-if="pending"
      :title="`Supprimer le défi du ${formatChallengeDate(pending)} ?`"
      :busy="deleting"
      :error="deleteError"
      @cancel="pending = null"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 0.6rem;
  padding: 0.2rem 1rem 0.6rem;
}
.tool {
  flex: 1;
  padding: 0.7rem 0.9rem;
  border-radius: 0.9rem;
  font-weight: 800;
  font-size: 0.9rem;
  color: var(--ink);
  background: var(--panel);
}
.tool.primary {
  background: var(--accent);
  color: var(--on-color);
}
.toolbar-err {
  margin: -0.2rem 1rem 0.4rem;
}
.list {
  --tint: var(--accent);
  padding-top: 0.4rem;
}
.row {
  padding: 0.9rem 1.1rem;
  font-size: 1rem;
}
/* Past dailies read quieter and are locked. */
.row.past {
  opacity: 0.85;
  background: var(--panel);
  box-shadow: var(--lift);
}
.date {
  flex: none;
  font-size: 0.92rem;
  text-transform: capitalize;
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
</style>
