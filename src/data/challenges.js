/*
 * Puzzle bank. Each level is a hidden `secret` the player must guess and 4
 * `words` linked to it. Each word is spelled on its own letter wheel; words may
 * contain a space (two-word answers) — the space is dropped on the wheel but
 * shown as a gap in the answer slots. Secrets and words carry no diacritics
 * (e == e, c == c) so typed accents match after normalisation.
 *
 * `date` (ISO) makes each puzzle one day's challenge: they run one per day so
 * the last is today's daily challenge (see DAILY_INDEX).
 */
export const PUZZLES_NEW = [
  { date: '2026-06-15', secret: 'mars', words: ['planete', 'printemps', 'guerre', 'olympe'] },
  { date: '2026-06-16', secret: 'salsa', words: ['danser', 'sauce', 'porto rico', 'latino'] },
  { date: '2026-06-17', secret: 'baleine', words: ['cachalot', 'bleue', 'plancton', 'mammifere'] },
  { date: '2026-06-18', secret: 'suite', words: ['appartement', 'sequence', 'apres', 'logique'] },
  { date: '2026-06-19', secret: 'couteau', words: ['coquillage', 'tranchant', 'aiguiser', 'blanche'] },
  { date: '2026-06-20', secret: 'console', words: ['meuble', 'jeu video', 'terminal', 'joystick'] },
  { date: '2026-06-21', secret: 'grue', words: ['chantier', 'heron', 'engin', 'hauteur'] },
  { date: '2026-06-22', secret: 'mule', words: ['pantoufle', 'obstine', 'jument', 'transport'] },
  { date: '2026-06-23', secret: 'langue', words: ['bouche', 'dialecte', 'anglais', 'papille'] },
  { date: '2026-06-24', secret: 'batterie', words: ['recharge', 'cuisine', 'tambour', 'voiture'] },
  { date: '2026-06-25', secret: 'franc', words: ['monnaie', 'sincere', 'france', 'peuple'] },
  { date: '2026-06-26', secret: 'carbone', words: ['charbon', 'respirer', 'diamant', 'quatorze'] },
  { date: '2026-06-27', secret: 'course', words: ['athlete', 'supermarche', 'poursuite', 'vitesse'] },
  { date: '2026-06-28', secret: 'metal', words: ['aimant', 'musique', 'alliage', 'cuivre'] },
  { date: '2026-06-29', secret: 'fantome', words: ['spectre', 'defunt', 'opera', 'cimetiere'] },
  { date: '2026-06-30', secret: 'corail', words: ['ocean', 'barriere', 'polype', 'couleur'] },
  { date: '2026-07-01', secret: 'cirque', words: ['chapiteau', 'equestre', 'acrobate', 'spectacle'] },
  { date: '2026-07-02', secret: 'planche', words: ['charpente', 'theatre', 'skateboard', 'rectangle'] },
  { date: '2026-07-03', secret: 'voler', words: ['aviation', 'papillon', 'derober', 'planer'] },
  { date: '2026-07-04', secret: 'melon', words: ['orange', 'spherique', 'aliment', 'chapeau'] },
  { date: '2026-07-05', secret: 'creche', words: ['garderie', 'couche', 'roi mage', 'nativite'] },
  { date: '2026-07-06', secret: 'pigeon', words: ['plumage', 'urbain', 'voyageur', 'arnaque'] },
  { date: '2026-07-07', secret: 'verre', words: ['vitre', 'gobelet', 'lunette', 'fragile'] },
  { date: '2026-07-08', secret: 'baguette', words: ['baton', 'magique', 'tradition', 'chinoise'] },
  { date: '2026-07-09', secret: 'castor', words: ['barrage', 'queue', 'rongeur', 'contes'] },
  { date: '2026-07-10', secret: 'defense', words: ['securite', 'elephant', 'fortifier', 'interdit'] },
  { date: '2026-07-11', secret: 'agent', words: ['espionnage', 'immobilier', 'secret', 'policier'] },
];

/* Local ISO date (YYYY-MM-DD) for today, matching the puzzle `date` format. */
function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/* Today's challenge: the most recent puzzle not dated in the future. ISO dates
 * compare lexicographically, so a string compare orders them correctly. */
export const DAILY_INDEX = (() => {
  const today = todayISO();
  let idx = 0;
  for (let i = 0; i < PUZZLES_NEW.length; i++) {
    if (PUZZLES_NEW[i].date <= today) idx = i;
  }
  return idx;
})();

/* Route slug for a puzzle index: "daily" for today, else its ISO date. */
export function slugForIndex(i) {
  return i === DAILY_INDEX ? 'daily' : PUZZLES_NEW[i]?.date;
}

/* Resolve a route slug ("daily" or an ISO date) to a puzzle index, or -1. */
export function indexForSlug(slug) {
  if (slug === 'daily') return DAILY_INDEX;
  return PUZZLES_NEW.findIndex((p) => p.date === slug);
}

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/* An ISO date as a short French label, e.g. "Sam 11/07". */
export function formatChallengeDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${DAYS[date.getDay()]} ${dd}/${mm}`;
}
