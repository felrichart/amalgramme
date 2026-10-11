/*
 * Merge rule for one level's save when a device and an account disagree: the
 * more advanced save wins (finished > more pieces found > more help spent), the
 * most recent breaks ties. Never loses progress, so syncing needs no prompt.
 * Shared by the client and the Worker (same constraints as constants.js).
 */

export const SAVE_MAX_BYTES = 4096;

export function isSave(s) {
  return !!s && typeof s === 'object' && !Array.isArray(s) && Array.isArray(s.solved);
}

function rank(s) {
  const found = s.solved.filter(Boolean).length + (s.secretFound ? 1 : 0);
  return [s.completed ? 1 : 0, found, Number(s.helpUsed) || 0, Number(s.updatedAt) || 0];
}

/* The save to keep out of `a` and `b` (either may be missing). */
export function pickSave(a, b) {
  if (!isSave(a)) return isSave(b) ? b : null;
  if (!isSave(b)) return a;
  const ra = rank(a);
  const rb = rank(b);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] > rb[i] ? a : b;
  return a;
}
