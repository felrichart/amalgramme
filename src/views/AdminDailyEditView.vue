<script setup>
/*
 * Admin editor for one daily challenge. Create (/admin/new) or edit
 * (/admin/edit/:date). Wraps ChallengeForm and prepends a date field. Today and
 * future dailies are fully editable; a past daily is locked to its already-played
 * puzzle and only its hint can be added/changed. Enforced here for UX and again
 * by the Worker, which is authoritative.
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getToday } from '../utils/today.js';
import { formatChallengeDate } from '../data/challenges.js';
import { getDailies, dailyRecord } from '../data/dailies.js';
import { createDaily, updateDaily } from '../services/dailies.js';
import { username, pin, isAdmin } from '../composables/useUsername.js';
import ChallengeForm from '../components/ChallengeForm.vue';

const route = useRoute();
const router = useRouter();

const today = getToday();

/* Add `n` calendar days to an ISO date (UTC math keeps it tz-agnostic). */
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const editDate = route.params.date ?? null;
const isEdit = !!editDate;
/* A past daily is locked to its played puzzle — only its hint is editable. */
const lockPuzzle = computed(() => isEdit && editDate < today);

const initialWords = reactive(['', '', '', '']);
const initialSecret = ref('');
const initialHint = ref('');

/* New: default to the day after the last scheduled daily (or today), skipping
 * any date already taken. Edit: the date is fixed. */
function firstFreeDate() {
  const list = getDailies();
  const last = list.length ? list[list.length - 1].date : null;
  let cand = last && addDays(last, 1) > today ? addDays(last, 1) : today;
  const taken = new Set(list.map((d) => d.date));
  while (taken.has(cand)) cand = addDays(cand, 1);
  return cand;
}

const date = ref(isEdit ? editDate : firstFreeDate());

/* Admin only; edit only an existing daily (past ones open hint-only). */
onMounted(() => {
  if (!isAdmin.value) {
    router.replace('/');
    return;
  }
  if (!isEdit) return;
  const rec = dailyRecord(editDate);
  if (!rec) {
    router.replace('/admin');
    return;
  }
  rec.words.forEach((w, i) => (initialWords[i] = w));
  initialSecret.value = rec.secret;
  initialHint.value = rec.hint ?? '';
});

const taken = computed(() => !isEdit && getDailies().some((d) => d.date === date.value));
/* Edit: the date is fixed (a past daily is allowed, hint-only). New: today or later, free. */
const dateValid = computed(() =>
  isEdit ? true : !!date.value && date.value >= today && !taken.value,
);
const dateHint = computed(() => {
  if (isEdit) return '';
  if (!date.value) return 'Choisis une date.';
  if (date.value < today) return 'Seuls aujourd’hui et les jours suivants sont modifiables.';
  if (taken.value) return 'Un défi existe déjà pour cette date.';
  return '';
});

const submitting = ref(false);
const error = ref('');

async function submit(normalized) {
  submitting.value = true;
  error.value = '';
  const payload = { ...normalized, pin: pin.value };
  const res = isEdit
    ? await updateDaily(editDate, payload)
    : await createDaily({ ...payload, date: date.value });
  submitting.value = false;
  if (res.ok) router.push('/admin');
  else error.value = res.error;
}
</script>

<template>
  <div class="create">
    <header class="top">
      <button class="icon-btn" type="button" @click="router.push('/admin')" aria-label="admin">
        ←
      </button>
      <h1 class="title">{{ isEdit ? 'Modifier le défi' : 'Nouveau défi' }}</h1>
      <div class="spacer" />
    </header>

    <ChallengeForm
      :author="username"
      :initial-words="initialWords"
      :initial-secret="initialSecret"
      :initial-hint="initialHint"
      :is-edit="isEdit"
      :lock-puzzle="lockPuzzle"
      :submitting="submitting"
      :error="error"
      :recap-byline="formatChallengeDate(date)"
      :extra-valid="dateValid"
      @submit="submit"
    >
      <template #fields-top>
        <section class="section date-section">
          <h2 class="section-title">Date</h2>
          <label class="field">
            <input
              v-if="!isEdit"
              v-model="date"
              class="input date-input"
              type="date"
              :min="today"
            />
            <span v-else class="input date-input fixed">{{ formatChallengeDate(date) }}</span>
            <span v-if="dateHint" class="hint">{{ dateHint }}</span>
          </label>
        </section>
      </template>
    </ChallengeForm>
  </div>
</template>

<style scoped>
.create {
  min-height: 100dvh;
  max-height: 100dvh;
  display: flex;
  flex-direction: column;
  max-width: 560px;
  margin: 0 auto;
}
.top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.9rem 1rem 0.3rem;
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

/* Date block matches ChallengeForm's .section styling (scoped there, restated
 * here for this view's slotted content). */
.section {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 0.9rem;
  border-radius: 1rem;
  background: var(--panel);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.section-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.input {
  width: 100%;
  padding: 0.8rem 1rem;
  border-radius: 0.9rem;
  font-family: inherit;
  font-weight: 900;
  font-size: 1.1rem;
  color: var(--ink);
  background: var(--tile);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.date-input.fixed {
  text-transform: capitalize;
}
.hint {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--pink);
  padding-left: 0.2rem;
}
</style>
