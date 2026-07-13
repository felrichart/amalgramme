/*
 * Rules for a community-challenge word: normalisation and validation, shared by
 * the create form and re-implemented server-side in the Worker (keep in sync).
 *
 * A word is 3–12 letters with optional separators — space, hyphen, apostrophe —
 * that behave like gaps on the wheel (see puzzle.js parseAnswer). At most 4
 * separators total; any other punctuation or digit is rejected. The four indices
 * must all be distinct. The énigme must be
 * spellable from the pooled letters of the four indices (the real game rule: the
 * secret is typed by spending tiles drawn from the four wheels — see
 * useGameState.trayRows/typeSecret).
 */
import { normalize } from './puzzle.js';

export const MAX_LETTERS = 12;
export const MIN_LETTERS = 3;
const MAX_SEPARATOR = 4;

function isSeparator(ch) {
  return ch === ' ' || ch === '-' || ch === "'";
}

/*
 * Lowercase, strip diacritics ("bébé" → "bebe"), fold the typographic apostrophe,
 * collapse runs of separators, and drop leading/trailing separators. Preserves
 * the separators space, hyphen and apostrophe.
 */
export function normalizeWord(raw) {
  const chars = String(raw ?? '')
    .trim()
    .replace(/’/g, "'")
    .split('')
    .map((ch) => (isSeparator(ch) ? ch : normalize(ch)));
  let out = '';
  let prevSep = true; // start as a separator so leading ones drop
  for (const ch of chars) {
    const sep = isSeparator(ch);
    if (sep && prevSep) continue;
    out += ch;
    prevSep = sep;
  }
  return out.replace(/[ \-']+$/, '');
}

/* Validate one already-normalised word; returns an error code or null. */
export function wordError(word) {
  if (!word) return 'empty';
  let letters = 0;
  let separator = 0;
  let other = 0;
  for (const ch of word) {
    if (ch >= 'a' && ch <= 'z') letters++;
    else if (isSeparator(ch)) separator++;
    else other++;
  }
  if (other > 0) return 'char';
  if (letters < 1) return 'empty';
  if (letters < MIN_LETTERS) return 'short';
  if (letters > MAX_LETTERS) return 'long';
  if (separator > MAX_SEPARATOR) return 'sep';
  return null;
}

/* Multiset of a–z letters in a word (separators ignored). */
export function letterBag(word) {
  const bag = {};
  for (const ch of word) if (ch >= 'a' && ch <= 'z') bag[ch] = (bag[ch] || 0) + 1;
  return bag;
}

/* True when every letter of `secret` can be drawn from the pooled letters of the
 * index `words` — the constraint that makes a challenge solvable. */
export function canBuildSecret(secret, words) {
  const pool = {};
  for (const w of words) {
    const bag = letterBag(w);
    for (const ch in bag) pool[ch] = (pool[ch] || 0) + bag[ch];
  }
  const need = letterBag(secret);
  for (const ch in need) if ((pool[ch] || 0) < need[ch]) return false;
  return true;
}

/*
 * Validate a full challenge from raw user input. Normalises every field and
 * returns per-field error codes plus `ok` (all fields filled, valid and the
 * énigme buildable) and the `normalized` values ready to submit.
 */
export function validateChallenge({ author, words, secret }) {
  const nWords = (words ?? []).map(normalizeWord);
  const nSecret = normalizeWord(secret ?? '');
  const wordErrs = nWords.map(wordError);
  /* Flag any index word that repeats an earlier one (ignoring blanks). */
  const seen = new Map();
  nWords.forEach((w, i) => {
    if (!w || wordErrs[i]) return;
    if (seen.has(w)) wordErrs[i] = 'dup';
    else seen.set(w, i);
  });
  const secretErr = wordError(nSecret);
  const authorErr = author && author.trim() ? null : 'empty';
  const wordsValid = wordErrs.every((e) => !e) && nWords.length === 4;
  const buildable = wordsValid && !secretErr && canBuildSecret(nSecret, nWords);
  const ok = !authorErr && wordsValid && !secretErr && buildable;
  return {
    ok,
    author: authorErr,
    words: wordErrs,
    secret: secretErr,
    buildable,
    normalized: { author: (author ?? '').trim(), words: nWords, secret: nSecret },
  };
}
