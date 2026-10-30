<script setup>
/*
 * The admin's level editor: a bank level, or an official one, to save as a draft
 * or validate on a day. Each family can be made rare or normal, each word given
 * another master spelling (it then follows that spelling's base), each spelling
 * banned from the level, and each base its Wiktionnaire definition (saved at
 * once, for every level).
 */
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import '../theme.js';
import ConfirmModal from '../../components/ui/ConfirmModal.vue';
import { getToday } from '../../utils/today.js';
import { addDays } from '../../utils/date.js';
import { bank } from '../levels.js';
import { official, officialLevel, saveLevel, removeLevel } from '../store.js';
import { buildLevel } from '../game.js';
import { draftFrom, toggleRare, setMaster, ban, unban, bannedOf } from '../editor.js';
import { dayColor, longDayLabel } from '../days.js';
import DicoSenses from '../components/DicoSenses.vue';

const route = useRoute();
const router = useRouter();
const pattern = route.params.pattern;

const stored = officialLevel(pattern);
// A plain copy: the stored level is reactive, which structuredClone refuses.
const draft = ref(
  stored
    ? (({ pattern, words, rare, banned = [] }) => ({ pattern, words, rare, banned }))(
        JSON.parse(JSON.stringify(stored)),
      )
    : draftFrom(bank().find((l) => l.pattern === pattern)),
);
const status = ref(stored?.status ?? null);

/* The first day from today no other level holds. */
function freeDay() {
  const taken = new Set(official.levels.map((l) => l.date));
  let day = getToday();
  while (taken.has(day)) day = addDays(day, 1);
  return day;
}
const date = ref(stored?.date ?? '');
const snapshot = () => JSON.stringify([draft.value, date.value]);
// What's saved, or the bank's level until it is.
const savedAs = ref(snapshot());
const dirty = computed(() => snapshot() !== savedAs.value);
const message = ref(null);

const level = computed(() => buildLevel(draft.value));
/* The families, normal then rare, each alphabetical by its first word, with its
 * words' spellings and the other bases they're homonyms of. */
const sections = computed(() => {
  const { answers, families } = level.value;
  const first = (f) => answers.get(f.keys[0]).display;
  const sorted = [...families].sort((a, b) => first(a).localeCompare(first(b), 'fr'));
  const withWords = (f) => ({
    ...f,
    words: f.keys.map((k) => {
      const a = answers.get(k);
      const others = new Set(a.spellings.map((sp) => sp.base).filter((b) => b !== f.base));
      return { ...a, others: [...others] };
    }),
  });
  return [
    { title: 'Réponses', families: sorted.filter((f) => !f.rare).map(withWords) },
    { title: 'Rares', families: sorted.filter((f) => f.rare).map(withWords) },
  ];
});

const rare = (base) => (draft.value = toggleRare(draft.value, base));
const master = (key, form) => (draft.value = setMaster(draft.value, key, form));
const banOne = (key, form) => (draft.value = ban(draft.value, key, form));
const unbanOne = (form) => (draft.value = unban(draft.value, form));
const banned = computed(() => bannedOf(draft.value));

async function save(as) {
  if (as === 'valid' && !date.value) date.value = freeDay();
  const res = await saveLevel(draft.value, as, date.value);
  if (!res.ok) return (message.value = { text: res.error, tone: 'bad' });
  status.value = as;
  savedAs.value = snapshot();
  message.value = {
    text: as === 'valid' ? `Validé pour le ${longDayLabel(date.value)}` : 'Brouillon enregistré',
  };
}

const confirming = ref(false);
async function remove() {
  confirming.value = false;
  const res = await removeLevel(pattern);
  if (!res.ok) return (message.value = { text: res.error, tone: 'bad' });
  router.push('/dicorama');
}

const back = stored ? '/dicorama' : '/dicorama/banque';
const play = () => router.push(`/dicorama/motif/${pattern}`);
</script>

<template>
  <div class="dico admin" :style="{ '--day': dayColor(date || getToday()) }">
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
      <h1 class="title">{{ pattern.replaceAll('_', '·') }}</h1>
      <button class="dc-button quiet small" type="button" @click="play">Jouer</button>
    </header>
    <p class="state">
      {{ status === 'valid' ? 'Validé' : status === 'draft' ? 'Brouillon' : 'Banque' }}
      <span v-if="dirty"> · modifié</span>
    </p>
    <label class="when">
      <span>Jour</span>
      <input v-model="date" type="date" />
      <button v-if="!date" class="link" type="button" @click="date = freeDay()">
        prochain jour libre
      </button>
      <button v-else class="link" type="button" @click="date = ''">sans date</button>
    </label>

    <div class="sections">
      <section v-for="s in sections" :key="s.title" class="section">
        <h2 class="heading">
          {{ s.title }} <span class="count">{{ s.families.length }}</span>
        </h2>
        <p v-if="!s.families.length" class="none">Aucune.</p>
        <article v-for="f in s.families" :key="f.base" class="family" :class="{ rare: f.rare }">
          <header class="family-top">
            <span class="note" title="note de rareté">{{ f.points }}</span>
            <DicoSenses class="family-def" :word="f.base" />
            <button class="pill swap" type="button" @click="rare(f.base)">
              {{ f.rare ? '→ réponse' : '→ rare' }}
            </button>
          </header>
          <ul class="words">
            <li v-for="w in f.words" :key="w.key" class="word">
              <div class="spellings">
                <span
                  v-for="(sp, i) in w.spellings"
                  :key="sp.form"
                  class="spelling"
                  :class="{ master: i === 0 }"
                >
                  <button
                    class="form"
                    type="button"
                    :disabled="i === 0"
                    :title="i === 0 ? 'maître mot' : 'en faire le maître mot'"
                    @click="master(w.key, sp.form)"
                  >
                    {{ sp.form }}
                    <span v-if="sp.label || sp.base !== f.base" class="label">
                      {{ sp.label }}<template v-if="sp.base !== f.base"> de {{ sp.base }}</template>
                    </span>
                  </button>
                  <button
                    class="ban"
                    type="button"
                    :aria-label="`bannir ${sp.form}`"
                    title="bannir du niveau"
                    @click="banOne(w.key, sp.form)"
                  >
                    ✕
                  </button>
                </span>
              </div>
              <DicoSenses v-for="b in w.others" :key="b" class="other-def" :word="b" />
            </li>
          </ul>
        </article>
      </section>
      <section class="section">
        <h2 class="heading">
          Bannis <span class="count">{{ banned.length }}</span>
        </h2>
        <p v-if="!banned.length" class="none">Aucun : ✕ sur un mot l'écarte du niveau.</p>
        <div v-else class="spellings">
          <button
            v-for="sp in banned"
            :key="sp.form"
            class="spelling form banned"
            type="button"
            title="rétablir"
            @click="unbanOne(sp.form)"
          >
            <s>{{ sp.form }}</s> <span class="label">rétablir</span>
          </button>
        </div>
      </section>
    </div>

    <footer class="foot">
      <p v-if="message" class="message" :class="message.tone">{{ message.text }}</p>
      <div class="actions">
        <template v-if="status === 'valid'">
          <button class="cta ghost press" type="button" @click="save('draft')">
            Repasser en brouillon
          </button>
          <button class="cta press" type="button" :disabled="!dirty" @click="save('valid')">
            Enregistrer
          </button>
        </template>
        <template v-else>
          <button
            class="cta ghost press"
            type="button"
            :disabled="status && !dirty"
            @click="save('draft')"
          >
            Enregistrer le brouillon
          </button>
          <button class="cta press" type="button" @click="save('valid')">Valider</button>
        </template>
      </div>
      <button v-if="status" class="remove" type="button" @click="confirming = true">
        Retirer des niveaux
      </button>
    </footer>

    <ConfirmModal
      v-if="confirming"
      title="Retirer ce niveau ? Il reste dans la banque."
      confirm-label="Retirer"
      @cancel="confirming = false"
      @confirm="remove"
    />
  </div>
</template>

<style scoped>
/* Dicorama's colours on the shared admin bits (pills, buttons, modals). */
.admin {
  --ink: var(--dc-ink);
  --muted: var(--dc-muted);
  --panel: var(--dc-board);
  --line: var(--dc-board-edge);
  --rare: #b07d00;
  --on-color: var(--dc-cream);
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: 100dvh;
}
.bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: max(10px, env(safe-area-inset-top)) 12px 4px 10px;
}
.title {
  flex: 1;
  margin: 0;
  font-family: var(--dc-mono);
  font-size: 22px;
  letter-spacing: 0.18em;
  color: var(--day);
}
.small {
  min-height: 34px;
  padding: 0 12px;
  font-size: 13px;
}
.when {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 1rem 0.6rem;
  font-size: 14px;
  font-weight: 600;
  color: var(--dc-muted);
}
.when input {
  padding: 6px 8px;
  border: 1.5px solid var(--dc-board-edge);
  border-radius: 8px;
  background: var(--dc-board);
  font: inherit;
  color: var(--dc-ink);
}
.link {
  padding: 0;
  border: 0;
  background: none;
  font-size: 13px;
  text-decoration: underline;
  color: var(--dc-muted);
  cursor: pointer;
}
.family-top .note {
  font-family: var(--dc-mono);
}
.foot {
  padding: 0.6rem 1rem max(1rem, env(safe-area-inset-bottom));
  border-top: 1.5px solid var(--dc-board-edge);
}
.state {
  margin: 0;
  padding: 0 1rem 0.4rem;
  text-align: center;
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--muted);
}
.sections {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.2rem 1rem 1rem;
}
.section + .section {
  margin-top: 1.2rem;
}
.heading {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 900;
  color: var(--ink);
}
.count {
  font-size: 0.8rem;
  color: var(--muted);
}
.none {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--muted);
}
/* A family: its rarity note, its base's definition, and its words. */
.family {
  padding: 0.6rem 0.7rem;
  border: 1.5px solid var(--line);
  border-radius: 0.8rem;
  background: var(--panel);
}
.family + .family {
  margin-top: 0.5rem;
}
.family.rare {
  border-color: var(--rare);
}
.family-top {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.note {
  flex: none;
  min-width: 1.9rem;
  padding: 0.1rem 0.3rem;
  border-radius: 999px;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 900;
  color: var(--muted);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.rare .note {
  color: var(--on-color);
  background: var(--rare);
}
.family-def {
  flex: 1;
  min-width: 0;
}
.pill.swap {
  flex: none;
  min-width: 0;
  height: 1.9rem;
  padding: 0 0.6rem;
  font-size: 0.75rem;
}
.words {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.spellings {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
/* A word's spellings, its master first: tapping another makes it the master, its
   ✕ bans it. */
.spelling {
  display: inline-flex;
  align-items: center;
  border: 1.5px dashed var(--line);
  border-radius: 999px;
}
.spelling.master {
  border-style: solid;
  border-color: var(--ink);
}
.form {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35em;
  padding: 0.2rem 0.2rem 0.2rem 0.55rem;
  font: inherit;
  font-weight: 800;
  font-size: 0.9rem;
  color: var(--ink);
  background: none;
  border: none;
  cursor: pointer;
}
.form:disabled {
  cursor: default;
}
.ban {
  padding: 0.2rem 0.5rem 0.2rem 0.3rem;
  font: inherit;
  font-size: 0.7rem;
  font-weight: 900;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.ban:hover {
  color: var(--danger);
}
/* A banned spelling: struck out, tapping it brings it back. */
.form.banned {
  padding-right: 0.55rem;
  color: var(--muted);
  border: 1.5px dashed var(--line);
  border-radius: 999px;
}
.label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--muted);
}
.other-def {
  margin: 0.25rem 0 0 0.6rem;
}

.foot {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.actions {
  display: flex;
  gap: 0.6rem;
}
.actions .cta {
  flex: 1;
  padding-inline: 0.8rem;
}
.message {
  margin: 0;
  text-align: center;
  font-weight: 800;
  font-size: 0.85rem;
  color: var(--ink);
}
.message.bad {
  color: var(--danger);
}
.remove {
  align-self: center;
  padding: 0.1rem 0.5rem;
  font: inherit;
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--danger);
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
}
</style>
