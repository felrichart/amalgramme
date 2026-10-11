import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pickSave } from '../shared/progress.js';

vi.mock('../src/config.js', () => ({ API_URL: 'https://api.test', CACHE_MS: 0 }));

const { setSession, clearSession } = await import('../src/composables/useAccount.js');
const { afterSignIn, afterSignOut, prompt, answerPrompt } = await import('../src/services/sync.js');
const { allSaves, writeSave } = await import('../src/data/progress.js');

const save = (found, extra = {}) => ({
  solved: [0, 1, 2, 3].map((i) => i < found),
  secretFound: false,
  completed: false,
  ...extra,
});

/* Fake /progress endpoint over an in-memory account set, merging like the Worker. */
let account;
let posts;
beforeEach(() => {
  localStorage.clear();
  clearSession();
  account = {};
  posts = 0;
  globalThis.fetch = vi.fn(async (_url, { method, body }) => {
    if (method === 'POST') {
      posts++;
      for (const [id, s] of Object.entries(JSON.parse(body).saves))
        account[id] = pickSave(account[id], s);
    }
    return new Response(JSON.stringify(account));
  });
});

const signIn = (name = 'bob') => setSession('tok', { username: name });

describe('pickSave', () => {
  it('prefers the more advanced save, then the newer one', () => {
    expect(pickSave(save(1, { updatedAt: 9 }), save(2, { updatedAt: 1 })).solved[1]).toBe(true);
    expect(pickSave(save(4), save(1, { completed: true })).completed).toBe(true);
    expect(pickSave(save(1, { updatedAt: 1 }), save(1, { updatedAt: 2 })).updatedAt).toBe(2);
    expect(pickSave(null, { bad: 1 })).toBeNull();
  });
});

describe('sync on sign-in', () => {
  it('silently pushes device progress into an empty account', async () => {
    writeSave('2026-01-01', save(2));
    signIn();
    await afterSignIn();
    expect(prompt.value).toBeNull();
    expect(Object.keys(account)).toEqual(['2026-01-01']);
  });

  it('asks before adding foreign progress; "Ajouter" merges it', async () => {
    writeSave('2026-01-01', save(2));
    account = { '2026-01-02': save(4, { completed: true }) };
    signIn();
    const done = afterSignIn();
    await vi.waitFor(() => expect(prompt.value?.count).toBe(1));
    answerPrompt(true);
    await done;
    expect(Object.keys(account).sort()).toEqual(['2026-01-01', '2026-01-02']);
    expect(Object.keys(allSaves()).sort()).toEqual(['2026-01-01', '2026-01-02']);
  });

  it('"Non" swaps in the account and restores the device saves on logout', async () => {
    writeSave('2026-01-01', save(2));
    account = { '2026-01-02': save(4, { completed: true }) };
    signIn();
    const done = afterSignIn();
    await vi.waitFor(() => expect(prompt.value).not.toBeNull());
    answerPrompt(false);
    await done;
    expect(posts).toBe(0);
    expect(Object.keys(allSaves())).toEqual(['2026-01-02']);

    clearSession();
    afterSignOut();
    expect(Object.keys(allSaves())).toEqual(['2026-01-01']);
  });

  it('never asks again for the account the device mirrors', async () => {
    account = { '2026-01-02': save(1) };
    signIn();
    await afterSignIn();
    writeSave('2026-01-03', save(1)); // played while signed in, push pending
    await afterSignIn();
    expect(prompt.value).toBeNull();
    expect(account['2026-01-03']).toBeTruthy();
  });
});
