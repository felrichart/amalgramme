/*
 * Generates lab/lexilouhette/levels.json (the game's data) and levels.report.md
 * (what each level holds, what was weeded out) from data/lexique.tsv, Lexique 4
 * cleaned by clean-lexique.mjs (or another one: `npm run lab:levels -- path/to.tsv`).
 *
 * Manual settings live in levels.config.json, see lab/lexilouhette/README.md.
 * Levels already in levels.json keep their date and pattern (their words follow the
 * config); each run appends `batch` new ones (or `--add N`). Pass --fresh to start
 * over. Seeded: same table and config, same levels. Every candidate level also goes
 * to levels.all.json, to play any of them in the lab.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { keyOf, buildLevel, maxScore, tierOf, familiesOf, lemmaPoints } from '../game.js';

const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const addArg = args.indexOf('--add');
const file = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const tsvPath =
  args.find((a, i) => !a.startsWith('--') && i !== addArg + 1) ?? file('data/lexique.tsv');
const config = {
  start: '2026-10-24',
  batch: 10,
  pinned: [],
  skipped: [],
  reviewed: [],
  banned: [],
  rejected: {},
  added: {},
  ...JSON.parse(readFileSync(file('levels.config.json'), 'utf8')),
};
const banned = new Set(config.banned);
const reviewed = new Set(config.reviewed);
const skipped = new Set(config.skipped);
const add = addArg >= 0 ? Number(args[addArg + 1]) : config.batch;

const LENGTHS = [5, 6, 7, 8];
// Blanks per level: at least MIN_BLANKS, and at most one more than the letters shown.
const MIN_BLANKS = 2;
// Shown letters in a row, at most (RE_E__, not PLA___).
const MAX_RUN = 2;
// Families (one spot each) per level.
const MIN_SPOTS = 10;
const MAX_SPOTS = 25;
// A family is known when this share of people know its lemma (Lexique's Preval,
// %); levels need enough of them.
const KNOWN_PREVAL = 90;
const MIN_KNOWN = 7;
// Share of families that are verbs, at most (…ANT, …ENT farms).
const MAX_VERBS = 0.5;
// A blank where most known families share a letter (_O_C_E → mostly _OUCHE): that
// letter should be shown instead, which is another candidate.
const MAX_SAME_LETTER = 0.5;
// Frequency (per million) given to words added by hand.
const ADDED_FREQ = 1;

const LETTERS = /^[a-zàâäçéèêëîïôöûùüÿ]+$/;
// data/lexique.tsv columns, see clean-lexique.mjs.
const [MOT, LEMME, CGRAM, INFOVER, FREQMOT, FREQLEMME, PREVAL] = [0, 1, 2, 5, 6, 8, 9];
const isVerb = (c) => c[CGRAM].startsWith('VER') || c[CGRAM] === 'AUX';
const isParticiple = (c) => isVerb(c) && c[INFOVER].includes('par:');
// A reading this much rarer than a word's commonest one doesn't make it a word of
// its own (entrait the beam, against il entrait).
const MIN_READING_SHARE = 0.1;

/*
 * One entry per unaccented spelling, shown as its most frequent form, with the
 * lemmas that form can belong to (`options`, by reading frequency): which family
 * it joins depends on the level, see inFamilies().
 */
function loadDictionary(path) {
  const forms = new Map();
  for (const line of readFileSync(path, 'utf8').split('\n').slice(1)) {
    const c = line.split('\t');
    const form = c[MOT];
    if (!LETTERS.test(form) || !LENGTHS.includes(form.length)) continue;
    if (!forms.has(form)) forms.set(form, { total: 0, readings: [] });
    const f = forms.get(form);
    f.total += Number(c[FREQMOT]) || 0;
    f.readings.push(c);
  }
  const byKey = new Map();
  for (const [form, { total, readings }] of forms) {
    const key = keyOf(form).toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { key, freq: 0, formFreq: -1, forms: new Set() });
    const e = byKey.get(key);
    e.freq += total;
    e.forms.add(form);
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

/* The lemmas a dictionary entry's readings point to, commonest first. An adjective
 * that is also a participle counts as the participle (fatigués: fatiguer). */
function lemmaOptions(e) {
  const participle = e.readings.some(isParticiple);
  const byLemma = new Map();
  for (const c of e.readings) {
    if (participle && c[CGRAM].startsWith('ADJ')) continue;
    const lemma = c[LEMME];
    const o = byLemma.get(lemma) ?? {
      lemma,
      lemmaFreq: Number(c[FREQLEMME]) || 0,
      preval: c[PREVAL] === '' ? null : Number(c[PREVAL]),
      freq: 0,
      verb: isVerb(c),
    };
    o.freq += Number(c[FREQMOT]) || 0;
    byLemma.set(lemma, o);
  }
  const options = [...byLemma.values()].sort((a, b) => b.freq - a.freq);
  const kept = options.filter((o) => o.freq >= options[0].freq * MIN_READING_SHARE);
  for (const o of kept) if (!o.lemmaFreq) o.lemmaFreq = e.freq;
  return kept;
}

/*
 * A pattern's words, each in a family: of its lemmas, the one fewest of these
 * words share, so a word with a reading of its own stands apart (porte, not with
 * porter's portez); ties go to the commonest.
 */
function inFamilies(words) {
  const count = new Map();
  for (const e of words)
    for (const o of e.options) count.set(o.lemma, (count.get(o.lemma) ?? 0) + 1);
  return words.map((e) => {
    const o = e.options.reduce((best, o) =>
      count.get(o.lemma) < count.get(best.lemma) ? o : best,
    );
    return { ...e, lemma: o.lemma, lemmaFreq: o.lemmaFreq, verb: o.verb, preval: o.preval };
  });
}

/* Each family's most common word. */
function mainWords(words) {
  const mains = new Map();
  for (const e of words) {
    if (!mains.has(e.lemma) || e.freq > mains.get(e.lemma).freq) mains.set(e.lemma, e);
  }
  return [...mains.values()];
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

const fits = (pattern, key) =>
  [...pattern].every((p, i) => p === '_' || p === key[i].toUpperCase());

/* A pattern's words after the manual settings, plus what those settings removed. */
function curate(pattern, words) {
  const rejected = new Set(config.rejected[pattern] ?? []);
  const isOut = (e) => banned.has(e.display) || rejected.has(e.display);
  const added = (config.added[pattern] ?? []).map((w) => ({
    key: keyOf(w).toLowerCase(),
    display: w,
    freq: ADDED_FREQ,
    options: [{ lemma: w, lemmaFreq: ADDED_FREQ, freq: ADDED_FREQ, verb: false }],
    forms: new Set([w]),
  }));
  return {
    kept: inFamilies([...words.filter((e) => !isOut(e)), ...added]),
    removed: words.filter(isOut).map((e) => e.display),
  };
}

/* Every silhouette that passes the thresholds: each mask groups the words by the
 * letters it shows, and each group is a candidate level. */
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
        const c = evaluate(pattern, curate(pattern, group).kept);
        if (c) found.push(c);
      }
    }
  }
  return found;
}

/* The candidate level for `pattern`, or null when it fails a threshold. */
function evaluate(pattern, words) {
  const mains = mainWords(words);
  if (mains.length < MIN_SPOTS || mains.length > MAX_SPOTS) return null;
  const known = mains.filter((e) => e.preval >= KNOWN_PREVAL);
  if (known.length < MIN_KNOWN) return null;
  if (mains.filter((e) => e.verb).length > mains.length * MAX_VERBS) return null;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== '_') continue;
    const counts = {};
    for (const e of known) counts[e.key[i]] = (counts[e.key[i]] ?? 0) + 1;
    if (Math.max(...Object.values(counts)) > known.length * MAX_SAME_LETTER) return null;
  }
  return { pattern, spots: mains.length, known: known.length, words };
}

/* `pattern`'s level as the config makes it, and whether it passes the thresholds. */
function levelFor(byLength, pattern, date) {
  const all = byLength.get(pattern.length).filter((e) => fits(pattern, e.key));
  const words = curate(pattern, all).kept;
  return { date, pattern, words, ok: !!evaluate(pattern, words) };
}

/* Levels from the previous run, in order, unless skipped since. */
function previousLevels(byLength) {
  if (fresh || !existsSync(file('levels.json'))) return [];
  const prev = JSON.parse(readFileSync(file('levels.json'), 'utf8'));
  return prev
    .filter((l) => !skipped.has(l.pattern))
    .map((l) => levelFor(byLength, l.pattern, l.date));
}

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/*
 * The previous levels, then pinned patterns, then `add` new candidates: reviewed
 * ones first, then a seeded shuffle of the rest, minus the patterns already there.
 */
function pick(byLength, cands, rand) {
  const levels = previousLevels(byLength);
  const nextDate = () => (levels.length ? addDays(levels.at(-1).date, 1) : config.start);
  for (const pattern of config.pinned) {
    if (!levels.some((l) => l.pattern === pattern))
      levels.push(levelFor(byLength, pattern, nextDate()));
  }
  const order = [...cands];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.sort((a, b) => reviewed.has(b.pattern) - reviewed.has(a.pattern));
  const taken = new Set(levels.map((l) => l.pattern));
  for (const c of order.filter((c) => !taken.has(c.pattern)).slice(0, add)) {
    levels.push({ date: nextDate(), pattern: c.pattern, words: c.words, ok: true });
  }
  return levels;
}

const round = (f) => Number(f.toPrecision(3));

/* Markdown: per level, its families with points, the merged accent variants and
 * what the manual settings took out. */
function report(levels, byLength) {
  const out = ['# Lexilouhette — niveaux générés', ''];
  out.push('Généré par `npm run lab:levels`. Ne pas éditer : régler `levels.config.json`.', '');
  out.push('Par famille : `lemme (points) : mot principal · autres mots`.', '');
  for (const l of levels) {
    const level = buildLevel(l);
    const all = byLength.get(l.pattern.length).filter((e) => fits(l.pattern, e.key));
    const { removed } = curate(l.pattern, all);
    const tags = [reviewed.has(l.pattern) ? 'revu' : '**À REVOIR**'];
    if (!l.ok) tags.push('**sous les seuils**');
    const families = familiesOf(level, []);
    out.push(
      `## ${l.date} · \`${l.pattern}\` · ${families.length} familles, ${l.words.length} mots · max ${maxScore(level)} · ${tags.join(' · ')}`,
      '',
    );
    for (const f of families) {
      const words = [...level.answers.values()].filter((a) => a.lemma === f.lemma);
      const rest = words.filter((a) => a !== f.main).map((a) => a.display);
      out.push(`- ${f.lemma} (${f.points}) : ${[f.main.display, ...rest].join(' · ')}`);
    }
    out.push('');
    const merged = all
      .filter((e) => e.forms.size > 1)
      .map((e) => `${e.display} (${[...e.forms].filter((f) => f !== e.display).join(', ')})`);
    if (merged.length) out.push(`Variantes fusionnées : ${merged.join(' · ')}`, '');
    if (removed.length) out.push(`Retirés à la main : ${removed.join(' · ')}`, '');
    if (config.added[l.pattern]?.length)
      out.push(`Ajoutés : ${config.added[l.pattern].join(' · ')}`, '');
  }
  return out.join('\n');
}

const byLength = loadDictionary(tsvPath);
const rand = mulberry32(20261024);
const cands = candidates(byLength);
// A level's words as levels.json stores them, most common first.
const wordRows = (words) =>
  [...words]
    .sort((a, b) => b.freq - a.freq)
    .map((e) => [e.display, round(e.freq), e.lemma, round(e.lemmaFreq)]);
const levels = pick(byLength, cands, rand).map((l) => ({ ...l, words: wordRows(l.words) }));

const data = levels.map(({ date, pattern, words }) => ({ date, pattern, words }));
// Formatted as `npm run format` would, so regenerating doesn't churn the diff.
const options = await prettier.resolveConfig(file('levels.json'));
writeFileSync(
  file('levels.json'),
  await prettier.format(JSON.stringify(data), { ...options, parser: 'json' }),
);
writeFileSync(file('levels.report.md'), report(levels, byLength));
// Every candidate, by length then pattern, one per line (too big for prettier).
const all = [...cands]
  .sort((a, b) => a.pattern.length - b.pattern.length || a.pattern.localeCompare(b.pattern))
  .map((c) => JSON.stringify({ pattern: c.pattern, words: wordRows(c.words) }));
writeFileSync(file('levels.all.json'), `[\n${all.join(',\n')}\n]\n`);

const pending = levels.filter((l) => !reviewed.has(l.pattern));
const familyCount = (l) => new Set(l.words.map((w) => w[2])).size;
for (const l of levels) {
  const tags = [reviewed.has(l.pattern) ? 'revu' : 'À REVOIR'];
  if (!l.ok) tags.push('sous les seuils');
  console.log(
    `${l.date}  ${l.pattern.padEnd(8)} ${String(familyCount(l)).padStart(3)} familles ${String(l.words.length).padStart(3)} mots  ${tags.join(', ')}`,
  );
}
for (const l of pending) {
  const families = familiesOf(buildLevel(l), []);
  console.log(`\n${l.pattern}: ${families.map((f) => f.main.display).join(' ')}`);
}

// Families by points, per hundred (100s … 400s, 500): in these levels, and in
// every candidate (what the points formula is tuned on).
function split(points) {
  const hundreds = [0, 0, 0, 0, 0];
  for (const p of points) hundreds[tierOf(p)]++;
  return hundreds
    .map((n, i) => `${i < 4 ? `${i + 1}xx` : '500'} ${Math.round((100 * n) / points.length)}%`)
    .join(' · ');
}
const candFreqs = cands.flatMap((c) => mainWords(c.words).map((e) => e.lemmaFreq));
const levelPoints = data.flatMap((l) => familiesOf(buildLevel(l), []).map((f) => f.points));
console.log(`\nPoints des familles : ${split(levelPoints)}`);
console.log(`Sur tous les candidats : ${split(candFreqs.map(lemmaPoints))}`);
if (process.env.DUMP_FREQS) writeFileSync(process.env.DUMP_FREQS, JSON.stringify(candFreqs));
const perLength = {};
for (const c of cands) perLength[c.pattern.length] = (perLength[c.pattern.length] ?? 0) + 1;
const lengths = Object.entries(perLength).map(([len, n]) => `${n} de ${len} lettres`);
console.log(`${cands.length} niveaux possibles : ${lengths.join(', ')}`);
const ok = levels.filter((l) => l.ok).length;
console.log(`${levels.length} niveaux (${ok} dans les seuils), ${pending.length} à revoir`);
