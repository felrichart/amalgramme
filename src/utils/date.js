/* ISO date helpers. Dates are plain `YYYY-MM-DD` strings, which compare lexicographically. */

export const pad = (n) => String(n).padStart(2, '0');

/* `YYYY-MM-DD` from calendar parts (month is 1-based). */
export function isoDate(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/* Device-local today. */
export function deviceToday() {
  const d = new Date();
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/* Add `n` calendar days (UTC math keeps it timezone-agnostic). */
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
