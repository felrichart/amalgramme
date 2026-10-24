import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildLevel,
  judge,
  keyOf,
  tierOf,
  lemmaPoints,
  earned,
  scoreOf,
  maxScore,
  familiesOf,
  wordHint,
} from '../lab/lexilouhette/game.js';
import { LEVELS, ALL, levelByPattern, loadProgress } from '../lab/lexilouhette/levels.js';
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
  it('gives a lemma about 92 more points per tenfold drop, easing towards 100 when common', () => {
    expect([20000, 2000, 200, 20, 2, 0.01].map(lemmaPoints)).toEqual([
      100, 105, 120, 185, 270, 480,
    ]);
  });

  it("credits a family's points once, to its first word found", () => {
    const points = pts('PASSIVE').points;
    expect(earned(level, [], 'PASSIVE')).toBe(points);
    expect(earned(level, ['PASSIVE'], 'PASSIFS')).toBe(0);
    expect(scoreOf(level, ['PASSIFS', 'PASSIVE'])).toBe(points);
    expect(maxScore(level)).toBe(scoreOf(level, [...level.answers.keys()]));
  });

  it('gives each family one spot, filled by its first find', () => {
    // Newest first: passive was found before passifs.
    const families = familiesOf(level, ['PISCINE', 'PASSIFS', 'PASSIVE']);
    expect(families.map((f) => f.main.display)).toEqual([
      'passion',
      'passive',
      'piscine',
      'pussiez',
    ]);
    const passif = families[1];
    expect(passif.lead.key).toBe('PASSIVE');
    expect(passif.extras.map((w) => w.key)).toEqual(['PASSIFS']);
    expect(families[0]).toMatchObject({ lead: null, extras: [] });
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
    expect(g.score.value).toBe(pts('PISCINE').points);
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

  it('fills spots and highlights the latest word, or a retyped one', () => {
    const g = useLexilouhette(level);
    typeAll(g, 'icne');
    typeAll(g, 'asôn');
    const found = g.families.value.filter((f) => f.lead);
    expect(found.map((f) => f.lead.display)).toEqual(['passion', 'piscine']);
    expect(g.latest.value).toBe('PASSION');
    typeAll(g, 'icne');
    expect(g.latest.value).toBe('PISCINE');
  });

  it('accepts accented keys and ends once every spot is filled', async () => {
    const g = useLexilouhette(level);
    for (const letters of ['ícné', 'asôn', 'asve']) typeAll(g, letters);
    typeAll(g, 'asfs');
    expect(g.feedback.value.points).toBe(0);
    expect(g.exhausted.value).toBe(false);
    typeAll(g, 'usez');
    expect(g.exhausted.value).toBe(true);
    expect(g.playing.value).toBe(false);
    await Promise.resolve();
    expect(loadProgress(level.date).found).toHaveLength(5);
  });
});

describe('levels', () => {
  it('ships at least 20 levels of 10 to 25 families, each word fitting its silhouette', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(20);
    for (const l of LEVELS) {
      const blanks = [...l.pattern].filter((p) => p === '_').length;
      expect(blanks).toBeLessThanOrEqual(l.pattern.length - blanks + 1);
      expect(l.pattern.length).toBeLessThanOrEqual(8);
      const spots = familiesOf(l, []).length;
      expect(spots).toBeGreaterThanOrEqual(10);
      expect(spots).toBeLessThanOrEqual(25);
      for (const key of l.answers.keys()) {
        expect(key).toHaveLength(l.pattern.length);
        expect([...l.pattern].every((p, i) => p === '_' || p === key[i])).toBe(true);
      }
    }
  });

  it('lists every candidate level, each playable by its pattern', () => {
    expect(ALL.length).toBeGreaterThan(LEVELS.length);
    expect(new Set(ALL.map((l) => l.pattern)).size).toBe(ALL.length);
    const level = levelByPattern(ALL[0].pattern);
    expect(level.date).toBe(ALL[0].pattern);
    expect(familiesOf(level, []).length).toBeGreaterThanOrEqual(10);
    expect(levelByPattern('ZZZZZ')).toBe(null);
  });
});

describe('word hint', () => {
  const hint = (display, lemma) => {
    const h = wordHint({ display, lemma });
    return `${h.lead}${h.lemma}`;
  };

  it('names the lemma, elided and without its verb mark, or the word alone', () => {
    expect(hint('tomberas', 'tomber')).toBe('de tomber');
    expect(hint('aimons', 'aimer (verbe)')).toBe('d’aimer');
    expect(hint('rumba', 'rumba')).toBe('rumba');
  });
});
