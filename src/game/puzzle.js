import { PUZZLES } from '../data/challenges.js'

/* Puzzle for a level index (clamped to the bank). */
export function puzzleForLevel(idx) {
  const i = Math.min(Math.max(0, idx | 0), PUZZLES.length - 1)
  return PUZZLES[i]
}

/*
 * Each word becomes a set of letter tiles for its wheel. `letters` carries a
 * stable id per tile so the wheel can shuffle positions and the drawn path can
 * reference tiles even when the answer repeats a letter. Spaces are stripped;
 * `text` is the answer the drawn path is compared against.
 */
export function buildWords(puzzle) {
  return puzzle.words.map((raw) => {
    const text = raw.replace(/ /g, '')
    return {
      text,
      length: text.length,
      letters: text.split('').map((ch, id) => ({ id, ch })),
    }
  })
}

/* Deterministic Fisher-Yates so shuffles vary by seed without Math.random. */
export function shuffle(arr, seed = 0) {
  const a = arr.slice()
  let s = (seed * 9301 + 49297) % 233280 || 1
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* Strip diacritics so a typed "é" matches the accent-free answers. */
export function normalize(ch) {
  return ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
