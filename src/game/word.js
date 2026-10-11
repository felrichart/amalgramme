/*
 * Challenge-word rules for the create form: the shared rules (shared/word-rules.js,
 * also enforced by the Worker) plus the form-only author check.
 */
import { checkChallenge } from '../../shared/word-rules.js';

export {
  MAX_LETTERS,
  MIN_LETTERS,
  MAX_SEPARATOR,
  WORD_COUNT,
  normalizeWord,
  wordError,
  canBuildSecret,
} from '../../shared/word-rules.js';

/* checkChallenge plus a required author; `normalized` gains the trimmed author. */
export function validateChallenge({ author, words, secret }) {
  const res = checkChallenge({ words, secret });
  const name = (author ?? '').trim();
  const authorErr = name ? null : 'empty';
  return {
    ...res,
    ok: res.ok && !authorErr,
    author: authorErr,
    normalized: { author: name, ...res.normalized },
  };
}
