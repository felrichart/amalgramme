/*
 * Rules for a challenge word — normalisation, validation and the letter-pool
 * check — shared verbatim by the create form (src/game/word.js) and the
 * Cloudflare Worker (server/worker.js) so both accept exactly the same words.
 *
 * Pure and dependency-free: it must bundle for the browser (Vite) and the Worker
 * (esbuild) alike. Editing anything here changes server-side validation too, so
 * redeploy the Worker afterwards (`wrangler deploy` from server/, see server/README.md).
 *
 * A word is 3–12 letters with optional separators — space, hyphen, apostrophe —
 * that behave like gaps on the wheel (see puzzle.js parseAnswer). At most 4
 * separators; any other punctuation or digit is rejected. The énigme must be
 * spellable from the pooled letters of the four index words (the real game rule:
 * the secret is typed by spending tiles drawn from the four wheels).
 */
export const MAX_LETTERS = 12;
export const MIN_LETTERS = 3;
export const MAX_SEPARATOR = 4;

/* Strip diacritics and lowercase one character ("É" → "e"), so a typed accent
 * matches the accent-free answers. */
export function normalizeChar(ch) {
  return ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function isSeparator(ch) {
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
    .map((ch) => (isSeparator(ch) ? ch : normalizeChar(ch)));
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
