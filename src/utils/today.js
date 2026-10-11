/*
 * Resolves today's date (YYYY-MM-DD) in the device's timezone. Prefers a time API
 * so the daily can't be shifted by a wrong or spoofed device clock, but falls back
 * to the device clock when unreachable — a casual daily isn't worth blocking load.
 * `resolveToday` must be awaited once at startup before anything reads `getToday`.
 */
import { deviceToday, isoDate } from './date.js';

function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

let cached = null;

export function getToday() {
  if (cached === null) throw new Error('today not resolved: call resolveToday first');
  return cached;
}

/* Never rejects, so app load proceeds even offline. */
export async function resolveToday() {
  try {
    const tz = encodeURIComponent(deviceTimeZone());
    const res = await fetch(`https://timeapi.io/api/time/current/zone?timeZone=${tz}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`time API failed: HTTP ${res.status}`);
    const { year, month, day } = await res.json();
    cached = isoDate(year, month, day);
  } catch {
    cached = deviceToday();
  }
  return cached;
}
