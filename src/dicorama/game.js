/*
 * Dicorama rules: a silhouette (`P_S_I__`) and every word that fits it.
 *
 * A word is what's typed (without accents): its master spelling, shown, and its
 * homonyms (tigres, tigrés), found together. A level's riddles are a few of its
 * words, each with a clue, a numbered spot each; the score counts them. Its other
 * words, and the riddles' homonyms, are bonus words, kept apart. Every riddle
 * found wins the star, every word found the trophy.
 */
import { normalizeChar } from '../../shared/word-rules.js';

export const BLANK = '_';
export const POINTS_MIN = 25;
export const POINTS_MAX = 99;
/* A base's points, its rarity on a scale (never shown to players), common below
 * RARE_POINTS: POINTS_MIN down to FREQ_COMMON (per million), POINTS_MAX from
 * FREQ_RARE, and in between they follow an S-curve of the word's rarity (its log
 * frequency): slow near both ends, fastest at CENTRE (0 = FREQ_COMMON, 1 =
 * FREQ_RARE), more so the higher STEEPNESS. Tuned so the bases of the 5 to
 * 7-letter levels split about 5/30/35/25/5 % across the tiers (`npm run
 * dicorama:levels` prints it). */
const FREQ_COMMON = 66;
const FREQ_RARE = 0.0013;
const STEEPNESS = 3.1;
const CENTRE = 0.36;
export const RARE_POINTS = 75;
// Tiers the points are tuned on, by their lowest points: 25, 26–49, 50–74, 75–98, 99.
const TIER_FLOORS = [POINTS_MIN, POINTS_MIN + 1, 50, RARE_POINTS, POINTS_MAX];
export const TIERS = TIER_FLOORS.length;

// Riddles per level.
export const CLUES_MIN = 6;
export const CLUES_MAX = 12;

export const keyOf = (word) => [...word].map(normalizeChar).join('').toUpperCase();

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
// The S-curve on [0, 1], stretched to go from 0 to 1.
const sCurve = (u) => {
  const at = (v) => sigmoid(STEEPNESS * (v - CENTRE));
  return (at(u) - at(0)) / (at(1) - at(0));
};

export function wordPoints(freq) {
  const rarity = Math.log10(FREQ_COMMON / Math.max(freq, 1e-9));
  const u = Math.min(1, Math.max(0, rarity / Math.log10(FREQ_COMMON / FREQ_RARE)));
  return Math.round(POINTS_MIN + (POINTS_MAX - POINTS_MIN) * sCurve(u));
}

export const tierOf = (pts) => TIER_FLOORS.findLastIndex((floor) => pts >= floor);

/* A tier's points, as "26–49" (or "25" for a single value). */
export function tierLabel(tier) {
  const low = TIER_FLOORS[tier];
  const high = (TIER_FLOORS[tier + 1] ?? POINTS_MAX + 1) - 1;
  return low === high ? `${low}` : `${low}–${high}`;
}

/* A spelling as a level stores it (see buildLevel). */
export function storedSpelling({ form, freq, baseFreq, label = '', base = form }) {
  if (base !== form) return [form, freq, baseFreq, label, base];
  return label ? [form, freq, baseFreq, label] : [form, freq, baseFreq];
}

const spellingOf = ([form, freq, baseFreq, label = '', base = form]) => ({
  form,
  freq,
  baseFreq,
  label,
  base,
});

/*
 * A level as bank.json (and the Worker) stores it: `words`, every spelling as
 * `[form, freq, baseFreq, label, base]` (as common as `freq`, per million; its
 * base as common as `baseFreq`, all its forms counted), `label` ("fém. plur.")
 * and `base` left out when empty or the form itself. Spellings typed alike make
 * a word, the first its master. `clues` maps the riddles' typed keys to their
 * clue. `banned` spellings are left out, and with them a word without any. Each
 * answer is keyed by its unaccented spelling; its `points` are its master's
 * base's rarity.
 *
 * `refused` maps what's typed to why it isn't an answer (see REASONS): the
 * `conjugated` keys (verb forms that fit, found by the generator), then each
 * banned spelling by its `reasons` ('invalid' when it has none).
 */
export function buildLevel({
  pattern,
  words,
  clues = {},
  banned = [],
  conjugated = [],
  reasons = {},
}) {
  const answers = new Map();
  for (const stored of words) {
    const sp = spellingOf(stored);
    if (banned.includes(sp.form)) continue;
    const key = keyOf(sp.form);
    const answer = answers.get(key);
    if (answer) answer.spellings.push(sp);
    else
      answers.set(key, {
        key,
        display: sp.form,
        spellings: [sp],
        freq: sp.freq,
        points: wordPoints(sp.baseFreq),
        clue: clues[key] ?? null,
      });
  }
  const riddles = [...answers.values()]
    .filter((a) => a.clue != null)
    .sort((a, b) => a.display.localeCompare(b.display, 'fr'))
    .map((a) => a.key);
  const refused = new Map(conjugated.map((k) => [k, 'conj']));
  for (const form of banned) {
    const key = keyOf(form);
    if (!answers.has(key)) refused.set(key, reasons[form] ?? 'invalid');
  }
  return { pattern, answers, riddles, refused };
}

/* A bank level's riddles, unclued: its CLUES_MIN commonest words, a base each
 * while there are enough. */
export function defaultClues(level) {
  const words = [...buildLevel(level).answers.values()].sort((a, b) => b.freq - a.freq);
  const bases = new Set();
  const firsts = words.filter((w) => {
    const base = w.spellings[0].base;
    if (bases.has(base)) return false;
    bases.add(base);
    return true;
  });
  const picked = [...firsts, ...words.filter((w) => !firsts.includes(w))].slice(0, CLUES_MIN);
  return Object.fromEntries(picked.map((w) => [w.key, '']));
}

/* Why a word is banned from a level, and what the player is told. */
export const REASONS = {
  conj: 'pas de conjugaison',
  invalid: 'mot invalide',
  offensive: 'mot offensant',
};

/* What a fully typed word gets: 'new', 'dup' (already found), a reason it's
 * refused (see REASONS) or 'unknown'. */
export function judge(level, key, found) {
  if (!level.answers.has(key)) return level.refused.get(key) ?? 'unknown';
  return found.includes(key) ? 'dup' : 'new';
}

export const isRiddle = (level, key) => level.answers.get(key)?.clue != null;

/*
 * The level's list: a numbered spot per riddle ('clue'), alphabetical, then a row
 * per bonus word found ('bonus'), alphabetical, shown apart: a word that's no
 * riddle, or a riddle's homonyms (`of`: its key and display), the first of them
 * on the card.
 * A bonus row's `kids` are its card's homonyms; `keys`, the words it shows.
 */
export function listOf(level, found) {
  const kidsOf = (key, spellings) => spellings.map((spelling) => ({ key, spelling }));
  const clueRows = level.riddles.map((key, i) => {
    const answer = level.answers.get(key);
    const isFound = found.includes(key);
    return {
      id: `c${key}`,
      kind: 'clue',
      num: i + 1,
      clue: answer.clue,
      answer,
      found: isFound,
      keys: isFound ? [key] : [],
      kids: [],
    };
  });
  const bonusRows = found.flatMap((key) => {
    const answer = level.answers.get(key);
    if (!answer) return [];
    if (answer.clue == null) {
      const kids = kidsOf(key, answer.spellings.slice(1));
      return [{ id: `b${key}`, kind: 'bonus', answer, found: true, keys: [key], kids }];
    }
    const [, first, ...rest] = answer.spellings;
    if (!first) return [];
    const card = { ...answer, display: first.form, spellings: [first, ...rest] };
    const kids = kidsOf(key, rest);
    const of = { key, display: answer.display };
    return [{ id: `h${key}`, kind: 'bonus', of, answer: card, found: true, keys: [], kids }];
  });
  bonusRows.sort((a, b) => a.answer.display.localeCompare(b.answer.display, 'fr'));
  return [...clueRows, ...bonusRows];
}

/*
 * Where a player stands, the words in `found` being found: `score`, the riddles
 * found, out of `total`; `bonus`, the bonus rows found (see listOf), out of
 * `bonusTotal`; `star`, every riddle found; `trophy`, every word found.
 */
export function progressOf(level, found) {
  const words = found.filter((k) => level.answers.has(k));
  const homonyms = (a) => a.clue != null && a.spellings.length > 1;
  const bonusOf = (answers) => answers.filter((a) => a.clue == null || homonyms(a)).length;
  const score = words.filter((k) => isRiddle(level, k)).length;
  const total = level.riddles.length;
  const bonus = bonusOf(words.map((k) => level.answers.get(k)));
  const bonusTotal = bonusOf([...level.answers.values()]);
  return {
    score,
    total,
    bonus,
    bonusTotal,
    star: total > 0 && score === total,
    trophy: words.length === level.answers.size,
  };
}

const VOWEL = /^[aeiouyàâäéèêëîïôöûùüœæ]/i;

/* "de" before a word, elided before a vowel (d’aimer). */
export const deBefore = (word) => (VOWEL.test(word) ? 'd’' : 'de ');
