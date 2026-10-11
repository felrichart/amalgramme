/*
 * Network layer over the Cloudflare Worker (shared by dailies, community levels,
 * auth and stats). Fail-soft: reads fall back to the local caches, writes resolve
 * to { ok: false, error } with a French message — nothing ever throws.
 */
import { API_URL, CACHE_MS } from '../config.js';

const OFFLINE = 'Connexion impossible, réessaie plus tard.';

/* Messages for the Worker's error codes; callers may override per call. */
const MESSAGES = {
  no_pin: 'Choisis un nom et un code à 4 chiffres.',
  rate_limited: 'Trop de requêtes, réessaie dans un instant.',
};

export function request(path, { method = 'GET', body, timeout = 8000 } = {}) {
  return fetch(API_URL + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
}

async function errorCode(res) {
  if (res.status === 429) return 'rate_limited';
  try {
    return (await res.json()).error;
  } catch {
    return '';
  }
}

/*
 * A write call: { ok: true, data } with the parsed response, or { ok: false, error }.
 * `messages` maps error codes to text; `fallback` covers anything else.
 */
export async function mutate(path, { method = 'POST', body, timeout, messages = {}, fallback }) {
  if (!API_URL) return { ok: false, error: 'Serveur non configuré.' };
  try {
    const res = await request(path, { method, body, timeout });
    if (!res.ok) {
      const code = await errorCode(res);
      return { ok: false, error: messages[code] ?? MESSAGES[code] ?? fallback };
    }
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

/*
 * Refresh `cache` (see data/cache.js) from `path` when older than `maxAgeMs`
 * (0 forces a fetch). Every request counts toward the Worker's free-tier quota,
 * hence the cache window.
 */
export async function refresh(cache, path, maxAgeMs = CACHE_MS) {
  if (!API_URL) return;
  if (maxAgeMs > 0 && Date.now() - cache.fetchedAt() < maxAgeMs) return;
  try {
    const res = await request(path, { timeout: 5000 });
    if (!res.ok) return;
    const levels = await res.json();
    if (Array.isArray(levels)) cache.set(levels);
  } catch {
    // offline: keep the cache
  }
}
