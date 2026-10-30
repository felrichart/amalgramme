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
 *   GET    /comments/:level          a puzzle's comments (signed in, puzzle solved)
 *   POST   /comments/:level          post one's single comment on it (same gate)
 *   DELETE /comments/:level/:user    remove a comment (admin)
 *   GET    /levels                   every community level, newest first, with play stats
 *   POST   /levels                   create one (signed in, rate-limited)
 *   DELETE /levels/:id               remove one (its author, or the admin)
 *   GET    /dailies                  every daily, oldest first, with play stats
 *   POST   /dailies                  create one (admin, today or later)
 *   PUT    /dailies/:date            edit one (admin, today or later)
 *   DELETE /dailies/:date            remove one (admin, today or later)
 *   POST   /plays/:puzzle            record an attempt or solve (by account, else device)
 *   POST   /plays/claim              fold this device's anonymous plays into the account
 *   POST   /admin/export             full DB dump for the admin's manual backup
 *   GET    /dicorama                 Dicorama's levels (players: validated, up to tomorrow;
 *                                    the admin: all) and its picked definitions
 *   PUT    /dicorama/levels/:pattern save a level (admin)
 *   DELETE /dicorama/levels/:pattern remove one (admin)
 *   PUT    /dicorama/definitions/:base  pick a base word's definition (admin)
 *   DELETE /dicorama/definitions/:base  back to its default one (admin)
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
  COMMENT_MAX_LENGTH,
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
  return env.DB.batch([
    ...['users', 'sessions', 'email_tokens', 'progress', 'comments'].map((t) =>
      env.DB.prepare(`DELETE FROM ${t} WHERE username = ?`).bind(name),
    ),
    // Its plays go; the puzzle counters keep counting them.
    env.DB.prepare('DELETE FROM plays WHERE player = ?').bind('u:' + name),
  ]);
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

/* attempts = distinct players who opened a puzzle, successes = those who solved it.
 * `puzzleId` is the SQL expression giving a row's puzzle id. */
function listWithStats(env, columns, table, puzzleId, order) {
  return env.DB.prepare(
    `SELECT ${columns},
            COALESCE(s.attempts, 0) AS attempts,
            COALESCE(s.successes, 0) AS successes
     FROM ${table} t
     LEFT JOIN puzzle_stats s ON s.puzzle_id = ${puzzleId}
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

/* --- Comments --- */

/* Comments are keyed like progress (date or "com-<id>"); the gate is the
 * account's synced save for that puzzle, so the client syncs it first. */
async function hasSolved(env, username, levelId) {
  const row = await env.DB.prepare('SELECT data FROM progress WHERE username = ? AND level_id = ?')
    .bind(username, levelId)
    .first();
  return !!row && !!JSON.parse(row.data).completed;
}

/* Wrap a handler on /comments/:level with the "solved it" gate. */
const solvedOnly = (handler) =>
  signedIn(async (ctx) => {
    const { level } = ctx.params;
    if (!SAVE_ID_RE.test(level)) return fail('not_found', 404);
    if (!(await hasSolved(ctx.env, ctx.user.username, level))) return fail('not_solved', 403);
    return handler(ctx);
  });

async function listComments({ env, params }) {
  const { results } = await env.DB.prepare(
    'SELECT username, body, created_at FROM comments WHERE level_id = ? ORDER BY created_at DESC',
  )
    .bind(params.level)
    .all();
  return json(results);
}

/* One comment per player and puzzle, for good: it can't be edited or reposted. */
async function postComment({ request, env, params, user }) {
  const body = await readBody(request);
  if (!body) return fail('bad_json', 400);
  // Line breaks kept, other control characters dropped.
  const text = String(body.body ?? '')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
    .trim();
  if (!text || text.length > COMMENT_MAX_LENGTH) return fail('bad_comment', 422);
  if (await rateLimited(env)) return fail('rate_limited', 429);
  const comment = { username: user.username, body: text, created_at: Date.now() };
  const { meta } = await env.DB.prepare(
    `INSERT INTO comments (level_id, username, body, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(level_id, username) DO NOTHING`,
  )
    .bind(params.level, comment.username, comment.body, comment.created_at)
    .run();
  if (!meta?.changes) return fail('already_commented', 409);
  return json(comment, 201);
}

async function deleteComment({ env, params }) {
  await env.DB.prepare('DELETE FROM comments WHERE level_id = ? AND username = ?')
    .bind(params.level, decodeURIComponent(params.user))
    .run();
  return json({ ok: true });
}

/* --- Levels --- */

async function listLevels({ env }) {
  const { results } = await listWithStats(
    env,
    't.id, t.author, t.secret, t.words, t.created_at',
    'levels',
    `'com-' || t.id`,
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
  await env.DB.batch([
    env.DB.prepare('DELETE FROM levels WHERE id = ?').bind(params.id),
    ...forgetPuzzle(env, 'com-' + params.id),
  ]);
  return json({ ok: true });
}

async function listDailies({ env }) {
  const { results } = await listWithStats(
    env,
    't.date, t.secret, t.words, t.updated_at',
    'dailies',
    't.date',
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
  await env.DB.batch([
    env.DB.prepare('DELETE FROM dailies WHERE date = ?').bind(date),
    ...forgetPuzzle(env, date),
  ]);
  return json({ ok: true });
}

/* --- Play stats --- */

/* Statements dropping everything attached to a deleted puzzle. */
const forgetPuzzle = (env, puzzleId) =>
  ['comments', 'plays', 'puzzle_stats'].map((t) =>
    env.DB.prepare(
      `DELETE FROM ${t} WHERE ${t === 'comments' ? 'level_id' : 'puzzle_id'} = ?`,
    ).bind(puzzleId),
  );

function puzzleExists(env, puzzleId) {
  return puzzleId.startsWith('com-')
    ? exists(env, 'levels', 'id', puzzleId.slice(4))
    : exists(env, 'dailies', 'date', puzzleId);
}

const bumpStats = (env, puzzleId, attempts, successes) =>
  env.DB.prepare(
    `INSERT INTO puzzle_stats (puzzle_id, attempts, successes) VALUES (?, ?, ?)
     ON CONFLICT(puzzle_id) DO UPDATE SET attempts = attempts + excluded.attempts,
                                          successes = successes + excluded.successes`,
  ).bind(puzzleId, attempts, successes);

const deviceId = (body) => String(body?.client ?? '').slice(0, 64);

/* An attempt counts once per player, a solve flips it once; the counters move
 * only when a row actually changes, so repeats are free. Signed in, the player is
 * the account; otherwise the device id sent in the body. */
async function recordPlay({ request, env, params }) {
  const body = (await readBody(request)) ?? {};
  const user = await sessionUser(env, request);
  const client = deviceId(body);
  if (!user && !client) return fail('no_client', 400);
  const puzzleId = params.puzzle;
  if (!(await puzzleExists(env, puzzleId))) return fail('not_found', 404);

  const player = user ? 'u:' + user.username : 'c:' + client;
  const solved = (params.kind ?? body.kind) === 'solve' ? 1 : 0;
  const now = Date.now();
  const inserted = await env.DB.prepare(
    `INSERT INTO plays (puzzle_id, player, solved, started_at, solved_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(puzzle_id, player) DO NOTHING`,
  )
    .bind(puzzleId, player, solved, now, solved ? now : null)
    .run();
  if (inserted.meta?.changes) {
    await bumpStats(env, puzzleId, 1, solved).run();
  } else if (solved) {
    const flipped = await env.DB.prepare(
      'UPDATE plays SET solved = 1, solved_at = ? WHERE puzzle_id = ? AND player = ? AND solved = 0',
    )
      .bind(now, puzzleId, player)
      .run();
    if (flipped.meta?.changes) await bumpStats(env, puzzleId, 0, 1).run();
  }
  return json({ ok: true });
}

/* Pre-0011 clients posted to /levels/:id/<kind> and /dailies/:date/<kind>. */
const legacyRecordPlay = (prefix) => (ctx) =>
  recordPlay({ ...ctx, params: { puzzle: prefix + ctx.params.id, kind: ctx.params.kind } });

/* The device's anonymous plays become the account's. Where both played the same
 * puzzle the two rows merge (solved if either was) and the counters drop the
 * duplicate. One batch, so it applies atomically. */
async function claimPlays({ request, env, user }) {
  const client = deviceId(await readBody(request));
  if (!client) return fail('no_client', 400);
  const anon = 'c:' + client;
  const mine = 'u:' + user.username;
  const both =
    'SELECT puzzle_id FROM plays WHERE player = ?1 INTERSECT SELECT puzzle_id FROM plays WHERE player = ?2';
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE puzzle_stats SET attempts = attempts - 1,
         successes = successes - (SELECT MIN(p.solved) FROM plays p
                                  WHERE p.puzzle_id = puzzle_stats.puzzle_id AND p.player IN (?1, ?2))
       WHERE puzzle_id IN (${both})`,
    ).bind(anon, mine),
    env.DB.prepare(
      `UPDATE plays SET solved = 1, solved_at = (SELECT a.solved_at FROM plays a
                                                  WHERE a.puzzle_id = plays.puzzle_id AND a.player = ?1)
       WHERE player = ?2 AND solved = 0
         AND puzzle_id IN (SELECT puzzle_id FROM plays WHERE player = ?1 AND solved = 1)`,
    ).bind(anon, mine),
    env.DB.prepare(
      `UPDATE plays SET player = ?2
       WHERE player = ?1 AND puzzle_id NOT IN (SELECT puzzle_id FROM plays WHERE player = ?2)`,
    ).bind(anon, mine),
    env.DB.prepare('DELETE FROM plays WHERE player = ?').bind(anon),
  ]);
  return json({ ok: true });
}

/* --- Dicorama --- */

const DICO_PATTERN = /^[A-Z_]{4,7}$/;
const DICO_MAX_BYTES = 64 * 1024;

const isStrings = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const dicoLevel = (r) => ({
  pattern: r.pattern,
  status: r.status,
  date: r.date,
  words: JSON.parse(r.words),
  rare: JSON.parse(r.rare),
  banned: JSON.parse(r.banned),
});

/* Players get validated levels up to tomorrow (Paris), so no timezone misses its
 * day; the client keeps the ones up to its own today. */
async function getDicorama({ request, env }) {
  const user = await sessionUser(env, request);
  const cols = 'pattern, status, date, words, rare, banned';
  const levels =
    user?.username === ADMIN_NAME
      ? env.DB.prepare(`SELECT ${cols} FROM dicorama_levels ORDER BY date, pattern`)
      : env.DB.prepare(
          `SELECT ${cols} FROM dicorama_levels WHERE status = 'valid' AND date <= ? ORDER BY date`,
        ).bind(addDays(serverToday(), 1));
  const [{ results: rows }, { results: defs }] = await Promise.all([
    levels.all(),
    env.DB.prepare('SELECT base, idx, text FROM dicorama_definitions').all(),
  ]);
  return json({
    levels: rows.map(dicoLevel),
    definitions: Object.fromEntries(defs.map((d) => [d.base, { index: d.idx, text: d.text }])),
  });
}

/* A validated level needs its day, which no other level may hold. */
async function saveDicoLevel({ request, env, params }) {
  const body = await readBody(request);
  if (!body) return fail('bad_json', 400);
  const { pattern } = params;
  const { status, words, rare, banned } = body;
  const date = body.date ?? null;
  if (!DICO_PATTERN.test(pattern) || !pattern.includes('_')) return fail('bad_pattern', 422);
  if (status !== 'draft' && status !== 'valid') return fail('invalid', 422);
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('bad_date', 422);
  if (status === 'valid' && !date) return fail('bad_date', 422);
  if (!Array.isArray(words) || !words.length || !isStrings(rare) || !isStrings(banned))
    return fail('invalid', 422);
  const stored = [words, rare, banned].map((v) => JSON.stringify(v));
  if (stored.join('').length > DICO_MAX_BYTES) return fail('invalid', 422);
  if (date) {
    const taken = await env.DB.prepare(
      'SELECT 1 FROM dicorama_levels WHERE date = ? AND pattern != ?',
    )
      .bind(date, pattern)
      .first();
    if (taken) return fail('date_taken', 409);
  }

  await env.DB.prepare(
    `INSERT INTO dicorama_levels (pattern, status, date, words, rare, banned, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(pattern) DO UPDATE SET status = excluded.status, date = excluded.date,
       words = excluded.words, rare = excluded.rare, banned = excluded.banned,
       updated_at = excluded.updated_at`,
  )
    .bind(pattern, status, date, ...stored, Date.now())
    .run();
  return json({ pattern, status, date, words, rare, banned });
}

async function deleteDicoLevel({ env, params }) {
  if (!(await exists(env, 'dicorama_levels', 'pattern', params.pattern)))
    return fail('not_found', 404);
  await env.DB.prepare('DELETE FROM dicorama_levels WHERE pattern = ?').bind(params.pattern).run();
  return json({ ok: true });
}

async function setDicoDefinition({ request, env, params }) {
  const body = await readBody(request);
  const base = decodeURIComponent(params.base);
  const index = body?.index;
  const text = String(body?.text ?? '').trim();
  if (!Number.isInteger(index) || index < 0 || !text || text.length > 2000)
    return fail('invalid', 422);
  await env.DB.prepare(
    `INSERT INTO dicorama_definitions (base, idx, text) VALUES (?, ?, ?)
     ON CONFLICT(base) DO UPDATE SET idx = excluded.idx, text = excluded.text`,
  )
    .bind(base, index, text)
    .run();
  return json({ base, index, text });
}

async function deleteDicoDefinition({ env, params }) {
  await env.DB.prepare('DELETE FROM dicorama_definitions WHERE base = ?')
    .bind(decodeURIComponent(params.base))
    .run();
  return json({ ok: true });
}

/* Full DB dump (password hashes included, sessions and email tokens left out). */
async function exportAll({ env }) {
  const all = (sql) => env.DB.prepare(sql).all();
  const [dailies, levels, users, plays, puzzleStats, progress, comments, dicoLevels, dicoDefs] =
    await Promise.all([
      all('SELECT * FROM dailies ORDER BY date'),
      all('SELECT * FROM levels ORDER BY created_at'),
      all('SELECT * FROM users ORDER BY created_at'),
      all('SELECT * FROM plays'),
      all('SELECT * FROM puzzle_stats'),
      all('SELECT * FROM progress'),
      all('SELECT * FROM comments'),
      all('SELECT * FROM dicorama_levels ORDER BY pattern'),
      all('SELECT * FROM dicorama_definitions ORDER BY base'),
    ]);
  return json({
    exported_at: Date.now(),
    dailies: dailies.results,
    levels: levels.results,
    users: users.results,
    plays: plays.results,
    puzzle_stats: puzzleStats.results,
    progress: progress.results,
    comments: comments.results,
    dicorama_levels: dicoLevels.results,
    dicorama_definitions: dicoDefs.results,
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
    for (const t of ['sessions', 'email_tokens', 'progress', 'comments'])
      stmts.push(env.DB.prepare(`DELETE FROM ${t} WHERE username IN (${legacy})`));
    stmts.push(
      env.DB.prepare(
        `DELETE FROM plays WHERE player IN (SELECT 'u:' || username FROM (${legacy}))`,
      ),
    );
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
  ['GET', /^\/comments\/(?<level>[^/]+)$/, solvedOnly(listComments)],
  ['POST', /^\/comments\/(?<level>[^/]+)$/, solvedOnly(postComment)],
  ['DELETE', /^\/comments\/(?<level>[^/]+)\/(?<user>[^/]+)$/, adminOnly(deleteComment)],
  ['GET', /^\/levels$/, listLevels],
  ['POST', /^\/levels$/, signedIn(createLevel)],
  ['POST', /^\/plays\/claim$/, signedIn(claimPlays)],
  ['POST', /^\/plays\/(?<puzzle>[\w-]+)$/, recordPlay],
  ['POST', /^\/levels\/(?<id>[^/]+)\/(?<kind>attempt|solve)$/, legacyRecordPlay('com-')],
  ['DELETE', /^\/levels\/(?<id>[^/]+)$/, signedIn(deleteLevel)],
  ['GET', /^\/dailies$/, listDailies],
  ['POST', /^\/dailies$/, adminOnly(createDaily)],
  ['POST', /^\/dailies\/(?<id>[^/]+)\/(?<kind>attempt|solve)$/, legacyRecordPlay('')],
  ['PUT', /^\/dailies\/(?<date>[^/]+)$/, adminOnly(updateDaily)],
  ['DELETE', /^\/dailies\/(?<date>[^/]+)$/, adminOnly(deleteDaily)],
  ['POST', /^\/admin\/export$/, adminOnly(exportAll)],
  ['GET', /^\/dicorama$/, getDicorama],
  ['PUT', /^\/dicorama\/levels\/(?<pattern>[^/]+)$/, adminOnly(saveDicoLevel)],
  ['DELETE', /^\/dicorama\/levels\/(?<pattern>[^/]+)$/, adminOnly(deleteDicoLevel)],
  ['PUT', /^\/dicorama\/definitions\/(?<base>[^/]+)$/, adminOnly(setDicoDefinition)],
  ['DELETE', /^\/dicorama\/definitions\/(?<base>[^/]+)$/, adminOnly(deleteDicoDefinition)],
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
