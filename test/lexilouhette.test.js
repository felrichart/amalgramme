import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildLevel,
  judge,
  keyOf,
  tierOf,
  wordPoints,
  scoreOf,
  earned,
  maxScore,
  familiesOf,
  deBefore,
} from '../lab/lexilouhette/game.js';
import { LEVELS, levelByPattern, loadProgress } from '../lab/lexilouhette/levels.js';
import { useLexilouhette } from '../lab/lexilouhette/useLexilouhette.js';
import { pageTitles } from '../lab/lexilouhette/definitions.js';

const level = buildLevel({
  pattern: 'P_S_I__',
  words: [
    [26.3, 'piscine', 'piscine'],
    [20.6, 'passion', 'passion'],
    [1.19, 'passif', [['passive', 'fém.']], [['passifs', 'plur.']]],
  ],
});
const typeAll = (g, letters) => [...letters].forEach((ch) => g.type(ch));
const pts = (key) => level.families[level.answers.get(key).family].points;

describe('points', () => {
  it('rises on an S-curve from 25 for common words to 99 for the rarest', () => {
    expect([1000, 66, 30, 10, 1, 0.1, 0.01, 0.0013, 0].map(wordPoints)).toEqual([
      25, 25, 30, 38, 57, 75, 90, 99, 99,
    ]);
  });

  it('counts each family once', () => {
    expect(scoreOf(level, ['PASSIFS', 'PASSIVE', 'PISCINE'])).toBe(pts('PASSIFS') + pts('PISCINE'));
    expect(scoreOf(level, ['GONE'])).toBe(0);
    expect(maxScore(level)).toBe(scoreOf(level, [...level.answers.keys()]));
  });

  it('gives nothing for a later find of a family', () => {
    expect(earned(level, ['PISCINE'], 'PASSIVE')).toBe(pts('PASSIVE'));
    expect(earned(level, ['PASSIFS'], 'PASSIVE')).toBe(0);
  });
});

describe('tierOf', () => {
  it('splits 25, 26–49, 50–74, 75–98 and 99', () => {
    expect([25, 26, 49, 50, 74, 75, 98, 99].map(tierOf)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
});

describe('families', () => {
  const rows = (f) => f.rows.map((r) => r.display);

  it('gives each family a spot, alphabetical, its finds first find first', () => {
    expect(familiesOf(level, []).map((f) => f.rows.length)).toEqual([0, 0, 0]);
    const [, passif] = familiesOf(level, ['PASSIFS', 'PISCINE', 'PASSIVE']);
    expect(rows(passif)).toEqual(['passive', 'passifs']);
    expect(passif.found).toBe(true);
  });

  it('lists every word once revealed, the found ones first', () => {
    const [, passif] = familiesOf(level, ['PASSIFS'], true);
    expect(passif.rows.map((r) => [r.display, r.found])).toEqual([
      ['passifs', true],
      ['passive', false],
    ]);
  });

  it('reads a word with its homonyms and their bases', () => {
    const gre = buildLevel({
      pattern: '__GRE_',
      words: [
        [
          3.32,
          'tigre',
          [
            ['tigres', 'plur.'],
            ['tigrés', 'part. passé plur.', 'tigrer'],
          ],
        ],
      ],
    });
    expect(gre.answers.get('TIGRES')).toEqual({
      key: 'TIGRES',
      display: 'tigres',
      family: 0,
      spellings: [
        { form: 'tigres', label: 'plur.', base: 'tigre' },
        { form: 'tigrés', label: 'part. passé plur.', base: 'tigrer' },
      ],
    });
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
    expect(g.score.value).toBe(pts('PISCINE'));
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
    expect(g.families.value.filter((f) => f.found).map((f) => f.rows[0].display)).toEqual([
      'passion',
      'piscine',
    ]);
    expect(g.latest.value).toBe('PASSION');
    typeAll(g, 'icne');
    expect(g.latest.value).toBe('PISCINE');
  });

  it('scores a family once and ends once every spot is filled', async () => {
    const g = useLexilouhette(level);
    for (const letters of ['ícné', 'asfs']) typeAll(g, letters);
    expect(g.feedback.value.points).toBe(pts('PASSIFS'));
    typeAll(g, 'asve');
    expect(g.feedback.value.points).toBe(0);
    expect(g.exhausted.value).toBe(false);
    typeAll(g, 'asôn');
    expect(g.exhausted.value).toBe(true);
    expect(g.playing.value).toBe(false);
    await Promise.resolve();
    expect(loadProgress(level.pattern).found).toHaveLength(4);
  });
});

describe('levels', () => {
  it('ships levels of 10 to 30 families, each word fitting its silhouette', () => {
    expect(LEVELS.length).toBeGreaterThan(500);
    expect(new Set(LEVELS.map((l) => l.pattern)).size).toBe(LEVELS.length);
    for (const l of LEVELS.map(buildLevel)) {
      const blanks = [...l.pattern].filter((p) => p === '_').length;
      expect(blanks).toBeGreaterThanOrEqual(2);
      expect(l.pattern.length - blanks).toBeGreaterThanOrEqual(2);
      expect(l.pattern.length).toBeLessThanOrEqual(7);
      expect(l.families.length).toBeGreaterThanOrEqual(10);
      expect(l.families.length).toBeLessThanOrEqual(30);
      for (const a of l.answers.values()) {
        expect(a.key).toHaveLength(l.pattern.length);
        expect([...l.pattern].every((p, i) => p === '_' || p === a.key[i])).toBe(true);
        expect(a.spellings.every((s) => keyOf(s.form) === a.key)).toBe(true);
      }
    }
  });

  it('plays a level by its pattern', () => {
    expect(levelByPattern(LEVELS[0].pattern).pattern).toBe(LEVELS[0].pattern);
    expect(levelByPattern('ZZZZZ')).toBe(null);
  });
});

describe('deBefore', () => {
  it('elides before a vowel', () => {
    expect(`${deBefore('fatigué')}fatigué`).toBe('de fatigué');
    expect(`${deBefore('aimer')}aimer`).toBe('d’aimer');
  });
});

describe('definitions', () => {
  it('looks a spelled-out œ up with its ligature first', () => {
    expect(pageTitles('soeur')).toEqual(['sœur', 'soeur']);
    expect(pageTitles('rumba')).toEqual(['rumba']);
  });
});
