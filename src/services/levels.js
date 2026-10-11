/* Backend calls for the daily bank, community levels and accounts. */
import { mutate, refresh } from './api.js';
import { dailyCache, getDailies } from '../data/dailies.js';
import { communityCache, getCache, isCommunityId } from '../data/community.js';

export const loadDailies = (maxAgeMs) => refresh(dailyCache, '/dailies', maxAgeMs);
export const loadCommunityLevels = (maxAgeMs) => refresh(communityCache, '/levels', maxAgeMs);

/* Refresh whichever bank holds `date`. */
export const loadLevelsFor = (date, maxAgeMs) =>
  isCommunityId(date) ? loadCommunityLevels(maxAgeMs) : loadDailies(maxAgeMs);

/* Sign in ('connexion') or claim a name ('inscription'). */
export function authenticate({ author, pin, mode }) {
  return mutate('/auth', {
    body: { author, pin, mode },
    messages: {
      name_taken: 'Ce nom est déjà pris.',
      unknown: 'Ce nom n’existe pas. Inscris-toi d’abord.',
      wrong_pin: 'Code incorrect.',
      rate_limited: 'Trop de tentatives, réessaie dans un instant.',
    },
    fallback: 'Connexion refusée.',
  });
}

/* --- Community levels (create-only; owner or admin may delete) --- */

const COMMUNITY_MESSAGES = {
  rate_limited: 'Trop de créations, réessaie dans un instant.',
  name_taken: 'Ce nom est déjà pris (code incorrect).',
  forbidden: 'Code incorrect : ce défi ne t’appartient pas.',
};

/* `payload` is { author, pin, secret, words }. */
export async function createCommunityLevel(payload) {
  const res = await mutate('/levels', {
    body: payload,
    messages: COMMUNITY_MESSAGES,
    fallback: 'Création refusée, vérifie ton défi.',
  });
  if (res.ok) communityCache.set([res.data, ...getCache().filter((l) => l.id !== res.data.id)]);
  return res;
}

export async function deleteCommunityLevel(id, auth) {
  const res = await mutate(`/levels/${id}`, {
    method: 'DELETE',
    body: auth,
    messages: COMMUNITY_MESSAGES,
    fallback: 'Suppression refusée.',
  });
  if (res.ok) communityCache.set(getCache().filter((l) => l.id !== id));
  return res;
}

/* --- Dailies (admin only, today and later) --- */

const ADMIN_MESSAGES = {
  no_pin: 'Choisis un code à 4 chiffres.',
  forbidden: 'Réservé au compte admin.',
  past_date: 'Trop tard : seuls aujourd’hui et les jours suivants sont modifiables.',
  past_locked: 'Défi passé : seule l’aide peut être modifiée, pas le puzzle.',
  date_taken: 'Un défi existe déjà pour cette date.',
  bad_date: 'Date invalide.',
  invalid: 'Défi invalide, vérifie les indices et l’énigme.',
};

/* Create a daily (`payload.date`), or edit the one at `editDate`.
 * `payload` is { author, pin, secret, words, date? }. */
export async function saveDaily(payload, editDate = null) {
  const res = await mutate(editDate ? `/dailies/${editDate}` : '/dailies', {
    method: editDate ? 'PUT' : 'POST',
    body: payload,
    messages: ADMIN_MESSAGES,
    fallback: editDate ? 'Modification refusée.' : 'Création refusée.',
  });
  if (res.ok) dailyCache.set([res.data, ...getDailies().filter((d) => d.date !== res.data.date)]);
  return res;
}

export async function deleteDaily(date, auth) {
  const res = await mutate(`/dailies/${date}`, {
    method: 'DELETE',
    body: auth,
    messages: ADMIN_MESSAGES,
    fallback: 'Suppression refusée.',
  });
  if (res.ok) dailyCache.set(getDailies().filter((d) => d.date !== date));
  return res;
}

/* Full DB dump for the admin's manual backup. */
export function exportBackup(auth) {
  return mutate('/admin/export', {
    body: auth,
    timeout: 15000,
    messages: ADMIN_MESSAGES,
    fallback: 'Export refusé.',
  });
}
