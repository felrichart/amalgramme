/*
 * Writes data/dictionnaire.tsv, the words the games draw from: the Grammalecte
 * lexicon (data/lexique-grammalecte-fr-v7.7.zip, the LibreOffice spellchecker's)
 * in its common, modern and classic spellings, minus proper nouns and
 * abbreviations, every length kept: `npm run lab:dico`.
 *
 * Columns: Mot, Lemme, Etiquettes (Grammalecte's: nature, gender, number, verb
 * form), FreqMot, FreqLemme (per million words, the lemma's summed over its
 * forms). œ and æ are spelled out (soeur), as players type them.
 */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const file = (name) => fileURLToPath(new URL(`../data/${name}`, import.meta.url));
const text = execFileSync(
  'unzip',
  ['-p', file('lexique-grammalecte-fr-v7.7.zip'), 'lexique-grammalecte-fr-v7.7.txt'],
  { encoding: 'utf8', maxBuffer: 1 << 30 },
);
const lines = text.split('\n');
const start = lines.findIndex((l) => l.startsWith('id\tfid')) + 1;

// Sub-dictionaries: * common, M modern, C classic; R (1990 reform), A (other
// variants) and X (dubious) are left out. "*/R" is the lemma's, then the form's.
const KEPT = new Set(['*', 'M', 'C']);
// Notes left out: unit symbols (kcal) and dotted abbreviations (chap., janv.). Clipped
// words (radio, auto) are kept.
const SKIPPED_NOTES = new Set(['symb', 'abty']);
const spellOut = (w) => w.replaceAll('œ', 'oe').replaceAll('æ', 'ae');
// Grammalecte's frequency is a percentage.
const PER_MILLION = 1e4;

const rows = new Map();
for (const line of lines.slice(start)) {
  const c = line.split('\t');
  if (c.length < 20) continue;
  const [form, lemma, tags, notes, sub, freq] = [c[2], c[3], c[4], c[7], c[10], c[18]].map(
    (x, i) => (i < 2 ? spellOut(x) : x),
  );
  if (!sub.split('/').every((s) => KEPT.has(s))) continue;
  if (notes.split(' ').some((n) => SKIPPED_NOTES.has(n))) continue;
  if (tags.split(' ').includes('npr')) continue;
  // One row per form and lemma, its tags merged (porter: ipre, impe).
  const id = `${form}\t${lemma}`;
  const row = rows.get(id) ?? { form, lemma, tags: new Set(), freq: 0 };
  for (const t of tags.split(' ')) row.tags.add(t);
  row.freq = Math.max(row.freq, Number(freq) * PER_MILLION || 0);
  rows.set(id, row);
}

const lemmaFreqs = new Map();
for (const r of rows.values()) lemmaFreqs.set(r.lemma, (lemmaFreqs.get(r.lemma) ?? 0) + r.freq);

const round = (f) => (f ? Number(f.toPrecision(3)) : 0);
const out = ['Mot\tLemme\tEtiquettes\tFreqMot\tFreqLemme'];
for (const r of rows.values()) {
  const freqs = [round(r.freq), round(lemmaFreqs.get(r.lemma))];
  out.push([r.form, r.lemma, [...r.tags].join(' '), ...freqs].join('\t'));
}
writeFileSync(file('dictionnaire.tsv'), `${out.join('\n')}\n`);
console.log(`${out.length - 1} lignes, ${lemmaFreqs.size} lemmes`);
