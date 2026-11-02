<script setup>
/*
 * The admin's level editor: a bank level, or an official one, to save as a draft
 * or validate on a day. Each word can be made a riddle, with its clue, or a
 * bonus word, given another master spelling, its spellings banned from the
 * level, and its bases their Wiktionnaire definition (saved at once, for every
 * level). Validating takes CLUES_MIN to CLUES_MAX riddles, each clued.
 */
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import '../theme.js';
import ConfirmModal from '../../components/ui/ConfirmModal.vue';
import { getToday } from '../../utils/today.js';
import { addDays } from '../../utils/date.js';
import { bank } from '../levels.js';
import { official, officialLevel, saveLevel, removeLevel } from '../store.js';
import { buildLevel, REASONS, CLUES_MIN, CLUES_MAX } from '../game.js';
import {
  draftFrom,
  setRiddle,
  setClue,
  validOf,
  setMaster,
  ban,
  unban,
  bannedOf,
} from '../editor.js';
import { dayColor, longDayLabel } from '../days.js';
import DicoSenses from '../components/DicoSenses.vue';

const route = useRoute();
const router = useRouter();
const pattern = route.params.pattern;

const stored = officialLevel(pattern);
const fromBank = bank().find((l) => l.pattern === pattern);
// A plain copy: the stored level is reactive, which structuredClone refuses.
const draft = ref(draftFrom(stored ? JSON.parse(JSON.stringify(stored)) : fromBank));
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
/* The riddles, alphabetical as players see them, then the bonus words,
 * commonest first; each word with its spellings' bases. */
const sections = computed(() => {
  const { answers, riddles } = level.value;
  const withBases = (a) => ({ ...a, bases: [...new Set(a.spellings.map((sp) => sp.base))] });
  const others = [...answers.values()].filter((a) => a.clue == null);
  return [
    {
      title: 'Énigmes',
      range: `${CLUES_MIN} à ${CLUES_MAX}`,
      words: riddles.map((k) => withBases(answers.get(k))),
    },
    { title: 'Bonus', words: others.sort((a, b) => b.freq - a.freq).map(withBases) },
  ];
});
const riddleCount = computed(() => level.value.riddles.length);

const KINDS = [
  [true, 'Énigme'],
  [false, 'Bonus'],
];
const move = (key, riddle) => (draft.value = setRiddle(draft.value, key, riddle));
const clue = (key, text) => (draft.value = setClue(draft.value, key, text));
const master = (key, form) => (draft.value = setMaster(draft.value, key, form));
const REASON_LABELS = { conj: 'conjugaison', invalid: 'mot invalide', offensive: 'mot offensant' };
// The spelling whose ✕ was tapped, its reason to pick.
const banning = ref(null);
function banOne(form, reason) {
  draft.value = ban(draft.value, form, reason);
  banning.value = null;
}
const unbanOne = (form) => (draft.value = unban(draft.value, form));
const banned = computed(() => bannedOf(draft.value));
/* The banned spellings by reason; the generator's verb forms with the
 * conjugations, typed as they are (no accents). */
const bannedBy = computed(() =>
  Object.keys(REASONS).map((reason) => ({
    reason,
    spellings: banned.value.filter((sp) => sp.reason === reason),
    found: reason === 'conj' ? draft.value.conjugated.map((k) => k.toLowerCase()) : [],
  })),
);
const bannedCount = computed(() => banned.value.length + draft.value.conjugated.length);
const valid = computed(() => validOf(draft.value));

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
          {{ s.title }}
          <span class="count">
            {{ s.words.length }}<template v-if="s.range"> ({{ s.range }})</template>
          </span>
        </h2>
        <p v-if="!s.words.length" class="none">Aucun.</p>
        <article
          v-for="w in s.words"
          :key="w.key"
          class="entry"
          :class="{ riddle: w.clue != null }"
        >
          <header class="entry-top">
            <span class="note" title="note de rareté de sa base">{{ w.points }}</span>
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
                  <span v-if="sp.label || sp.base !== sp.form" class="label">
                    {{ sp.label }}<template v-if="sp.base !== sp.form"> de {{ sp.base }}</template>
                  </span>
                </button>
                <button
                  class="ban"
                  type="button"
                  :aria-label="`bannir ${sp.form}`"
                  title="bannir du niveau"
                  :aria-expanded="banning === sp.form"
                  @click="banning = banning === sp.form ? null : sp.form"
                >
                  ✕
                </button>
                <span v-if="banning === sp.form" class="reasons" role="group" aria-label="raison">
                  <button
                    v-for="(_, reason) in REASONS"
                    :key="reason"
                    class="reason"
                    type="button"
                    @click="banOne(sp.form, reason)"
                  >
                    {{ REASON_LABELS[reason] }}
                  </button>
                </span>
              </span>
            </div>
            <div class="kinds" role="group" aria-label="sorte de mot">
              <button
                v-for="[riddle, label] in KINDS"
                :key="label"
                class="kind"
                :class="{ on: (w.clue != null) === riddle }"
                type="button"
                :aria-pressed="(w.clue != null) === riddle"
                @click="move(w.key, riddle)"
              >
                {{ label }}
              </button>
            </div>
          </header>
          <input
            v-if="w.clue != null"
            class="clue"
            :class="{ empty: !w.clue.trim() }"
            type="text"
            maxlength="80"
            placeholder="Indice"
            :aria-label="`indice de ${w.display}`"
            :value="w.clue"
            @input="clue(w.key, $event.target.value)"
          />
          <DicoSenses v-for="b in w.bases" :key="b" class="definition" :word="b" />
        </article>
      </section>
      <section class="section">
        <h2 class="heading">
          Bannis <span class="count">{{ bannedCount }}</span>
        </h2>
        <p v-if="!bannedCount" class="none">Aucun : ✕ sur un mot l'écarte du niveau.</p>
        <template v-for="g in bannedBy" :key="g.reason">
          <div v-if="g.spellings.length || g.found.length" class="banned-group">
            <h3 class="subheading">{{ REASON_LABELS[g.reason] }}</h3>
            <div v-if="g.spellings.length" class="spellings">
              <button
                v-for="sp in g.spellings"
                :key="sp.form"
                class="spelling form banned"
                type="button"
                title="rétablir"
                @click="unbanOne(sp.form)"
              >
                <s>{{ sp.form }}</s> <span class="label">rétablir</span>
              </button>
            </div>
            <p v-if="g.found.length" class="found">
              <span class="label">trouvées par le générateur :</span> {{ g.found.join(', ') }}
            </p>
          </div>
        </template>
      </section>
    </div>

    <footer class="foot">
      <p v-if="!valid" class="message bad">
        Pour valider : de {{ CLUES_MIN }} à {{ CLUES_MAX }} énigmes, chacune avec son indice ({{
          riddleCount
        }}
        pour l'instant).
      </p>
      <p v-else-if="message" class="message" :class="message.tone">{{ message.text }}</p>
      <div class="actions">
        <template v-if="status === 'valid'">
          <button class="cta ghost press" type="button" @click="save('draft')">
            Repasser en brouillon
          </button>
          <button
            class="cta validate press"
            type="button"
            :disabled="!dirty || !valid"
            @click="save('valid')"
          >
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
          <button
            class="cta validate press"
            type="button"
            :disabled="!valid"
            @click="save('valid')"
          >
            Valider
          </button>
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
/* A word: its rarity note, its spellings, its kind, its clue when it's a
   riddle, and its bases' definitions. */
.entry {
  padding: 0.6rem 0.7rem;
  border: 1.5px solid var(--line);
  border-radius: 0.8rem;
  background: var(--panel);
}
.entry + .entry {
  margin-top: 0.5rem;
}
.entry.riddle {
  border-color: var(--day);
}
.entry-top {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.entry-top .spellings {
  flex: 1;
  min-width: 0;
}
.note {
  flex: none;
  min-width: 1.9rem;
  padding: 0.1rem 0.3rem;
  border-radius: 999px;
  text-align: center;
  font-family: var(--dc-mono);
  font-size: 0.75rem;
  font-weight: 900;
  color: var(--muted);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.clue {
  width: 100%;
  box-sizing: border-box;
  margin-top: 0.5rem;
  padding: 0.45rem 0.6rem;
  border: 1.5px solid var(--line);
  border-radius: 0.5rem;
  background: var(--dc-cream);
  font: inherit;
  font-style: italic;
  font-size: 0.95rem;
  color: var(--ink);
}
/* A riddle still to clue blocks validating. */
.clue.empty {
  border-color: var(--danger);
}
.definition {
  margin-top: 0.4rem;
}
/* The word's kind: a riddle, or a bonus word. */
.kinds {
  flex: none;
  display: flex;
  border: 1.5px solid var(--line);
  border-radius: 999px;
  overflow: hidden;
}
.kind {
  padding: 0.25rem 0.55rem;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.kind + .kind {
  border-left: 1.5px solid var(--line);
}
.kind.on {
  color: var(--on-color);
  background: var(--ink);
}
.riddle .kind.on {
  background: var(--day);
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
/* A ✕ tapped: the reasons to ban for, one tap bans. */
.reasons {
  display: inline-flex;
  gap: 0.2rem;
  padding: 0 0.3rem 0 0;
}
.reason {
  padding: 0.15rem 0.45rem;
  font: inherit;
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--danger);
  background: none;
  border: 1.5px solid var(--danger);
  border-radius: 999px;
  cursor: pointer;
}
.banned-group + .banned-group {
  margin-top: 0.7rem;
}
.subheading {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  font-weight: 900;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.found {
  margin: 0.4rem 0 0;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--muted);
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
.cta.validate {
  color: #fff;
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
