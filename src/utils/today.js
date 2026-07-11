/*
 * Resolves today's date (YYYY-MM-DD), keyed on the device's own timezone. It
 * prefers an authoritative time API so the daily can't be shifted by a wrong or
 * spoofed device clock, but falls back to the device clock when the API is
 * unreachable — a casual daily puzzle isn't worth blocking app load over.
 * `resolveToday` must be awaited once at startup before any module reads `getToday`.
 */

/* IANA timezone reported by the device, e.g. "Europe/Paris". */
export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/* Device-local today (YYYY-MM-DD), the fallback when the time API is unreachable. */
function deviceToday() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

let cached = null;

/* Resolved today's date. Throws until `resolveToday` has been awaited. */
export function getToday() {
  if (cached === null) throw new Error('today not resolved: call resolveToday first');
  return cached;
}

/* Resolve today's date via the time API, falling back to the device clock on any
 * failure. Never rejects, so app load proceeds even offline. */
export async function resolveToday() {
  try {
    const tz = deviceTimeZone();
    const url = `https://timeapi.io/api/time/current/zone?timeZone=${encodeURIComponent(tz)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`time API failed: HTTP ${res.status}`);
    const { year, month, day } = await res.json();
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    cached = `${year}-${mm}-${dd}`;
  } catch {
    cached = deviceToday();
  }
  return cached;
}
