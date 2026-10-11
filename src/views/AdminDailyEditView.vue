<script setup>
/*
 * Admin editor for one daily: create (/admin/new) or edit (/admin/edit/:date).
 * Only today and future dailies are editable (the Worker is authoritative).
 */
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getToday } from '../utils/today.js';
import { addDays } from '../utils/date.js';
import { formatChallengeDate } from '../utils/format.js';
import { getDailies, dailyRecord } from '../data/dailies.js';
import { saveDaily } from '../services/levels.js';
import { username, pin } from '../composables/useUsername.js';
import { useRequest } from '../composables/useRequest.js';
import PageHeader from '../components/ui/PageHeader.vue';
import ChallengeForm from '../components/ChallengeForm.vue';

const route = useRoute();
const router = useRouter();
const today = getToday();

const editDate = route.params.date ?? null;
const record = editDate && editDate >= today ? dailyRecord(editDate) : null;
if (editDate && !record) router.replace('/admin');

/* New: the day after the last scheduled daily (or today), skipping taken dates. */
function firstFreeDate() {
  const taken = new Set(getDailies().map((d) => d.date));
  const last = [...taken].pop();
  let date = last && addDays(last, 1) > today ? addDays(last, 1) : today;
  while (taken.has(date)) date = addDays(date, 1);
  return date;
}

const date = ref(editDate ?? firstFreeDate());

const dateHint = computed(() => {
  if (editDate) return '';
  if (!date.value) return 'Choisis une date.';
  if (date.value < today) return 'Seuls aujourd’hui et les jours suivants sont modifiables.';
  if (dailyRecord(date.value)) return 'Un défi existe déjà pour cette date.';
  return '';
});

const { busy, error, run } = useRequest(saveDaily);
async function submit(normalized) {
  const payload = { ...normalized, pin: pin.value, date: editDate ? undefined : date.value };
  if ((await run(payload, editDate)).ok) router.push('/admin');
}
</script>

<template>
  <div class="page fit">
    <PageHeader
      :title="editDate ? 'Modifier le défi' : 'Nouveau défi'"
      back="/admin"
      back-label="admin"
    />

    <ChallengeForm
      :author="username"
      :initial-words="record?.words"
      :initial-secret="record?.secret"
      :is-edit="!!editDate"
      :submitting="busy"
      :error="error"
      :recap-byline="formatChallengeDate(date)"
      :extra-valid="!dateHint"
      @submit="submit"
    >
      <template #fields-top>
        <section class="section">
          <h2 class="section-title">Date</h2>
          <label class="field">
            <input v-if="!editDate" v-model="date" class="input date" type="date" :min="today" />
            <span v-else class="input date fixed">{{ formatChallengeDate(date) }}</span>
            <span v-if="dateHint" class="hint">{{ dateHint }}</span>
          </label>
        </section>
      </template>
    </ChallengeForm>
  </div>
</template>

<style scoped>
.input.date {
  font-size: 1.1rem;
  color: var(--ink);
  text-transform: none;
}
.input.fixed {
  text-transform: capitalize;
}
</style>
