/*
 * Network layer for the daily puzzle bank, over the same Cloudflare Worker as
 * the community section (config.js COMMUNITY_API). Fail-soft like
 * services/community.js: reads never throw, falling back to the local cache so
 * dailies keep resolving offline once warmed. Admin writes (create/edit/delete)
 * and the backup export are gated server-side to the `cara+` account.
 */
import { COMMUNITY_API, COMMUNITY_CACHE_MS } from '../config.js';
import { getDailies, setDailies, cacheFetchedAt } from '../data/dailies.js';
import { clientId, hasReported, markReported } from '../data/community.js';

/*
 * Return the daily bank, refreshing from the backend only when the cache is
 * older than `maxAgeMs` (0 forces a fetch). On any failure returns the current
 * cache. main.js passes 0 for the startup warm-up.
 */
export async function loadDailies(maxAgeMs = COMMUNITY_CACHE_MS) {
  if (!COMMUNITY_API) return getDailies();
  if (maxAgeMs > 0 && Date.now() - cacheFetchedAt() < maxAgeMs) return getDailies();
  try {
    const res = await fetch(`${COMMUNITY_API}/dailies`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`dailies API: HTTP ${res.status}`);
    const levels = await res.json();
    if (Array.isArray(levels)) setDailies(levels, Date.now());
    return getDailies();
  } catch {
    return getDailies();
  }
}

/* Map a rejected admin response to a user-facing French message. */
async function reason(res, fallback) {
  if (res.status === 429) return 'Trop de requêtes, réessaie dans un instant.';
  let error = '';
  try {
    ({ error } = await res.json());
  } catch {
    /* no body */
  }
  const messages = {
    no_pin: 'Choisis un code à 4 chiffres.',
    forbidden: 'Réservé au compte admin.',
    past_date: 'Trop tard : seuls aujourd’hui et les jours suivants sont modifiables.',
    date_taken: 'Un défi existe déjà pour cette date.',
    bad_date: 'Date invalide.',
    invalid: 'Défi invalide, vérifie les indices et l’énigme.',
  };
  return messages[error] ?? fallback;
}

/* Replace one daily in the cache (by date), keeping the list stamped fresh. */
function cacheUpsert(level) {
  setDailies([level, ...getDailies().filter((d) => d.date !== level.date)], Date.now());
}

/*
 * Create a daily. `payload` is { author, pin, date, secret, words }. Returns
 * { ok: true, level } (and merges it into the cache) or { ok: false, error }.
 */
export async function createDaily(payload) {
  if (!COMMUNITY_API) return { ok: false, error: 'Serveur non configuré.' };
  try {
    const res = await fetch(`${COMMUNITY_API}/dailies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: await reason(res, 'Création refusée.') };
    const level = await res.json();
    cacheUpsert(level);
    return { ok: true, level };
  } catch {
    return { ok: false, error: 'Connexion impossible, réessaie plus tard.' };
  }
}

/*
 * Edit a daily in place. `payload` is { author, pin, secret, words }. Returns
 * { ok: true, level } (and updates the cache) or { ok: false, error }.
 */
export async function updateDaily(date, payload) {
  if (!COMMUNITY_API) return { ok: false, error: 'Serveur non configuré.' };
  try {
    const res = await fetch(`${COMMUNITY_API}/dailies/${date}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: await reason(res, 'Modification refusée.') };
    const level = await res.json();
    cacheUpsert(level);
    return { ok: true, level };
  } catch {
    return { ok: false, error: 'Connexion impossible, réessaie plus tard.' };
  }
}

/*
 * Delete a daily. `auth` is { author, pin }. Returns { ok: true } (and drops it
 * from the cache) or { ok: false, error }.
 */
export async function deleteDaily(date, auth) {
  if (!COMMUNITY_API) return { ok: false, error: 'Serveur non configuré.' };
  try {
    const res = await fetch(`${COMMUNITY_API}/dailies/${date}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(auth),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: await reason(res, 'Suppression refusée.') };
    setDailies(
      getDailies().filter((d) => d.date !== date),
      Date.now(),
    );
    return { ok: true };
  } catch {
    return { ok: false, error: 'Connexion impossible, réessaie plus tard.' };
  }
}

/*
 * Report a play stat for a daily date. `kind` is 'attempt' (opened) or 'solve'
 * (completed). Fire-and-forget and fail-soft, deduped per device by the shared
 * stat client (the backend also dedupes), so revisits cost nothing.
 */
function reportStat(date, kind) {
  if (!COMMUNITY_API || hasReported(date, kind)) return Promise.resolve();
  const client = clientId();
  if (!client) return Promise.resolve();
  return fetch(`${COMMUNITY_API}/dailies/${date}/${kind}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client }),
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => {
      if (res.ok) markReported(date, kind);
    })
    .catch(() => {
      /* offline / server down: leave unmarked so we try again next time */
    });
}

/* Record that this client opened a daily. Resolves once the post settles. */
export function recordAttempt(date) {
  return reportStat(date, 'attempt');
}

/* Record that this client completed a daily. Resolves once the post settles. */
export function recordSolve(date) {
  return reportStat(date, 'solve');
}

/*
 * Full DB dump for a manual backup. `auth` is { author, pin } (admin). Returns
 * { ok: true, data } (the parsed JSON) or { ok: false, error }.
 */
export async function exportBackup(auth) {
  if (!COMMUNITY_API) return { ok: false, error: 'Serveur non configuré.' };
  try {
    const res = await fetch(`${COMMUNITY_API}/admin/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(auth),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false, error: await reason(res, 'Export refusé.') };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, error: 'Connexion impossible, réessaie plus tard.' };
  }
}
