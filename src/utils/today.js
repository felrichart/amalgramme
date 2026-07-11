/*
 * Resolves today's date (YYYY-MM-DD) from a time API, keyed on the device's own
 * timezone, so the daily challenge can't be shifted by a wrong/spoofed device
 * clock. `resolveToday` must be awaited once at startup before any module reads
 * `getToday`; there is no device-clock fallback — a network failure throws and
 * load is aborted.
 */

/* IANA timezone reported by the device, e.g. "Europe/Paris". */
export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

let cached = null;

/* Resolved today's date. Throws until `resolveToday` has succeeded. */
export function getToday() {
  if (cached === null) throw new Error('today not resolved: call resolveToday first');
  return cached;
}

/* Fetch today's date for the device timezone. Throws on any failure. */
export async function resolveToday() {
  const tz = deviceTimeZone();
  const url = `https://timeapi.io/api/time/current/zone?timeZone=${encodeURIComponent(tz)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`time API failed: HTTP ${res.status}`);
  const { year, month, day } = await res.json();
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  cached = `${year}-${mm}-${dd}`;
  return cached;
}
