/*
 * Dicorama rules: a silhouette (`P_S_I__`) and every word that fits it.
 *
 * A word is what's typed (without accents): its master spelling, shown, and its
 * homonyms (tigres, tigrés), found together. Words sharing a base (dur: dure,
 * durs) form a family: its first find counts once, its later ones join it
 * without counting. Every family found counts, in three kinds: the GOAL most
 * common ones are the list, a numbered spot each; the other common ones count
 * the same but show only once found; a rare family is a bonus on top. The level
 * is finished at GOAL families found (any kind), complete once every common one
 * is.
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
 * dicorama:levels` prints it). */
const FREQ_COMMON = 66;
const FREQ_RARE = 0.0013;
const STEEPNESS = 3.1;
const CENTRE = 0.36;
export const RARE_POINTS = 75;
// Tiers the points are tuned on, by their lowest points: 25, 26–49, 50–74, 75–98, 99.
const TIER_FLOORS = [POINTS_MIN, POINTS_MIN + 1, 50, RARE_POINTS, POINTS_MAX];
export const TIERS = TIER_FLOORS.length;

// Families to find to finish a level, and the list's numbered spots.
export const GOAL = 10;

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
 * A level as bank.json (and the Worker) stores it: `[freq, base, ...words]`
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
    families.push({ id, base, freq, points, rare: isRare, main: false, keys });
  }
  // The list: the most common families, the word's own base first on a tie.
  families
    .filter((f) => !f.rare)
    .sort((a, b) => b.freq - a.freq || a.base.localeCompare(b.base, 'fr'))
    .slice(0, GOAL)
    .forEach((f) => (f.main = true));
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

/*
 * Where a player stands, the words in `found` being found: `score`, the families
 * found (`rare` of them rare, out of `rareTotal`); `goal`, the families that
 * finish the level; `total`, every common family plus the rare ones found, the
 * score that completes it. `perfect` once every family is found, rare ones too
 * (a level without any is just complete).
 */
export function progressOf(level, found) {
  const opened = new Set(found.map((k) => familyOf(level, k)));
  const families = level.families.filter((f) => opened.has(f.id));
  const score = families.length;
  const rare = families.filter((f) => f.rare).length;
  const common = level.families.filter((f) => !f.rare).length;
  const goal = Math.min(GOAL, common);
  const rareTotal = level.families.length - common;
  return {
    score,
    rare,
    rareTotal,
    goal,
    total: common + rare,
    finished: score >= goal,
    complete: score - rare === common,
    perfect: rareTotal > 0 && score === level.families.length,
  };
}

/*
 * The level's list, alphabetical: a numbered spot per family of the list, filled
 * by its first find, and a row per other family found: 'extra' for a common one,
 * 'rare' for a rare one. A row's `kids` are its word's homonyms then its family's
 * later finds (`variant`, with their own homonyms), oldest first; `keys`, every
 * word it shows.
 */
export function listOf(level, found) {
  const firstWord = (f) => level.answers.get(f.keys[0]);
  const sorted = [...level.families].sort((a, b) =>
    firstWord(a).display.localeCompare(firstWord(b).display, 'fr'),
  );
  // Each family's finds, oldest first.
  const finds = new Map();
  for (const key of [...found].reverse()) {
    const id = familyOf(level, key);
    finds.set(id, [...(finds.get(id) ?? []), key]);
  }
  const homonyms = (answer) =>
    answer.spellings.slice(1).map((spelling) => ({ key: answer.key, spelling, kind: 'homonym' }));

  let num = 0;
  const rows = [];
  for (const f of sorted) {
    const [key, ...later] = finds.get(f.id) ?? [];
    const answer = key ? level.answers.get(key) : null;
    const kind = f.main ? 'main' : f.rare ? 'rare' : 'extra';
    if (!f.main && !answer) continue;
    const kids = !key
      ? []
      : [
          ...homonyms(answer),
          ...later.flatMap((k) => {
            const a = level.answers.get(k);
            return [{ key: k, spelling: a.spellings[0], kind: 'variant' }, ...homonyms(a)];
          }),
        ];
    rows.push({
      id: `f${f.id}`,
      kind,
      num: f.main ? ++num : null,
      answer,
      found: !!key,
      keys: key ? [key, ...later] : [],
      kids,
      // A spot stays put whichever word fills it.
      sort: f.main ? firstWord(f).display : answer.display,
    });
  }
  return rows.sort((a, b) => a.sort.localeCompare(b.sort, 'fr'));
}

const VOWEL = /^[aeiouyàâäéèêëîïôöûùüœæ]/i;

/* "de" before a word, elided before a vowel (d’aimer). */
export const deBefore = (word) => (VOWEL.test(word) ? 'd’' : 'de ');

/* The marks a level's progress won: 0, 1 (the star, finished), 2 (the trophy,
 * complete), 3 (the crown, perfect). */
export const marksOf = (p) => (p.perfect ? 3 : p.complete ? 2 : p.finished ? 1 : 0);
