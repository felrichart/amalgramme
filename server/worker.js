/*
 * Amalgramme API — a single Cloudflare Worker over D1.
 *   POST   /auth/signup              create an account (name + email + password)
 *   POST   /auth/login               sign in by name or email + password
 *   POST   /auth/pin                 legacy sign-in by name + PIN (until PIN_DEADLINE)
 *   POST   /auth/logout              revoke the current session
 *   GET    /auth/me                  the signed-in account
 *   POST   /auth/secure              legacy account → add email + password
 *   POST   /auth/verify              confirm an email from its emailed token
 *   POST   /auth/verify/resend       re-send the verification email
 *   POST   /auth/forgot              email a password-reset link (always 200)
 *   POST   /auth/reset               set a new password from its emailed token
 *   GET    /progress                 the account's saved progress, per puzzle
 *   POST   /progress                 merge device saves in, returns the merged set
 *   GET    /levels                   every community level, newest first, with play stats
 *   POST   /levels                   create one (signed in, rate-limited)
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
 * Identity: signed-in calls carry `Authorization: Bearer <session token>`; only
 * token hashes are stored (sessions, email_tokens). Passwords are PBKDF2-hashed
 * (crypto.js). Legacy PIN-only accounts keep working until PIN_DEADLINE, then the
 * daily cron deletes them. Word rules and identity constants are shared with the
 * client via ../shared/.
 */
import { checkChallenge } from '../shared/word-rules.js';
import {
  ADMIN_NAME,
  PIN_RE,
  PIN_DEADLINE,
  NAME_MAX_LENGTH,
  LEVEL_ID_LENGTH,
  passwordValid,
  emailValid,
} from '../shared/constants.js';
import { pickSave, isSave, SAVE_MAX_BYTES } from '../shared/progress.js';
import { hashPassword, verifyPassword, newToken, tokenHash } from './crypto.js';
import { sendAccountMail, mailLogged } from './mail.js';

const DAY = 24 * 60 * 60 * 1000;
const SESSION_MS = 180 * DAY;
// Sliding expiry: a session used with less than this left is pushed back out.
const SESSION_RENEW_MS = 150 * DAY;
const TOKEN_MS = { verify: 2 * DAY, reset: 60 * 60 * 1000 };

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
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

/* Per-key brute-force guard on credential checks (keys: client IP, target login). */
async function authLimited(env, ...keys) {
  for (const key of keys) {
    const { success } = await env.AUTH_LIMITER.limit({ key });
    if (!success) return true;
  }
  return false;
}

const clientIp = (request) => request.headers.get('cf-connecting-ip') ?? 'unknown';

/* `table` and `col` are always literals from this file, never user input. */
async function exists(env, table, col, value) {
  return !!(await env.DB.prepare(`SELECT 1 FROM ${table} WHERE ${col} = ?`).bind(value).first());
}

/* --- Accounts --- */

const isLegacy = (u) => !u.password_hash;
const pinExpired = () => Date.now() >= PIN_DEADLINE;

/* A trimmed display name, or '' when unusable (also a route segment, hence the
 * excluded URL characters). */
function cleanName(raw) {
  const name = String(raw ?? '').trim();
  if (!name || name.length > NAME_MAX_LENGTH) return '';
  return /[\/?#%\\\u0000-\u001f\u007f]/.test(name) ? '' : name;
}

const cleanEmail = (raw) =>
  String(raw ?? '')
    .trim()
    .toLowerCase();

const USER_COLS = 'username, pin, email, email_verified, password_hash, created_at';

function findUser(env, name) {
  return env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE username = ?`).bind(name).first();
}

/* By username, or by email when `login` contains an @. */
function findLogin(env, login) {
  const byEmail = login.includes('@');
  return env.DB.prepare(
    `SELECT ${USER_COLS} FROM users WHERE ${byEmail ? 'email' : 'username'} = ?`,
  )
    .bind(byEmail ? cleanEmail(login) : login)
    .first();
}

/* What the client may know about its own account. */
function publicUser(u) {
  return {
    username: u.username,
    email: u.email ?? null,
    emailVerified: !!u.email_verified,
    legacy: isLegacy(u),
    pinDeadline: isLegacy(u) ? PIN_DEADLINE : null,
  };
}

/* Delete an account and everything only it can reach; its levels stay, authored by
 * the bare name (see deleteLevel for why a later namesake can't claim them). */
function dropUser(env, name) {
  return env.DB.batch(
    ['users', 'sessions', 'email_tokens', 'progress'].map((t) =>
      env.DB.prepare(`DELETE FROM ${t} WHERE username = ?`).bind(name),
    ),
  );
}

/* `extra` rides along in the response (the dev mail link). */
async function openSession(env, user, extra) {
  const token = newToken();
  await env.DB.prepare('INSERT INTO sessions (token_hash, username, expires_at) VALUES (?, ?, ?)')
    .bind(await tokenHash(token), user.username, Date.now() + SESSION_MS)
    .run();
  return json({ token, user: publicUser(user), ...extra });
}

/* The signed-in user (row + `session` hash), or null. */
async function sessionUser(env, request) {
  const m = (request.headers.get('authorization') ?? '').match(/^Bearer (\S+)$/);
  if (!m) return null;
  const hash = await tokenHash(m[1]);
  const row = await env.DB.prepare(
    `SELECT s.expires_at, ${USER_COLS.split(', ')
      .map((c) => 'u.' + c)
      .join(', ')}
     FROM sessions s JOIN users u ON u.username = s.username
     WHERE s.token_hash = ?`,
  )
    .bind(hash)
    .first();
  const now = Date.now();
  if (!row || row.expires_at < now || (isLegacy(row) && pinExpired())) return null;
  if (row.expires_at - now < SESSION_RENEW_MS) {
    await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
      .bind(now + SESSION_MS, hash)
      .run();
  }
  return { ...row, session: hash };
}

/* Wrap a handler that needs a signed-in user, passed as ctx.user. */
const signedIn = (handler) => async (ctx) => {
  const user = await sessionUser(ctx.env, ctx.request);
  if (!user) return fail('unauthorized', 401);
  return handler({ ...ctx, user });
};

/* Same, restricted to the admin account. */
const adminOnly = (handler) =>
  signedIn((ctx) => (ctx.user.username === ADMIN_NAME ? handler(ctx) : fail('forbidden', 403)));

/* Mint a one-shot email token (replacing pending ones of its kind) and mail it.
 * Returns { devMail: link } when mail is only logged (dev), else {}. */
async function mailToken(env, ctx, user, kind) {
  const token = newToken();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM email_tokens WHERE username = ? AND kind = ?').bind(
      user.username,
      kind,
    ),
    env.DB.prepare(
      'INSERT INTO email_tokens (token_hash, username, kind, expires_at) VALUES (?, ?, ?, ?)',
    ).bind(await tokenHash(token), user.username, kind, Date.now() + TOKEN_MS[kind]),
  ]);
  const send = sendAccountMail(env, kind, { to: user.email, username: user.username, token });
  if (mailLogged(env)) return { devMail: await send };
  // Don't hold the response on the mail provider; failures only get logged.
  ctx.waitUntil(send.catch((e) => console.error('mail failed', e)));
  return {};
}

/* Consume an email token of `kind`: its username, or null when unknown/expired. */
async function takeToken(env, token, kind) {
  const hash = await tokenHash(String(token ?? ''));
  const row = await env.DB.prepare(
    'SELECT username, expires_at FROM email_tokens WHERE token_hash = ? AND kind = ?',
  )
    .bind(hash, kind)
    .first();
  if (!row) return null;
  await env.DB.prepare('DELETE FROM email_tokens WHERE token_hash = ?').bind(hash).run();
  return row.expires_at >= Date.now() ? row.username : null;
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

/* --- Handlers: (ctx) → Response, ctx = { request, env, ctx, params, user? } --- */

async function signup({ request, env, ctx }) {
  const body = await readBody(request);
  if (!body) return fail('bad_json', 400);
  const username = cleanName(body.username);
  const email = cleanEmail(body.email);
  if (!username) return fail('bad_name', 422);
  if (!emailValid(email)) return fail('bad_email', 422);
  if (!passwordValid(body.password)) return fail('weak_password', 422);
  if ((await rateLimited(env)) || (await authLimited(env, clientIp(request))))
    return fail('rate_limited', 429);

  const taken = await findUser(env, username);
  if (taken) {
    if (!(isLegacy(taken) && pinExpired())) return fail('name_taken', 409);
    await dropUser(env, username);
  }
  if (await exists(env, 'users', 'email', email)) return fail('email_taken', 409);

  const user = {
    username,
    email,
    email_verified: 0,
    password_hash: await hashPassword(body.password),
  };
  await env.DB.prepare(
    'INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(username, email, user.password_hash, Date.now())
    .run();
  return openSession(env, user, await mailToken(env, ctx, user, 'verify'));
}

async function login({ request, env }) {
  const body = await readBody(request);
  if (!body) return fail('bad_json', 400);
  const loginId = String(body.login ?? '').trim();
  const password = String(body.password ?? '');
  if (!loginId || !password) return fail('bad_credentials', 401);
  if (await authLimited(env, clientIp(request), 'login:' + loginId.toLowerCase()))
    return fail('rate_limited', 429);

  const user = await findLogin(env, loginId);
  if (user && isLegacy(user)) return fail(pinExpired() ? 'bad_credentials' : 'legacy', 401);
  if (!user || !(await verifyPassword(password, user.password_hash)))
    return fail('bad_credentials', 401);
  return openSession(env, user);
}

async function loginPin({ request, env }) {
  const body = await readBody(request);
  if (!body) return fail('bad_json', 400);
  const username = String(body.username ?? '').trim();
  const pin = String(body.pin ?? '');
  if (!username || !PIN_RE.test(pin)) return fail('bad_credentials', 401);
  if (pinExpired()) return fail('pin_expired', 410);
  if (await authLimited(env, clientIp(request), 'pin:' + username))
    return fail('rate_limited', 429);

  const user = await findUser(env, username);
  if (user && !isLegacy(user)) return fail('secured', 401);
  if (!user || user.pin !== pin) return fail('bad_credentials', 401);
  return openSession(env, user);
}

async function logout({ env, user }) {
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(user.session).run();
  return json({ ok: true });
}

const me = async ({ user }) => json(publicUser(user));

/* A legacy account adds email + password and drops its PIN; same name, same levels. */
async function secure({ request, env, ctx, user }) {
  if (!isLegacy(user)) return fail('already_secured', 409);
  const body = await readBody(request);
  if (!body) return fail('bad_json', 400);
  const email = cleanEmail(body.email);
  if (!emailValid(email)) return fail('bad_email', 422);
  if (!passwordValid(body.password)) return fail('weak_password', 422);
  if (await exists(env, 'users', 'email', email)) return fail('email_taken', 409);

  const password_hash = await hashPassword(body.password);
  await env.DB.prepare(
    'UPDATE users SET email = ?, password_hash = ?, pin = NULL, email_verified = 0 WHERE username = ?',
  )
    .bind(email, password_hash, user.username)
    .run();
  const secured = { ...user, email, password_hash, pin: null, email_verified: 0 };
  return json({ ...publicUser(secured), ...(await mailToken(env, ctx, secured, 'verify')) });
}

async function verifyEmail({ request, env }) {
  const body = (await readBody(request)) ?? {};
  const username = await takeToken(env, body.token, 'verify');
  if (!username) return fail('bad_token', 410);
  await env.DB.prepare('UPDATE users SET email_verified = 1 WHERE username = ?')
    .bind(username)
    .run();
  return json({ ok: true, username });
}

async function resendVerification({ request, env, ctx, user }) {
  if (!user.email || user.email_verified) return fail('nothing_to_verify', 409);
  if (await authLimited(env, 'mail:' + user.username, clientIp(request)))
    return fail('rate_limited', 429);
  return json({ ok: true, ...(await mailToken(env, ctx, user, 'verify')) });
}

/* Always answers ok, so it can't be used to probe which names/emails exist. */
async function forgotPassword({ request, env, ctx }) {
  const body = (await readBody(request)) ?? {};
  const loginId = String(body.login ?? '').trim();
  let dev = {};
  if (loginId && !(await authLimited(env, clientIp(request), 'forgot:' + loginId.toLowerCase()))) {
    const user = await findLogin(env, loginId);
    if (user?.email && !isLegacy(user)) dev = await mailToken(env, ctx, user, 'reset');
  }
  return json({ ok: true, ...dev });
}

/* Sets the password, proves the email, signs out everywhere else, signs in here. */
async function resetPassword({ request, env }) {
  const body = (await readBody(request)) ?? {};
  if (!passwordValid(body.password)) return fail('weak_password', 422);
  const username = await takeToken(env, body.token, 'reset');
  const user = username && (await findUser(env, username));
  if (!user) return fail('bad_token', 410);
  const password_hash = await hashPassword(body.password);
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE users SET password_hash = ?, pin = NULL, email_verified = 1 WHERE username = ?',
    ).bind(password_hash, username),
    env.DB.prepare('DELETE FROM sessions WHERE username = ?').bind(username),
  ]);
  return openSession(env, { ...user, password_hash, pin: null, email_verified: 1 });
}

/* --- Synced progress --- */

const SAVE_ID_RE = /^[\w-]{1,40}$/;
const SAVES_PER_PUSH = 500;

async function accountSaves(env, username) {
  const { results } = await env.DB.prepare('SELECT level_id, data FROM progress WHERE username = ?')
    .bind(username)
    .all();
  return Object.fromEntries(results.map((r) => [r.level_id, JSON.parse(r.data)]));
}

const getProgress = async ({ env, user }) => json(await accountSaves(env, user.username));

/* Merge each pushed save with the stored one (shared/progress.js decides), write
 * only the winners that changed, and return the whole merged set. Malformed
 * entries are skipped rather than failing the batch. */
async function pushProgress({ request, env, user }) {
  const body = await readBody(request);
  const pushed = body?.saves;
  if (!pushed || typeof pushed !== 'object') return fail('bad_json', 400);
  const entries = Object.entries(pushed).slice(0, SAVES_PER_PUSH);

  const saves = await accountSaves(env, user.username);
  const now = Date.now();
  const writes = [];
  for (const [id, save] of entries) {
    if (!SAVE_ID_RE.test(id) || !isSave(save)) continue;
    const data = JSON.stringify(save);
    if (data.length > SAVE_MAX_BYTES) continue;
    if (pickSave(saves[id], save) === saves[id]) continue;
    saves[id] = save;
    writes.push(
      env.DB.prepare(
        `INSERT INTO progress (username, level_id, data, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(username, level_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      ).bind(user.username, id, data, now),
    );
  }
  if (writes.length) await env.DB.batch(writes);
  return json(saves);
}

/* --- Levels --- */

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

async function createLevel({ request, env, user }) {
  if (await rateLimited(env)) return fail('rate_limited', 429);
  const body = await readBody(request);
  if (!body) return fail('bad_json', 400);

  const challenge = checkChallenge(body);
  if (!challenge.ok) return fail('invalid', 422);
  const { words, secret } = challenge.normalized;

  const author = user.username;
  const id = crypto.randomUUID().slice(0, LEVEL_ID_LENGTH);
  const created_at = Date.now();
  await env.DB.prepare(
    'INSERT INTO levels (id, author, secret, words, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, author, secret, JSON.stringify(words), created_at)
    .run();
  return json({ id, author, secret, words, created_at }, 201);
}

/* The author may delete — but only levels posted since their account exists, so
 * whoever later claims an expired account's name can't touch its old levels. */
async function deleteLevel({ env, params, user }) {
  const level = await env.DB.prepare('SELECT author, created_at FROM levels WHERE id = ?')
    .bind(params.id)
    .first();
  if (!level) return fail('not_found', 404);
  const owner = user.username === level.author && level.created_at >= user.created_at;
  if (!owner && user.username !== ADMIN_NAME) return fail('forbidden', 403);
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

async function deleteDaily({ env, params }) {
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

/* Full DB dump (password hashes included, sessions and email tokens left out). */
async function exportAll({ env }) {
  const all = (sql) => env.DB.prepare(sql).all();
  const [dailies, levels, users, stats, progress] = await Promise.all([
    all('SELECT * FROM dailies ORDER BY date'),
    all('SELECT * FROM levels ORDER BY created_at'),
    all('SELECT * FROM users ORDER BY created_at'),
    all('SELECT * FROM level_stats'),
    all('SELECT * FROM progress'),
  ]);
  return json({
    exported_at: Date.now(),
    dailies: dailies.results,
    levels: levels.results,
    users: users.results,
    level_stats: stats.results,
    progress: progress.results,
  });
}

/* Daily cron: purge expired sessions/tokens and, past the deadline, PIN-only accounts. */
async function cleanup(env) {
  const now = Date.now();
  const stmts = [
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM email_tokens WHERE expires_at < ?').bind(now),
  ];
  if (now >= PIN_DEADLINE) {
    const legacy = 'SELECT username FROM users WHERE password_hash IS NULL';
    for (const t of ['sessions', 'email_tokens', 'progress'])
      stmts.push(env.DB.prepare(`DELETE FROM ${t} WHERE username IN (${legacy})`));
    stmts.push(env.DB.prepare('DELETE FROM users WHERE password_hash IS NULL'));
  }
  await env.DB.batch(stmts);
}

/* [method, path pattern (named groups become params), handler], first match wins. */
const ROUTES = [
  ['POST', /^\/auth\/signup$/, signup],
  ['POST', /^\/auth\/login$/, login],
  ['POST', /^\/auth\/pin$/, loginPin],
  ['POST', /^\/auth\/logout$/, signedIn(logout)],
  ['GET', /^\/auth\/me$/, signedIn(me)],
  ['POST', /^\/auth\/secure$/, signedIn(secure)],
  ['POST', /^\/auth\/verify$/, verifyEmail],
  ['POST', /^\/auth\/verify\/resend$/, signedIn(resendVerification)],
  ['POST', /^\/auth\/forgot$/, forgotPassword],
  ['POST', /^\/auth\/reset$/, resetPassword],
  ['GET', /^\/progress$/, signedIn(getProgress)],
  ['POST', /^\/progress$/, signedIn(pushProgress)],
  ['GET', /^\/levels$/, listLevels],
  ['POST', /^\/levels$/, signedIn(createLevel)],
  ['POST', /^\/levels\/(?<id>[^/]+)\/(?<kind>attempt|solve)$/, recordStat('levels', 'id')],
  ['DELETE', /^\/levels\/(?<id>[^/]+)$/, signedIn(deleteLevel)],
  ['GET', /^\/dailies$/, listDailies],
  ['POST', /^\/dailies$/, adminOnly(createDaily)],
  ['POST', /^\/dailies\/(?<id>[^/]+)\/(?<kind>attempt|solve)$/, recordStat('dailies', 'date')],
  ['PUT', /^\/dailies\/(?<date>[^/]+)$/, adminOnly(updateDaily)],
  ['DELETE', /^\/dailies\/(?<date>[^/]+)$/, adminOnly(deleteDaily)],
  ['POST', /^\/admin\/export$/, adminOnly(exportAll)],
];

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const { pathname } = new URL(request.url);
    for (const [method, pattern, handler] of ROUTES) {
      if (request.method !== method) continue;
      const m = pathname.match(pattern);
      if (m) return handler({ request, env, ctx, params: m.groups ?? {} });
    }
    return fail('not_found', 404);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(cleanup(env));
  },
};
