/*
 * Puzzle bank. Each puzzle is one level: a `theme` (shown to the player as a
 * free hint), 7 `words` linked by that theme, and a `difficulty` bucket. Words
 * are 5-10 letters, may contain spaces (multi-word), and carry no diacritics
 * (e == e, c == c) since they are typed. Themes are display-only, so they use
 * normal French spelling. `difficulty` is one of DIFFICULTIES[].key; adjust it
 * freely and add new levels under any bucket.
 */
export const DIFFICULTIES = [
  { key: 'facile', label: 'Facile' },
  { key: 'normal', label: 'Normal' },
  { key: 'difficile', label: 'Difficile' },
]

export const PUZZLES = [
  { difficulty: 'normal', theme: 'Couleurs chaudes', words: ['rouge', 'orange', 'bordeaux', 'corail', 'safran', 'brique', 'abricot'] },
  { difficulty: 'difficile', theme: 'Acteurs français', words: ['dujardin', 'cassel', 'cluzet', 'depardieu', 'lellouche', 'auteuil', 'belmondo'] },
  { difficulty: 'normal', theme: 'Fruits rouges', words: ['fraise', 'cerise', 'framboise', 'groseille', 'cassis', 'myrtille', 'grenade'] },
  { difficulty: 'facile', theme: 'Animaux marins', words: ['dauphin', 'requin', 'baleine', 'meduse', 'crevette', 'homard', 'phoque'] },
  { difficulty: 'normal', theme: "Capitales d'Europe", words: ['madrid', 'lisbonne', 'berlin', 'vienne', 'athenes', 'varsovie', 'prague'] },
  { difficulty: 'normal', theme: 'Instruments de musique', words: ['guitare', 'violon', 'piano', 'batterie', 'trompette', 'clarinette', 'saxophone'] },
  { difficulty: 'normal', theme: 'Planètes du système solaire', words: ['mercure', 'venus', 'jupiter', 'saturne', 'neptune', 'uranus', 'pluton'] },
  { difficulty: 'facile', theme: 'Sports collectifs', words: ['football', 'rugby', 'basket', 'handball', 'volley', 'hockey', 'waterpolo'] },
  { difficulty: 'normal', theme: 'Légumes verts', words: ['courgette', 'epinard', 'brocoli', 'haricot', 'poireau', 'salade', 'asperge'] },
  { difficulty: 'difficile', theme: "Métiers de l'hôpital", words: ['medecin', 'infirmier', 'chirurgien', 'pharmacien', 'dentiste', 'urgentiste', 'radiologue'] },
  { difficulty: 'difficile', theme: 'Boissons chaudes', words: ['chocolat', 'tisane', 'infusion', 'cappuccino', 'expresso', 'verveine', 'chicoree'] },
  { difficulty: 'normal', theme: "Vêtements d'hiver", words: ['manteau', 'echarpe', 'bonnet', 'doudoune', 'pullover', 'moufles', 'anorak'] },
  { difficulty: 'facile', theme: "Pays d'Asie", words: ['japon', 'chine', 'coree', 'vietnam', 'thailande', 'mongolie', 'cambodge'] },
  { difficulty: 'normal', theme: 'Arbres de la forêt', words: ['chene', 'hetre', 'bouleau', 'sapin', 'erable', 'platane', 'peuplier'] },
  { difficulty: 'facile', theme: 'Danses latines', words: ['salsa', 'bachata', 'tango', 'rumba', 'samba', 'merengue', 'cumbia'] },
  { difficulty: 'difficile', theme: 'Outils de bricolage', words: ['marteau', 'tournevis', 'perceuse', 'tenaille', 'cheville', 'raboteuse', 'visseuse'] },
  { difficulty: 'difficile', theme: 'Fromages français', words: ['camembert', 'roquefort', 'comte', 'reblochon', 'munster', 'cantal', 'gruyere'] },
  { difficulty: 'difficile', theme: 'Oiseaux du jardin', words: ['moineau', 'mesange', 'pinson', 'merle', 'rougegorge', 'etourneau', 'sittelle'] },
  { difficulty: 'normal', theme: 'Desserts sucrés', words: ['sorbet', 'tiramisu', 'mousse', 'gateau', 'meringue', 'clafoutis', 'macaron'] },
  { difficulty: 'facile', theme: 'Moyens de transport', words: ['voiture', 'avion', 'train', 'bateau', 'tramway', 'scooter', 'metro'] },
  { difficulty: 'normal', theme: 'Couleurs froides', words: ['turquoise', 'indigo', 'marine', 'celeste', 'lavande', 'petrole', 'emeraude'] },
  { difficulty: 'facile', theme: 'Jours de la semaine', words: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] },
  { difficulty: 'facile', theme: 'Parties du corps', words: ['genou', 'epaule', 'cheville', 'poignet', 'coude', 'hanche', 'mollet'] },
  { difficulty: 'normal', theme: 'Félins sauvages', words: ['tigre', 'panthere', 'guepard', 'jaguar', 'leopard', 'caracal', 'serval'] },
  { difficulty: 'difficile', theme: 'Épices de cuisine', words: ['poivre', 'cumin', 'curcuma', 'paprika', 'cannelle', 'muscade', 'gingembre'] },
  { difficulty: 'normal', theme: 'Meubles de la maison', words: ['armoire', 'commode', 'canape', 'fauteuil', 'etagere', 'buffet', 'tabouret'] },
  { difficulty: 'difficile', theme: "Sports d'hiver", words: ['snowboard', 'patinage', 'bobsleigh', 'biathlon', 'hockey', 'curling', 'slalom'] },
  { difficulty: 'normal', theme: 'Fleurs du jardin', words: ['tulipe', 'marguerite', 'oeillet', 'pivoine', 'jonquille', 'muguet', 'dahlia'] },
  { difficulty: 'facile', theme: 'Métaux brillants', words: ['argent', 'platine', 'cuivre', 'bronze', 'chrome', 'nickel', 'laiton'] },
  { difficulty: 'normal', theme: 'Villes de France', words: ['marseille', 'bordeaux', 'toulouse', 'nantes', 'lille', 'rennes', 'strasbourg'] },
]
