/* Separators inside an answer — space, hyphen, apostrophe — all render as a gap
 * and are dropped from the letter wheel (see parseAnswer). */
const SEPARATOR = /[ \-']/;

/*
 * Split a raw answer into its separator-free form plus gap metadata. `text` is
 * what the player's input is compared against (no separators); `display` keeps
 * them for showing the solved answer; `layout[i]` is true where a separator
 * followed that letter, so the UI renders a gap between the parts of a
 * multi-part answer. Separators are space, hyphen and apostrophe.
 */
function parseAnswer(raw) {
  const text = raw.replace(/[ \-']/g, '');
  const layout = [];
  raw.split('').forEach((ch) => {
    if (SEPARATOR.test(ch)) layout[layout.length - 1] = true;
    else layout.push(false);
  });
  return { text, display: raw, length: text.length, layout };
}

/*
 * Each word becomes a set of letter tiles for its wheel. `letters` carries a
 * stable id per tile so the wheel can shuffle positions and the drawn path can
 * reference tiles even when the answer repeats a letter. Spaces are stripped for
 * the wheel (see parseAnswer for the shared text/display/layout handling).
 */
export function buildWords(puzzle) {
  return puzzle.words.map((raw) => {
    const a = parseAnswer(raw);
    return { ...a, letters: a.text.split('').map((ch, id) => ({ id, ch })) };
  });
}

/* Secret the player types to guess a level's theme; spaces render as a gap. */
export function buildSecret(puzzle) {
  return parseAnswer(puzzle.secret);
}

/* Optional extra hint (the "indice supplémentaire"), revealed already-solved on
 * demand from the secret keyboard; null when the puzzle carries none (old levels). */
export function buildHint(puzzle) {
  return puzzle.hint ? parseAnswer(puzzle.hint) : null;
}

/* Deterministic Fisher-Yates so shuffles vary by seed without Math.random. */
export function shuffle(arr, seed = 0) {
  const a = arr.slice();
  let s = (seed * 9301 + 49297) % 233280 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Strip diacritics so a typed "é" matches the accent-free answers. Shared with
 * the word rules (and the Worker) — see shared/word-rules.js. */
export { normalizeChar as normalize } from '../../shared/word-rules.js';
