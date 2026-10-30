/*
 * Dicorama's official levels and the definitions the admin picked, from the Worker
 * (GET /dicorama) and kept on the device, so the game opens offline. Only the
 * admin writes them.
 *
 * `levels`: `{ pattern, status: 'draft' | 'valid', date, words, rare, banned, reasons,
 * conjugated }` (see buildLevel in game.js). Players get the validated ones up
 * to today, one a day; the admin gets them all. `definitions`: base → `{ index,
 * text }`, the Wiktionnaire sense picked for that word, in every level.
 */
import { reactive } from 'vue';
import { API_URL, CACHE_MS } from '../config.js';
import { request, mutate } from '../services/api.js';
import { isAdmin } from '../composables/useAccount.js';
import { readJSON, writeJSON, isObject } from '../utils/storage.js';
import { getToday } from '../utils/today.js';

const KEY = 'dicorama:v1:official';

const saved = readJSON(KEY, {}, isObject);
export const official = reactive({
  levels: Array.isArray(saved.levels) ? saved.levels : [],
  definitions: isObject(saved.definitions) ? saved.definitions : {},
});
// When it was last fetched, and whether as the admin (who gets the drafts too).
let fetched = { at: saved.fetchedAt ?? 0, admin: saved.admin === true };

function keep() {
  writeJSON(KEY, { ...official, fetchedAt: fetched.at, admin: fetched.admin });
}

/* Refreshes when older than `maxAgeMs` (0 forces it). Never rejects: offline, the
 * device's copy stays. */
export async function loadOfficial(maxAgeMs = CACHE_MS) {
  if (!API_URL) return;
  const fresh = Date.now() - fetched.at < maxAgeMs && fetched.admin === isAdmin.value;
  if (maxAgeMs > 0 && fresh) return;
  try {
    const res = await request('/dicorama', { timeout: 5000 });
    if (!res.ok) return;
    const data = await res.json();
    official.levels = Array.isArray(data.levels) ? data.levels : [];
    official.definitions = isObject(data.definitions) ? data.definitions : {};
    fetched = { at: Date.now(), admin: isAdmin.value };
    keep();
  } catch {
    // Offline: keep the device's copy.
  }
}

export const officialLevel = (pattern) => official.levels.find((l) => l.pattern === pattern);

const isPlayed = (l) => l.status === 'valid' && !!l.date && l.date <= getToday();

/* The levels players have had, oldest first. */
export const playedLevels = () =>
  official.levels.filter(isPlayed).sort((a, b) => a.date.localeCompare(b.date));

/* The level of the day `date`: a played one, or any dated one for the admin. */
export const levelOn = (date) =>
  official.levels.find((l) => l.date === date && (isPlayed(l) || isAdmin.value)) ?? null;

/* The admin's levels still to come: dated after today or drafts, dated first. */
export const upcomingLevels = () =>
  official.levels
    .filter((l) => !isPlayed(l))
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));

const MESSAGES = {
  forbidden: 'Réservé au compte admin.',
  date_taken: 'Un autre niveau a déjà ce jour.',
  bad_date: 'Choisis un jour pour valider le niveau.',
  invalid: 'Niveau invalide.',
};

/* Saves a level as `status`, played on `date` (required to validate). */
export async function saveLevel(draft, status, date) {
  const { pattern, words, rare, banned, reasons, conjugated } = draft;
  // A plain copy, not the editor's reactive draft.
  const body = JSON.parse(
    JSON.stringify({ status, date: date || null, words, rare, banned, reasons, conjugated }),
  );
  const res = await mutate(`/dicorama/levels/${pattern}`, {
    method: 'PUT',
    body,
    messages: MESSAGES,
    fallback: "Impossible d'enregistrer le niveau.",
  });
  if (res.ok) {
    official.levels = [...official.levels.filter((l) => l.pattern !== pattern), res.data];
    keep();
  }
  return res;
}

export async function removeLevel(pattern) {
  const res = await mutate(`/dicorama/levels/${pattern}`, {
    method: 'DELETE',
    body: {},
    messages: MESSAGES,
    fallback: 'Impossible de retirer le niveau.',
  });
  if (res.ok) {
    official.levels = official.levels.filter((l) => l.pattern !== pattern);
    keep();
  }
  return res;
}

/* `choice`: `{ index, text }`, or null for the word's default sense. */
export async function setDefinition(base, choice) {
  const res = await mutate(`/dicorama/definitions/${encodeURIComponent(base)}`, {
    method: choice ? 'PUT' : 'DELETE',
    body: choice ?? {},
    messages: MESSAGES,
    fallback: "Impossible d'enregistrer la définition.",
  });
  if (res.ok) {
    const rest = Object.entries(official.definitions).filter(([b]) => b !== base);
    official.definitions = Object.fromEntries(choice ? [...rest, [base, choice]] : rest);
    keep();
  }
  return res;
}
