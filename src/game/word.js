/*
 * Challenge-word rules for the create form. The normalisation/validation
 * primitives live in shared/word-rules.js (shared verbatim with the Worker); this
 * module re-exports the ones the UI needs and adds validateChallenge — the
 * form-facing check that turns raw input into per-field error codes.
 */
import {
  MAX_LETTERS,
  MIN_LETTERS,
  normalizeWord,
  wordError,
  canBuildSecret,
} from '../../shared/word-rules.js';

export { MAX_LETTERS, MIN_LETTERS, normalizeWord, wordError, canBuildSecret };

/*
 * Validate a full challenge from raw user input. Normalises every field and
 * returns per-field error codes plus `ok` (all fields filled, valid and the
 * énigme buildable) and the `normalized` values ready to submit.
 *
 * `hint` (the "indice supplémentaire") is required: a valid word, distinct from
 * the four indices and the énigme. It is not part of the buildability rule — a
 * bonus clue, not a feeder wheel.
 */
export function validateChallenge({ author, words, secret, hint }) {
  const nWords = (words ?? []).map(normalizeWord);
  const nSecret = normalizeWord(secret ?? '');
  const nHint = normalizeWord(hint ?? '');
  const wordErrs = nWords.map(wordError);
  /* Flag any index word that repeats an earlier one (ignoring blanks). */
  const seen = new Map();
  nWords.forEach((w, i) => {
    if (!w || wordErrs[i]) return;
    if (seen.has(w)) wordErrs[i] = 'dup';
    else seen.set(w, i);
  });
  const secretErr = wordError(nSecret);
  let hintErr = wordError(nHint);
  if (!hintErr && (nWords.includes(nHint) || nHint === nSecret)) hintErr = 'dup';
  const authorErr = author && author.trim() ? null : 'empty';
  const wordsValid = wordErrs.every((e) => !e) && nWords.length === 4;
  const buildable = wordsValid && !secretErr && canBuildSecret(nSecret, nWords);
  const ok = !authorErr && wordsValid && !secretErr && buildable && !hintErr;
  return {
    ok,
    author: authorErr,
    words: wordErrs,
    secret: secretErr,
    hint: hintErr,
    buildable,
    normalized: {
      author: (author ?? '').trim(),
      words: nWords,
      secret: nSecret,
      hint: nHint || null,
    },
  };
}
