/*
 * Lexilouhette rules: a silhouette (`P_S_I__`) and every word that fits it.
 *
 * Each word holds a spot, together with its spellings that differ only by their
 * accents (cogne, cogné): typed without accents, they're a single answer. A word
 * brings points by how rare its spelling is. The level is done once every spot
 * is filled.
 */
import { normalizeChar } from '../../shared/word-rules.js';

export const BLANK = '_';
export const POINTS_MIN = 25;
export const POINTS_MAX = 99;
/* Word points: POINTS_MIN down to FREQ_COMMON (per million), POINTS_MAX from
 * FREQ_RARE, and in between they follow an S-curve of the word's rarity (its log
 * frequency): slow near both ends, fastest at CENTRE (0 = FREQ_COMMON, 1 =
 * FREQ_RARE), more so the higher STEEPNESS. Tuned so the words of the 5 to
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

/* A level from levels.json (`[freq, ...spellings]` per word, commonest spelling
 * first), each answer keyed by its unaccented spelling. */
export function buildLevel({ pattern, words }) {
  const answers = new Map(
    words.map(([freq, ...spellings]) => {
      const key = keyOf(spellings[0]);
      const points = wordPoints(freq);
      return [key, { key, display: spellings[0], spellings, freq, points, tier: tierOf(points) }];
    }),
  );
  return { pattern, answers };
}

/* What a fully typed word gets: 'new', 'dup' (already found) or 'unknown'. */
export function judge(level, key, found) {
  if (!level.answers.has(key)) return 'unknown';
  return found.includes(key) ? 'dup' : 'new';
}

export const scoreOf = (level, found) =>
  found.reduce((sum, key) => sum + (level.answers.get(key)?.points ?? 0), 0);

export const maxScore = (level) => scoreOf(level, [...level.answers.keys()]);

/* The level's answers, one per spot, alphabetical. */
export const spotsOf = (level) =>
  [...level.answers.values()].sort((a, b) => a.display.localeCompare(b.display, 'fr'));

const VOWEL = /^[aeiouyàâäéèêëîïôöûùüœæ]/i;

/* "de" before a word, elided before a vowel (d’aimer). */
export const deBefore = (word) => (VOWEL.test(word) ? 'd’' : 'de ');
