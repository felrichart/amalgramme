import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildLevel,
  judge,
  keyOf,
  tierOf,
  wordPoints,
  progressOf,
  opens,
  listOf,
  deBefore,
  starSteps,
  kidsMax,
} from '../src/dicorama/game.js';
import BANK from '../src/dicorama/bank.json';
import { loadBank, bankLevel, loadProgress } from '../src/dicorama/levels.js';
import { draftFrom, setRare, setMaster, ban, unban, bannedOf } from '../src/dicorama/editor.js';
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

describe('progress', () => {
  it('counts the families found, rare ones too', () => {
    expect(progressOf(level, ['PASSIFS', 'PASSIVE', 'PISCINE'])).toEqual({
      score: 2,
      total: 3,
      rare: 0,
      rareTotal: 1,
      steps: [1, 2, 3],
      stars: 2,
      book: false,
    });
  });

  it('keeps rare words out of the score, winning the book once all are found', () => {
    const withRare = progressOf(level, ['POSTING', 'PISCINE']);
    expect(withRare).toMatchObject({ score: 1, rare: 1, stars: 1, book: true });
    const none = buildLevel({ pattern: 'P_S_I__', words: [[26.3, 'piscine', 'piscine']] });
    expect(progressOf(none, ['PISCINE']).book).toBe(false);
  });

  it('wins stars at a third of the list, two thirds, then all of it, rounding up', () => {
    expect(starSteps(11)).toEqual([4, 8, 11]);
    expect(starSteps(13)).toEqual([5, 9, 13]);
    expect(starSteps(21)).toEqual([7, 14, 21]);
    const stars = (found) => progressOf(level, found).stars;
    expect(stars(['POSTING'])).toBe(0);
    expect(stars(['POSTING', 'PISCINE'])).toBe(1);
    expect(stars(['PASSION', 'PISCINE'])).toBe(2);
    expect(stars(['PASSIVE', 'PASSION', 'PISCINE'])).toBe(3);
  });

  it("makes room for the list's longest sub-list", () => {
    expect(kidsMax(level)).toBe(1);
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

  const kids = (rows) => rows.flatMap((r) => r.kids.map((k) => [k.kind, k.spelling.form]));

  it('gives each family of the list a numbered spot, alphabetical', () => {
    expect(shown(listOf(level, []))).toEqual([
      ['main', 1, null, false],
      ['main', 2, null, false],
      ['main', 3, null, false],
    ]);
  });

  it('gives every common family a spot, a rare one showing once found', () => {
    const words = Array.from({ length: 12 }, (_, i) => {
      const word = `mot${String.fromCharCode(97 + i)}`;
      return [12 - i, word, word];
    });
    const many = buildLevel({ pattern: 'MOT_', words, rare: ['motl'] });
    expect(listOf(many, [])).toHaveLength(11);
    const rows = listOf(many, ['MOTL']);
    expect(rows).toHaveLength(12);
    expect(shown(rows).at(-1)).toEqual(['rare', null, 'motl', true]);
    expect(progressOf(many, ['MOTL'])).toMatchObject({ score: 0, rare: 1, total: 11 });
  });

  it("fills a spot with its first find, its family's later ones under it", () => {
    const rows = listOf(level, ['POSTING', 'PASSIFS', 'PISCINE', 'PASSIVE']);
    expect(shown(rows)).toEqual([
      ['main', 1, null, false],
      ['main', 2, 'passive', true],
      ['main', 3, 'piscine', true],
      ['rare', null, 'posting', true],
    ]);
    expect(kids(rows)).toEqual([['variant', 'passifs']]);
    expect(rows[1].keys).toEqual(['PASSIVE', 'PASSIFS']);
  });

  it("lists a word's homonyms before its family's later finds", () => {
    const tigre = buildLevel({
      pattern: '__GRE_',
      words: [
        [
          3.32,
          'tigre',
          [
            ['tigres', 'plur.'],
            ['tigrés', 'part. passé plur.', 'tigrer', 0.252],
          ],
          [['tigrer', 'inf.']],
        ],
      ],
    });
    expect(kids(listOf(tigre, ['TIGRER', 'TIGRES']))).toEqual([
      ['homonym', 'tigrés'],
      ['variant', 'tigrer'],
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
    expect(g.progress.value.score).toBe(1);
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

  it('scores a family once, three stars with the list, the book with the rares', async () => {
    const g = useDicorama(level);
    for (const letters of ['ícné', 'asfs', 'asve']) typeAll(g, letters);
    expect(g.progress.value.score).toBe(2);
    expect(g.celebration.value).toBe('two');
    g.dismiss();
    typeAll(g, 'asôn');
    expect(g.progress.value.stars).toBe(3);
    expect(g.celebration.value).toBe('all');
    g.dismiss();
    typeAll(g, 'otng');
    expect(g.progress.value.score).toBe(3);
    // A rare word takes longer to land, in its box.
    expect(g.celebration.value).toBe(null);
    vi.advanceTimersByTime(1000);
    expect(g.celebration.value).toBe('book');
    await Promise.resolve();
    expect(loadProgress(level.pattern).found).toHaveLength(5);
  });

  it('celebrates a star, then shows it once that is over', () => {
    const g = useDicorama(level);
    expect(g.greeted.value).toEqual({ stars: 0, book: false });
    [...'icne'].forEach((ch) => g.type(ch));
    vi.advanceTimersByTime(1200);
    expect(g.progress.value.stars).toBe(1);
    expect(g.celebration.value).toBe(null);
    vi.advanceTimersByTime(800);
    expect(g.celebration.value).toBe('one');
    expect(g.greeted.value.stars).toBe(0);
    g.dismiss();
    expect(g.greeted.value.stars).toBe(1);
  });

  it('knows once a full word is typed, found or not, until it starts over', () => {
    const g = useDicorama(level);
    [...'xxx'].forEach((ch) => g.type(ch));
    expect(g.typed.value).toBe(false);
    typeAll(g, 'xxxx');
    expect(g.typed.value).toBe(true);
    g.reset();
    expect(g.typed.value).toBe(false);
  });

  it('starts over', async () => {
    const g = useDicorama(level);
    typeAll(g, 'icne');
    expect(g.state.found).toEqual(['PISCINE']);
    g.reset();
    expect(g.state.found).toEqual([]);
    await Promise.resolve();
    expect(loadProgress(level.pattern)).toEqual({ found: [] });
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
    expect(draftFrom(tigre)).toEqual({
      ...tigre,
      rare: ['ogre'],
      banned: [],
      reasons: {},
      conjugated: [],
    });
    expect(setRare(draftFrom(tigre), 'ogre', false).rare).toEqual([]);
    expect(setRare(draftFrom(tigre), 'tigre', true).rare).toEqual(['ogre', 'tigre']);
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
    expect(judge(built, 'OGRES', [])).toBe('invalid');
  });

  it('tells why a banned word or a verb form is no answer', () => {
    const draft = ban(
      { ...draftFrom(tigre), conjugated: ['TIGRAIT'] },
      'OGRES',
      'ogres',
      'offensive',
    );
    const built = buildLevel(draft);
    expect(judge(built, 'OGRES', [])).toBe('offensive');
    expect(judge(built, 'TIGRAIT', [])).toBe('conj');
    expect(bannedOf(draft).map((sp) => sp.reason)).toEqual(['offensive']);
    expect(unban(draft, 'ogres').reasons).toEqual({});
    // Banned before reasons existed.
    expect(judge(buildLevel({ ...tigre, banned: ['ogres'] }), 'OGRES', [])).toBe('invalid');
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
