/*
 * Writes data/lexique.tsv, the words the games draw from: Lexique 4.1 minus the
 * words the Grammalecte spellchecker doesn't know (data/grammalecte.txt) and the
 * hand-made lists of proper nouns (data/exclus-noms-propres.txt) and words that
 * don't exist (data/exclus-inconnus.txt), every length kept. Run it again after
 * editing those lists: `npm run lab:lexique`.
 *
 * Columns: Mot, Lemme, Cgram, Genre, Nombre, InfoVER, FreqMot, FreqOrtho, FreqLemme,
 * Preval, Phono, NbSyll (see data/README-Lexique.txt). Fixed once here rather than
 * in every reader:
 * - a verb whose lemma another word also has is marked "(verbe)" (se fier, fier);
 * - FreqLemme and Preval are their lemma's highest over all of Lexique, some rows
 *   understating them (bougiez: 0.4 for bouger's 193).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = (name) => fileURLToPath(new URL(`../data/${name}`, import.meta.url));
const words = (name) =>
  new Set(
    readFileSync(file(name), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  );

const names = words('exclus-noms-propres.txt');
const unknown = words('exclus-inconnus.txt');
// Lexique spells œ as "oe" (soeur), Grammalecte doesn't.
const unligature = (w) => w.replaceAll('œ', 'oe').replaceAll('æ', 'ae');
const spelled = new Set([...words('grammalecte.txt')].map(unligature));

const rows = readFileSync(file('Lexique4.1.tsv'), 'utf8')
  .split('\n')
  .slice(1)
  .filter(Boolean)
  .map((line) => line.split('\t'));

const isVerb = (c) => c[4].startsWith('VER') || c[4] === 'AUX';
const otherLemmas = new Set(rows.filter((c) => !isVerb(c)).map((c) => c[3]));
const lemmaOf = (c) => (isVerb(c) && otherLemmas.has(c[3]) ? `${c[3]} (verbe)` : c[3]);

const lemmaFreqs = new Map();
const prevals = new Map();
for (const c of rows) {
  const lemma = lemmaOf(c);
  lemmaFreqs.set(lemma, Math.max(lemmaFreqs.get(lemma) ?? 0, Number(c[11]) || 0));
  if (c[32] !== '') prevals.set(c[3], Math.max(prevals.get(c[3]) ?? 0, Number(c[32])));
}

const HEADER =
  'Mot Lemme Cgram Genre Nombre InfoVER FreqMot FreqOrtho FreqLemme Preval Phono NbSyll';
const out = [HEADER.replaceAll(' ', '\t')];
for (const c of rows) {
  const [form, , , lemma] = c;
  if (names.has(form) || unknown.has(form) || unknown.has(lemma)) continue;
  if (!spelled.has(unligature(form.toLowerCase()))) continue;
  const marked = lemmaOf(c);
  const freqs = [c[9], c[10], lemmaFreqs.get(marked), prevals.get(lemma) ?? ''];
  out.push([form, marked, c[4], c[6], c[7], c[8], ...freqs, c[1], c[25]].join('\t'));
}
writeFileSync(file('lexique.tsv'), `${out.join('\n')}\n`);
console.log(`${out.length - 1} lignes (sur ${rows.length}), ${names.size + unknown.size} exclus`);
