import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildLevel,
  judge,
  keyOf,
  tierOf,
  wordPoints,
  scoreOf,
  opens,
  maxScore,
  listOf,
  isDone,
  deBefore,
} from '../src/dicorama/game.js';
import BANK from '../src/dicorama/bank.json';
import { loadBank, bankLevel, loadProgress } from '../src/dicorama/levels.js';
import { draftFrom, toggleRare, setMaster, ban, unban, bannedOf } from '../src/dicorama/editor.js';
import { useDicorama } from '../src/dicorama/useDicorama.js';
import { pageTitles } from '../src/dicorama/definitions.js';
import { dayColor, dayLabel, longDayLabel } from '../src/dicorama/days.js';

const level = buildLevel({
  pattern: 'P_S_I__',
  words: [
    [26.3, 'piscine', 'piscine'],
    [20.6, 'passion', 'passion'],
    [1.19, 'passif', [['passive', 'fém.']], [['passifs', 'plur.']]],
    [0.01, 'posting', 'posting'],
  ],
});
// Types a word's blanks and lets it be checked (and land, when found).
const typeAll = (g, letters) => {
  [...letters].forEach((ch) => g.type(ch));
  vi.advanceTimersByTime(2000);
};

describe('points', () => {
  it('rises on an S-curve from 25 for common words to 99 for the rarest', () => {
    expect([1000, 66, 30, 10, 1, 0.1, 0.01, 0.0013, 0].map(wordPoints)).toEqual([
      25, 25, 30, 38, 57, 75, 90, 99, 99,
    ]);
  });
});

describe('score', () => {
  it('counts the families found, normal and rare', () => {
    expect(scoreOf(level, ['PASSIFS', 'PASSIVE', 'PISCINE'])).toEqual({ normal: 2, rare: 0 });
    expect(scoreOf(level, ['POSTING', 'PISCINE'])).toEqual({ normal: 1, rare: 1 });
    expect(maxScore(level)).toBe(3);
  });

  it('makes families rare from 75 points, unless told which', () => {
    expect(level.families.map((f) => f.rare)).toEqual([false, false, false, true]);
    const told = buildLevel({ ...level, words: [[26.3, 'piscine', 'piscine']], rare: ['piscine'] });
    expect(told.families[0].rare).toBe(true);
  });

  it('counts only the first find of a family', () => {
    expect(opens(level, ['PISCINE'], 'PASSIVE')).toBe(true);
    expect(opens(level, ['PASSIFS'], 'PASSIVE')).toBe(false);
  });
});

describe('tierOf', () => {
  it('splits 25, 26–49, 50–74, 75–98 and 99', () => {
    expect([25, 26, 49, 50, 74, 75, 98, 99].map(tierOf)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
});

describe('list', () => {
  const shown = (rows) => rows.map((r) => [r.kind, r.num, r.answer?.display ?? null, r.found]);

  it('gives each normal family a numbered spot, alphabetical', () => {
    expect(shown(listOf(level, []))).toEqual([
      ['main', 1, null, false],
      ['main', 2, null, false],
      ['main', 3, null, false],
    ]);
    expect(isDone(level, ['PISCINE', 'PASSION', 'PASSIVE'])).toBe(true);
  });

  it('fills a spot with its first find, later ones and rares on rows of their own', () => {
    expect(shown(listOf(level, ['POSTING', 'PASSIFS', 'PISCINE', 'PASSIVE']))).toEqual([
      ['variant', null, 'passifs', true],
      ['main', 1, null, false],
      ['main', 2, 'passive', true],
      ['main', 3, 'piscine', true],
      ['rare', null, 'posting', true],
    ]);
  });

  it('shows the families still to find once revealed', () => {
    expect(shown(listOf(level, ['PASSIFS'], true))).toEqual([
      ['main', 1, 'passion', false],
      ['main', 2, 'passifs', true],
      ['main', 3, 'piscine', false],
      ['rare', null, 'posting', false],
    ]);
  });
});

describe('answers', () => {
  it('reads a word with its homonyms and their bases', () => {
    const gre = buildLevel({
      pattern: '__GRE_',
      words: [
        [
          3.32,
          'tigre',
          [
            ['tigres', 'plur.'],
            ['tigrés', 'part. passé plur.', 'tigrer', 0.252],
          ],
        ],
      ],
    });
    expect(gre.answers.get('TIGRES')).toEqual({
      key: 'TIGRES',
      display: 'tigres',
      family: 0,
      spellings: [
        { form: 'tigres', label: 'plur.', base: 'tigre', freq: 3.32 },
        { form: 'tigrés', label: 'part. passé plur.', base: 'tigrer', freq: 0.252 },
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

describe('useDicorama', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());
  const typed = (g) => g.slots.value.map((s) => s.ch ?? '_').join('');

  it('types the blanks only, checks a full word on its own and lands it', () => {
    const g = useDicorama(level);
    [...'icn'].forEach((ch) => g.type(ch));
    expect(typed(g)).toBe('PISCIN_');
    g.type('e');
    expect(g.state.found).toEqual([]);
    vi.advanceTimersByTime(400);
    expect(g.phase.value).toBe('flip');
    expect(g.cursor.value).toBe(null);
    vi.advanceTimersByTime(1200);
    expect(g.state.found).toEqual(['PISCINE']);
    expect(g.score.value).toEqual({ normal: 1, rare: 0 });
    expect(typed(g)).toBe('P_S_I__');
    expect(g.cursor.value).toBe(0);
  });

  it('keeps a rejected word, its cursor on the last blank to retype it', () => {
    const g = useDicorama(level);
    typeAll(g, 'icnx');
    expect(g.message.value).toBe('unknown');
    expect(g.shake.value).toBe(1);
    expect(g.cursor.value).toBe(3);
    g.type('e');
    expect(g.message.value).toBe(null);
    vi.advanceTimersByTime(2000);
    expect(g.state.found).toEqual(['PISCINE']);
  });

  it('retypes a picked blank, then goes back to the first empty one', () => {
    const g = useDicorama(level);
    typeAll(g, 'xcne');
    g.pick(0);
    g.type('i');
    vi.advanceTimersByTime(2000);
    expect(g.state.found).toEqual(['PISCINE']);
    ['a', 's'].forEach(g.type);
    g.pick(0);
    g.type('o');
    expect(typed(g)).toBe('POSSI__');
    expect(g.cursor.value).toBe(2);
  });

  it('erases the last letter, or all of them', () => {
    const g = useDicorama(level);
    ['i', 'c', 'n'].forEach(g.type);
    g.pick(0);
    g.backspace();
    expect(typed(g)).toBe('PISCI__');
    g.clear();
    expect(typed(g)).toBe('P_S_I__');
  });

  it('points at a word typed again', () => {
    const g = useDicorama(level);
    typeAll(g, 'icne');
    typeAll(g, 'asôn');
    expect(g.latest.value).toBe('PASSION');
    typeAll(g, 'icne');
    expect(g.message.value).toBe('dup');
    expect(g.latest.value).toBe('PISCINE');
    g.type('a');
    expect(g.latest.value).toBe('PASSION');
    vi.advanceTimersByTime(3000);
    expect(g.message.value).toBe(null);
  });

  it('scores a family once and is done once every spot is filled', async () => {
    const g = useDicorama(level);
    for (const letters of ['ícné', 'asfs', 'asve']) typeAll(g, letters);
    expect(g.score.value).toEqual({ normal: 2, rare: 0 });
    expect(g.done.value).toBe(false);
    typeAll(g, 'asôn');
    expect(g.done.value).toBe(true);
    expect(g.playing.value).toBe(true);
    await Promise.resolve();
    expect(loadProgress(level.pattern).found).toHaveLength(4);
  });

  it('stops at the solutions and starts over', async () => {
    const g = useDicorama(level);
    typeAll(g, 'icne');
    g.reveal();
    expect(g.playing.value).toBe(false);
    g.type('a');
    expect(typed(g)).toBe('P_S_I__');
    g.reset();
    expect(g.state.found).toEqual([]);
    expect(g.playing.value).toBe(true);
    await Promise.resolve();
    expect(loadProgress(level.pattern)).toEqual({ found: [], revealed: false });
  });
});

describe('levels', () => {
  it('ships levels of 10 to 25 families but the rarest, each word fitting its silhouette', () => {
    expect(BANK.length).toBeGreaterThan(500);
    expect(new Set(BANK.map((l) => l.pattern)).size).toBe(BANK.length);
    for (const l of BANK.map(buildLevel)) {
      const blanks = [...l.pattern].filter((p) => p === '_').length;
      expect(l.pattern.length === 4 ? [2] : [3, 4]).toContain(blanks);
      expect(l.pattern.length - blanks).toBeGreaterThanOrEqual(2);
      expect(l.pattern.length).toBeLessThanOrEqual(7);
      const counted = l.families.filter((f) => !f.rare).length;
      expect(counted).toBeGreaterThanOrEqual(10);
      expect(counted).toBeLessThanOrEqual(25);
      for (const a of l.answers.values()) {
        expect(a.key).toHaveLength(l.pattern.length);
        expect([...l.pattern].every((p, i) => p === '_' || p === a.key[i])).toBe(true);
        expect(a.spellings.every((s) => keyOf(s.form) === a.key)).toBe(true);
      }
    }
    // Builds every level of the bank: slow.
  }, 30_000);

  it('plays a level by its pattern', async () => {
    await loadBank();
    expect(bankLevel(BANK[0].pattern).pattern).toBe(BANK[0].pattern);
    expect(bankLevel('ZZZZZ')).toBe(null);
  });
});

describe('editor', () => {
  const tigre = {
    pattern: '__GRE_',
    words: [
      [
        3.32,
        'tigre',
        [
          ['tigres', 'plur.'],
          ['tigrés', 'part. passé plur.', 'tigrer', 0.252],
        ],
      ],
      [0.001, 'ogre', [['ogres', 'plur.']]],
    ],
  };

  it('starts from a bank level and its rare families', () => {
    expect(draftFrom(tigre)).toEqual({ ...tigre, rare: ['ogre'], banned: [] });
    expect(toggleRare(draftFrom(tigre), 'ogre').rare).toEqual([]);
    expect(toggleRare(draftFrom(tigre), 'tigre').rare).toEqual(['ogre', 'tigre']);
  });

  it('moves a word into the family of its new master', () => {
    const draft = setMaster(draftFrom(tigre), 'TIGRES', 'tigrés');
    expect(draft.words).toEqual([
      [0.001, 'ogre', [['ogres', 'plur.']]],
      [
        0.252,
        'tigrer',
        [
          ['tigrés', 'part. passé plur.'],
          ['tigres', 'plur.', 'tigre', 3.32],
        ],
      ],
    ]);
    const back = setMaster(draft, 'TIGRES', 'tigres');
    expect(back.words).toEqual([tigre.words[1], tigre.words[0]]);
  });

  it('bans a spelling, its next one taking over as master', () => {
    const draft = ban(draftFrom(tigre), 'TIGRES', 'tigres');
    expect(draft.banned).toEqual(['tigres']);
    const built = buildLevel(draft);
    expect(built.families.map((f) => f.base)).toEqual(['ogre', 'tigrer']);
    expect(built.answers.get('TIGRES').spellings.map((sp) => sp.form)).toEqual(['tigrés']);
    expect(bannedOf(draft).map((sp) => [sp.form, sp.key])).toEqual([['tigres', 'TIGRES']]);
    expect(buildLevel(unban(draft, 'tigres')).answers.get('TIGRES').spellings).toHaveLength(2);
  });

  it('drops a word and its family once all their spellings are banned', () => {
    const draft = ban(draftFrom(tigre), 'OGRES', 'ogres');
    const built = buildLevel(draft);
    expect(built.families.map((f) => [f.id, f.base])).toEqual([[0, 'tigre']]);
    expect(judge(built, 'OGRES', [])).toBe('unknown');
  });

  it('drops a family left empty from the rare ones', () => {
    const rare = { ...draftFrom(tigre), rare: ['tigre'] };
    expect(setMaster(rare, 'TIGRES', 'tigrés').rare).toEqual([]);
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

describe('days', () => {
  it('colours and names a day', () => {
    expect(dayColor('2026-11-02')).toBe('#2f4ad6');
    expect(dayColor('2026-11-08')).toBe('#cc3a9e');
    expect(dayLabel('2026-11-07')).toBe('07 novembre');
    expect(longDayLabel('2026-11-07')).toBe('samedi 7 novembre');
  });
});
