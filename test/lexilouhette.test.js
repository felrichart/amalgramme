import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildLevel,
  judge,
  keyOf,
  tierOf,
  wordPoints,
  scoreOf,
  opens,
  maxScore,
  familiesOf,
  isDone,
  deBefore,
} from '../lab/lexilouhette/game.js';
import { BANK, bankLevel, loadProgress } from '../lab/lexilouhette/levels.js';
import {
  draftFrom,
  toggleRare,
  setMaster,
  ban,
  unban,
  bannedOf,
} from '../lab/lexilouhette/editor.js';
import { useLexilouhette } from '../lab/lexilouhette/useLexilouhette.js';
import { pageTitles } from '../lab/lexilouhette/definitions.js';

const level = buildLevel({
  pattern: 'P_S_I__',
  words: [
    [26.3, 'piscine', 'piscine'],
    [20.6, 'passion', 'passion'],
    [1.19, 'passif', [['passive', 'fém.']], [['passifs', 'plur.']]],
    [0.01, 'posting', 'posting'],
  ],
});
const typeAll = (g, letters) => [...letters].forEach((ch) => g.type(ch));

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

describe('families', () => {
  const rows = (f) => f.rows.map((r) => r.display);

  it('gives each family a spot, alphabetical, its finds first find first', () => {
    expect(familiesOf(level, []).map((f) => f.rows.length)).toEqual([0, 0, 0]);
    const [, passif] = familiesOf(level, ['PASSIFS', 'PISCINE', 'PASSIVE']);
    expect(rows(passif)).toEqual(['passive', 'passifs']);
    expect(passif.found).toBe(true);
  });

  it('numbers the normal spots and shows a rare one once found', () => {
    const spots = familiesOf(level, ['POSTING']);
    expect(spots.map((f) => [f.base, f.num])).toEqual([
      ['passion', 1],
      ['passif', 2],
      ['piscine', 3],
      ['posting', null],
    ]);
    expect(isDone(level, ['PISCINE', 'PASSION', 'PASSIVE'])).toBe(true);
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

describe('useLexilouhette', () => {
  beforeEach(() => localStorage.clear());

  it('types the blanks only and adds a found word', () => {
    const g = useLexilouhette(level);
    typeAll(g, 'icne');
    expect(g.state.found).toEqual(['PISCINE']);
    expect(g.score.value).toEqual({ normal: 1, rare: 0 });
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
    expect(g.feedback.value.opens).toBe(true);
    typeAll(g, 'asve');
    expect(g.feedback.value.opens).toBe(false);
    expect(g.score.value).toEqual({ normal: 2, rare: 0 });
    expect(g.exhausted.value).toBe(false);
    typeAll(g, 'asôn');
    expect(g.exhausted.value).toBe(true);
    expect(g.playing.value).toBe(false);
    await Promise.resolve();
    expect(loadProgress(level.pattern).found).toHaveLength(4);
  });

  it('starts a finished level over', async () => {
    const g = useLexilouhette(level);
    for (const letters of ['icne', 'asfs', 'asôn']) typeAll(g, letters);
    g.reveal();
    g.reset();
    expect(g.state.found).toEqual([]);
    expect(g.playing.value).toBe(true);
    expect(g.score.value).toEqual({ normal: 0, rare: 0 });
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
  });

  it('plays a level by its pattern', () => {
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
