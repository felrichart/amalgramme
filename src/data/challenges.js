/*
 * Puzzle bank. Each level is a hidden `secret` the player must guess and 4
 * `words` linked to it. Each word is spelled on its own letter wheel; words may
 * contain a space (two-word answers) — the space is dropped on the wheel but
 * shown as a gap in the answer slots. Secrets and words carry no diacritics
 * (e == e, c == c) so typed accents match after normalisation.
 */
export const PUZZLES_NEW = [
  { secret: 'mars', words: ['planete', 'printemps', 'guerre', 'olympe'] },
  // { secret: 'chine', words: ['ideogramme', 'muraille', 'canton', 'panda'] },
  { secret: 'salsa', words: ['danser', 'sauce', 'porto rico', 'latino'] },
  { secret: 'baleine', words: ['cachalot', 'bleue', 'plancton', 'mammifere'] },
  { secret: 'suite', words: ['appartement', 'sequence', 'apres', 'logique'] },
  { secret: 'couteau', words: ['coquillage', 'tranchant', 'aiguiser', 'blanche'] },
  { secret: 'console', words: ['meuble', 'jeu video', 'terminal', 'joystick'] },
  // { secret: 'couronne', words: ['royaute', 'couvre chef', 'carie', 'laurier'] },
  { secret: 'grue', words: ['chantier', 'heron', 'engin', 'hauteur'] },
  { secret: 'mule', words: ['pantoufle', 'obstine', 'jument', 'transport'] },
  { secret: 'langue', words: ['bouche', 'dialecte', 'anglais', 'papille'] },
  { secret: 'batterie', words: ['recharge', 'cuisine', 'tambour', 'voiture'] },
  { secret: 'franc', words: ['monnaie', 'sincere', 'france', 'peuple'] },
  { secret: 'carbone', words: ['charbon', 'respirer', 'diamant', 'quatorze'] },
  // { secret: 'panier', words: ['osier', 'fruits', 'basketball', 'caddie'] },
  { secret: 'course', words: ['athlete', 'supermarche', 'poursuite', 'vitesse'] },
  { secret: 'metal', words: ['aimant', 'musique', 'alliage', 'cuivre'] },
  { secret: 'fantome', words: ['spectre', 'defunt', 'opera', 'cimetiere'] },
  { secret: 'corail', words: ['ocean', 'barriere', 'polype', 'couleur'] },
  { secret: 'cirque', words: ['chapiteau', 'equestre', 'acrobate', 'spectacle'] },
  { secret: 'planche', words: ['charpente', 'theatre', 'skateboard', 'rectangle'] },
  { secret: 'voler', words: ['aviation', 'papillon', 'derober', 'planer'] },
  { secret: 'melon', words: ['orange', 'spherique', 'aliment', 'chapeau'] },
  { secret: 'creche', words: ['garderie', 'couche', 'roi mage', 'nativite'] },
  { secret: 'pigeon', words: ['plumage', 'urbain', 'voyageur', 'arnaque'] },
  { secret: 'verre', words: ['vitre', 'gobelet', 'lunette', 'fragile'] },
  { secret: 'baguette', words: ['baton', 'magique', 'tradition', 'chinoise'] },
  { secret: 'castor', words: ['barrage', 'queue', 'rongeur', 'contes'] },
  { secret: 'defense', words: ['securite', 'elephant', 'fortifier', 'interdit'] },
  { secret: 'agent', words: ['espionnage', 'immobilier', 'double', 'policier'] },
  // { secret: 'clavier', words: ['piano', 'ordinateur', 'virtuel', 'touche'] },
];
