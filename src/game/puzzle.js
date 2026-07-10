import { PUZZLES } from '../data/challenges.js'

/* Puzzle for a level index (clamped to the bank). */
export function puzzleForLevel(idx) {
  const i = Math.min(Math.max(0, idx | 0), PUZZLES.length - 1)
  return PUZZLES[i]
}

/*
 * A word may contain spaces (multi-word answers). We model it as a flat list of
 * slots where each slot is either a letter cell (fillable) or a gap (fixed space).
 * `answer` keeps only the letters, in order, for comparison and the letter pool.
 */
export function buildWord(raw) {
  const slots = []
  let letterIndex = 0
  for (const ch of raw.split('')) {
    if (ch === ' ') slots.push({ gap: true })
    else slots.push({ gap: false, letterIndex: letterIndex++, solution: ch })
  }
  const answer = raw.replace(/ /g, '')
  return { raw, slots, answer, length: answer.length }
}

export function buildWords(puzzle) {
  return puzzle.words.map((w) => buildWord(w))
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
