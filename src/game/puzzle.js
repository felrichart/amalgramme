import { isSeparator } from '../../shared/word-rules.js';

/* Strip diacritics so a typed "é" matches the accent-free answers. */
export { normalizeChar as normalize } from '../../shared/word-rules.js';

/*
 * Split a raw answer into `text` (separators dropped — what input is compared
 * against), `display` (as written) and `layout`, where `layout[i]` is true when a
 * separator follows letter i so the UI renders a gap there.
 */
function parseAnswer(raw) {
  const layout = [];
  for (const ch of raw) {
    if (isSeparator(ch)) layout[layout.length - 1] = true;
    else layout.push(false);
  }
  const text = [...raw].filter((ch) => !isSeparator(ch)).join('');
  return { text, display: raw, length: text.length, layout };
}

/* Each word plus its wheel tiles; a tile's stable `id` lets the wheel shuffle and
 * the drawn path tell apart repeated letters. */
export function buildWords(puzzle) {
  return puzzle.words.map((raw) => {
    const a = parseAnswer(raw);
    return { ...a, letters: [...a.text].map((ch, id) => ({ id, ch })) };
  });
}

export function buildSecret(puzzle) {
  return parseAnswer(puzzle.secret);
}

/* Answer boxes for `typed` so far: one per letter, `gapAfter` where a separator was. */
export function answerSlots(answer, typed) {
  return answer.layout.map((gapAfter, i) => ({ ch: typed[i] || '', gapAfter }));
}

/* Identifies one secret-keyboard tile: its tray row and per-word tile id. */
export const tileKey = (r, id) => `${r}-${id}`;

/* Linear congruential step, the project's seeded randomness (no Math.random). */
const M = 233280;
const lcg = (s) => (s * 9301 + 49297) % M;

/* Deterministic pseudo-random index in [0, n) for `seed`. */
export function seededIndex(seed, n) {
  return Math.floor((lcg(seed) / M) * n);
}

/* Deterministic Fisher-Yates. */
export function shuffle(arr, seed = 0) {
  const a = arr.slice();
  let s = lcg(seed) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = lcg(s);
    const j = Math.floor((s / M) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
