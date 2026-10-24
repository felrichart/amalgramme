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
export const POINTS_MIN = 100;
export const POINTS_MAX = 500;
/* Lemma points grow by POINTS_PER_DECADE each time the lemma is ten times rarer,
 * up to POINTS_MAX; above FREQ_COMMON (per million) they ease down towards
 * POINTS_MIN instead of stopping flat there. Tuned so the families of every
 * candidate level split about 20/30/30/15/5 % across the tiers (`npm run
 * lab:levels` prints it). */
const FREQ_COMMON = 140;
const POINTS_PER_DECADE = 92;
// Colour tiers, every TIER_STEP points from POINTS_MIN; the last holds 500.
const TIER_STEP = 100;
export const TIERS = 5;

// Points are rounded to this.
const STEP = 5;

export const keyOf = (word) => [...word].map(normalizeChar).join('').toUpperCase();

export function lemmaPoints(lemmaFreq) {
  const decades = Math.log10(1 + FREQ_COMMON / Math.max(lemmaFreq, 1e-9));
  const pts = Math.min(POINTS_MAX, POINTS_MIN + POINTS_PER_DECADE * decades);
  return Math.round(pts / STEP) * STEP;
}

/* 0 (100–199) .. TIERS - 1 (500). */
export const tierOf = (pts) =>
  Math.min(TIERS - 1, Math.max(0, Math.floor((pts - POINTS_MIN) / TIER_STEP)));

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
