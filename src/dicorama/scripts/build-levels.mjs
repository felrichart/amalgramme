/*
 * Generates src/dicorama/bank.json, every silhouette that makes a good level,
 * from data/dictionnaire.tsv (build-dictionary.mjs; or another one: `npm run
 * dicorama:levels -- path/to.tsv`). Manual settings live in levels.config.json, see
 * src/dicorama/README.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  keyOf,
  tierOf,
  tierLabel,
  wordPoints,
  storedSpelling,
  TIERS,
  RARE_POINTS,
} from '../game.js';

const file = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const tsvPath = process.argv[2] ?? file('data/dictionnaire.tsv');
const config = {
  skipped: [],
  skippedEndings: [],
  banned: [],
  rejected: {},
  added: {},
  ...JSON.parse(readFileSync(file('levels.config.json'), 'utf8')),
};
const banned = new Set(config.banned);
const skipped = new Set(config.skipped);
const isSkipped = (pattern) =>
  skipped.has(pattern) || config.skippedEndings.some((end) => pattern.endsWith(end));

const LENGTHS = [4, 5, 6, 7, 8, 9];
// Blanks per level, at least MIN_SHOWN letters staying shown.
const BLANKS = [2, 3, 4];
const MIN_SHOWN = 2;
// Words per level: enough for its riddles (see CLUES_MIN in game.js), few enough
// to find them all.
const MIN_WORDS = 6;
const MAX_WORDS = 30;
// Common bases (under RARE_POINTS) per level, at least.
const MIN_COMMON = 5;
// Share of words that are plurals, at most (…ES, …ÉS farms).
const MAX_PLURALS = 0.6;
// Conjugated verb forms that fit a level, fewer than this: the player's told
// they're no answer, so a …AIS festival isn't a level.
const MAX_CONJUGATED = 250;
// Frequency (per million) given to words added by hand.
const ADDED_FREQ = 1;

const LETTERS = /^[a-zàâäçéèêëîïôöûùüÿ]+$/;
// data/dictionnaire.tsv columns, see build-dictionary.mjs.
const [MOT, LEMME, TAGS, FREQMOT, FREQLEMME] = [0, 1, 2, 3, 4];

const isVerb = (tags) => tags.some((t) => /^v\d/.test(t));
const isPlural = (tags) => tags.includes('pl') && !tags.includes('sg') && !tags.includes('inv');

/* Whether a reading makes a playable word: anything but a verb, an infinitive or
 * a participle, past or present (dormi, fatiguées, chantant). Conjugations are
 * out: the lexicon can't tell il cogne from un cogne. */
function isPlayable(tags) {
  return !isVerb(tags) || ['infi', 'ppas', 'ppre'].some((t) => tags.includes(t));
}

/* A reading's rank as a spelling's sense, best first: noun, adjective (or anything
 * else but a verb), verb (past participle or infinitive); within each, singular
 * before plural, then, but for nouns (une tare, un taré), masculine before
 * feminine. */
function rankOf(tags) {
  const kind = isVerb(tags) ? 2 : tags.includes('nom') ? 0 : 1;
  const feminine = tags.includes('fem') && !tags.includes('mas') && !tags.includes('epi');
  return 4 * kind + 2 * isPlural(tags) + (kind > 0 && feminine);
}

/* What a spelling is of its base, for the definition bubble: "fém. plur." (de
 * vert), "part. passé fém." (d'acheter), "part. présent" (de chanter); nothing
 * when it's the base itself. A feminine base's forms aren't called feminine
 * (tortures: plur. de torture). */
function labelOf(form, sense, femBases) {
  if (sense.lemma === form) return '';
  const verb =
    isVerb(sense.tags) && (sense.tags.includes('ppre') ? 'part. présent' : 'part. passé');
  const parts = verb ? [verb] : [];
  if (sense.tags.includes('fem') && !femBases.has(sense.lemma)) parts.push('fém.');
  if (isPlural(sense.tags)) parts.push('plur.');
  return parts.join(' ') || 'forme';
}

/*
 * The playable words by length, one per unaccented spelling (what's typed), and
 * `verbForms`, the typed keys (uppercase) of the spellings that are only verb
 * forms, by length.
 *
 * A spelling (with its accents) counts all its uses, playable or not (tigres: tu
 * tigres too), since the lexicon splits them unreliably between its readings, and
 * takes its best-ranked playable reading as its sense, whose lemma is its base
 * (tigres: the noun tigre). A word holds the spellings typed the same way, its
 * master word first, the one with the best-ranked sense (tigres before tigrés),
 * whose base is the word's. A base is as common as all the spellings it's the base
 * of, every length, unplayable ones included through their best reading (édite:
 * éditer).
 */
function loadDictionary(path) {
  const spellings = new Map();
  const femBases = new Set();
  for (const line of readFileSync(path, 'utf8').split('\n').slice(1)) {
    const c = line.split('\t');
    if (c.length < 5) continue;
    const [form, lemma, tags] = [c[MOT], c[LEMME], c[TAGS].split(' ')];
    if (form === lemma && tags.includes('fem') && !tags.includes('mas')) femBases.add(lemma);
    if (!LETTERS.test(form)) continue;
    if (!spellings.has(form)) spellings.set(form, { form, freq: 0, sense: null, any: null });
    const sp = spellings.get(form);
    sp.freq += Number(c[FREQMOT]) || 0;
    const reading = { lemma, tags, rank: rankOf(tags), own: lemma === form, freq: +c[FREQLEMME] };
    const better = (a, b) => !b || (a.rank - b.rank || b.own - a.own || b.freq - a.freq) < 0;
    if (better(reading, sp.any)) sp.any = reading;
    if (isPlayable(tags) && better(reading, sp.sense)) sp.sense = reading;
  }
  const baseFreqs = new Map();
  for (const { freq, sense, any } of spellings.values()) {
    const { lemma } = sense ?? any;
    baseFreqs.set(lemma, (baseFreqs.get(lemma) ?? 0) + freq);
  }

  const byKey = new Map();
  for (const sp of spellings.values()) {
    if (!sp.sense || !LENGTHS.includes(sp.form.length)) continue;
    const key = keyOf(sp.form).toLowerCase();
    if (!byKey.has(key)) byKey.set(key, []);
    const label = labelOf(sp.form, sp.sense, femBases);
    byKey.get(key).push({ ...sp, base: sp.sense.lemma, label });
  }
  const verbForms = new Map(LENGTHS.map((len) => [len, new Set()]));
  for (const sp of spellings.values()) {
    const key = keyOf(sp.form);
    if (sp.sense || !LENGTHS.includes(key.length) || byKey.has(key.toLowerCase())) continue;
    verbForms.get(key.length).add(key);
  }
  const byLength = new Map(LENGTHS.map((len) => [len, []]));
  for (const [key, all] of byKey) {
    all.sort((a, b) => a.sense.rank - b.sense.rank || b.freq - a.freq);
    const [master] = all;
    byLength.get(key.length).push({
      key,
      spellings: all.map(({ form, freq, base, label }) => ({
        form,
        freq,
        base,
        label,
        baseFreq: baseFreqs.get(base),
      })),
      plural: isPlural(master.sense.tags),
    });
  }
  return { byLength, verbForms };
}

/* Every set of shown positions in `len` allowed by the blank rules. */
function masks(len) {
  const out = [];
  for (let bits = 0; bits < 1 << len; bits++) {
    const shown = [...Array(len).keys()].filter((i) => bits & (1 << i));
    if (shown.length >= MIN_SHOWN && BLANKS.includes(len - shown.length)) out.push(shown);
  }
  return out;
}

/* A pattern's words after the manual settings: banned and rejected spellings go,
 * and a word goes with its last one. */
function curate(pattern, words) {
  const rejected = new Set(config.rejected[pattern] ?? []);
  const kept = words.flatMap((e) => {
    const spellings = e.spellings.filter((s) => !banned.has(s.form) && !rejected.has(s.form));
    if (spellings.length === e.spellings.length) return [e];
    return spellings.length ? [{ ...e, spellings }] : [];
  });
  const added = (config.added[pattern] ?? []).map((w) => ({
    key: keyOf(w).toLowerCase(),
    spellings: [{ form: w, freq: ADDED_FREQ, base: w, label: '', baseFreq: ADDED_FREQ }],
    plural: false,
  }));
  return [...kept, ...added];
}

// A frequency as bank.json stores it, which the game rates.
const round = (f) => Number(f.toPrecision(3));

/* The level for `pattern`, or null when it fails a threshold. `conjugated`: the
 * verb forms that fit it. */
function evaluate(pattern, words, conjugated) {
  if (conjugated.length >= MAX_CONJUGATED) return null;
  if (words.length < MIN_WORDS || words.length > MAX_WORDS) return null;
  const common = new Set(
    words
      .map((w) => w.spellings[0])
      .filter((sp) => wordPoints(round(sp.baseFreq)) < RARE_POINTS)
      .map((sp) => sp.base),
  );
  if (common.size < MIN_COMMON) return null;
  if (words.filter((w) => w.plural).length > words.length * MAX_PLURALS) return null;
  return { pattern, words, conjugated };
}

/* The levels no other level narrows down: A___E goes when A__TE is a level. */
function mostSpecific(levels) {
  const patterns = new Set(levels.map((l) => l.pattern));
  const generic = new Set();
  for (const { pattern } of levels) {
    const shown = [...pattern].flatMap((ch, i) => (ch === '_' ? [] : [i]));
    // Every non-empty set of shown letters to hide.
    for (let bits = 1; bits < 1 << shown.length; bits++) {
      const chars = [...pattern];
      shown.forEach((i, k) => bits & (1 << k) && (chars[i] = '_'));
      if (patterns.has(chars.join(''))) generic.add(chars.join(''));
    }
  }
  return levels.filter((l) => !generic.has(l.pattern));
}

/* Every silhouette that passes the thresholds and that no other one narrows down, by
 * length then pattern: each mask groups the words by the letters it shows, and each
 * group is a candidate. */
function candidates({ byLength, verbForms }) {
  const found = [];
  for (const [len, words] of byLength) {
    for (const mask of masks(len)) {
      const patternOf = (key) =>
        [...key].map((ch, i) => (mask.includes(i) ? ch.toUpperCase() : '_')).join('');
      const groups = new Map();
      for (const e of words) {
        const pattern = patternOf(e.key);
        if (!groups.has(pattern)) groups.set(pattern, []);
        groups.get(pattern).push(e);
      }
      const forms = new Map();
      for (const key of verbForms.get(len)) {
        const pattern = patternOf(key);
        if (groups.has(pattern)) forms.set(pattern, [...(forms.get(pattern) ?? []), key]);
      }
      for (const [pattern, group] of groups) {
        if (group.length < MIN_WORDS || isSkipped(pattern)) continue;
        const curated = curate(pattern, group);
        // Not a word added by hand.
        const added = new Set(curated.map((w) => w.key.toUpperCase()));
        const conjugated = (forms.get(pattern) ?? []).filter((k) => !added.has(k)).sort();
        const level = evaluate(pattern, curated, conjugated);
        if (level) found.push(level);
      }
    }
  }
  return mostSpecific(found).sort(
    (a, b) => a.pattern.length - b.pattern.length || a.pattern.localeCompare(b.pattern),
  );
}

/* A level's words as bank.json stores them (see buildLevel, game.js): their
 * spellings, master first, the commonest word first. */
const wordRows = (words) =>
  [...words]
    .sort((a, b) => b.spellings[0].freq - a.spellings[0].freq)
    .flatMap(({ spellings }) =>
      spellings.map((sp) =>
        storedSpelling({ ...sp, freq: round(sp.freq), baseFreq: round(sp.baseFreq) }),
      ),
    );

const levels = candidates(loadDictionary(tsvPath));
// One level per line (too big for prettier).
const lines = levels.map((l) =>
  JSON.stringify({
    pattern: l.pattern,
    words: wordRows(l.words),
    ...(l.conjugated.length && { conjugated: l.conjugated }),
  }),
);
writeFileSync(file('bank.json'), `[\n${lines.join(',\n')}\n]\n`);

// The bases of the 5 to 7-letter levels' words by points tier: what the points
// formula is tuned on.
const freqs = levels
  .filter((l) => l.pattern.length >= 5 && l.pattern.length <= 7)
  .flatMap((l) => [
    ...new Map(l.words.map((w) => [w.spellings[0].base, w.spellings[0].baseFreq])).values(),
  ]);
if (process.env.DUMP_FREQS) writeFileSync(process.env.DUMP_FREQS, JSON.stringify(freqs));
const tiers = Array(TIERS).fill(0);
for (const f of freqs) tiers[tierOf(wordPoints(f))]++;
const split = tiers
  .map((n, i) => `${tierLabel(i)} ${Math.round((100 * n) / freqs.length)}%`)
  .join(' · ');
console.log(`Points des bases : ${split}`);
const perLength = {};
for (const l of levels) perLength[l.pattern.length] = (perLength[l.pattern.length] ?? 0) + 1;
const lengths = Object.entries(perLength).map(([len, n]) => `${n} de ${len} lettres`);
console.log(`${levels.length} niveaux : ${lengths.join(', ')}`);
