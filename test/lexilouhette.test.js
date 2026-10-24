import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildLevel,
  judge,
  keyOf,
  tierOf,
  lemmaPoints,
  bonusPoints,
  earned,
  scoreOf,
  maxScore,
  familiesOf,
} from '../lab/lexilouhette/game.js';
import { LEVELS, loadProgress } from '../lab/lexilouhette/levels.js';
import { useLexilouhette } from '../lab/lexilouhette/useLexilouhette.js';

const level = buildLevel({
  date: '2000-01-01',
  pattern: 'P_S_I__',
  words: [
    ['piscine', 26.3, 'piscine', 26.3],
    ['passion', 20.6, 'passion', 20.6],
    ['passive', 1.19, 'passif', 1.5],
    ['passifs', 0.275, 'passif', 1.5],
    ['pussiez', 0.063, 'pouvoir', 2000],
  ],
});
const typeAll = (g, letters) => [...letters].forEach((ch) => g.type(ch));
const pts = (key) => level.answers.get(key);

describe('points', () => {
  it('gives a lemma 115 more points per tenfold drop below 100/million, within 100..500', () => {
    expect([1000, 100, 10, 1, 0.1, 0.001].map(lemmaPoints)).toEqual([100, 100, 215, 330, 445, 500]);
  });

  it('gives a word a 10..100 bonus for being rarer than its lemma, in steps of 5', () => {
    expect(bonusPoints(100, 100)).toBe(10);
    expect(bonusPoints(50, 100)).toBe(35);
    expect(bonusPoints(0.01, 100)).toBe(100);
  });

  it("credits a family's lemma once, to its first word found", () => {
    const { lemmaPoints: lemma } = pts('PASSIVE');
    const { bonus: a } = pts('PASSIVE');
    const { bonus: b } = pts('PASSIFS');
    expect(earned(level, [], 'PASSIVE')).toBe(lemma + a);
    expect(earned(level, ['PASSIVE'], 'PASSIFS')).toBe(b);
    expect(scoreOf(level, ['PASSIVE', 'PASSIFS'])).toBe(lemma + a + b);
    expect(scoreOf(level, ['PASSIFS', 'PASSIVE'])).toBe(lemma + a + b);
    expect(maxScore(level)).toBe(scoreOf(level, [...level.answers.keys()]));
  });

  it('groups found words by family, the first found leading', () => {
    // Newest first: passifs was found before passive.
    const families = familiesOf(level, ['PASSIVE', 'PISCINE', 'PASSIFS']);
    expect(families.map((f) => f.words.map((w) => w.display))).toEqual([
      ['passifs', 'passive'],
      ['piscine'],
    ]);
    expect(families[0].words.map((w) => w.lead)).toEqual([true, false]);
    // The lead comes first even when it isn't first alphabetically.
    const [passif] = familiesOf(level, ['PASSIFS', 'PASSIVE']);
    expect(passif.words.map((w) => w.display)).toEqual(['passive', 'passifs']);
    expect(familiesOf(level, [], true)).toHaveLength(4);
  });
});

describe('tierOf', () => {
  it('steps every 100 points, 500 and up sharing the last', () => {
    expect([100, 199, 200, 350, 499, 500, 600].map(tierOf)).toEqual([0, 0, 1, 2, 3, 4, 4]);
  });
});

describe('judge', () => {
  it('matches without accents and flags repeats', () => {
    expect(keyOf('Piscîne')).toBe('PISCINE');
    expect(judge(level, 'PISCINE', [])).toBe('new');
    expect(judge(level, 'PISCINE', ['PISCINE'])).toBe('dup');
    expect(judge(level, 'POSTIER', [])).toBe('unknown');
  });
});

describe('useLexilouhette', () => {
  beforeEach(() => localStorage.clear());

  it('types the blanks only and adds a found word', () => {
    const g = useLexilouhette(level);
    typeAll(g, 'icne');
    expect(g.state.found).toEqual(['PISCINE']);
    expect(g.score.value).toBe(pts('PISCINE').lemmaPoints + pts('PISCINE').bonus);
    expect(g.slots.value.filter((s) => !s.fixed).every((s) => s.ch == null)).toBe(true);
  });

  it('erases only the last letter of a rejected guess', () => {
    const g = useLexilouhette(level);
    typeAll(g, 'icnx');
    expect(g.rejected.value).toBe(true);
    g.backspace();
    expect(g.rejected.value).toBe(false);
    expect(g.slots.value.map((s) => s.ch).join('')).toBe('PISCIN');
    g.type('e');
    expect(g.state.found).toEqual(['PISCINE']);
  });

  it('lets a rejected guess be fixed in place', () => {
    const g = useLexilouhette(level);
    typeAll(g, 'xcne');
    g.moveTo(0);
    g.type('i');
    expect(g.state.found).toEqual(['PISCINE']);
  });

  it('starts over when typing on after a rejected guess', () => {
    const g = useLexilouhette(level);
    typeAll(g, 'aaaa');
    expect(g.feedback.value.kind).toBe('unknown');
    expect(g.rejected.value).toBe(true);
    g.type('a');
    expect(g.rejected.value).toBe(false);
    expect(g.slots.value[1].ch).toBe('A');
    expect(g.slots.value[3].ch).toBe(null);
  });

  it('shows families and highlights the latest word, or a retyped one', () => {
    const g = useLexilouhette(level);
    typeAll(g, 'icne');
    typeAll(g, 'asôn');
    expect(g.families.value.map((f) => f.words[0].display)).toEqual(['passion', 'piscine']);
    expect(g.latest.value).toBe('PASSION');
    typeAll(g, 'icne');
    expect(g.latest.value).toBe('PISCINE');
  });

  it('accepts accented keys and reports when every word is found', async () => {
    const g = useLexilouhette(level);
    for (const letters of ['ícné', 'asôn', 'asve', 'asfs', 'usez']) typeAll(g, letters);
    expect(g.exhausted.value).toBe(true);
    expect(g.playing.value).toBe(false);
    await Promise.resolve();
    expect(loadProgress(level.date).found).toHaveLength(5);
  });
});

describe('levels', () => {
  it('ships at least 20 levels of at least 10 words, each fitting its silhouette', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(20);
    for (const l of LEVELS) {
      expect(l.answers.size).toBeGreaterThanOrEqual(10);
      for (const key of l.answers.keys()) {
        expect(key).toHaveLength(l.pattern.length);
        expect([...l.pattern].every((p, i) => p === '_' || p === key[i])).toBe(true);
      }
    }
  });
});
