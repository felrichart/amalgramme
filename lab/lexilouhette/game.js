/*
 * Lexilouhette rules: a silhouette (`P_S_I__`) and every word that fits it.
 *
 * A word is what's typed (without accents): its master spelling, shown, and its
 * homonyms (tigres, tigrés), found together. Words sharing a base (dur: dure,
 * durs) form a family holding a single spot: the first word found fills it and
 * counts once, the family's later finds show under it but don't count. A rare
 * family is a bonus: its spot shows only once found. The level is done once every
 * other spot is filled.
 */
import { normalizeChar } from '../../shared/word-rules.js';

export const BLANK = '_';
export const POINTS_MIN = 25;
export const POINTS_MAX = 99;
/* A family's points, its rarity on a scale (never shown to players), which makes
 * it rare by default from RARE_POINTS: POINTS_MIN down to FREQ_COMMON (per million), POINTS_MAX from
 * FREQ_RARE, and in between they follow an S-curve of the word's rarity (its log
 * frequency): slow near both ends, fastest at CENTRE (0 = FREQ_COMMON, 1 =
 * FREQ_RARE), more so the higher STEEPNESS. Tuned so the families of the 5 to
 * 7-letter levels split about 5/30/35/25/5 % across the tiers (`npm run
 * lab:levels` prints it). */
const FREQ_COMMON = 66;
const FREQ_RARE = 0.0013;
const STEEPNESS = 3.1;
const CENTRE = 0.36;
export const RARE_POINTS = 75;
// Tiers the points are tuned on, by their lowest points: 25, 26–49, 50–74, 75–98, 99.
const TIER_FLOORS = [POINTS_MIN, POINTS_MIN + 1, 50, RARE_POINTS, POINTS_MAX];
export const TIERS = TIER_FLOORS.length;

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

/*
 * A stored word (see buildLevel) of the family of `base` (as common as `freq`), as
 * its spellings, each with its base's frequency.
 */
export function spellingsOf(word, base, freq) {
  return (Array.isArray(word) ? word : [word]).map((sp) => {
    const [form, label = '', of = base, ofFreq = freq] = Array.isArray(sp) ? sp : [sp];
    return { form, label, base: of, freq: ofFreq };
  });
}

/* Spellings as a word of the family of `base` stores them. */
export function storedWord(spellings, base) {
  if (spellings.length === 1 && spellings[0].form === base && !spellings[0].label) return base;
  return spellings.map(({ form, label, base: of, freq }) => {
    if (of !== base) return [form, label, of, freq];
    return label ? [form, label] : form;
  });
}

/*
 * A level as levels.json (and official.json) stores it: `[freq, base, ...words]`
 * per family, a word being its spellings, master first, or `base` alone when that's
 * its only one. A spelling is `form` (the base itself), `[form, label]` (a form of
 * the base: ["dures", "fém. plur."]) or `[form, label, base, freq]` (a homonym of
 * another base, as common as `freq`: ["tigrés", "part. passé plur.", "tigrer",
 * 0.05]). `rare` lists the rare families' bases; without it, a family is rare from
 * RARE_POINTS. `banned` spellings are left out, and with them a word or family
 * left without any. Each answer is keyed by its unaccented spelling.
 */
export function buildLevel({ pattern, words, rare, banned = [] }) {
  const answers = new Map();
  const families = [];
  for (const [freq, base, ...raw] of words) {
    const id = families.length;
    const keys = raw.flatMap((w) => {
      const spellings = spellingsOf(w, base, freq).filter((sp) => !banned.includes(sp.form));
      if (!spellings.length) return [];
      const key = keyOf(spellings[0].form);
      answers.set(key, { key, display: spellings[0].form, spellings, family: id });
      return [key];
    });
    if (!keys.length) continue;
    const points = wordPoints(freq);
    const isRare = rare ? rare.includes(base) : points >= RARE_POINTS;
    families.push({ id, base, freq, points, rare: isRare, keys });
  }
  return { pattern, answers, families };
}

/* What a fully typed word gets: 'new', 'dup' (already found) or 'unknown'. */
export function judge(level, key, found) {
  if (!level.answers.has(key)) return 'unknown';
  return found.includes(key) ? 'dup' : 'new';
}

const familyOf = (level, key) => level.answers.get(key)?.family;

/* Whether `key` is its family's first find, the words in `found` being found. */
export function opens(level, found, key) {
  const id = familyOf(level, key);
  return !found.some((k) => k !== key && familyOf(level, k) === id);
}

/* The families found: `normal` ones and `rare` ones. */
export function scoreOf(level, found) {
  const opened = new Set(found.map((k) => familyOf(level, k)));
  const families = level.families.filter((f) => opened.has(f.id));
  const rare = families.filter((f) => f.rare).length;
  return { normal: families.length - rare, rare };
}

// The normal families, the ones to find.
export const maxScore = (level) => level.families.filter((f) => !f.rare).length;

/*
 * The level's spots, alphabetical by their first word: one per normal family,
 * numbered (`num`, from 1), and one per rare family once found or `revealed`.
 * `rows` are its words found, first find first (the one that counts), then once
 * `revealed` the others, each with whether it's found.
 */
export function familiesOf(level, found, revealed = false) {
  const first = (f) => level.answers.get(f.keys[0]).display;
  const sorted = [...level.families].sort((a, b) => first(a).localeCompare(first(b), 'fr'));
  let num = 0;
  return sorted.flatMap((f) => {
    const mine = found.filter((k) => familyOf(level, k) === f.id).reverse();
    if (f.rare && !mine.length && !revealed) return [];
    const keys = revealed ? [...mine, ...f.keys.filter((k) => !mine.includes(k))] : mine;
    const rows = keys.map((k) => ({ ...level.answers.get(k), found: mine.includes(k) }));
    return [{ ...f, num: f.rare ? null : ++num, rows, found: mine.length > 0 }];
  });
}

export const isDone = (level, found) => {
  const opened = new Set(found.map((k) => familyOf(level, k)));
  return level.families.every((f) => f.rare || opened.has(f.id));
};

const VOWEL = /^[aeiouyàâäéèêëîïôöûùüœæ]/i;

/* "de" before a word, elided before a vowel (d’aimer). */
export const deBefore = (word) => (VOWEL.test(word) ? 'd’' : 'de ');
