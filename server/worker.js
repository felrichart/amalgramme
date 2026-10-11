/*
 * Amalgramme API — a single Cloudflare Worker over D1.
 *   POST   /auth                     sign in (verify name+PIN) or sign up (claim a name)
 *   GET    /levels                   every community level, newest first, with play stats
 *   POST   /levels                   create one (claims/verifies the author, rate-limited)
 *   DELETE /levels/:id               remove one (its author, or the admin)
 *   GET    /dailies                  every daily, oldest first, with play stats
 *   POST   /dailies                  create one (admin, today or later)
 *   PUT    /dailies/:date            edit one (admin, today or later)
 *   DELETE /dailies/:date            remove one (admin, today or later)
 *   POST   /levels/:id/(attempt|solve), /dailies/:date/(attempt|solve)
 *                                    record an anonymous play (no sign-in)
 *   POST   /admin/export             full DB dump for the admin's manual backup
 *
 * Community levels are create-only: there is no edit endpoint.
 *
 * Identity: a username is claimed by a PIN on first use and stored in `users`
 * (plaintext, by design — a casual ownership check, not a password). Reusing a
 * name requires the same PIN. Word rules and identity constants are shared with
 * the client via ../shared/.
 */
import { checkChallenge } from '../shared/word-rules.js';
import { ADMIN_NAME, PIN_RE, NAME_MAX_LENGTH, LEVEL_ID_LENGTH } from '../shared/constants.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

const fail = (error, status) => json({ error }, status);

/* Parsed JSON body, or null when absent/malformed. */
async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function authorFrom(body) {
  return String(body.author ?? '')
    .trim()
    .slice(0, NAME_MAX_LENGTH);
}

/* Server-authoritative "today" (YYYY-MM-DD) in Europe/Paris: the boundary for the
 * daily edit guard. `en-CA` formats a Date as ISO. */
function serverToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

/* Global (not per-client) cap on writes that create rows. */
async function rateLimited(env) {
  const { success } = await env.RATE_LIMITER.limit({ key: 'global' });
  return !success;
}

/* `table` and `col` are always literals from this file, never user input. */
async function exists(env, table, col, value) {
  return !!(await env.DB.prepare(`SELECT 1 FROM ${table} WHERE ${col} = ?`).bind(value).first());
}

function userPin(env, name) {
  return env.DB.prepare('SELECT pin FROM users WHERE username = ?').bind(name).first();
}

function createUser(env, name, pin) {
  return env.DB.prepare('INSERT INTO users (username, pin, created_at) VALUES (?, ?, ?)')
    .bind(name, pin, Date.now())
    .run();
}

/*
 * Verify (and, when `create`, claim) an author's PIN:
 *   'ok'        name+PIN check out
 *   'no_pin'    malformed name or PIN
 *   'mismatch'  name exists with another PIN, or is unknown and !create
 */
async function authAuthor(env, name, pin, create) {
  if (!name || !PIN_RE.test(pin)) return 'no_pin';
  const row = await userPin(env, name);
  if (row) return row.pin === pin ? 'ok' : 'mismatch';
  if (!create) return 'mismatch';
  await createUser(env, name, pin);
  return 'ok';
}

/* Error response unless the body authenticates as the admin, else null. */
async function adminError(env, body) {
  const author = authorFrom(body);
  const auth = await authAuthor(env, author, String(body.pin ?? ''), false);
  if (auth === 'no_pin') return fail('no_pin', 400);
  if (auth !== 'ok' || author !== ADMIN_NAME) return fail('forbidden', 403);
  return null;
}

/* attempts = distinct clients who opened a puzzle, successes = those who solved it. */
function listWithStats(env, columns, table, key, order) {
  return env.DB.prepare(
    `SELECT ${columns},
            COALESCE(s.attempts, 0) AS attempts,
            COALESCE(s.successes, 0) AS successes
     FROM ${table} t
     LEFT JOIN (
       SELECT level_id, COUNT(*) AS attempts, SUM(solved) AS successes
       FROM level_stats GROUP BY level_id
     ) s ON s.level_id = t.${key}
     ORDER BY ${order}`,
  ).all();
}

const withWords = (r) => ({ ...r, words: JSON.parse(r.words) });

/* --- Handlers: (ctx) → Response, ctx = { request, env, params } --- */

async function auth({ request, env }) {
  const body = await readBody(request);
  if (!body) return fail('bad_json', 400);
  const author = authorFrom(body);
  const pin = String(body.pin ?? '');
  if (!author || !PIN_RE.test(pin)) return fail('no_pin', 400);

  const row = await userPin(env, author);
  if (body.mode === 'inscription') {
    if (row) return fail('name_taken', 403);
    if (await rateLimited(env)) return fail('rate_limited', 429);
    await createUser(env, author, pin);
    return json({ ok: true, author });
  }
  if (!row) return fail('unknown', 404);
  if (row.pin !== pin) return fail('wrong_pin', 403);
  return json({ ok: true, author });
}

async function listLevels({ env }) {
  const { results } = await listWithStats(
    env,
    't.id, t.author, t.secret, t.words, t.created_at',
    'levels',
    'id',
    't.created_at DESC',
  );
  return json(results.map(withWords));
}

async function createLevel({ request, env }) {
  if (await rateLimited(env)) return fail('rate_limited', 429);
  const body = await readBody(request);
  if (!body) return fail('bad_json', 400);

  const author = authorFrom(body);
  const auth = await authAuthor(env, author, String(body.pin ?? ''), true);
  if (auth === 'no_pin') return fail('no_pin', 400);
  if (auth === 'mismatch') return fail('name_taken', 403);

  const challenge = checkChallenge(body);
  if (!challenge.ok) return fail('invalid', 422);
  const { words, secret } = challenge.normalized;

  const id = crypto.randomUUID().slice(0, LEVEL_ID_LENGTH);
  const created_at = Date.now();
  await env.DB.prepare(
    'INSERT INTO levels (id, author, secret, words, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, author, secret, JSON.stringify(words), created_at)
    .run();
  return json({ id, author, secret, words, created_at }, 201);
}

async function deleteLevel({ request, env, params }) {
  const body = (await readBody(request)) ?? {};
  const level = await env.DB.prepare('SELECT author FROM levels WHERE id = ?')
    .bind(params.id)
    .first();
  if (!level) return fail('not_found', 404);
  const author = authorFrom(body);
  const auth = await authAuthor(env, author, String(body.pin ?? ''), false);
  if (auth !== 'ok' || (author !== ADMIN_NAME && author !== level.author))
    return fail('forbidden', 403);
  await env.DB.prepare('DELETE FROM levels WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}

async function listDailies({ env }) {
  const { results } = await listWithStats(
    env,
    't.date, t.secret, t.words, t.updated_at',
    'dailies',
    'date',
    't.date',
  );
  return json(results.map(withWords));
}

async function createDaily({ request, env }) {
  const body = await readBody(request);
  if (!body) return fail('bad_json', 400);
  const denied = await adminError(env, body);
  if (denied) return denied;

  const date = String(body.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('bad_date', 422);
  if (date < serverToday()) return fail('past_date', 422);
  const challenge = checkChallenge(body);
  if (!challenge.ok) return fail('invalid', 422);
  if (await exists(env, 'dailies', 'date', date)) return fail('date_taken', 409);

  const { words, secret } = challenge.normalized;
  const updated_at = Date.now();
  await env.DB.prepare('INSERT INTO dailies (date, secret, words, updated_at) VALUES (?, ?, ?, ?)')
    .bind(date, secret, JSON.stringify(words), updated_at)
    .run();
  return json({ date, secret, words, updated_at, attempts: 0, successes: 0 }, 201);
}

async function updateDaily({ request, env, params }) {
  const body = await readBody(request);
  if (!body) return fail('bad_json', 400);
  const denied = await adminError(env, body);
  if (denied) return denied;

  const { date } = params;
  if (!(await exists(env, 'dailies', 'date', date))) return fail('not_found', 404);
  // An already-played puzzle can't change.
  if (date < serverToday()) return fail('past_locked', 422);
  const challenge = checkChallenge(body);
  if (!challenge.ok) return fail('invalid', 422);

  const { words, secret } = challenge.normalized;
  const updated_at = Date.now();
  await env.DB.prepare('UPDATE dailies SET secret = ?, words = ?, updated_at = ? WHERE date = ?')
    .bind(secret, JSON.stringify(words), updated_at, date)
    .run();
  return json({ date, secret, words, updated_at });
}

async function deleteDaily({ request, env, params }) {
  const denied = await adminError(env, (await readBody(request)) ?? {});
  if (denied) return denied;

  const { date } = params;
  if (!(await exists(env, 'dailies', 'date', date))) return fail('not_found', 404);
  if (date < serverToday()) return fail('past_date', 422);
  await env.DB.prepare('DELETE FROM dailies WHERE date = ?').bind(date).run();
  return json({ ok: true });
}

/* Record a play (attempt) or a completion (solve) of a puzzle in `table`, keyed
 * by `col`. Deduped by the (level, client) primary key: attempt inserts once,
 * solve upserts to 1. Community ids and daily dates share level_stats — the two
 * id spaces never collide. */
function recordStat(table, col) {
  return async ({ request, env, params }) => {
    const body = (await readBody(request)) ?? {};
    const client = String(body.client ?? '').slice(0, 64);
    if (!client) return fail('no_client', 400);
    if (!(await exists(env, table, col, params.id))) return fail('not_found', 404);
    await env.DB.prepare(
      `INSERT INTO level_stats (level_id, client_id, solved, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(level_id, client_id)
       DO UPDATE SET solved = MAX(solved, excluded.solved), updated_at = excluded.updated_at`,
    )
      .bind(params.id, client, params.kind === 'solve' ? 1 : 0, Date.now())
      .run();
    return json({ ok: true });
  };
}

/* Full DB dump, plaintext PINs included (same casual-auth design; admin-only). */
async function exportAll({ request, env }) {
  const body = await readBody(request);
  if (!body) return fail('bad_json', 400);
  const denied = await adminError(env, body);
  if (denied) return denied;
  const all = (sql) => env.DB.prepare(sql).all();
  const [dailies, levels, users, stats] = await Promise.all([
    all('SELECT * FROM dailies ORDER BY date'),
    all('SELECT * FROM levels ORDER BY created_at'),
    all('SELECT * FROM users ORDER BY created_at'),
    all('SELECT * FROM level_stats'),
  ]);
  return json({
    exported_at: Date.now(),
    dailies: dailies.results,
    levels: levels.results,
    users: users.results,
    level_stats: stats.results,
  });
}

/* [method, path pattern (named groups become params), handler], first match wins. */
const ROUTES = [
  ['POST', /^\/auth$/, auth],
  ['GET', /^\/levels$/, listLevels],
  ['POST', /^\/levels$/, createLevel],
  ['POST', /^\/levels\/(?<id>[^/]+)\/(?<kind>attempt|solve)$/, recordStat('levels', 'id')],
  ['DELETE', /^\/levels\/(?<id>[^/]+)$/, deleteLevel],
  ['GET', /^\/dailies$/, listDailies],
  ['POST', /^\/dailies$/, createDaily],
  ['POST', /^\/dailies\/(?<id>[^/]+)\/(?<kind>attempt|solve)$/, recordStat('dailies', 'date')],
  ['PUT', /^\/dailies\/(?<date>[^/]+)$/, updateDaily],
  ['DELETE', /^\/dailies\/(?<date>[^/]+)$/, deleteDaily],
  ['POST', /^\/admin\/export$/, exportAll],
];

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const { pathname } = new URL(request.url);
    for (const [method, pattern, handler] of ROUTES) {
      if (request.method !== method) continue;
      const m = pathname.match(pattern);
      if (m) return handler({ request, env, params: m.groups ?? {} });
    }
    return fail('not_found', 404);
  },
};
