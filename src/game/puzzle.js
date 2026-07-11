import { PUZZLES_NEW as PUZZLES } from '../data/challenges.js';

/* Puzzle for a level index (clamped to the bank). */
export function puzzleForLevel(idx) {
  const i = Math.min(Math.max(0, idx | 0), PUZZLES.length - 1);
  return PUZZLES[i];
}

/*
 * Split a raw answer into its space-free form plus gap metadata. `text` is what
 * the player's input is compared against (no spaces); `display` keeps the spaces
 * for showing the solved answer; `layout[i]` is true where a space followed that
 * letter, so the UI renders a gap between the parts of a multi-word answer.
 */
function parseAnswer(raw) {
  const text = raw.replace(/ /g, '');
  const layout = [];
  raw.split('').forEach((ch) => {
    if (ch === ' ') layout[layout.length - 1] = true;
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

/*
 * Tile pool for the secret keyboard: every letter of the 4 answer words with its
 * total count. The player spends these tiles typing the secret; a letter absent
 * here has no key. Words carry no diacritics so letters are already a–z.
 */
export function buildPool(words) {
  const total = {};
  words.forEach((w) => w.letters.forEach(({ ch }) => (total[ch] = (total[ch] || 0) + 1)));
  return total;
}

/*
 * Secret tray grouped by source word: one row per answer word, holding that
 * word's letters in order. Unlike buildPool (which merges all four into per-letter
 * counts), this keeps a letter shared by two words as two separate tiles, so every
 * tile maps to a specific wheel. Spend/remaining stays count-based (see buildPool).
 * Each row is shuffled so the tray doesn't spell out the answer word.
 */
export function buildPoolByWord(words) {
  return words.map((w, i) =>
    shuffle(
      w.letters.map(({ ch }) => ch),
      (i + 1) * 31,
    ),
  );
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

/* Strip diacritics so a typed "é" matches the accent-free answers. */
export function normalize(ch) {
  return ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
