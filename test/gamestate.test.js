import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { useGameState } from '../src/composables/useGameState.js';

const KEY = 'amalgramme:v3:level:';
const DATE = '2026-07-07'; // secret "verre", word 0 = "vitre"

/* useGameState resolves the puzzle via the daily cache; seed it. */
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    'amalgramme:v3:dailies',
    JSON.stringify({
      levels: [{ date: DATE, secret: 'verre', words: ['vitre', 'gobelet', 'lunette', 'fragile'] }],
      fetchedAt: 1,
    }),
  );
});

async function typeWord(g, word) {
  for (const ch of word) g.typeLetter(ch);
  await nextTick();
}

describe('useGameState', () => {
  it('starts focused on the first word', () => {
    const g = useGameState(DATE);
    expect(g.state.focus).toBe('word');
    expect(g.state.wordIndex).toBe(0);
  });

  it('solves a word by typing it and advances focus to the next open word', async () => {
    const g = useGameState(DATE);
    await typeWord(g, g.words[0].text);
    expect(g.solved[0]).toBe(true);
    expect(g.state.focus).toBe('word');
    expect(g.state.wordIndex).toBe(1);
  });

  it('persists progress under the level date key', async () => {
    const g = useGameState(DATE);
    await typeWord(g, g.words[0].text);
    const saved = JSON.parse(localStorage.getItem(KEY + DATE));
    expect(saved.solved[0]).toBe(true);
  });

  it('resumes a persisted game across instances', async () => {
    const g1 = useGameState(DATE);
    await typeWord(g1, g1.words[0].text);
    const g2 = useGameState(DATE);
    expect(g2.solved[0]).toBe(true);
  });

  it('completes only when every word and the secret are found', async () => {
    const g = useGameState(DATE);
    for (let i = 0; i < g.words.length; i++) {
      g.activate(i);
      await typeWord(g, g.words[i].text);
    }
    expect(g.allSolved.value).toBe(true);
    expect(g.state.completed).toBe(false); // secret still missing
    expect(g.secretActive.value).toBe(true);

    for (const ch of g.secret.text) g.typeSecret(ch);
    await nextTick();
    expect(g.state.secretFound).toBe(true);
    expect(g.state.completed).toBe(true);
    expect(g.state.focus).toBe('none');
  });
});

describe('useGameState extra hint', () => {
  const HDATE = '2026-07-08';
  const seedHint = (hint) =>
    localStorage.setItem(
      'amalgramme:v3:dailies',
      JSON.stringify({
        levels: [
          {
            date: HDATE,
            secret: 'verre',
            words: ['vitre', 'gobelet', 'lunette', 'fragile'],
            ...(hint ? { hint } : {}),
          },
        ],
        fetchedAt: 1,
      }),
    );

  it('exposes the parsed hint and starts unrevealed', () => {
    seedHint('transparent');
    const g = useGameState(HDATE);
    expect(g.hasHint).toBe(true);
    expect(g.hint.text).toBe('transparent');
    expect(g.state.hintRevealed).toBe(false);
  });

  it('reveals and persists the hint across instances', async () => {
    seedHint('transparent');
    const g = useGameState(HDATE);
    g.revealHint();
    await nextTick();
    expect(g.state.hintRevealed).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY + HDATE)).hintRevealed).toBe(true);
    expect(useGameState(HDATE).state.hintRevealed).toBe(true);
  });

  it('has no hint and revealHint is a no-op when the puzzle carries none', () => {
    seedHint(null);
    const g = useGameState(HDATE);
    expect(g.hasHint).toBe(false);
    expect(g.hint).toBeNull();
    g.revealHint();
    expect(g.state.hintRevealed).toBe(false);
  });
});
