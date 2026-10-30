/* A colour a day of the week, and French day labels. */

// Sunday first, as Date#getDay counts.
const COLORS = ['#cc3a9e', '#2f4ad6', '#c41d4f', '#0f9a62', '#7552e8', '#e2650a', '#0e9fb3'];
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/* Cursor and bonus yellow, every day. */
export const YELLOW = '#f4b41a';

const parts = (iso) => iso.split('-').map(Number);
const weekday = (iso) => {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export const dayColor = (iso) => COLORS[weekday(iso)];

/* "07 novembre". */
export function dayLabel(iso) {
  const [, m, d] = parts(iso);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]}`;
}

/* "vendredi 7 novembre". */
export function longDayLabel(iso) {
  const [, m, d] = parts(iso);
  return `${WEEKDAYS[weekday(iso)]} ${d} ${MONTHS[m - 1]}`;
}

/* "ven", the weekday on three letters. */
export const shortWeekday = (iso) => WEEKDAYS[weekday(iso)].slice(0, 3);

const SHORT_MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

/* "oct.", the month abbreviated. */
export const shortMonth = (iso) => SHORT_MONTHS[parts(iso)[1] - 1];

export const dayOfMonth = (iso) => parts(iso)[2];

/* "aujourd'hui", "hier", else the weekday: a day of the last week, from `today`. */
export function relativeDay(iso, today) {
  if (iso === today) return "aujourd'hui";
  const [y, m, d] = parts(today);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  return iso === yesterday ? 'hier' : WEEKDAYS[weekday(iso)];
}
