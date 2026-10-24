/*
 * Generates lab/lexilouhette/levels.json (the game's data) and levels.report.md
 * (what each level holds, what was weeded out) from the Lexique 4 table in data/
 * (or another one: `npm run lab:levels -- path/to.tsv`, or LEXIQUE=…).
 *
 * Manual settings live in levels.config.json, see lab/lexilouhette/README.md.
 * Levels already in levels.json keep their date and pattern (their words follow the
 * config); new ones are appended until `count` levels pass the thresholds. Pass
 * --fresh to start over. Seeded: same table and config, same levels.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { keyOf, buildLevel, familiesOf, maxScore } from '../game.js';

const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const file = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const tsvPath =
  args.find((a) => !a.startsWith('--')) ?? process.env.LEXIQUE ?? file('data/Lexique4.1.tsv');
const config = {
  start: '2026-10-24',
  count: 20,
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

const LENGTHS = [4, 5, 6, 7];
// Blanks per level: at least this many, and at most half the word (rounded down,
// so a 5-letter word shows 3 letters for 2 blanks).
const MIN_BLANKS = 2;
// A word players are likely to know; levels need enough of them, across enough lemmas.
const KNOWN_FREQ = 2;
const MIN_KNOWN = 10;
const MAX_KNOWN = 50;
// Distinct lemmas (word families) per level.
const MIN_LEMMAS = 6;
const MAX_PLURALS = 0.4;
const MAX_TOTAL = 70;
// Share of known words that only exist as conjugated verbs (…ANT, …IEZ farms).
const MAX_VERB_FORMS = 0.5;
// Shown endings that make a conjugation farm.
const VERB_ENDINGS = ['ANT', 'ENT', 'IEZ', 'ONS', 'AIT', 'AIS', 'ERA', 'IRA'];
// A blank where most known words share a letter (_O_C_E → mostly _OUCHE): that
// letter should be shown instead, which is another candidate.
const MAX_SAME_LETTER = 0.5;
// Share of a level's words already used by picked levels.
const MAX_OVERLAP = 0.2;
// Levels sharing a first or last pattern char, so they don't all start with C or
// end in a shown E. A blank edge is the natural case and gets more room.
const MAX_SAME_EDGE = { shown: 3, blank: 13 };
// Frequency (per million) given to words added by hand.
const ADDED_FREQ = 1;

const LETTERS = /^[a-zàâäçéèêëîïôöûùüÿ]+$/;

/*
 * One entry per unaccented spelling, shown as its most frequent form, in the
 * family of its most common reading's lemma (venez → venir, mort → mourir).
 */
function loadDictionary(path) {
  const byKey = new Map();
  for (const line of readFileSync(path, 'utf8').split('\n').slice(1)) {
    const c = line.split('\t');
    const form = c[0];
    if (!form || !LETTERS.test(form) || !LENGTHS.includes(form.length)) continue;
    const freq = Number(c[10]) || 0;
    const lemmaFreq = Number(c[11]) || 0;
    const key = keyOf(form).toLowerCase();
    let e = byKey.get(key);
    if (!e) {
      e = { key, display: form, freq, lemma: null, lemmaFreq: 0, forms: new Set() };
      e.verbForm = true;
      byKey.set(key, e);
    }
    // A conjugated verb form, unless some reading is an infinitive or another class.
    if ((!c[4].startsWith('VER') && c[4] !== 'AUX') || c[8].startsWith('inf')) e.verbForm = false;
    if (freq > e.freq) Object.assign(e, { display: form, freq });
    if (!e.lemma || lemmaFreq > e.lemmaFreq) Object.assign(e, { lemma: c[3], lemmaFreq });
    e.forms.add(form);
  }
  const byLength = new Map(LENGTHS.map((len) => [len, []]));
  for (const e of byKey.values()) {
    if (!e.lemmaFreq) Object.assign(e, { lemma: e.display, lemmaFreq: e.freq });
    byLength.get(e.key.length).push(e);
  }
  return byLength;
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
    if (blanks >= MIN_BLANKS && blanks <= Math.floor(len / 2)) out.push(shown);
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
    lemma: w,
    lemmaFreq: ADDED_FREQ,
    forms: new Set([w]),
    verbForm: false,
  }));
  return {
    kept: [...words.filter((e) => !isOut(e)), ...added],
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
        if (skipped.has(pattern)) continue;
        const c = evaluate(pattern, curate(pattern, group).kept);
        if (c) found.push(c);
      }
    }
  }
  return found;
}

/* The candidate level for `pattern`, or null when it fails a threshold. */
function evaluate(pattern, words) {
  if (words.length > MAX_TOTAL) return null;
  if (VERB_ENDINGS.some((end) => pattern.endsWith(end))) return null;
  const known = words.filter((e) => e.freq >= KNOWN_FREQ);
  if (known.length < MIN_KNOWN || known.length > MAX_KNOWN) return null;
  const lemmas = new Set(words.map((e) => e.lemma)).size;
  const plurals = known.filter((e) => /[sx]$/.test(e.key)).length;
  const verbForms = known.filter((e) => e.verbForm).length;
  if (lemmas < MIN_LEMMAS || plurals > known.length * MAX_PLURALS) return null;
  if (verbForms > known.length * MAX_VERB_FORMS) return null;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== '_') continue;
    const counts = {};
    for (const e of known) counts[e.key[i]] = (counts[e.key[i]] ?? 0) + 1;
    if (Math.max(...Object.values(counts)) > known.length * MAX_SAME_LETTER) return null;
  }
  return { pattern, known: known.length, lemmas, words };
}

// Levels that play alike: same shown letters (C_N_I__ / C_N_I___) or same start
// (BA__E / BA_A___, COU_E__ / CO_T___).
const shownLetters = (pattern) => pattern.replaceAll('_', '');
function alike(a, b) {
  if (shownLetters(a) === shownLetters(b)) return true;
  const [pa, pb] = [a.slice(0, 2), b.slice(0, 2)];
  return a.slice(0, 3) === b.slice(0, 3) || (pa === pb && !pa.includes('_'));
}

function edgeRoom(picked, c, at) {
  const ch = c.pattern.at(at);
  const max = ch === '_' ? MAX_SAME_EDGE.blank : MAX_SAME_EDGE.shown;
  return picked.filter((p) => p.pattern.at(at) === ch).length < max;
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
 * The previous levels, then pinned patterns, then new picks until `count` levels
 * pass the thresholds. Picks rotate lengths, favour reviewed patterns, then many
 * lemmas and few obscure words, and avoid looking like a level already there.
 */
function pick(byLength, cands, rand) {
  const levels = previousLevels(byLength);
  const nextDate = () => (levels.length ? addDays(levels.at(-1).date, 1) : config.start);
  for (const pattern of config.pinned) {
    if (!levels.some((l) => l.pattern === pattern))
      levels.push(levelFor(byLength, pattern, nextDate()));
  }
  const used = new Set(levels.flatMap((l) => l.words.map((e) => e.key)));
  const ranked = cands
    .map((c) => ({
      c,
      r:
        (reviewed.has(c.pattern) ? 10 : 0) +
        Math.min(1, c.lemmas / c.known) +
        c.known / c.words.length +
        rand() * 0.4,
    }))
    .sort((a, b) => b.r - a.r)
    .map((x) => x.c);
  const passing = () => levels.filter((l) => l.ok).length;
  for (let turn = 0, misses = 0; passing() < config.count && misses < LENGTHS.length; turn++) {
    const len = LENGTHS[turn % LENGTHS.length];
    const next = ranked.find(
      (c) =>
        c.pattern.length === len &&
        !levels.some((l) => alike(l.pattern, c.pattern)) &&
        edgeRoom(levels, c, 0) &&
        edgeRoom(levels, c, -1) &&
        c.words.filter((e) => used.has(e.key)).length <= c.words.length * MAX_OVERLAP,
    );
    if (!next) {
      misses++;
      continue;
    }
    misses = 0;
    levels.push({ date: nextDate(), pattern: next.pattern, words: next.words, ok: true });
    for (const e of next.words) used.add(e.key);
  }
  return levels;
}

const round = (f) => Number(f.toPrecision(3));

/* Markdown: per level, its word families with points, the merged accent variants
 * and what the manual settings took out. */
function report(levels, byLength) {
  const out = ['# Lexilouhette — niveaux générés', ''];
  out.push('Généré par `npm run lab:levels`. Ne pas éditer : régler `levels.config.json`.', '');
  out.push('Par famille : `lemme (points du lemme) : mot +bonus · …`.', '');
  for (const l of levels) {
    const level = buildLevel(l);
    const all = byLength.get(l.pattern.length).filter((e) => fits(l.pattern, e.key));
    const { removed } = curate(l.pattern, all);
    const tags = [reviewed.has(l.pattern) ? 'revu' : '**À REVOIR**'];
    if (!l.ok) tags.push('**sous les seuils**');
    const families = familiesOf(level, [], true).length;
    out.push(
      `## ${l.date} · \`${l.pattern}\` · ${l.words.length} mots, ${families} familles · max ${maxScore(level)} · ${tags.join(' · ')}`,
      '',
    );
    const byLemma = new Map();
    for (const a of level.answers.values()) {
      if (!byLemma.has(a.lemma)) byLemma.set(a.lemma, []);
      byLemma.get(a.lemma).push(a);
    }
    for (const [lemma, words] of byLemma) {
      out.push(
        `- ${lemma} (${words[0].lemmaPoints}) : ${words.map((a) => `${a.display} +${a.bonus}`).join(' · ')}`,
      );
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
const levels = pick(byLength, candidates(byLength), rand).map((l) => ({
  ...l,
  words: [...l.words]
    .sort((a, b) => b.freq - a.freq)
    .map((e) => [e.display, round(e.freq), e.lemma, round(e.lemmaFreq)]),
}));

const data = levels.map(({ date, pattern, words }) => ({ date, pattern, words }));
writeFileSync(file('levels.json'), JSON.stringify(data) + '\n');
writeFileSync(file('levels.report.md'), report(levels, byLength));

const pending = levels.filter((l) => !reviewed.has(l.pattern));
for (const l of levels) {
  const tags = [reviewed.has(l.pattern) ? 'revu' : 'À REVOIR'];
  if (!l.ok) tags.push('sous les seuils');
  const families = new Set(l.words.map((w) => w[2])).size;
  console.log(
    `${l.date}  ${l.pattern.padEnd(8)} ${String(l.words.length).padStart(3)} mots ${String(families).padStart(3)} familles  ${tags.join(', ')}`,
  );
}
for (const l of pending) console.log(`\n${l.pattern}: ${l.words.map((w) => w[0]).join(' ')}`);

// Families by the points of their most common word (the one usually found
// first), per hundred: 100s … 400s, 500 and up.
const hundreds = [0, 0, 0, 0, 0];
let familyCount = 0;
for (const l of data) {
  const seen = new Set();
  for (const a of buildLevel(l).answers.values()) {
    if (seen.has(a.lemma)) continue;
    seen.add(a.lemma);
    hundreds[Math.min(4, Math.floor((a.lemmaPoints + a.bonus) / 100) - 1)]++;
    familyCount++;
  }
}
const split = hundreds.map((n, i) => {
  const label = i < 4 ? `${i + 1}xx` : '500+';
  return `${label} ${Math.round((100 * n) / familyCount)}%`;
});
console.log(`\nPoints des familles : ${split.join(' · ')}`);
const ok = levels.filter((l) => l.ok).length;
console.log(`${levels.length} niveaux (${ok} dans les seuils), ${pending.length} à revoir`);
