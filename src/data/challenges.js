/*
 * Puzzle bank. Each level is a hidden `secret` the player must guess and 4
 * `words` linked to it. Each word is spelled on its own letter wheel; words may
 * contain a space (two-word answers) — the space is dropped on the wheel but
 * shown as a gap in the answer slots. Secrets and words carry no diacritics
 * (e == e, c == c) so typed accents match after normalisation.
 */
export const PUZZLES_NEW = [
  // { secret: 'castor', words: ['barrage', 'queue', 'rongeur', 'histoire'] },
  { secret: 'mars', words: ['planete', 'printemps', 'guerrier', 'olympe'] },
  //  { secret: 'clavier', words: ['piano', 'ordinateur', 'souris', 'touche'] },
  // { secret: 'chine', words: ['ideogramme', 'muraille', 'canton', 'panda'] },
  { secret: 'salsa', words: ['danser', 'sauce', 'porto rico', 'latino'] },
  { secret: 'baleine', words: ['cachalot', 'bleue', 'plancton', 'mammifere'] },
  { secret: 'suite', words: ['appartement', 'sequence', 'apres', 'logique'] },
  { secret: 'couteau', words: ['coquillage', 'tranchant', 'aiguiser', 'blanche'] },
  { secret: 'console', words: ['meuble', 'jeu video', 'terminal', 'joystick'] },
  // { secret: 'couronne', words: ['royaute', 'diademe', 'carie', 'laurier'] },
  { secret: 'grue', words: ['chantier', 'echassier', 'engin', 'hauteur'] },
  //{ secret: 'agent', words: ['secret', 'immobilier', 'double', 'policier'] },
  { secret: 'mule', words: ['pantoufle', 'obstine', 'jument', 'transport'] },
  { secret: 'langue', words: ['bouche', 'dialecte', 'anglais', 'papille'] },
  { secret: 'batterie', words: ['recharge', 'cuisine', 'tambour', 'voiture'] },
  { secret: 'franc', words: ['monnaie', 'sincere', 'france', 'peuple'] },
  // { secret: 'defense', words: ['protection', 'elephant', 'attaque', 'interdit'] },
  { secret: 'carbone', words: ['charbon', 'respirer', 'diamant', 'quatorze'] },
  // { secret: 'verre', words: ['fenetre', 'gobelet', 'lunette', 'fragile'] },
  // { secret: 'panier', words: ['osier', 'fruits', 'basketball', 'caddie'] },
];
