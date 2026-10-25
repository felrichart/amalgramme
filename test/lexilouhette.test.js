import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildLevel,
  judge,
  keyOf,
  tierOf,
  wordPoints,
  scoreOf,
  maxScore,
  spotsOf,
  deBefore,
} from '../lab/lexilouhette/game.js';
import { LEVELS, levelByPattern, loadProgress } from '../lab/lexilouhette/levels.js';
import { useLexilouhette } from '../lab/lexilouhette/useLexilouhette.js';
import { pageTitles } from '../lab/lexilouhette/definitions.js';

const level = buildLevel({
  pattern: 'P_S_I__',
  words: [
    [26.3, 'piscine'],
    [20.6, 'passion'],
    [1.19, 'passive'],
    [0.275, 'passifs'],
  ],
});
const typeAll = (g, letters) => [...letters].forEach((ch) => g.type(ch));
const pts = (key) => level.answers.get(key).points;

describe('points', () => {
  it('rises on an S-curve from 25 for common words to 99 for the rarest', () => {
    expect([1000, 66, 30, 10, 1, 0.1, 0.01, 0.0013, 0].map(wordPoints)).toEqual([
      25, 25, 30, 38, 57, 75, 90, 99, 99,
    ]);
  });

  it('adds up every word found', () => {
    expect(scoreOf(level, ['PASSIFS', 'PISCINE'])).toBe(pts('PASSIFS') + pts('PISCINE'));
    expect(scoreOf(level, ['GONE'])).toBe(0);
    expect(maxScore(level)).toBe(scoreOf(level, [...level.answers.keys()]));
  });
});

describe('tierOf', () => {
  it('splits 25, 26–49, 50–74, 75–98 and 99', () => {
    expect([25, 26, 49, 50, 74, 75, 98, 99].map(tierOf)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
});

describe('spots', () => {
  it('gives each word a spot, alphabetical', () => {
    expect(spotsOf(level).map((a) => a.display)).toEqual([
      'passifs',
      'passion',
      'passive',
      'piscine',
    ]);
  });

  it('holds the spellings that differ by accents together, commonest first', () => {
    const gne = buildLevel({ pattern: '__GNE', words: [[0.483, 'cogne', 'cogné']] });
    expect(gne.answers.get('COGNE')).toMatchObject({
      display: 'cogne',
      spellings: ['cogne', 'cogné'],
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
    expect(g.spots.value.filter((s) => s.found).map((s) => s.display)).toEqual([
      'passion',
      'piscine',
    ]);
    expect(g.latest.value).toBe('PASSION');
    typeAll(g, 'icne');
    expect(g.latest.value).toBe('PISCINE');
  });

  it('accepts accented keys and ends once every spot is filled', async () => {
    const g = useLexilouhette(level);
    for (const letters of ['ícné', 'asôn', 'asve']) typeAll(g, letters);
    expect(g.exhausted.value).toBe(false);
    typeAll(g, 'asfs');
    expect(g.feedback.value.points).toBe(pts('PASSIFS'));
    expect(g.exhausted.value).toBe(true);
    expect(g.playing.value).toBe(false);
    await Promise.resolve();
    expect(loadProgress(level.pattern).found).toHaveLength(4);
  });
});

describe('levels', () => {
  it('ships levels of 10 to 25 words, each fitting its silhouette', () => {
    expect(LEVELS.length).toBeGreaterThan(500);
    expect(new Set(LEVELS.map((l) => l.pattern)).size).toBe(LEVELS.length);
    for (const l of LEVELS.map(buildLevel)) {
      const blanks = [...l.pattern].filter((p) => p === '_').length;
      expect(blanks).toBeLessThanOrEqual(l.pattern.length - blanks + 1);
      expect(l.pattern.length).toBeLessThanOrEqual(8);
      expect(l.answers.size).toBeGreaterThanOrEqual(10);
      expect(l.answers.size).toBeLessThanOrEqual(25);
      for (const a of l.answers.values()) {
        expect(a.key).toHaveLength(l.pattern.length);
        expect([...l.pattern].every((p, i) => p === '_' || p === a.key[i])).toBe(true);
        expect(a.spellings.every((s) => keyOf(s) === a.key)).toBe(true);
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
