/*
 * Puzzle bank. Each puzzle is one level: a `theme` (shown to the player as a
 * free hint) and 7 `words` linked by that theme. Words are 5-10 letters, may
 * contain spaces (multi-word), and carry no diacritics (e == e, c == c) since
 * they are typed. Themes are display-only, so they use normal French spelling.
 */
export const PUZZLES = [
  { theme: 'Couleurs chaudes', words: ['rouge', 'orange', 'bordeaux', 'corail', 'safran', 'brique', 'abricot'] },
  { theme: 'Acteurs français', words: ['dujardin', 'cassel', 'cluzet', 'depardieu', 'lellouche', 'auteuil', 'belmondo'] },
  { theme: 'Fruits rouges', words: ['fraise', 'cerise', 'framboise', 'groseille', 'cassis', 'myrtille', 'grenade'] },
  { theme: 'Animaux marins', words: ['dauphin', 'requin', 'baleine', 'meduse', 'crevette', 'homard', 'phoque'] },
  { theme: "Capitales d'Europe", words: ['madrid', 'lisbonne', 'berlin', 'vienne', 'athenes', 'varsovie', 'prague'] },
  { theme: 'Instruments de musique', words: ['guitare', 'violon', 'piano', 'batterie', 'trompette', 'clarinette', 'saxophone'] },
  { theme: 'Planètes du système solaire', words: ['mercure', 'venus', 'jupiter', 'saturne', 'neptune', 'uranus', 'pluton'] },
  { theme: 'Sports collectifs', words: ['football', 'rugby', 'basket', 'handball', 'volley', 'hockey', 'waterpolo'] },
  { theme: 'Légumes verts', words: ['courgette', 'epinard', 'brocoli', 'haricot', 'poireau', 'salade', 'asperge'] },
  { theme: "Métiers de l'hôpital", words: ['medecin', 'infirmier', 'chirurgien', 'pharmacien', 'dentiste', 'urgentiste', 'radiologue'] },
  { theme: 'Boissons chaudes', words: ['chocolat', 'tisane', 'infusion', 'cappuccino', 'expresso', 'verveine', 'chicoree'] },
  { theme: "Vêtements d'hiver", words: ['manteau', 'echarpe', 'bonnet', 'doudoune', 'pullover', 'moufles', 'anorak'] },
  { theme: "Pays d'Asie", words: ['japon', 'chine', 'coree', 'vietnam', 'thailande', 'mongolie', 'cambodge'] },
  { theme: 'Arbres de la forêt', words: ['chene', 'hetre', 'bouleau', 'sapin', 'erable', 'platane', 'peuplier'] },
  { theme: 'Danses latines', words: ['salsa', 'bachata', 'tango', 'rumba', 'samba', 'merengue', 'cumbia'] },
  { theme: 'Outils de bricolage', words: ['marteau', 'tournevis', 'perceuse', 'tenaille', 'cheville', 'raboteuse', 'visseuse'] },
  { theme: 'Fromages français', words: ['camembert', 'roquefort', 'comte', 'reblochon', 'munster', 'cantal', 'gruyere'] },
  { theme: 'Oiseaux du jardin', words: ['moineau', 'mesange', 'pinson', 'merle', 'rougegorge', 'etourneau', 'sittelle'] },
  { theme: 'Desserts sucrés', words: ['sorbet', 'tiramisu', 'mousse', 'gateau', 'meringue', 'clafoutis', 'macaron'] },
  { theme: 'Moyens de transport', words: ['voiture', 'avion', 'train', 'bateau', 'tramway', 'scooter', 'metro'] },
  { theme: 'Couleurs froides', words: ['turquoise', 'indigo', 'marine', 'celeste', 'lavande', 'petrole', 'emeraude'] },
  { theme: 'Jours de la semaine', words: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] },
  { theme: 'Parties du corps', words: ['genou', 'epaule', 'cheville', 'poignet', 'coude', 'hanche', 'mollet'] },
  { theme: 'Félins sauvages', words: ['tigre', 'panthere', 'guepard', 'jaguar', 'leopard', 'caracal', 'serval'] },
  { theme: 'Épices de cuisine', words: ['poivre', 'cumin', 'curcuma', 'paprika', 'cannelle', 'muscade', 'gingembre'] },
  { theme: 'Meubles de la maison', words: ['armoire', 'commode', 'canape', 'fauteuil', 'etagere', 'buffet', 'tabouret'] },
  { theme: "Sports d'hiver", words: ['snowboard', 'patinage', 'bobsleigh', 'biathlon', 'hockey', 'curling', 'slalom'] },
  { theme: 'Fleurs du jardin', words: ['tulipe', 'marguerite', 'oeillet', 'pivoine', 'jonquille', 'muguet', 'dahlia'] },
  { theme: 'Métaux brillants', words: ['argent', 'platine', 'cuivre', 'bronze', 'chrome', 'nickel', 'laiton'] },
  { theme: 'Villes de France', words: ['marseille', 'bordeaux', 'toulouse', 'nantes', 'lille', 'rennes', 'strasbourg'] },
]
