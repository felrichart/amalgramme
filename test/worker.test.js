import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../server/worker.js';
import { checkChallenge } from '../shared/word-rules.js';
import { PIN_DEADLINE } from '../shared/constants.js';
import { createD1 } from './d1.js';

const WORDS = ['soleil', 'plage', 'sable', 'vague'];

/* A fresh Worker env over a migrated in-memory DB. Mail is in dev mode: the Worker
 * logs each link, captured into `mails`. */
function fakeEnv({ limited = false } = {}) {
  const limiter = { limit: async () => ({ success: !limited }) };
  return {
    DB: createD1(),
    RATE_LIMITER: limiter,
    AUTH_LIMITER: limiter,
    APP_URL: 'https://app',
    MAIL_MODE: 'log',
  };
}

let mails;
let pending;
beforeEach(() => {
  mails = [];
  pending = [];
  vi.spyOn(console, 'log').mockImplementation((line) => {
    const m = String(line).match(/^\[mail:(\w+)\] (\S+) → \S+token=(\S+)$/);
    if (m) mails.push({ kind: m[1], to: m[2], token: decodeURIComponent(m[3]) });
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function call(env, method, path, body, token) {
  const init = { method, headers: {} };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  if (token) init.headers.authorization = `Bearer ${token}`;
  const ctx = { waitUntil: (p) => pending.push(p) };
  const res = await worker.fetch(new Request(`https://api.test${path}`, init), env, ctx);
  await Promise.all(pending);
  return res;
}

async function signup(env, username = 'bob', email = `${username}@mail.test`) {
  const res = await call(env, 'POST', '/auth/signup', { username, email, password: 'hunter2!!' });
  return (await res.json()).token;
}

/* A pre-existing PIN-only account, as migrated from the old users table. */
function legacyUser(env, username, pin, created_at = 1) {
  env.DB.sql(
    'INSERT INTO users (username, pin, created_at) VALUES (?, ?, ?)',
    username,
    pin,
    created_at,
  );
}

const afterDeadline = () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PIN_DEADLINE + 1000);
};

const save = (found, extra = {}) => ({
  solved: [true, true, true, true].map((_, i) => i < found),
  secretFound: false,
  completed: false,
  ...extra,
});

describe('checkChallenge', () => {
  it('accepts a valid challenge and normalises it', () => {
    const res = checkChallenge({ words: ['Soleil', ...WORDS.slice(1)], secret: 'Île' });
    expect(res.ok).toBe(true);
    expect(res.normalized).toEqual({ words: WORDS, secret: 'ile' });
  });
  it('flags duplicates, wrong counts and unbuildable énigmes', () => {
    expect(
      checkChallenge({ words: [...WORDS.slice(0, 3), 'soleil'], secret: 'sol' }).words,
    ).toEqual([null, null, null, 'dup']);
    expect(checkChallenge({ words: WORDS.slice(0, 3), secret: 'sol' }).ok).toBe(false);
    expect(checkChallenge({ words: WORDS, secret: 'zzz' }).buildable).toBe(false);
    expect(checkChallenge({ words: 'nope', secret: 'sol' }).ok).toBe(false);
  });
});

describe('accounts', () => {
  it('signs up with a hashed password and emails a verification link', async () => {
    const env = fakeEnv();
    const res = await call(env, 'POST', '/auth/signup', {
      username: ' bob ',
      email: 'Bob@Mail.test',
      password: 'hunter2!!',
    });
    expect(res.status).toBe(200);
    const { token, user } = await res.json();
    expect(token).toBeTruthy();
    expect(user).toMatchObject({ username: 'bob', email: 'bob@mail.test', emailVerified: false });
    expect(env.DB.sql('SELECT password_hash FROM users')[0].password_hash).toMatch(
      /^pbkdf2-sha256\$100000\$/,
    );
    expect(mails).toEqual([expect.objectContaining({ kind: 'verify', to: 'bob@mail.test' })]);
  });

  it('only hands mail links back in dev mode', async () => {
    const dev = await call(fakeEnv(), 'POST', '/auth/signup', {
      username: 'al',
      email: 'al@mail.test',
      password: 'hunter2!!',
    });
    expect((await dev.json()).devMail).toMatch(/^https:\/\/app\/verifier\?token=/);
    const sent = [];
    const env = { ...fakeEnv(), MAIL_MODE: undefined, EMAIL: { send: async (m) => sent.push(m) } };
    const prod = await call(env, 'POST', '/auth/signup', {
      username: 'al',
      email: 'al@mail.test',
      password: 'hunter2!!',
    });
    expect((await prod.json()).devMail).toBeUndefined();
    expect(sent).toHaveLength(1);
  });

  it('refuses taken names and emails, bad emails and short passwords', async () => {
    const env = fakeEnv();
    await signup(env, 'bob');
    const body = { username: 'al', email: 'al@mail.test', password: 'hunter2!!' };
    const status = async (b) => (await call(env, 'POST', '/auth/signup', { ...body, ...b })).status;
    expect(await status({ username: 'bob' })).toBe(409);
    expect(await status({ email: 'BOB@mail.test' })).toBe(409);
    expect(await status({ email: 'nope' })).toBe(422);
    expect(await status({ password: 'short' })).toBe(422);
    expect(await status({ username: 'a/b' })).toBe(422);
    expect(await status({})).toBe(200);
  });

  it('logs in by name or email, rejects a wrong password', async () => {
    const env = fakeEnv();
    await signup(env, 'bob');
    const login = (l, password = 'hunter2!!') =>
      call(env, 'POST', '/auth/login', { login: l, password });
    expect((await login('bob')).status).toBe(200);
    expect((await login('BOB@mail.test')).status).toBe(200);
    expect(await (await login('bob', 'wrong-pass')).json()).toEqual({ error: 'bad_credentials' });
    expect((await login('ghost')).status).toBe(401);
  });

  it('sessions: /auth/me needs a live token, logout revokes it', async () => {
    const env = fakeEnv();
    const token = await signup(env);
    expect((await call(env, 'GET', '/auth/me')).status).toBe(401);
    expect((await call(env, 'GET', '/auth/me', undefined, 'forged')).status).toBe(401);
    expect((await call(env, 'GET', '/auth/me', undefined, token)).status).toBe(200);
    await call(env, 'POST', '/auth/logout', {}, token);
    expect((await call(env, 'GET', '/auth/me', undefined, token)).status).toBe(401);
  });

  it('verifies the email once from its token', async () => {
    const env = fakeEnv();
    const token = await signup(env);
    const verify = () => call(env, 'POST', '/auth/verify', { token: mails[0].token });
    expect((await verify()).status).toBe(200);
    expect((await verify()).status).toBe(410);
    const me = await (await call(env, 'GET', '/auth/me', undefined, token)).json();
    expect(me.emailVerified).toBe(true);
  });

  it('resets a password by email and signs out other sessions', async () => {
    const env = fakeEnv();
    const old = await signup(env);
    const forgot = await call(env, 'POST', '/auth/forgot', { login: 'bob' });
    expect(forgot.status).toBe(200);
    // Unknown logins answer the same, without mailing.
    expect((await call(env, 'POST', '/auth/forgot', { login: 'ghost' })).status).toBe(200);
    const reset = mails.filter((m) => m.kind === 'reset');
    expect(reset).toHaveLength(1);
    const res = await call(env, 'POST', '/auth/reset', {
      token: reset[0].token,
      password: 'new-password',
    });
    expect(res.status).toBe(200);
    expect((await res.json()).user.emailVerified).toBe(true);
    expect((await call(env, 'GET', '/auth/me', undefined, old)).status).toBe(401);
    const login = await call(env, 'POST', '/auth/login', {
      login: 'bob',
      password: 'new-password',
    });
    expect(login.status).toBe(200);
  });

  it('rate-limits sign-up', async () => {
    const res = await call(fakeEnv({ limited: true }), 'POST', '/auth/signup', {
      username: 'al',
      email: 'al@mail.test',
      password: 'hunter2!!',
    });
    expect(res.status).toBe(429);
  });
});

describe('legacy PIN accounts', () => {
  it('sign in by PIN as legacy, then secure with email + password', async () => {
    const env = fakeEnv();
    legacyUser(env, 'old', '1234');
    expect((await call(env, 'POST', '/auth/pin', { username: 'old', pin: '0000' })).status).toBe(
      401,
    );
    expect(
      await (await call(env, 'POST', '/auth/login', { login: 'old', password: 'x' })).json(),
    ).toEqual({ error: 'legacy' });

    const res = await call(env, 'POST', '/auth/pin', { username: 'old', pin: '1234' });
    const { token, user } = await res.json();
    expect(user).toMatchObject({ legacy: true, pinDeadline: PIN_DEADLINE });

    const secured = await call(
      env,
      'POST',
      '/auth/secure',
      { email: 'old@mail.test', password: 'hunter2!!' },
      token,
    );
    expect(await secured.json()).toMatchObject({ username: 'old', legacy: false });
    expect(env.DB.sql('SELECT pin FROM users')[0].pin).toBeNull();
    expect(
      await (await call(env, 'POST', '/auth/pin', { username: 'old', pin: '1234' })).json(),
    ).toEqual({ error: 'secured' });
    const login = await call(env, 'POST', '/auth/login', { login: 'old', password: 'hunter2!!' });
    expect(login.status).toBe(200);
  });

  it('past the deadline: PIN refused, session dead, name freed, cron purges', async () => {
    const env = fakeEnv();
    legacyUser(env, 'old', '1234');
    legacyUser(env, 'gone', '1234');
    const { token } = await (
      await call(env, 'POST', '/auth/pin', { username: 'old', pin: '1234' })
    ).json();
    afterDeadline();
    expect((await call(env, 'POST', '/auth/pin', { username: 'old', pin: '1234' })).status).toBe(
      410,
    );
    expect((await call(env, 'GET', '/auth/me', undefined, token)).status).toBe(401);
    expect(await signup(env, 'old')).toBeTruthy();

    await worker.scheduled({}, env, { waitUntil: (p) => pending.push(p) });
    await Promise.all(pending);
    expect(env.DB.sql('SELECT username FROM users')).toEqual(
      [{ username: 'old' }].map((u) => expect.objectContaining(u)),
    );
  });
});

describe('progress sync', () => {
  it('merges pushed saves (most advanced wins) and returns the account set', async () => {
    const env = fakeEnv();
    const token = await signup(env);
    expect((await call(env, 'GET', '/progress')).status).toBe(401);

    const push = async (saves) => (await call(env, 'POST', '/progress', { saves }, token)).json();
    await push({ '2026-01-01': save(3), 'com-abc': save(1) });
    const merged = await push({
      '2026-01-01': save(1, { updatedAt: 9e12 }), // newer but behind: loses
      'com-abc': save(1, { completed: true }),
      '2026-01-02': save(2),
      'bad id!': save(4),
      '2026-01-03': { nope: true },
    });
    expect(Object.keys(merged).sort()).toEqual(['2026-01-01', '2026-01-02', 'com-abc']);
    expect(merged['2026-01-01'].solved.filter(Boolean)).toHaveLength(3);
    expect(merged['com-abc'].completed).toBe(true);
    expect(await (await call(env, 'GET', '/progress', undefined, token)).json()).toEqual(merged);
  });
});

describe('worker routes', () => {
  it('answers CORS preflight and 404s unknown routes', async () => {
    const env = fakeEnv();
    const pre = await call(env, 'OPTIONS', '/levels');
    expect(pre.status).toBe(200);
    expect(pre.headers.get('access-control-allow-headers')).toMatch(/authorization/);
    const res = await call(env, 'GET', '/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('POST /levels needs a session and authors the level as its user', async () => {
    const env = fakeEnv();
    const body = { author: 'mallory', words: WORDS, secret: 'SOL' };
    expect((await call(env, 'POST', '/levels', body)).status).toBe(401);
    const res = await call(env, 'POST', '/levels', body, await signup(env, 'bob'));
    expect(res.status).toBe(201);
    const level = await res.json();
    expect(level).toMatchObject({ author: 'bob', secret: 'sol', words: WORDS });
    expect(level.id).toHaveLength(8);
  });

  it('DELETE /levels: owner or admin only, never a later namesake', async () => {
    const env = fakeEnv();
    legacyUser(env, 'old', '1234');
    env.DB.sql(
      "INSERT INTO levels (id, author, secret, words, created_at) VALUES ('lvl1', 'old', 'sol', '[]', 5)",
    );
    const bob = await signup(env, 'bob');
    expect((await call(env, 'DELETE', '/levels/lvl1', {}, bob)).status).toBe(403);

    afterDeadline();
    const namesake = await signup(env, 'old');
    expect((await call(env, 'DELETE', '/levels/lvl1', {}, namesake)).status).toBe(403);
    const admin = await signup(env, 'cara+');
    expect((await call(env, 'DELETE', '/levels/lvl1', {}, admin)).status).toBe(200);
  });

  it('dailies writes are admin-only', async () => {
    const env = fakeEnv();
    const body = { date: '2999-01-01', words: WORDS, secret: 'sol' };
    expect((await call(env, 'POST', '/dailies', body)).status).toBe(401);
    expect((await call(env, 'POST', '/dailies', body, await signup(env, 'bob'))).status).toBe(403);
    const ok = await call(env, 'POST', '/dailies', body, await signup(env, 'cara+'));
    expect(ok.status).toBe(201);
  });
});

describe('comments', () => {
  const solve = (env, token, id) =>
    call(env, 'POST', '/progress', { saves: { [id]: save(4, { completed: true }) } }, token);

  it('are gated on a solved puzzle, one per player, newest first', async () => {
    const env = fakeEnv();
    const bob = await signup(env, 'bob');
    const al = await signup(env, 'al');
    const id = '2026-01-01';
    expect((await call(env, 'GET', `/comments/${id}`)).status).toBe(401);
    expect(await (await call(env, 'GET', `/comments/${id}`, undefined, bob)).json()).toEqual({
      error: 'not_solved',
    });
    // Started but unfinished doesn't count.
    await call(env, 'POST', '/progress', { saves: { [id]: save(3) } }, bob);
    expect((await call(env, 'POST', `/comments/${id}`, { body: 'hi' }, bob)).status).toBe(403);

    await solve(env, bob, id);
    await solve(env, al, id);
    const post = (token, body) => call(env, 'POST', `/comments/${id}`, { body }, token);
    expect((await post(bob, '  ')).status).toBe(422);
    expect((await post(bob, 'x'.repeat(281))).status).toBe(422);
    expect((await post(bob, ' Trop dur ! ')).status).toBe(201);
    expect(await (await post(bob, 'encore')).json()).toEqual({ error: 'already_commented' });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 1000);
    await post(al, 'Facile');

    const list = await (await call(env, 'GET', `/comments/${id}`, undefined, bob)).json();
    expect(list.map((c) => [c.username, c.body])).toEqual([
      ['al', 'Facile'],
      ['bob', 'Trop dur !'],
    ]);
  });

  it('admin deletes; deleting a level drops its comments', async () => {
    const env = fakeEnv();
    const bob = await signup(env, 'bob');
    const admin = await signup(env, 'cara+');
    const level = await (
      await call(env, 'POST', '/levels', { words: WORDS, secret: 'sol' }, bob)
    ).json();
    const id = `com-${level.id}`;
    await solve(env, bob, id);
    await call(env, 'POST', `/comments/${id}`, { body: 'ok' }, bob);
    expect((await call(env, 'DELETE', `/comments/${id}/bob`, {}, bob)).status).toBe(403);

    await call(env, 'DELETE', `/levels/${level.id}`, {}, bob);
    expect(env.DB.sql('SELECT * FROM comments')).toEqual([]);

    await solve(env, bob, '2026-01-01');
    await call(env, 'POST', '/comments/2026-01-01', { body: 'ok' }, bob);
    expect((await call(env, 'DELETE', '/comments/2026-01-01/bob', {}, admin)).status).toBe(200);
    expect(env.DB.sql('SELECT * FROM comments')).toEqual([]);
  });
});

describe('play stats', () => {
  const daily = (env, date = '2999-01-01') =>
    env.DB.sql(
      "INSERT INTO dailies (date, secret, words, updated_at) VALUES (?, 's', '[]', 1)",
      date,
    );
  const stats = (env) =>
    env.DB.sql('SELECT puzzle_id, attempts, successes FROM puzzle_stats ORDER BY puzzle_id').map(
      (r) => [r.puzzle_id, r.attempts, r.successes],
    );
  const play = (env, puzzle, kind, client, token) =>
    call(env, 'POST', `/plays/${puzzle}`, { client, kind }, token);

  it('counts each player once per puzzle, by device or account', async () => {
    const env = fakeEnv();
    daily(env);
    expect((await play(env, '2999-01-01', 'attempt')).status).toBe(400);
    expect((await play(env, '2999-01-02', 'attempt', 'd1')).status).toBe(404);
    await play(env, '2999-01-01', 'attempt', 'd1');
    await play(env, '2999-01-01', 'attempt', 'd1');
    await play(env, '2999-01-01', 'solve', 'd1');
    await play(env, '2999-01-01', 'solve', 'd1');
    const bob = await signup(env, 'bob');
    await play(env, '2999-01-01', 'solve', 'd2', bob);
    expect(stats(env)).toEqual([['2999-01-01', 2, 2]]);
    expect(env.DB.sql('SELECT player FROM plays ORDER BY player').map((r) => r.player)).toEqual([
      'c:d1',
      'u:bob',
    ]);
  });

  it('old clients still post to /levels|dailies/:id/<kind>, keyed like progress', async () => {
    const env = fakeEnv();
    daily(env);
    const level = await (
      await call(env, 'POST', '/levels', { words: WORDS, secret: 'sol' }, await signup(env))
    ).json();
    await call(env, 'POST', `/levels/${level.id}/attempt`, { client: 'd1' });
    await call(env, 'POST', '/dailies/2999-01-01/solve', { client: 'd1' });
    expect(stats(env)).toEqual([
      ['2999-01-01', 1, 1],
      [`com-${level.id}`, 1, 0],
    ]);
    const list = await (await call(env, 'GET', '/levels')).json();
    expect(list[0]).toMatchObject({ attempts: 1, successes: 0 });
  });

  it('claim folds device plays into the account without double counting', async () => {
    const env = fakeEnv();
    ['2999-01-01', '2999-01-02', '2999-01-03'].forEach((d) => daily(env, d));
    const bob = await signup(env, 'bob');
    // Device: solved 01, opened 02 and 03. Account: opened 01, solved 02.
    await play(env, '2999-01-01', 'solve', 'd1');
    await play(env, '2999-01-02', 'attempt', 'd1');
    await play(env, '2999-01-03', 'attempt', 'd1');
    await play(env, '2999-01-01', 'attempt', null, bob);
    await play(env, '2999-01-02', 'solve', null, bob);

    expect((await call(env, 'POST', '/plays/claim', { client: 'd1' })).status).toBe(401);
    await call(env, 'POST', '/plays/claim', { client: 'd1' }, bob);
    expect(stats(env)).toEqual([
      ['2999-01-01', 1, 1],
      ['2999-01-02', 1, 1],
      ['2999-01-03', 1, 0],
    ]);
    expect(env.DB.sql("SELECT COUNT(*) n FROM plays WHERE player = 'c:d1'")[0].n).toBe(0);
  });

  it('deleting a puzzle drops its plays, counters and comments', async () => {
    const env = fakeEnv();
    daily(env);
    const admin = await signup(env, 'cara+');
    await play(env, '2999-01-01', 'solve', 'd1');
    await call(env, 'DELETE', '/dailies/2999-01-01', {}, admin);
    expect(stats(env)).toEqual([]);
    expect(env.DB.sql('SELECT * FROM plays')).toEqual([]);
  });

  it('migration 0011 carries live level_stats over and leaves orphans', () => {
    const DB = createD1({ until: '0011' });
    DB.sql(
      "INSERT INTO levels (id, author, secret, words, created_at) VALUES ('abcd1234', 'a', 's', '[]', 1)",
    );
    DB.sql(
      "INSERT INTO dailies (date, secret, words, updated_at) VALUES ('2026-01-01', 's', '[]', 1)",
    );
    const row =
      'INSERT INTO level_stats (level_id, client_id, solved, updated_at) VALUES (?, ?, ?, 5)';
    DB.sql(row, 'abcd1234', 'x', 1);
    DB.sql(row, 'abcd1234', 'y', 0);
    DB.sql(row, '2026-01-01', 'x', 1);
    DB.sql(row, 'gone0000', 'x', 1);
    DB.migrate('0011');
    expect(DB.sql('SELECT * FROM puzzle_stats ORDER BY puzzle_id').map((r) => ({ ...r }))).toEqual([
      { puzzle_id: '2026-01-01', attempts: 1, successes: 1 },
      { puzzle_id: 'com-abcd1234', attempts: 2, successes: 1 },
    ]);
    expect(DB.sql("SELECT solved_at FROM plays WHERE player = 'c:y'")[0].solved_at).toBeNull();
    expect(DB.sql('SELECT COUNT(*) n FROM level_stats_legacy')[0].n).toBe(4);
  });
});
