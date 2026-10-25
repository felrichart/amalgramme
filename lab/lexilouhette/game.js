/*
 * Lexilouhette rules: a silhouette (`P_S_I__`) and every word that fits it.
 *
 * Words sharing a lemma form a family (exposer: exposé, exposés) holding a single
 * spot: the first word found fills it and brings the lemma's points, rarer lemmas
 * more; the family's other words still count as found but bring nothing. The
 * level is done once every spot is filled.
 */
import { normalizeChar } from '../../shared/word-rules.js';

export const BLANK = '_';
export const POINTS_MIN = 25;
export const POINTS_MAX = 99;
/* Lemma points: POINTS_MIN down to FREQ_COMMON (per million), POINTS_MAX from
 * FREQ_RARE, and in between they follow an S-curve of the lemma's rarity (its
 * log frequency): slow near both ends, fastest at CENTRE (0 = FREQ_COMMON, 1 =
 * FREQ_RARE), more so the higher STEEPNESS. Tuned so the families of the 5 to
 * 7-letter levels split about 5/30/35/25/5 % across the tiers (`npm run
 * lab:levels` prints it). */
const FREQ_COMMON = 158;
const FREQ_RARE = 0.0048;
const STEEPNESS = 3.4;
const CENTRE = 0.49;
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

export function lemmaPoints(lemmaFreq) {
  const rarity = Math.log10(FREQ_COMMON / Math.max(lemmaFreq, 1e-9));
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

/* A level from levels.json (`[display, freq, lemma, lemmaFreq, hintLemma?]` per
 * word, `hintLemma` for wordHint()), with each answer keyed by its unaccented
 * spelling. */
export function buildLevel({ pattern, words }) {
  const answers = new Map(
    words.map(([display, freq, lemma, lemmaFreq, hintLemma]) => {
      const key = keyOf(display);
      const points = lemmaPoints(lemmaFreq);
      return [key, { key, display, freq, lemma, hintLemma, points }];
    }),
  );
  return { pattern, answers };
}

/* What a fully typed word gets: 'new', 'dup' (already found) or 'unknown'. */
export function judge(level, key, found) {
  if (!level.answers.has(key)) return 'unknown';
  return found.includes(key) ? 'dup' : 'new';
}

/* Points `key` brings when the words in `found` are already found. */
export function earned(level, found, key) {
  const { lemma, points } = level.answers.get(key);
  return found.some((k) => k !== key && level.answers.get(k)?.lemma === lemma) ? 0 : points;
}

export function scoreOf(level, found) {
  const opened = new Set();
  let total = 0;
  for (const key of found) {
    const a = level.answers.get(key);
    if (!a || opened.has(a.lemma)) continue;
    total += a.points;
    opened.add(a.lemma);
  }
  return total;
}

export const maxScore = (level) => scoreOf(level, [...level.answers.keys()]);

const byDisplay = (a, b) => a.display.localeCompare(b.display, 'fr');

/*
 * The level's spots, one per family, sorted by the family's most common word
 * (`main`, what the reveal shows). `found` is newest first: `lead` is the
 * family's first find, `extras` its later ones, alphabetical.
 */
export function familiesOf(level, found) {
  const groups = new Map();
  for (const a of level.answers.values()) {
    if (!groups.has(a.lemma)) groups.set(a.lemma, []);
    groups.get(a.lemma).push(a);
  }
  const families = [...groups].map(([lemma, all]) => {
    const main = all.reduce((m, a) => (a.freq > m.freq ? a : m));
    const mine = found.filter((k) => level.answers.get(k)?.lemma === lemma);
    const lead = mine.length ? level.answers.get(mine.at(-1)) : null;
    const extras = mine
      .slice(0, -1)
      .map((k) => level.answers.get(k))
      .sort(byDisplay);
    return { lemma, main, lead, extras, points: main.points, tier: tierOf(main.points) };
  });
  return families.sort((a, b) => byDisplay(a.main, b.main));
}

const VOWEL = /^[aeiouyàâäéèêëîïôöûùüœæ]/i;

/* What the bubble over a found word says: "de" (elided) then its lemma, or the
 * lemma alone when the word is its own. `lead` comes before the lemma. A noun or
 * adjective commoner than its verb names itself (déluré, not délurer). */
export function wordHint({ display, lemma: familyLemma, hintLemma }) {
  const lemma = hintLemma ?? familyLemma;
  if (display === lemma) return { lead: '', lemma };
  return { lead: VOWEL.test(lemma) ? 'd’' : 'de ', lemma };
}
