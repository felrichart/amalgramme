import { PUZZLES_NEW as PUZZLES } from '../data/challenges.js';

/* Puzzle for a level index (clamped to the bank). */
export function puzzleForLevel(idx) {
  const i = Math.min(Math.max(0, idx | 0), PUZZLES.length - 1);
  return PUZZLES[i];
}

/*
 * Each word becomes a set of letter tiles for its wheel. `letters` carries a
 * stable id per tile so the wheel can shuffle positions and the drawn path can
 * reference tiles even when the answer repeats a letter. Spaces are stripped
 * for the wheel and for `text` (the answer the drawn path is compared against),
 * but kept in `layout` so a two-word answer renders a gap between its parts.
 */
export function buildWords(puzzle) {
  return puzzle.words.map((raw) => {
    const text = raw.replace(/ /g, '');
    /* Per answer-slot flag: true where the original word had a space after. */
    const layout = [];
    raw.split('').forEach((ch) => {
      if (ch === ' ') layout[layout.length - 1] = true;
      else layout.push(false);
    });
    return {
      text,
      length: text.length,
      layout,
      letters: text.split('').map((ch, id) => ({ id, ch })),
    };
  });
}

/* Secret letters (spaces stripped) the player types to guess a level's theme. */
export function buildSecret(puzzle) {
  const text = puzzle.secret.replace(/ /g, '');
  return { text, length: text.length };
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
