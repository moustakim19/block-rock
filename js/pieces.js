// ==========================================================
// BLOCK ROCK — Les pièces
// Une forme est un petit tableau 2D :
//   1 = il y a un bloc,  0 = c'est vide.
//
// Exemple, le "T" :     [ [1, 1, 1],      ███
//                         [0, 1, 0] ]       █
// ==========================================================

// Fait tourner une forme d'un quart de tour (sens des aiguilles d'une montre).
// La 1re colonne lue de bas en haut devient la 1re ligne, etc.
//
//   [ [1, 0],          [ [1, 1, 1],
//     [1, 0],    →       [1, 0, 0] ]
//     [1, 1] ]
function tourner(forme) {
  const hauteur = forme.length;
  const largeur = forme[0].length;
  const resultat = [];
  for (let c = 0; c < largeur; c++) {
    const nouvelleLigne = [];
    for (let l = hauteur - 1; l >= 0; l--) {
      nouvelleLigne.push(forme[l][c]);
    }
    resultat.push(nouvelleLigne);
  }
  return resultat;
}

// Renvoie la forme et ses 3 rotations (4 orientations au total)
function quatreRotations(forme) {
  const rotations = [forme];
  for (let i = 0; i < 3; i++) {
    rotations.push(tourner(rotations[rotations.length - 1]));
  }
  return rotations;
}

// La liste des familles de pièces.
// "poids" = la fréquence d'apparition : plus il est grand, plus la pièce sort souvent.
// "type"  = facile, moyenne ou dure : sert à régler la difficulté (voir poidsAjuste).
const FAMILLES = [
  { nom: "carré 1×1", type: "facile", poids: 2,   formes: [[[1]]] },
  { nom: "carré 2×2", type: "facile", poids: 3,   formes: [[[1, 1],
                                            [1, 1]]] },
  { nom: "carré 3×3", type: "dure", poids: 1.2, formes: [[[1, 1, 1],
                                            [1, 1, 1],
                                            [1, 1, 1]]] },

  // Les lignes : une version horizontale et une verticale
  { nom: "ligne de 2", type: "facile", poids: 2,   formes: [[[1, 1]],             [[1], [1]]] },
  { nom: "ligne de 3", type: "facile", poids: 2.5, formes: [[[1, 1, 1]],          [[1], [1], [1]]] },
  { nom: "ligne de 4", type: "moyenne", poids: 2,   formes: [[[1, 1, 1, 1]],       [[1], [1], [1], [1]]] },
  { nom: "ligne de 5", type: "dure", poids: 1.2, formes: [[[1, 1, 1, 1, 1]],    [[1], [1], [1], [1], [1]]] },

  // Petit L (3 blocs) dans ses 4 orientations
  { nom: "petit L", type: "facile", poids: 2, formes: quatreRotations([[1, 0],
                                                       [1, 1]]) },

  // Grand L et son reflet dans le miroir (le J) : 8 orientations
  { nom: "L", type: "dure", poids: 2.5, formes: quatreRotations([[1, 0],
                                                   [1, 0],
                                                   [1, 1]])
                          .concat(quatreRotations([[0, 1],
                                                   [0, 1],
                                                   [1, 1]])) },

  { nom: "T", type: "moyenne", poids: 2, formes: quatreRotations([[1, 1, 1],
                                                 [0, 1, 0]]) },

  // S et Z : couchés et debout
  { nom: "S", type: "dure", poids: 1.5, formes: [
      [[0, 1, 1],
       [1, 1, 0]],
      [[1, 0],
       [1, 1],
       [0, 1]],
      [[1, 1, 0],
       [0, 1, 1]],
      [[0, 1],
       [1, 1],
       [1, 0]],
  ] },
];

// Probabilité qu'une pièce contienne un bloc obsidienne (6 % = rare)
const CHANCE_OBSIDIENNE = 0.06;

// Nombre entier au hasard entre 0 et max - 1
function entierAuHasard(max) {
  return Math.floor(Math.random() * max);
}

// Le poids d'une famille selon la difficulté (de 0 = facile à 1 = très dur) :
// les pièces faciles deviennent plus rares, les dures plus fréquentes.
// Au niveau 100, un carré 3×3 sort environ 2 fois plus souvent qu'au niveau 1.
function poidsAjuste(famille, difficulte) {
  if (famille.type === "facile") return famille.poids * (1 - 0.55 * difficulte);
  if (famille.type === "dure") return famille.poids * (1 + 1.3 * difficulte);
  return famille.poids;
}

// Choisit une famille au hasard en tenant compte des poids.
// Imagine une règle graduée où chaque famille occupe une longueur = son poids :
// on tire un point au hasard sur la règle et on regarde sur quelle famille il tombe.
function familleAuHasard(difficulte) {
  let total = 0;
  for (const famille of FAMILLES) total += poidsAjuste(famille, difficulte);

  let tirage = Math.random() * total;
  for (const famille of FAMILLES) {
    tirage -= poidsAjuste(famille, difficulte);
    if (tirage < 0) return famille;
  }
  return FAMILLES[0];
}

// Crée une pièce : une forme + une couleur (1 à 4) + peut-être un bloc obsidienne
function pieceAuHasard(difficulte) {
  const famille = familleAuHasard(difficulte);
  const forme = famille.formes[entierAuHasard(famille.formes.length)];
  const piece = {
    forme: forme,
    couleur: 1 + entierAuHasard(4),
    obsidienne: null, // ou { l, c } : la position du bloc obsidienne dans la forme
  };

  if (Math.random() < CHANCE_OBSIDIENNE) {
    // On liste les blocs de la forme et on en choisit un
    const blocs = [];
    forme.forEach(function (ligne, l) {
      ligne.forEach(function (valeur, c) {
        if (valeur === 1) blocs.push({ l: l, c: c });
      });
    });
    piece.obsidienne = blocs[entierAuHasard(blocs.length)];
  }
  return piece;
}

// Valeur à écrire dans la grille pour le bloc (l, c) d'une pièce :
// sa couleur (1 à 4), ou 5 si c'est le bloc obsidienne.
function valeurBloc(piece, l, c) {
  if (piece.obsidienne && piece.obsidienne.l === l && piece.obsidienne.c === c) {
    return 5;
  }
  return piece.couleur;
}

// Tire 3 pièces. Pour être juste, on essaie d'obtenir des pièces qui
// rentrent dans la grille (testé avec estJouable) :
// - si toutesDoiventRentrer : les 3 doivent rentrer (niveaux faciles) ;
// - sinon : au moins une doit rentrer (niveaux difficiles).
// Après 40 essais ratés, on garde le dernier tirage : la grille est
// vraiment trop pleine, la partie va sans doute se terminer.
function tirerTroisPieces(estJouable, difficulte, toutesDoiventRentrer) {
  let pieces = [];
  for (let essai = 0; essai < 40; essai++) {
    pieces = [pieceAuHasard(difficulte), pieceAuHasard(difficulte), pieceAuHasard(difficulte)];
    let nbQuiRentrent = 0;
    pieces.forEach(function (p) {
      if (estJouable(p.forme)) nbQuiRentrent++;
    });
    if (toutesDoiventRentrer ? nbQuiRentrent === 3 : nbQuiRentrent >= 1) {
      return pieces;
    }
  }
  return pieces;
}
