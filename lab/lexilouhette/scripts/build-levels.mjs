/*
 * Generates lab/lexilouhette/levels.json, every silhouette that makes a good level,
 * from data/dictionnaire.tsv (build-dictionary.mjs; or another one: `npm run
 * lab:levels -- path/to.tsv`). Manual settings live in levels.config.json, see
 * lab/lexilouhette/README.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { keyOf, tierOf, lemmaPoints } from '../game.js';

const file = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const tsvPath = process.argv[2] ?? file('data/dictionnaire.tsv');
const config = {
  skipped: [],
  banned: [],
  rejected: {},
  added: {},
  ...JSON.parse(readFileSync(file('levels.config.json'), 'utf8')),
};
const banned = new Set(config.banned);
const skipped = new Set(config.skipped);

const LENGTHS = [5, 6, 7, 8];
// Blanks per level: at least MIN_BLANKS, and at most one more than the letters shown.
const MIN_BLANKS = 2;
// Shown letters in a row, at most (RE_E__, not PLA___).
const MAX_RUN = 2;
// Families (one spot each) per level.
const MIN_SPOTS = 10;
const MAX_SPOTS = 25;
// A family is known when its lemma is this common (per million); levels need
// enough of them.
const KNOWN_FREQ = 1;
const MIN_KNOWN = 7;
// Share of families that are verbs, at most (…ANT, …ENT farms).
const MAX_VERBS = 0.5;
// A blank where most known families share a letter (_O_C_E → mostly _OUCHE): that
// letter should be shown instead, which is another candidate.
const MAX_SAME_LETTER = 0.5;
// Frequency (per million) given to words added by hand.
const ADDED_FREQ = 1;

const LETTERS = /^[a-zàâäçéèêëîïôöûùüÿ]+$/;
// data/dictionnaire.tsv columns, see build-dictionary.mjs.
const [MOT, LEMME, TAGS, FREQMOT, FREQLEMME] = [0, 1, 2, 3, 4];
const tagsOf = (c) => c[TAGS].split(' ');
const isVerb = (c) => tagsOf(c).some((t) => /^v\d/.test(t));
const isParticiple = (c) => isVerb(c) && tagsOf(c).some((t) => t === 'ppas' || t === 'ppre');
// A reading this much rarer than a word's commonest one doesn't make it a word of
// its own (porte the noun, not the verb).
const MIN_READING_SHARE = 0.1;

// Every participle, to tell a noun or adjective made from one (blessé, fatigué).
const participles = new Set();

/*
 * One entry per unaccented spelling, shown as its most frequent form, with the
 * lemmas that form can belong to (`options`, by reading frequency): which family
 * it joins depends on the level, see inFamilies().
 */
function loadDictionary(path) {
  const forms = new Map();
  for (const line of readFileSync(path, 'utf8').split('\n').slice(1)) {
    const c = line.split('\t');
    if (c.length < 5) continue;
    const form = c[MOT];
    if (isParticiple(c)) participles.add(form);
    if (!LETTERS.test(form) || !LENGTHS.includes(form.length)) continue;
    if (!forms.has(form)) forms.set(form, { total: 0, readings: [] });
    const f = forms.get(form);
    f.total += Number(c[FREQMOT]) || 0;
    f.readings.push(c);
  }
  const byKey = new Map();
  for (const [form, { total, readings }] of forms) {
    const key = keyOf(form).toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { key, freq: 0, formFreq: -1 });
    const e = byKey.get(key);
    e.freq += total;
    if (total > e.formFreq) Object.assign(e, { display: form, formFreq: total, readings });
  }
  const byLength = new Map(LENGTHS.map((len) => [len, []]));
  for (const e of byKey.values()) {
    e.options = lemmaOptions(e);
    delete e.readings;
    byLength.get(e.key.length).push(e);
  }
  return byLength;
}

/* The lemmas a dictionary entry's readings point to, commonest first. A noun or
 * adjective made from a participle counts as the participle (fatigués, blessés:
 * fatiguer, blesser), lending the verb its frequency when more common (déluré is,
 * délurer isn't). */
function lemmaOptions(e) {
  const participle = e.readings.some(isParticiple);
  const byLemma = new Map();
  let madeFreq = 0;
  for (const c of e.readings) {
    if (participle && !isVerb(c) && participles.has(c[LEMME])) {
      madeFreq = Math.max(madeFreq, Number(c[FREQLEMME]) || 0);
      continue;
    }
    const lemma = c[LEMME];
    const o = byLemma.get(lemma) ?? {
      lemma,
      lemmaFreq: Number(c[FREQLEMME]) || 0,
      freq: 0,
      verb: isVerb(c),
    };
    o.freq += Number(c[FREQMOT]) || 0;
    byLemma.set(lemma, o);
  }
  for (const o of byLemma.values()) if (o.verb) o.lemmaFreq = Math.max(o.lemmaFreq, madeFreq);
  const options = [...byLemma.values()].sort((a, b) => b.freq - a.freq);
  return options.filter((o) => o.freq >= options[0].freq * MIN_READING_SHARE);
}

/*
 * A pattern's words, each in a family: of its lemmas, the one fewest of these
 * words share, so a word with a reading of its own stands apart (porte, not with
 * porter's portez); ties go to the commonest. A family is as common as the
 * commonest lemma among its words.
 */
function inFamilies(words) {
  const count = new Map();
  for (const e of words)
    for (const o of e.options) count.set(o.lemma, (count.get(o.lemma) ?? 0) + 1);
  const placed = words.map((e) => {
    const o = e.options.reduce((best, o) =>
      count.get(o.lemma) < count.get(best.lemma) ? o : best,
    );
    return { ...e, lemma: o.lemma, lemmaFreq: o.lemmaFreq, verb: o.verb };
  });
  const freqs = new Map();
  for (const e of placed) freqs.set(e.lemma, Math.max(freqs.get(e.lemma) ?? 0, e.lemmaFreq));
  return placed.map((e) => ({ ...e, lemmaFreq: freqs.get(e.lemma) }));
}

/* Each family's most common word. */
function mainWords(words) {
  const mains = new Map();
  for (const e of words) {
    if (!mains.has(e.lemma) || e.freq > mains.get(e.lemma).freq) mains.set(e.lemma, e);
  }
  return [...mains.values()];
}

/* Every set of shown positions in `len` allowed by the blank rules. */
function masks(len) {
  const out = [];
  for (let bits = 0; bits < 1 << len; bits++) {
    const shown = [...Array(len).keys()].filter((i) => bits & (1 << i));
    const blanks = len - shown.length;
    const run = shown.every((i, k) => k < MAX_RUN || shown[k - MAX_RUN] !== i - MAX_RUN);
    if (blanks >= MIN_BLANKS && blanks <= shown.length + 1 && run) out.push(shown);
  }
  return out;
}

/* A pattern's words after the manual settings. */
function curate(pattern, words) {
  const rejected = new Set(config.rejected[pattern] ?? []);
  const added = (config.added[pattern] ?? []).map((w) => ({
    key: keyOf(w).toLowerCase(),
    display: w,
    freq: ADDED_FREQ,
    options: [{ lemma: w, lemmaFreq: ADDED_FREQ, freq: ADDED_FREQ, verb: false }],
  }));
  const kept = words.filter((e) => !banned.has(e.display) && !rejected.has(e.display));
  return inFamilies([...kept, ...added]);
}

/* The level for `pattern`, or null when it fails a threshold. */
function evaluate(pattern, words) {
  const mains = mainWords(words);
  if (mains.length < MIN_SPOTS || mains.length > MAX_SPOTS) return null;
  const known = mains.filter((e) => e.lemmaFreq >= KNOWN_FREQ);
  if (known.length < MIN_KNOWN) return null;
  if (mains.filter((e) => e.verb).length > mains.length * MAX_VERBS) return null;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== '_') continue;
    const counts = {};
    for (const e of known) counts[e.key[i]] = (counts[e.key[i]] ?? 0) + 1;
    if (Math.max(...Object.values(counts)) > known.length * MAX_SAME_LETTER) return null;
  }
  return { pattern, words, mains };
}

/* Every silhouette that passes the thresholds, by length then pattern: each mask
 * groups the words by the letters it shows, and each group is a candidate. */
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
        if (group.length < MIN_SPOTS || skipped.has(pattern)) continue;
        const level = evaluate(pattern, curate(pattern, group));
        if (level) found.push(level);
      }
    }
  }
  return found.sort(
    (a, b) => a.pattern.length - b.pattern.length || a.pattern.localeCompare(b.pattern),
  );
}

const round = (f) => Number(f.toPrecision(3));
// A level's words as levels.json stores them, most common first.
const wordRows = (words) =>
  [...words]
    .sort((a, b) => b.freq - a.freq)
    .map((e) => [e.display, round(e.freq), e.lemma, round(e.lemmaFreq)]);

const levels = candidates(loadDictionary(tsvPath));
// One level per line (too big for prettier).
const lines = levels.map((l) => JSON.stringify({ pattern: l.pattern, words: wordRows(l.words) }));
writeFileSync(file('levels.json'), `[\n${lines.join(',\n')}\n]\n`);

// Families by points, per hundred (100s … 400s, 500): what the points formula
// is tuned on.
const freqs = levels.flatMap((l) => l.mains.map((e) => e.lemmaFreq));
if (process.env.DUMP_FREQS) writeFileSync(process.env.DUMP_FREQS, JSON.stringify(freqs));
const hundreds = [0, 0, 0, 0, 0];
for (const f of freqs) hundreds[tierOf(lemmaPoints(f))]++;
const split = hundreds
  .map((n, i) => `${i < 4 ? `${i + 1}xx` : '500'} ${Math.round((100 * n) / freqs.length)}%`)
  .join(' · ');
console.log(`Points des familles : ${split}`);
const perLength = {};
for (const l of levels) perLength[l.pattern.length] = (perLength[l.pattern.length] ?? 0) + 1;
const lengths = Object.entries(perLength).map(([len, n]) => `${n} de ${len} lettres`);
console.log(`${levels.length} niveaux : ${lengths.join(', ')}`);
