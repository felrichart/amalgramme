/*
 * Puzzle bank. Each puzzle has a `theme` (shown to the player as a free hint)
 * and 7 `words` linked by that theme. Words are 5-10 letters, may contain
 * spaces (multi-word), and carry no diacritics (e == e, c == c). Daily
 * challenges cycle through this bank by date, so any date (incl. past dates
 * back to 2026-01-01) is playable.
 */
export const PUZZLES = [
  { theme: 'couleur chaude', words: ['rouge', 'orange', 'bordeaux', 'corail', 'safran', 'brique', 'abricot'] },
  { theme: 'acteur francais', words: ['dujardin', 'cassel', 'cluzet', 'depardieu', 'lellouche', 'auteuil', 'belmondo'] },
  { theme: 'fruit rouge', words: ['fraise', 'cerise', 'framboise', 'groseille', 'cassis', 'myrtille', 'grenade'] },
  { theme: 'animal marin', words: ['dauphin', 'requin', 'baleine', 'meduse', 'crevette', 'homard', 'phoque'] },
  { theme: 'capitale europe', words: ['madrid', 'lisbonne', 'berlin', 'vienne', 'athenes', 'varsovie', 'prague'] },
  { theme: 'instrument musique', words: ['guitare', 'violon', 'piano', 'batterie', 'trompette', 'clarinette', 'saxophone'] },
  { theme: 'planete systeme', words: ['mercure', 'venus', 'jupiter', 'saturne', 'neptune', 'uranus', 'pluton'] },
  { theme: 'sport collectif', words: ['football', 'rugby', 'basket', 'handball', 'volley', 'hockey', 'waterpolo'] },
  { theme: 'legume vert', words: ['courgette', 'epinard', 'brocoli', 'haricot', 'poireau', 'salade', 'asperge'] },
  { theme: 'metier hopital', words: ['medecin', 'infirmier', 'chirurgien', 'pharmacien', 'dentiste', 'urgentiste', 'radiologue'] },
  { theme: 'boisson chaude', words: ['chocolat', 'tisane', 'infusion', 'cappuccino', 'expresso', 'verveine', 'chicoree'] },
  { theme: 'vetement hiver', words: ['manteau', 'echarpe', 'bonnet', 'doudoune', 'pullover', 'moufles', 'anorak'] },
  { theme: 'pays asie', words: ['japon', 'chine', 'coree', 'vietnam', 'thailande', 'mongolie', 'cambodge'] },
  { theme: 'arbre foret', words: ['chene', 'hetre', 'bouleau', 'sapin', 'erable', 'platane', 'peuplier'] },
  { theme: 'danse latine', words: ['salsa', 'bachata', 'tango', 'rumba', 'samba', 'merengue', 'cumbia'] },
  { theme: 'outil bricolage', words: ['marteau', 'tournevis', 'perceuse', 'tenaille', 'cheville', 'raboteuse', 'visseuse'] },
  { theme: 'fromage francais', words: ['camembert', 'roquefort', 'comte', 'reblochon', 'munster', 'cantal', 'gruyere'] },
  { theme: 'oiseau jardin', words: ['moineau', 'mesange', 'pinson', 'merle', 'rougegorge', 'etourneau', 'sittelle'] },
  { theme: 'dessert sucre', words: ['sorbet', 'tiramisu', 'mousse', 'gateau', 'meringue', 'clafoutis', 'macaron'] },
  { theme: 'moyen transport', words: ['voiture', 'avion', 'train', 'bateau', 'tramway', 'scooter', 'metro'] },
  { theme: 'couleur froide', words: ['turquoise', 'indigo', 'marine', 'celeste', 'lavande', 'petrole', 'emeraude'] },
  { theme: 'jour semaine', words: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] },
  { theme: 'partie corps', words: ['genou', 'epaule', 'cheville', 'poignet', 'coude', 'hanche', 'mollet'] },
  { theme: 'felin sauvage', words: ['tigre', 'panthere', 'guepard', 'jaguar', 'leopard', 'caracal', 'serval'] },
  { theme: 'epice cuisine', words: ['poivre', 'cumin', 'curcuma', 'paprika', 'cannelle', 'muscade', 'gingembre'] },
  { theme: 'meuble maison', words: ['armoire', 'commode', 'canape', 'fauteuil', 'etagere', 'buffet', 'tabouret'] },
  { theme: 'sport hiver', words: ['snowboard', 'patinage', 'bobsleigh', 'biathlon', 'hockey', 'curling', 'slalom'] },
  { theme: 'fleur jardin', words: ['tulipe', 'marguerite', 'oeillet', 'pivoine', 'jonquille', 'muguet', 'dahlia'] },
  { theme: 'metal brillant', words: ['argent', 'platine', 'cuivre', 'bronze', 'chrome', 'nickel', 'laiton'] },
  { theme: 'ville france', words: ['marseille', 'bordeaux', 'toulouse', 'nantes', 'lille', 'rennes', 'strasbourg'] },
]

/* First date for which past challenges are available. */
export const FIRST_DATE = '2026-01-01'
