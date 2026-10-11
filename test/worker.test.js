import { describe, it, expect } from 'vitest';
import worker from '../server/worker.js';
import { checkChallenge } from '../shared/word-rules.js';

const WORDS = ['soleil', 'plage', 'sable', 'vague'];

/* Minimal D1 stub: `users` maps username → pin; `rows` maps "table:value" → row for
 * existence checks. Records every executed statement. */
function fakeEnv({ users = {}, rows = {}, limited = false } = {}) {
  const runs = [];
  const prepare = (sql) => {
    let args = [];
    const stmt = {
      bind: (...a) => ((args = a), stmt),
      first: async () => {
        if (sql.startsWith('SELECT pin FROM users')) {
          return args[0] in users ? { pin: users[args[0]] } : null;
        }
        const m = sql.match(/FROM (\w+) WHERE/);
        return rows[`${m[1]}:${args[0]}`] ?? null;
      },
      run: async () => runs.push({ sql, args }),
      all: async () => ({ results: [] }),
    };
    return stmt;
  };
  return {
    runs,
    DB: { prepare },
    RATE_LIMITER: { limit: async () => ({ success: !limited }) },
  };
}

function call(env, method, path, body) {
  const init = { method };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  return worker.fetch(new Request(`https://api.test${path}`, init), env);
}

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

describe('worker routes', () => {
  it('answers CORS preflight and 404s unknown routes', async () => {
    const env = fakeEnv();
    expect((await call(env, 'OPTIONS', '/levels')).status).toBe(200);
    const res = await call(env, 'GET', '/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('auth: rejects bad json, unknown names and wrong pins', async () => {
    const env = fakeEnv({ users: { bob: '1234' } });
    expect((await call(env, 'POST', '/auth', '{')).status).toBe(400);
    expect((await call(env, 'POST', '/auth', { author: 'al', pin: '1234' })).status).toBe(404);
    expect((await call(env, 'POST', '/auth', { author: 'bob', pin: '0000' })).status).toBe(403);
    expect((await call(env, 'POST', '/auth', { author: 'bob', pin: '1234' })).status).toBe(200);
  });

  it('auth inscription: refuses a taken name, creates a new one', async () => {
    const env = fakeEnv({ users: { bob: '1234' } });
    const taken = await call(env, 'POST', '/auth', {
      author: 'bob',
      pin: '1234',
      mode: 'inscription',
    });
    expect(await taken.json()).toEqual({ error: 'name_taken' });
    const ok = await call(env, 'POST', '/auth', { author: 'al', pin: '1234', mode: 'inscription' });
    expect(ok.status).toBe(200);
    expect(env.runs[0].sql).toMatch(/INSERT INTO users/);
  });

  it('POST /levels rate-limits before reading the body', async () => {
    const res = await call(fakeEnv({ limited: true }), 'POST', '/levels', '{');
    expect(res.status).toBe(429);
  });

  it('POST /levels creates a normalised level with a short id', async () => {
    const env = fakeEnv();
    const res = await call(env, 'POST', '/levels', {
      author: '  bob ',
      pin: '1234',
      words: WORDS,
      secret: 'SOL',
    });
    expect(res.status).toBe(201);
    const level = await res.json();
    expect(level).toMatchObject({ author: 'bob', secret: 'sol', words: WORDS });
    expect(level.id).toHaveLength(8);
  });

  it('dailies writes are admin-only', async () => {
    const env = fakeEnv({ users: { bob: '1234', 'cara+': '9999' } });
    const body = { pin: '1234', date: '2999-01-01', words: WORDS, secret: 'sol' };
    expect((await call(env, 'POST', '/dailies', { ...body, author: 'bob' })).status).toBe(403);
    expect((await call(env, 'POST', '/dailies', { ...body, author: 'x', pin: '1' })).status).toBe(
      400,
    );
    const ok = await call(env, 'POST', '/dailies', { ...body, author: 'cara+', pin: '9999' });
    expect(ok.status).toBe(201);
  });

  it('stats: records against the right table and 404s unknown puzzles', async () => {
    const env = fakeEnv({ rows: { 'dailies:2026-01-01': {} } });
    expect((await call(env, 'POST', '/dailies/2026-01-01/solve', {})).status).toBe(400);
    expect((await call(env, 'POST', '/levels/abc/attempt', { client: 'c' })).status).toBe(404);
    const ok = await call(env, 'POST', '/dailies/2026-01-01/solve', { client: 'c' });
    expect(ok.status).toBe(200);
    expect(env.runs[0].args.slice(0, 3)).toEqual(['2026-01-01', 'c', 1]);
  });
});
