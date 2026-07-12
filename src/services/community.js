/*
 * Network layer for community levels, over the Cloudflare Worker in config.js.
 * Fail-soft like utils/today.js: reads never throw, falling back to the local
 * cache so the section works offline. Every request counts toward the Worker
 * free-tier quota, so loadCommunityLevels serves a fresh-enough cache without a
 * round trip (see COMMUNITY_CACHE_MS).
 */
import { COMMUNITY_API, COMMUNITY_CACHE_MS } from '../config.js';
import {
  getCache,
  setCache,
  cacheFetchedAt,
  clientId,
  hasReported,
  markReported,
} from '../data/community.js';

/*
 * Return the community list, refreshing from the backend only when the cache is
 * older than `maxAgeMs` (0 forces a fetch). On any failure returns the current
 * cache. Callers pass COMMUNITY_CACHE_MS for casual reads; 0 for the startup
 * warm-up.
 */
export async function loadCommunityLevels(maxAgeMs = COMMUNITY_CACHE_MS) {
  if (!COMMUNITY_API) return getCache();
  if (maxAgeMs > 0 && Date.now() - cacheFetchedAt() < maxAgeMs) return getCache();
  try {
    const res = await fetch(`${COMMUNITY_API}/levels`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`levels API: HTTP ${res.status}`);
    const levels = await res.json();
    if (Array.isArray(levels)) setCache(levels, Date.now());
    return getCache();
  } catch {
    return getCache();
  }
}

/* Map a rejected response to a user-facing French message. */
async function reason(res, fallback) {
  if (res.status === 429) return 'Trop de créations, réessaie dans un instant.';
  let error = '';
  try {
    ({ error } = await res.json());
  } catch {
    /* no body */
  }
  if (error === 'name_taken') return 'Ce nom est déjà pris (code incorrect).';
  if (error === 'no_pin') return 'Choisis un nom et un code à 4 chiffres.';
  if (error === 'forbidden') return 'Code incorrect : ce défi ne t’appartient pas.';
  return fallback;
}

/*
 * Sign in ('connexion') or sign up ('inscription') a name+PIN against the
 * backend, so a wrong code or an unknown name is refused before it's stored.
 * Returns { ok: true } or { ok: false, error }. With no backend configured
 * there's nothing to verify against, so it accepts optimistically.
 */
export async function authenticate({ author, pin, mode }) {
  if (!COMMUNITY_API) return { ok: true };
  try {
    const res = await fetch(`${COMMUNITY_API}/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ author, pin, mode }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { ok: true };
    const messages = {
      no_pin: 'Choisis un nom et un code à 4 chiffres.',
      name_taken: 'Ce nom est déjà pris.',
      unknown: 'Ce nom n’existe pas. Inscris-toi d’abord.',
      wrong_pin: 'Code incorrect.',
      rate_limited: 'Trop de tentatives, réessaie dans un instant.',
    };
    let error = '';
    try {
      ({ error } = await res.json());
    } catch {
      /* no body */
    }
    return { ok: false, error: messages[error] ?? 'Connexion refusée.' };
  } catch {
    return { ok: false, error: 'Connexion impossible, réessaie plus tard.' };
  }
}

/*
 * Create a challenge. `payload` is { author, pin, secret, words }. Returns
 * { ok: true, level } (and prepends it to the cache) or { ok: false, error }.
 */
export async function createCommunityLevel(payload) {
  if (!COMMUNITY_API) return { ok: false, error: 'Serveur non configuré.' };
  try {
    const res = await fetch(`${COMMUNITY_API}/levels`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok)
      return { ok: false, error: await reason(res, 'Création refusée, vérifie ton défi.') };
    const level = await res.json();
    setCache([level, ...getCache().filter((l) => l.id !== level.id)], Date.now());
    return { ok: true, level };
  } catch {
    return { ok: false, error: 'Connexion impossible, réessaie plus tard.' };
  }
}

/*
 * Edit a challenge in place. `payload` is { author, pin, secret, words }. Returns
 * { ok: true, level } (and updates the cache) or { ok: false, error }.
 */
export async function updateCommunityLevel(id, payload) {
  if (!COMMUNITY_API) return { ok: false, error: 'Serveur non configuré.' };
  try {
    const res = await fetch(`${COMMUNITY_API}/levels/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: await reason(res, 'Modification refusée.') };
    const level = await res.json();
    setCache([level, ...getCache().filter((l) => l.id !== level.id)], Date.now());
    return { ok: true, level };
  } catch {
    return { ok: false, error: 'Connexion impossible, réessaie plus tard.' };
  }
}

/*
 * Report a play stat for a bare level id. `kind` is 'attempt' (opened) or
 * 'solve' (completed). Fire-and-forget and fail-soft — stats never block or
 * surface to the player. Reported at most once per kind per level for this
 * client (the backend also dedupes by client id), so revisits cost nothing.
 */
function reportStat(id, kind) {
  if (!COMMUNITY_API || hasReported(id, kind)) return;
  const client = clientId();
  if (!client) return;
  fetch(`${COMMUNITY_API}/levels/${id}/${kind}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client }),
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => {
      /* Mark reported only on success, so a failed post retries on the next open. */
      if (res.ok) markReported(id, kind);
    })
    .catch(() => {
      /* offline / server down: leave unmarked so we try again next time */
    });
}

/* Record that this client opened a community level (bare id). */
export function recordAttempt(id) {
  reportStat(id, 'attempt');
}

/* Record that this client completed a community level (bare id). */
export function recordSolve(id) {
  reportStat(id, 'solve');
}

/*
 * Delete a challenge. `auth` is { author, pin }. Returns { ok: true } (and drops
 * it from the cache) or { ok: false, error }.
 */
export async function deleteCommunityLevel(id, auth) {
  if (!COMMUNITY_API) return { ok: false, error: 'Serveur non configuré.' };
  try {
    const res = await fetch(`${COMMUNITY_API}/levels/${id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(auth),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: await reason(res, 'Suppression refusée.') };
    setCache(
      getCache().filter((l) => l.id !== id),
      Date.now(),
    );
    return { ok: true };
  } catch {
    return { ok: false, error: 'Connexion impossible, réessaie plus tard.' };
  }
}
