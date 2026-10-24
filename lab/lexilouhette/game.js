/*
 * Lexilouhette rules: a silhouette (`P_S_I__`) and every word that fits it.
 *
 * Words sharing a lemma form a family (venir: venez, venue, venus). The first word
 * found in a family brings the lemma's points plus its own bonus; the others only
 * their bonus, so a family is worth its lemma once whatever the order.
 */
import { normalizeChar } from '../../shared/word-rules.js';

export const BLANK = '_';
export const POINTS_MIN = 100;
export const POINTS_MAX = 500;
// Lemma points grow by POINTS_PER_DECADE each time the lemma is ten times rarer
// than FREQ_COMMON (per million), within POINTS_MIN..POINTS_MAX.
const FREQ_COMMON = 100;
const POINTS_PER_DECADE = 115;
// A word's bonus: how much rarer it is than its lemma, on the same scale.
const BONUS_MIN = 10;
const BONUS_MAX = 100;
// Colour tiers, every TIER_STEP points from POINTS_MIN; the last holds 500 and up.
const TIER_STEP = 100;
export const TIERS = 5;

// Points are rounded to this.
const STEP = 5;

export const keyOf = (word) => [...word].map(normalizeChar).join('').toUpperCase();

function scale(freq) {
  const decades = Math.log10(FREQ_COMMON) - Math.log10(Math.max(freq, 1e-9));
  return Math.min(POINTS_MAX, Math.max(POINTS_MIN, POINTS_MIN + POINTS_PER_DECADE * decades));
}

const roundStep = (pts) => Math.round(pts / STEP) * STEP;

export const lemmaPoints = (lemmaFreq) => roundStep(scale(lemmaFreq));

export function bonusPoints(freq, lemmaFreq) {
  const bonus = scale(freq) - scale(lemmaFreq);
  return roundStep(Math.min(BONUS_MAX, Math.max(BONUS_MIN, bonus)));
}

/* 0 (100–199) .. TIERS - 1 (500 and up). */
export const tierOf = (pts) =>
  Math.min(TIERS - 1, Math.max(0, Math.floor((pts - POINTS_MIN) / TIER_STEP)));

/* A level from levels.json (`[display, freq, lemma, lemmaFreq]` per word), with
 * each answer keyed by its unaccented spelling. */
export function buildLevel({ date, pattern, words }) {
  const answers = new Map(
    words.map(([display, freq, lemma, lemmaFreq]) => {
      const key = keyOf(display);
      const a = { key, display, lemma, lemmaPoints: lemmaPoints(lemmaFreq) };
      return [key, { ...a, bonus: bonusPoints(freq, lemmaFreq) }];
    }),
  );
  return { date, pattern, answers };
}

/* What a fully typed word gets: 'new', 'dup' (already found) or 'unknown'. */
export function judge(level, key, found) {
  if (!level.answers.has(key)) return 'unknown';
  return found.includes(key) ? 'dup' : 'new';
}

/* Points `key` brings when the words in `found` are already found. */
export function earned(level, found, key) {
  const a = level.answers.get(key);
  const opened = found.some((k) => k !== key && level.answers.get(k)?.lemma === a.lemma);
  return a.bonus + (opened ? 0 : a.lemmaPoints);
}

export function scoreOf(level, found) {
  const opened = new Set();
  let total = 0;
  for (const key of found) {
    const a = level.answers.get(key);
    if (!a) continue;
    total += a.bonus;
    if (!opened.has(a.lemma)) total += a.lemmaPoints;
    opened.add(a.lemma);
  }
  return total;
}

export const maxScore = (level) => scoreOf(level, [...level.answers.keys()]);

const byDisplay = (a, b) => a.display.localeCompare(b.display, 'fr');

/*
 * The found words grouped by family for display, plus the missed ones when
 * `withMissed`. `found` is newest first; the family's first find is its `lead`,
 * credited with the lemma's points (in a family with nothing found, its first
 * word alphabetically stands in). The lead comes first, then the rest in
 * alphabetical order; families are sorted by their lead.
 */
export function familiesOf(level, found, withMissed = false) {
  const chrono = [...found].reverse();
  const groups = new Map();
  for (const a of level.answers.values()) {
    if (!groups.has(a.lemma)) groups.set(a.lemma, []);
    groups.get(a.lemma).push(a);
  }
  const families = [];
  for (const [lemma, all] of groups) {
    const shown = all.filter((a) => withMissed || found.includes(a.key)).sort(byDisplay);
    if (!shown.length) continue;
    const lead = chrono.find((k) => level.answers.get(k)?.lemma === lemma) ?? shown[0].key;
    const words = shown.map((a) => ({
      key: a.key,
      display: a.display,
      found: found.includes(a.key),
      lead: a.key === lead,
      points: a.bonus + (a.key === lead ? a.lemmaPoints : 0),
    }));
    words.sort((a, b) => b.lead - a.lead);
    families.push({ lemma, words, tier: tierOf(words[0].points) });
  }
  return families.sort((a, b) => byDisplay(a.words[0], b.words[0]));
}
