/* French display strings. */
import { pad } from './date.js';

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/* An ISO date as a short label, e.g. "Sam 11/07". */
export function formatChallengeDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${DAYS[new Date(y, m - 1, d).getDay()]} ${pad(d)}/${pad(m)}`;
}

export function solvedBy(successes, attempts) {
  return `Réussi par ${successes} joueur${successes > 1 ? 's' : ''} sur ${attempts}`;
}
