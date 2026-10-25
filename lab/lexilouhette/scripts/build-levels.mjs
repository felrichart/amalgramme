/*
 * Generates lab/lexilouhette/levels.json, every silhouette that makes a good level,
 * from data/dictionnaire.tsv (build-dictionary.mjs; or another one: `npm run
 * lab:levels -- path/to.tsv`). Manual settings live in levels.config.json, see
 * lab/lexilouhette/README.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { keyOf, tierOf, tierLabel, wordPoints, TIERS } from '../game.js';

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

const LENGTHS = [4, 5, 6, 7, 8];
// Blanks per level: at least MIN_BLANKS, and at most one more than the letters shown.
const MIN_BLANKS = 2;
// Shown letters in a row, at most (__GNE, not PLAN___).
const MAX_RUN = 3;
// Words (one spot each) per level.
const MIN_SPOTS = 10;
const MAX_SPOTS = 25;
// A word is known when this common (per million); levels need enough of them.
const KNOWN_FREQ = 1;
const MIN_KNOWN = 7;
// Share of words that are plurals, at most (…ES, …ÉS farms).
const MAX_PLURALS = 0.5;
// A blank where most known words share a letter (_O_C_E → mostly _OUCHE): that
// letter should be shown instead, which is another candidate.
const MAX_SAME_LETTER = 0.5;
// Frequency (per million) given to words added by hand.
const ADDED_FREQ = 1;

const LETTERS = /^[a-zàâäçéèêëîïôöûùüÿ]+$/;
// data/dictionnaire.tsv columns, see build-dictionary.mjs.
const [MOT, TAGS, FREQMOT] = [0, 2, 3];

/* Whether a reading makes a playable word: anything but a verb, an infinitive, or
 * a past participle that agrees (fatigué, fatiguée; not dormi). Conjugations and
 * present participles are out: the lexicon can't tell il cogne from un cogne, and
 * a present participle used as an adjective has an entry of its own (fatigant). */
function isPlayable(tags) {
  if (!tags.some((t) => /^v\d/.test(t))) return true;
  return tags.includes('infi') || (tags.includes('ppas') && tags.includes('adj'));
}

/*
 * One entry per unaccented spelling, holding its playable spellings, commonest
 * first (cogne, cogné), as common as all of them together. A spelling counts all
 * its uses, playable or not (cogne: il cogne too), since the lexicon can't split
 * them. It's a plural when every playable reading is.
 */
function loadDictionary(path) {
  const forms = new Map();
  for (const line of readFileSync(path, 'utf8').split('\n').slice(1)) {
    const c = line.split('\t');
    if (c.length < 5) continue;
    const form = c[MOT];
    if (!LETTERS.test(form) || !LENGTHS.includes(form.length)) continue;
    if (!forms.has(form)) forms.set(form, { form, freq: 0, playable: false, plural: true });
    const f = forms.get(form);
    f.freq += Number(c[FREQMOT]) || 0;
    const tags = c[TAGS].split(' ');
    if (!isPlayable(tags)) continue;
    f.playable = true;
    f.plural &&= tags.includes('pl');
  }
  const byKey = new Map();
  for (const f of forms.values()) {
    if (!f.playable) continue;
    const key = keyOf(f.form).toLowerCase();
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(f);
  }
  const byLength = new Map(LENGTHS.map((len) => [len, []]));
  for (const [key, spellings] of byKey) {
    spellings.sort((a, b) => b.freq - a.freq);
    byLength.get(key.length).push({
      key,
      spellings: spellings.map((s) => s.form),
      freq: spellings.reduce((sum, s) => sum + s.freq, 0),
      plural: spellings[0].plural,
    });
  }
  return byLength;
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

/* A pattern's words after the manual settings: banned and rejected spellings go,
 * and a word goes with its last one. */
function curate(pattern, words) {
  const rejected = new Set(config.rejected[pattern] ?? []);
  const kept = words.flatMap((e) => {
    const spellings = e.spellings.filter((s) => !banned.has(s) && !rejected.has(s));
    if (spellings.length === e.spellings.length) return [e];
    return spellings.length ? [{ ...e, spellings }] : [];
  });
  const added = (config.added[pattern] ?? []).map((w) => ({
    key: keyOf(w).toLowerCase(),
    spellings: [w],
    freq: ADDED_FREQ,
    plural: false,
  }));
  return [...kept, ...added];
}

/* The level for `pattern`, or null when it fails a threshold. */
function evaluate(pattern, words) {
  if (words.length < MIN_SPOTS || words.length > MAX_SPOTS) return null;
  const known = words.filter((e) => e.freq >= KNOWN_FREQ);
  if (known.length < MIN_KNOWN) return null;
  if (words.filter((e) => e.plural).length > words.length * MAX_PLURALS) return null;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== '_') continue;
    const counts = {};
    for (const e of known) counts[e.key[i]] = (counts[e.key[i]] ?? 0) + 1;
    if (Math.max(...Object.values(counts)) > known.length * MAX_SAME_LETTER) return null;
  }
  return { pattern, words };
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
        if (group.length < MIN_SPOTS || isSkipped(pattern)) continue;
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
// A level's words as levels.json stores them, `[freq, ...spellings]`, most common first.
const wordRows = (words) =>
  [...words].sort((a, b) => b.freq - a.freq).map((e) => [round(e.freq), ...e.spellings]);

const levels = candidates(loadDictionary(tsvPath));
// One level per line (too big for prettier).
const lines = levels.map((l) => JSON.stringify({ pattern: l.pattern, words: wordRows(l.words) }));
writeFileSync(file('levels.json'), `[\n${lines.join(',\n')}\n]\n`);

// Words of the 5 to 7-letter levels by points tier: what the points formula is
// tuned on.
const freqs = levels
  .filter((l) => l.pattern.length >= 5 && l.pattern.length <= 7)
  .flatMap((l) => l.words.map((e) => e.freq));
if (process.env.DUMP_FREQS) writeFileSync(process.env.DUMP_FREQS, JSON.stringify(freqs));
const tiers = Array(TIERS).fill(0);
for (const f of freqs) tiers[tierOf(wordPoints(f))]++;
const split = tiers
  .map((n, i) => `${tierLabel(i)} ${Math.round((100 * n) / freqs.length)}%`)
  .join(' · ');
console.log(`Points des mots : ${split}`);
const perLength = {};
for (const l of levels) perLength[l.pattern.length] = (perLength[l.pattern.length] ?? 0) + 1;
const lengths = Object.entries(perLength).map(([len, n]) => `${n} de ${len} lettres`);
console.log(`${levels.length} niveaux : ${lengths.join(', ')}`);
