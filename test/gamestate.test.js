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

describe('useGameState help reveals', () => {
  const totalRevealed = (g) => g.revealed.reduce((a, b) => a + b, 0);

  it('starts with 3 word reveals available (secret needs solved words first)', async () => {
    const g = useGameState(DATE);
    expect(g.helpLeft.value).toBe(3);
    expect(g.canRevealWord.value).toBe(true);
    expect(g.canRevealSecret.value).toBe(true);
    g.useHelp('word');
    await nextTick();
    expect(totalRevealed(g)).toBe(1);
    expect(g.helpLeft.value).toBe(2);
    const saved = JSON.parse(localStorage.getItem(KEY + DATE));
    expect(saved.helpUsed).toBe(1);
    expect(saved.revealed.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it('caps at 3 reveals, then disables both and does nothing', () => {
    const g = useGameState(DATE);
    g.useHelp('word');
    g.useHelp('word');
    g.useHelp('word');
    expect(g.helpLeft.value).toBe(0);
    expect(g.canRevealWord.value).toBe(false);
    expect(g.canRevealSecret.value).toBe(false);
    g.useHelp('word');
    expect(g.helpLeft.value).toBe(0);
  });

  it('reveals a secret letter on demand and leaves words untouched', async () => {
    const g = useGameState(DATE);
    g.useHelp('secret');
    await nextTick();
    expect(g.state.secretReveal).toBe(1);
    expect(totalRevealed(g)).toBe(0);
  });

  it('disables the secret reveal once the secret is found', async () => {
    const g = useGameState(DATE);
    for (let i = 0; i < g.words.length; i++) {
      g.activate(i);
      await typeWord(g, g.words[i].text);
    }
    for (const ch of g.secret.text) g.typeSecret(ch);
    await nextTick();
    expect(g.state.secretFound).toBe(true);
    expect(g.canRevealSecret.value).toBe(false);
    expect(g.canRevealWord.value).toBe(false);
  });

  it('pre-traces the revealed letters onto the active wheel and locks them', () => {
    const g = useGameState(DATE); // focused on word 0 = "vitre"
    g.useHelp('word'); // deterministic first pick is word 0
    expect(g.revealed[0]).toBe(1);
    /* The reveal seeds the path so the leading letter is already drawn. */
    expect(g.current.value).toBe('v');
    /* And can't be undone: backspace never eats the revealed prefix. */
    g.backspace();
    expect(g.current.value).toBe('v');
    /* The player only extends it. */
    for (const ch of 'itre') g.typeLetter(ch);
    expect(g.solved[0]).toBe(true);
  });

  it('pre-fills the revealed secret letters as locked input', () => {
    const g = useGameState(DATE); // secret "verre"
    g.useHelp('secret');
    expect(g.state.secretReveal).toBe(1);
    expect(g.secretInput.value).toBe('v');
  });

  it('does not double a revealed secret letter an old save had already typed', () => {
    /* Pre-feature saves stored revealed letters as typed picks (ghosts, not
     * auto-filled), so the prefix must not re-add them. */
    localStorage.setItem(
      KEY + DATE,
      JSON.stringify({
        solved: [false, false, false, false],
        secretReveal: 2,
        secretPicks: [
          { r: 0, id: 0, ch: 'v' },
          { r: 0, id: 1, ch: 'e' },
        ],
      }),
    );
    const g = useGameState(DATE);
    expect(g.secretInput.value).toBe('ve');
  });

  it('loads legacy saves (extra-hint fields) without error', () => {
    localStorage.setItem(
      KEY + DATE,
      JSON.stringify({ solved: [false, false, false, false], hintRevealed: true, secretPicks: [] }),
    );
    const g = useGameState(DATE);
    expect(g.state.helpUsed).toBe(0);
    expect(g.revealed).toEqual([0, 0, 0, 0]);
  });
});
