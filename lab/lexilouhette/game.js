/*
 * Lexilouhette rules: a silhouette (`P_S_I__`) and every word that fits it.
 *
 * A word is what's typed (without accents): its master spelling, shown, and its
 * homonyms (tigres, tigrés), found together. Words sharing a base (dur: dure,
 * durs) form a family holding a single spot: the first word found fills it and
 * brings the family's points, by how rare its base is; the family's later finds
 * show under it but bring nothing. The level is done once every spot is filled.
 */
import { normalizeChar } from '../../shared/word-rules.js';

export const BLANK = '_';
export const POINTS_MIN = 25;
export const POINTS_MAX = 99;
/* Family points: POINTS_MIN down to FREQ_COMMON (per million), POINTS_MAX from
 * FREQ_RARE, and in between they follow an S-curve of the word's rarity (its log
 * frequency): slow near both ends, fastest at CENTRE (0 = FREQ_COMMON, 1 =
 * FREQ_RARE), more so the higher STEEPNESS. Tuned so the families of the 5 to
 * 7-letter levels split about 5/30/35/25/5 % across the tiers (`npm run
 * lab:levels` prints it). */
const FREQ_COMMON = 66;
const FREQ_RARE = 0.0013;
const STEEPNESS = 3.1;
const CENTRE = 0.36;
// Colour tiers, by their lowest points: 25, 26–49, 50–74, 75–98, 99.
const TIER_FLOORS = [POINTS_MIN, POINTS_MIN + 1, 50, 75, POINTS_MAX];
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
 * A level from levels.json, `[freq, base, ...words]` per family, a word being its
 * spellings, master first, or `base` alone when that's its only one. A spelling is
 * `form` (the base itself), `[form, label]` (a form of the base: ["dures", "fém.
 * plur."]) or `[form, label, base]` (a homonym of another base: ["tigrés", "part.
 * passé plur.", "tigrer"]). Each answer is keyed by its unaccented spelling.
 */
export function buildLevel({ pattern, words }) {
  const answers = new Map();
  const families = words.map(([freq, base, ...raw], id) => {
    const points = wordPoints(freq);
    const keys = raw.map((w) => {
      const spellings = (Array.isArray(w) ? w : [w]).map((sp) => {
        const [form, label = '', of = base] = Array.isArray(sp) ? sp : [sp];
        return { form, label, base: of };
      });
      const key = keyOf(spellings[0].form);
      answers.set(key, { key, display: spellings[0].form, spellings, family: id });
      return key;
    });
    return { id, base, freq, points, tier: tierOf(points), keys };
  });
  return { pattern, answers, families };
}

/* What a fully typed word gets: 'new', 'dup' (already found) or 'unknown'. */
export function judge(level, key, found) {
  if (!level.answers.has(key)) return 'unknown';
  return found.includes(key) ? 'dup' : 'new';
}

const familyOf = (level, key) => level.answers.get(key)?.family;

/* Points `key` brings when the words in `found` are already found. */
export function earned(level, found, key) {
  const id = familyOf(level, key);
  return found.some((k) => k !== key && familyOf(level, k) === id) ? 0 : level.families[id].points;
}

export function scoreOf(level, found) {
  const opened = new Set(found.map((k) => familyOf(level, k)));
  return level.families.reduce((sum, f) => sum + (opened.has(f.id) ? f.points : 0), 0);
}

export const maxScore = (level) => level.families.reduce((sum, f) => sum + f.points, 0);

/*
 * The level's spots, one per family, alphabetical by its first word. `rows` are
 * its words found, first find first (it brings the points), then once `revealed`
 * the others, each with whether it's found.
 */
export function familiesOf(level, found, revealed = false) {
  const families = level.families.map((f) => {
    const mine = found.filter((k) => familyOf(level, k) === f.id).reverse();
    const keys = revealed ? [...mine, ...f.keys.filter((k) => !mine.includes(k))] : mine;
    const rows = keys.map((k) => ({ ...level.answers.get(k), found: mine.includes(k) }));
    return { ...f, rows, found: mine.length > 0 };
  });
  const first = (f) => level.answers.get(f.keys[0]).display;
  return families.sort((a, b) => first(a).localeCompare(first(b), 'fr'));
}

export const isDone = (level, found) => familiesOf(level, found).every((f) => f.found);

const VOWEL = /^[aeiouyàâäéèêëîïôöûùüœæ]/i;

/* "de" before a word, elided before a vowel (d’aimer). */
export const deBefore = (word) => (VOWEL.test(word) ? 'd’' : 'de ');
