/*
 * Generates lab/lexilouhette/levels.json, every silhouette that makes a good level,
 * from data/dictionnaire.tsv (build-dictionary.mjs; or another one: `npm run
 * lab:levels -- path/to.tsv`). Manual settings live in levels.config.json, see
 * lab/lexilouhette/README.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { keyOf, tierOf, tierLabel, wordPoints, storedWord, TIERS, RARE_POINTS } from '../game.js';

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

const LENGTHS = [4, 5, 6, 7];
// Blanks per level, by its length: 2 for 4 letters, else 3 or 4.
const blanksFor = (len) => (len === 4 ? [2] : [3, 4]);
// Shown letters per level, at least.
const MIN_SHOWN = 2;
// Normal families (one spot each, not rare) per level.
const MIN_SPOTS = 10;
const MAX_SPOTS = 25;
// A family is known when this common (per million); levels need enough of them.
const KNOWN_FREQ = 1;
const MIN_KNOWN = 5;
// Share of families whose words are all plurals, at most (…ES, …ÉS farms).
const MAX_PLURALS = 0.5;
// Frequency (per million) given to words added by hand.
const ADDED_FREQ = 1;

const LETTERS = /^[a-zàâäçéèêëîïôöûùüÿ]+$/;
// data/dictionnaire.tsv columns, see build-dictionary.mjs.
const [MOT, LEMME, TAGS, FREQMOT, FREQLEMME] = [0, 1, 2, 3, 4];

const isVerb = (tags) => tags.some((t) => /^v\d/.test(t));
const isPlural = (tags) => tags.includes('pl') && !tags.includes('sg') && !tags.includes('inv');

/* Whether a reading makes a playable word: anything but a verb, an infinitive, or
 * a past participle that agrees (fatigué, fatiguée; not dormi). Conjugations and
 * present participles are out: the lexicon can't tell il cogne from un cogne, and
 * a present participle used as an adjective has an entry of its own (fatigant). */
function isPlayable(tags) {
  if (!isVerb(tags)) return true;
  return tags.includes('infi') || (tags.includes('ppas') && tags.includes('adj'));
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
 * vert), "part. passé fém." (d'acheter); nothing when it's the base itself. A
 * feminine base's forms aren't called feminine (tortures: plur. de torture). */
function labelOf(form, sense, femBases) {
  if (sense.lemma === form) return '';
  const parts = isVerb(sense.tags) ? ['part. passé'] : [];
  if (sense.tags.includes('fem') && !femBases.has(sense.lemma)) parts.push('fém.');
  if (isPlural(sense.tags)) parts.push('plur.');
  return parts.join(' ') || 'forme';
}

/*
 * The playable words by length, one per unaccented spelling (what's typed).
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
      base: master.base,
      freq: baseFreqs.get(master.base),
      plural: isPlural(master.sense.tags),
    });
  }
  return byLength;
}

/* Every set of shown positions in `len` allowed by the blank rules. */
function masks(len) {
  const out = [];
  for (let bits = 0; bits < 1 << len; bits++) {
    const shown = [...Array(len).keys()].filter((i) => bits & (1 << i));
    if (shown.length >= MIN_SHOWN && blanksFor(len).includes(len - shown.length)) out.push(shown);
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
    spellings: [{ form: w, freq: ADDED_FREQ, base: w, label: '' }],
    base: w,
    freq: ADDED_FREQ,
    plural: false,
  }));
  return [...kept, ...added];
}

// A frequency as levels.json stores it, which the game rates.
const round = (f) => Number(f.toPrecision(3));

/* A pattern's words in families, one per base: its own word first (tigre before
 * tigres), then the commonest. It's a plural when all its words are. */
function familiesIn(words) {
  const families = new Map();
  for (const w of words) {
    if (!families.has(w.base)) families.set(w.base, { base: w.base, freq: w.freq, words: [] });
    families.get(w.base).words.push(w);
  }
  return [...families.values()].map((f) => {
    const own = (w) => w.spellings[0].form === f.base;
    f.words.sort((a, b) => own(b) - own(a) || b.spellings[0].freq - a.spellings[0].freq);
    return { ...f, plural: f.words.every((w) => w.plural) };
  });
}

/* The level for `pattern`, or null when it fails a threshold. */
function evaluate(pattern, words) {
  const families = familiesIn(words);
  const spots = families.filter((f) => wordPoints(round(f.freq)) < RARE_POINTS).length;
  if (spots < MIN_SPOTS || spots > MAX_SPOTS) return null;
  if (families.filter((f) => f.freq >= KNOWN_FREQ).length < MIN_KNOWN) return null;
  if (families.filter((f) => f.plural).length > families.length * MAX_PLURALS) return null;
  return { pattern, families };
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
function candidates(byLength) {
  const found = [];
  for (const [len, words] of byLength) {
    for (const mask of masks(len)) {
      const groups = new Map();
      for (const e of words) {
        const pattern = [...e.key]
          .map((ch, i) => (mask.includes(i) ? ch.toUpperCase() : '_'))
          .join('');
        if (!groups.has(pattern)) groups.set(pattern, []);
        groups.get(pattern).push(e);
      }
      for (const [pattern, group] of groups) {
        if (group.length < MIN_SPOTS || isSkipped(pattern)) continue;
        const level = evaluate(pattern, curate(pattern, group));
        if (level) found.push(level);
      }
    }
  }
  return mostSpecific(found).sort(
    (a, b) => a.pattern.length - b.pattern.length || a.pattern.localeCompare(b.pattern),
  );
}

/* A level's families as levels.json stores them (see game.js), commonest first. */
const familyRows = (families) =>
  [...families]
    .sort((a, b) => b.freq - a.freq)
    .map(({ freq, base, words }) => [
      round(freq),
      base,
      ...words.map(({ spellings }) =>
        storedWord(
          spellings.map((s) => ({ ...s, freq: s.baseFreq && round(s.baseFreq) })),
          base,
        ),
      ),
    ]);

const levels = candidates(loadDictionary(tsvPath));
// One level per line (too big for prettier).
const lines = levels.map((l) =>
  JSON.stringify({ pattern: l.pattern, words: familyRows(l.families) }),
);
writeFileSync(file('levels.json'), `[\n${lines.join(',\n')}\n]\n`);

// Families of the 5 to 7-letter levels by points tier: what the points formula is
// tuned on.
const freqs = levels
  .filter((l) => l.pattern.length >= 5 && l.pattern.length <= 7)
  .flatMap((l) => l.families.map((f) => f.freq));
if (process.env.DUMP_FREQS) writeFileSync(process.env.DUMP_FREQS, JSON.stringify(freqs));
const tiers = Array(TIERS).fill(0);
for (const f of freqs) tiers[tierOf(wordPoints(f))]++;
const split = tiers
  .map((n, i) => `${tierLabel(i)} ${Math.round((100 * n) / freqs.length)}%`)
  .join(' · ');
console.log(`Points des familles : ${split}`);
const perLength = {};
for (const l of levels) perLength[l.pattern.length] = (perLength[l.pattern.length] ?? 0) + 1;
const lengths = Object.entries(perLength).map(([len, n]) => `${n} de ${len} lettres`);
console.log(`${levels.length} niveaux : ${lengths.join(', ')}`);
