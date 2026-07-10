import { FIRST_DATE } from '../data/challenges.js'

/* Local-timezone date helpers. Keys are 'YYYY-MM-DD'. */

export function toKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey() {
  return toKey(new Date())
}

/* Whole days between two date keys (b - a). */
export function daysBetween(aKey, bKey) {
  const ms = fromKey(bKey).getTime() - fromKey(aKey).getTime()
  return Math.round(ms / 86400000)
}

/* A past or present challenge is playable; future ones are locked. */
export function isPlayable(key) {
  return key >= FIRST_DATE && key <= todayKey()
}

const MONTHS_FR = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']
const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

export function prettyDate(key) {
  const d = fromKey(key)
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

export { MONTHS_FR, DAYS_FR }
