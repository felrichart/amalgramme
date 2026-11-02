import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildLevel,
  judge,
  keyOf,
  tierOf,
  wordPoints,
  progressOf,
  listOf,
  deBefore,
  defaultClues,
  storedSpelling,
} from '../src/dicorama/game.js';
import BANK from '../src/dicorama/bank.json';
import { loadBank, bankLevel, loadProgress } from '../src/dicorama/levels.js';
import {
  draftFrom,
  setRiddle,
  setClue,
  validOf,
  setMaster,
  ban,
  unban,
  bannedOf,
} from '../src/dicorama/editor.js';
import { useDicorama } from '../src/dicorama/useDicorama.js';
import { pageTitles } from '../src/dicorama/definitions.js';
import { dayColor, dayLabel, longDayLabel } from '../src/dicorama/days.js';

const level = buildLevel({
  pattern: 'P_S_I__',
  words: [
    ['piscine', 26.3, 30],
    ['passion', 20.6, 25],
    ['passive', 1.19, 2, 'fém.', 'passif'],
    ['passifs', 0.5, 2, 'plur.', 'passif'],
    ['posting', 0.01, 0.01],
  ],
  clues: { PISCINE: 'Bassin', PASSION: 'Amour ardent' },
});
const tigre = {
  pattern: '__GRE_',
  words: [
    ['tigres', 3, 3.32, 'plur.', 'tigre'],
    ['tigrés', 0.2, 0.252, 'part. passé plur.', 'tigrer'],
    ['ogres', 0.001, 0.002, 'plur.', 'ogre'],
  ],
  clues: { TIGRES: 'Félins rayés' },
};
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

describe('tierOf', () => {
  it('splits 25, 26–49, 50–74, 75–98 and 99', () => {
    expect([25, 26, 49, 50, 74, 75, 98, 99].map(tierOf)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
});

describe('answers', () => {
  it('reads a word with its homonyms, its clue and its base rarity', () => {
    const built = buildLevel(tigre);
    expect(built.answers.get('TIGRES')).toEqual({
      key: 'TIGRES',
      display: 'tigres',
      freq: 3,
      points: wordPoints(3.32),
      clue: 'Félins rayés',
      spellings: [
        { form: 'tigres', freq: 3, baseFreq: 3.32, label: 'plur.', base: 'tigre' },
        { form: 'tigrés', freq: 0.2, baseFreq: 0.252, label: 'part. passé plur.', base: 'tigrer' },
      ],
    });
    expect(built.answers.get('OGRES').clue).toBe(null);
    expect(built.riddles).toEqual(['TIGRES']);
  });

  it('stores a spelling short when it is its own base', () => {
    expect(storedSpelling({ form: 'perle', freq: 13, baseFreq: 14 })).toEqual(['perle', 13, 14]);
    const perlé = { form: 'perlé', freq: 1, baseFreq: 2, label: 'part. passé', base: 'perler' };
    expect(storedSpelling(perlé)).toEqual(['perlé', 1, 2, 'part. passé', 'perler']);
  });

  it('picks the commonest words as riddles by default, a base each first', () => {
    const words = ['mota', 'motb', 'motc', 'motd', 'mote', 'motf', 'motg'].map((w, i) => [
      w,
      10 - i,
      10,
    ]);
    // Same base as mota: last pick.
    words[1] = ['motb', 9, 10, 'plur.', 'mota'];
    expect(Object.keys(defaultClues({ pattern: 'MOT_', words }))).toEqual([
      'MOTA',
      'MOTC',
      'MOTD',
      'MOTE',
      'MOTF',
      'MOTG',
    ]);
  });
});

describe('progress', () => {
  it('scores the riddles, counts the bonus words, the star with every riddle', () => {
    expect(progressOf(level, ['PASSIFS', 'PISCINE'])).toEqual({
      score: 1,
      total: 2,
      bonus: 1,
      bonusTotal: 3,
      star: false,
      trophy: false,
    });
    expect(progressOf(level, ['PASSION', 'PISCINE'])).toMatchObject({ star: true, trophy: false });
  });

  it('wins the trophy with every word', () => {
    const all = ['PISCINE', 'PASSION', 'PASSIVE', 'PASSIFS', 'POSTING'];
    expect(progressOf(level, all)).toMatchObject({ star: true, trophy: true, bonus: 3 });
  });

  it("counts a riddle's homonyms as a bonus word", () => {
    expect(progressOf(buildLevel(tigre), ['TIGRES'])).toMatchObject({
      score: 1,
      bonus: 1,
      bonusTotal: 2,
    });
  });
});

describe('list', () => {
  const shown = (rows) => rows.map((r) => [r.kind, r.num ?? null, r.answer.display, r.found]);

  it('gives each riddle a numbered spot with its clue, alphabetical', () => {
    const rows = listOf(level, []);
    expect(shown(rows)).toEqual([
      ['clue', 1, 'passion', false],
      ['clue', 2, 'piscine', false],
    ]);
    expect(rows.map((r) => r.clue)).toEqual(['Amour ardent', 'Bassin']);
  });

  it('lists the bonus words found apart, alphabetical', () => {
    const rows = listOf(level, ['POSTING', 'PISCINE', 'PASSIFS']);
    expect(shown(rows)).toEqual([
      ['clue', 1, 'passion', false],
      ['clue', 2, 'piscine', true],
      ['bonus', null, 'passifs', true],
      ['bonus', null, 'posting', true],
    ]);
  });

  it("puts a riddle's homonyms among the bonus words, a bonus word's under it", () => {
    const rows = listOf(buildLevel(tigre), ['TIGRES']);
    expect(rows[1]).toMatchObject({ kind: 'bonus', of: { key: 'TIGRES', display: 'tigres' } });
    expect(rows[1].answer.display).toBe('tigrés');
    expect(rows[1].keys).toEqual([]);
    const bonusWord = buildLevel({ ...tigre, clues: {} });
    const [row] = listOf(bonusWord, ['TIGRES']);
    expect(row.answer.display).toBe('tigres');
    expect(row.kids.map((k) => k.spelling.form)).toEqual(['tigrés']);
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

  it('erases the letter on the cursor, else the one before, else steps back', () => {
    const g = useDicorama(level);
    ['i', 'c', 'n'].forEach(g.type);
    g.backspace();
    expect(typed(g)).toBe('PISCI__');
    expect(g.cursor.value).toBe(2);
    g.pick(0);
    g.backspace();
    expect(typed(g)).toBe('P_SCI__');
    expect(g.cursor.value).toBe(0);
    g.pick(3);
    g.backspace();
    expect(typed(g)).toBe('P_SCI__');
    expect(g.cursor.value).toBe(2);
    g.backspace();
    expect(typed(g)).toBe('P_S_I__');
    expect(g.cursor.value).toBe(1);
    g.type('i');
    g.clear();
    expect(typed(g)).toBe('P_S_I__');
  });

  it('moves on after a letter, past an empty blank before it', () => {
    const g = useDicorama(level);
    g.pick(2);
    g.type('n');
    expect(g.cursor.value).toBe(3);
    g.type('e');
    expect(typed(g)).toBe('P_S_INE');
    expect(g.cursor.value).toBe(0);
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

  it('wins the star with the riddles, the trophy with every word', async () => {
    const g = useDicorama(level);
    for (const letters of ['ícné', 'asfs', 'asve', 'otng']) typeAll(g, letters);
    expect(g.progress.value).toMatchObject({ score: 1, bonus: 3 });
    expect(g.celebration.value).toBe(null);
    typeAll(g, 'asôn');
    expect(g.progress.value.score).toBe(2);
    expect(g.celebration.value).toBe('trophy');
    await Promise.resolve();
    expect(loadProgress(level.pattern).found).toHaveLength(5);
  });

  it('celebrates the star, then shows it once that is over', () => {
    const g = useDicorama(level);
    expect(g.greeted.value).toEqual({ star: false, trophy: false });
    typeAll(g, 'icne');
    [...'ason'].forEach((ch) => g.type(ch));
    vi.advanceTimersByTime(1200);
    expect(g.progress.value.star).toBe(true);
    expect(g.celebration.value).toBe(null);
    vi.advanceTimersByTime(800);
    expect(g.celebration.value).toBe('star');
    expect(g.greeted.value.star).toBe(false);
    g.dismiss();
    expect(g.greeted.value.star).toBe(true);
  });

  it('lands a bonus word in its box, taking longer', () => {
    const g = useDicorama(level);
    typeAll(g, 'icne');
    [...'asve'].forEach((ch) => g.type(ch));
    vi.advanceTimersByTime(1200);
    expect(g.state.found[0]).toBe('PASSIVE');
    expect(g.list.value.filter((r) => r.kind === 'bonus')).toHaveLength(1);
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
  it('ships levels of 10 to 30 words, each fitting its silhouette', () => {
    expect(BANK.length).toBeGreaterThan(500);
    expect(new Set(BANK.map((l) => l.pattern)).size).toBe(BANK.length);
    for (const l of BANK.map(buildLevel)) {
      const blanks = [...l.pattern].filter((p) => p === '_').length;
      expect([2, 3, 4]).toContain(blanks);
      expect(l.pattern.length - blanks).toBeGreaterThanOrEqual(2);
      expect(l.pattern.length).toBeGreaterThanOrEqual(4);
      expect(l.pattern.length).toBeLessThanOrEqual(9);
      expect(l.answers.size).toBeGreaterThanOrEqual(10);
      expect(l.answers.size).toBeLessThanOrEqual(30);
      for (const a of l.answers.values()) {
        expect(a.key).toHaveLength(l.pattern.length);
        expect([...l.pattern].every((p, i) => p === '_' || p === a.key[i])).toBe(true);
        expect(a.spellings.every((s) => keyOf(s.form) === a.key)).toBe(true);
      }
    }
    // Builds every level of the bank: slow.
  }, 60_000);

  it('plays a bank level by its pattern, with its default riddles', async () => {
    await loadBank();
    const l = bankLevel(BANK[0].pattern);
    expect(l.pattern).toBe(BANK[0].pattern);
    expect(l.riddles).toHaveLength(6);
    expect(bankLevel('ZZZZZ')).toBe(null);
  });
});

describe('editor', () => {
  const bank = { pattern: tigre.pattern, words: tigre.words };

  it('starts from a bank level, its commonest words as riddles to clue', () => {
    expect(draftFrom(bank)).toEqual({
      ...bank,
      clues: { TIGRES: '', OGRES: '' },
      banned: [],
      reasons: {},
      conjugated: [],
    });
    expect(draftFrom(tigre).clues).toEqual(tigre.clues);
  });

  it('makes a word a riddle or a bonus word, keeping its clue while a riddle', () => {
    let draft = setClue(draftFrom(tigre), 'TIGRES', 'Rayés');
    draft = setRiddle(draft, 'OGRES', true);
    expect(draft.clues).toEqual({ TIGRES: 'Rayés', OGRES: '' });
    expect(setRiddle(draft, 'TIGRES', false).clues).toEqual({ OGRES: '' });
    expect(setRiddle(draft, 'TIGRES', true).clues.TIGRES).toBe('Rayés');
  });

  it('validates 6 to 12 riddles, each clued', () => {
    const words = Array.from({ length: 13 }, (_, i) => {
      const w = `mot${String.fromCharCode(97 + i)}`;
      return [w, 1, 1];
    });
    const clued = (n, clue = 'indice') =>
      Object.fromEntries(words.slice(0, n).map(([w]) => [keyOf(w), clue]));
    const draft = (clues) => ({ pattern: 'MOT_', words, clues });
    expect(validOf(draft(clued(5)))).toBe(false);
    expect(validOf(draft(clued(6)))).toBe(true);
    expect(validOf(draft(clued(12)))).toBe(true);
    expect(validOf(draft(clued(13)))).toBe(false);
    expect(validOf(draft(clued(6, ' ')))).toBe(false);
  });

  it('changes the master spelling of a word', () => {
    const draft = setMaster(draftFrom(tigre), 'TIGRES', 'tigrés');
    expect(draft.words.map(([form]) => form)).toEqual(['tigrés', 'tigres', 'ogres']);
    expect(buildLevel(draft).answers.get('TIGRES').display).toBe('tigrés');
  });

  it('bans a spelling, its next one taking over as master', () => {
    const draft = ban(draftFrom(tigre), 'tigres');
    expect(draft.banned).toEqual(['tigres']);
    const built = buildLevel(draft);
    expect(built.answers.get('TIGRES').spellings.map((sp) => sp.form)).toEqual(['tigrés']);
    expect(bannedOf(draft).map((sp) => [sp.form, sp.key])).toEqual([['tigres', 'TIGRES']]);
    expect(buildLevel(unban(draft, 'tigres')).answers.get('TIGRES').spellings).toHaveLength(2);
  });

  it('tells why a banned word or a verb form is no answer', () => {
    const draft = ban({ ...draftFrom(tigre), conjugated: ['TIGRAIT'] }, 'ogres', 'offensive');
    const built = buildLevel(draft);
    expect(built.answers.has('OGRES')).toBe(false);
    expect(judge(built, 'OGRES', [])).toBe('offensive');
    expect(judge(built, 'TIGRAIT', [])).toBe('conj');
    expect(bannedOf(draft).map((sp) => sp.reason)).toEqual(['offensive']);
    expect(unban(draft, 'ogres').reasons).toEqual({});
    expect(judge(buildLevel({ ...tigre, banned: ['ogres'] }), 'OGRES', [])).toBe('invalid');
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
