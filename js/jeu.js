// ==========================================================
// BLOCK ROCK — Le cœur du jeu
// Plan :
//   1. Constantes et état du jeu
//   2. La grille (tableau 2D) et son affichage
//   3. Les pièces de la réserve
//   4. Le glisser-déposer (pointer events)
//   5. Poser une pièce, faire exploser les lignes, compter les points
//   6. Fin de partie
//   7. Sauvegarde (localStorage)
//   8. Écrans, thèmes, boutons
//   9. Installation de l'appli et mode hors ligne
// ==========================================================


// ---------- 1. CONSTANTES ET ÉTAT DU JEU ----------

const TAILLE = 8; // la grille fait 8 × 8

// Les noms sous lesquels on range les données dans localStorage
const CLE_RECORD = "blockrock-record";
const CLE_PARTIE = "blockrock-partie";
const CLE_THEME = "blockrock-theme";

// L'état du jeu : tout ce qui change pendant la partie
let grille = creerGrilleVide(); // le tableau 2D (voir plus bas)
let pieces = [null, null, null]; // les 3 pièces de la réserve (null = déjà posée)
let score = 0;
let record = lireNombre(CLE_RECORD);
let recordAuDebut = record;  // pour savoir si on a battu le record pendant la partie
let serie = 0;               // nombre de poses de suite avec une explosion
let posesSansExplosion = 0;  // pour savoir quand la série s'arrête
let partieFinie = false;

// Le mode de jeu : "infini" (sans fin) ou "niveau" (les 100 niveaux)
let mode = "infini";
let niveau = null;          // la configuration du niveau en cours (voir niveaux.js)
let lignesNiveau = 0;       // lignes déjà explosées dans ce niveau
let coupsRestants = null;   // null = coups illimités

// Chaque partie a un numéro. Les écrans de fin s'affichent avec un délai :
// si une NOUVELLE partie a commencé entre-temps, le numéro a changé et on n'affiche rien.
let numeroPartie = 0;
function plusTard(action, delai) {
  const numero = numeroPartie;
  setTimeout(function () {
    if (numero === numeroPartie) action();
  }, delai);
}

// Les éléments HTML dont on a besoin (on les cherche une seule fois)
const el = {
  plateau: document.getElementById("plateau"),
  grille: document.getElementById("grille"),
  messages: document.getElementById("messages"),
  emplacements: document.querySelectorAll(".emplacement"),
  score: document.getElementById("score"),
  record: document.getElementById("record"),
  cases: [], // tableau 2D des 64 <div> de la grille, rempli plus bas
};


// ---------- 2. LA GRILLE ----------
// La grille est un tableau de 8 lignes ; chaque ligne est un tableau de 8 nombres.
//   0 = case vide
//   1 à 4 = une gemme (violet, turquoise, rose, or)
//   5 = une gemme obsidienne
//   6 = un rocher (mode niveaux) — 7 = un rocher dur (devient 6 à la 1re explosion)
// On lit une case avec grille[ligne][colonne], par exemple grille[2][5].

function creerGrilleVide() {
  const nouvelleGrille = [];
  for (let l = 0; l < TAILLE; l++) {
    const ligne = [];
    for (let c = 0; c < TAILLE; c++) {
      ligne.push(0);
    }
    nouvelleGrille.push(ligne);
  }
  return nouvelleGrille;
}

// Crée les 64 <div> une seule fois, et les range dans el.cases[l][c]
function construireGrille() {
  for (let l = 0; l < TAILLE; l++) {
    el.cases.push([]);
    for (let c = 0; c < TAILLE; c++) {
      const div = document.createElement("div");
      div.className = "case";
      el.grille.appendChild(div);
      el.cases[l].push(div);
    }
  }
}

// Met à jour l'apparence d'UNE case d'après la valeur du tableau.
// C'est la règle d'or du jeu : le tableau décide, l'écran obéit.
function dessinerCase(l, c) {
  const valeur = grille[l][c];
  el.cases[l][c].className = valeur === 0 ? "case" : "case gemme c" + valeur;
}

// ----- Les mesures de la grille, gardées en mémoire -----
// Demander une position au navigateur (offsetLeft, getBoundingClientRect…) peut
// l'obliger à recalculer toute la page. Pendant une explosion, on le faisait
// pour chaque case : ça faisait "accrocher" l'animation. Maintenant, on mesure
// UNE fois, on garde le résultat, et on ne remesure que si l'écran change de taille.
let geo = null;

function geometrie() {
  if (!geo) {
    // Position de la grille à l'écran : on additionne les décalages de chaque
    // élément parent (offsetLeft/offsetTop ignorent les animations en cours,
    // même si l'écran est en train de trembler après un combo)
    let gauche = 0;
    let haut = 0;
    for (let e = el.grille; e; e = e.offsetParent) {
      gauche += e.offsetLeft;
      haut += e.offsetTop;
    }
    const case00 = el.cases[0][0];
    geo = {
      gauche: gauche,             // coin haut-gauche de la grille, à l'écran
      haut: haut,
      x0: case00.offsetLeft,      // coin de la case [0][0], dans la grille
      y0: case00.offsetTop,
      pas: el.cases[0][1].offsetLeft - case00.offsetLeft, // d'une case à la suivante
      taille: case00.offsetWidth, // taille d'une case
    };
  }
  return geo;
}

// Position d'une case : dans la grille (x, y) et à l'écran (ecranX, ecranY = son centre)
function positionCase(l, c) {
  const g = geometrie();
  const x = g.x0 + c * g.pas;
  const y = g.y0 + l * g.pas;
  return { x: x, y: y, ecranX: g.gauche + x + g.taille / 2, ecranY: g.haut + y + g.taille / 2 };
}

// L'écran change de taille (rotation du téléphone…) : il faudra remesurer
window.addEventListener("resize", function () { geo = null; });

function dessinerGrille() {
  for (let l = 0; l < TAILLE; l++) {
    for (let c = 0; c < TAILLE; c++) {
      dessinerCase(l, c);
    }
  }
}

// Est-ce que la forme rentre si son coin en haut à gauche est en (ligne, colonne) ?
// On vérifie chaque bloc (chaque 1) : il doit tomber DANS la grille, sur une case VIDE.
function peutPlacer(forme, ligne, colonne) {
  for (let i = 0; i < forme.length; i++) {
    for (let j = 0; j < forme[i].length; j++) {
      if (forme[i][j] === 0) continue; // trou dans la forme : rien à vérifier
      const l = ligne + i;
      const c = colonne + j;
      if (l < 0 || l >= TAILLE || c < 0 || c >= TAILLE) return false; // déborde
      if (grille[l][c] !== 0) return false; // case déjà prise
    }
  }
  return true;
}

// Est-ce que la forme rentre QUELQUE PART ? On essaie les 64 positions.
function peutPlacerQuelquePart(forme) {
  for (let l = 0; l < TAILLE; l++) {
    for (let c = 0; c < TAILLE; c++) {
      if (peutPlacer(forme, l, c)) return true;
    }
  }
  return false;
}

// Cherche les lignes et colonnes pleines d'une grille.
// Renvoie par exemple { lignes: [2, 7], colonnes: [0] }.
function trouverLignesPleines(g) {
  const lignes = [];
  const colonnes = [];

  for (let l = 0; l < TAILLE; l++) {
    // every() = "est-ce que TOUTES les cases de la ligne sont différentes de 0 ?"
    if (g[l].every(function (valeur) { return valeur !== 0; })) {
      lignes.push(l);
    }
  }

  for (let c = 0; c < TAILLE; c++) {
    let pleine = true;
    for (let l = 0; l < TAILLE; l++) {
      if (g[l][c] === 0) {
        pleine = false;
        break; // une case vide suffit : inutile de regarder la suite
      }
    }
    if (pleine) colonnes.push(c);
  }

  return { lignes: lignes, colonnes: colonnes };
}


// ---------- 3. LES PIÈCES DE LA RÉSERVE ----------

// Fabrique le HTML d'une pièce : une petite grille CSS de blocs
function creerElementPiece(piece) {
  const div = document.createElement("div");
  div.className = "piece";
  div.style.gridTemplateColumns = "repeat(" + piece.forme[0].length + ", var(--case))";

  piece.forme.forEach(function (ligne, l) {
    ligne.forEach(function (valeur, c) {
      const bloc = document.createElement("div");
      bloc.className = valeur === 1 ? "bloc gemme c" + valeurBloc(piece, l, c) : "bloc vide";
      div.appendChild(bloc);
    });
  });
  return div;
}

// Redessine les 3 emplacements. animer = true pour l'animation d'arrivée.
function dessinerReserve(animer) {
  pieces.forEach(function (piece, i) {
    const emplacement = el.emplacements[i];
    emplacement.innerHTML = "";
    if (!piece) return;
    const elPiece = creerElementPiece(piece);
    if (animer) {
      elPiece.classList.add("apparait");
      elPiece.style.animationDelay = i * 80 + "ms"; // les 3 pièces arrivent l'une après l'autre
    }
    emplacement.appendChild(elPiece);
  });
}

// La difficulté des pièces, de 0 (facile) à 1 (très dur) :
// - en mode niveau, elle vient du niveau ;
// - en mode infini, elle monte doucement avec le score (au maximum 0,6 à 8 000 points).
function difficulteActuelle() {
  if (mode === "niveau") return niveau.difficulte;
  return Math.min(0.6, score / 8000 * 0.6);
}

function tirerPieces() {
  const toutes = mode === "niveau" ? niveau.toutesJouables : true;
  return tirerTroisPieces(peutPlacerQuelquePart, difficulteActuelle(), toutes);
}

function donnerNouvellesPieces() {
  pieces = tirerPieces();
  dessinerReserve(true);
}


// ---------- 4. LE GLISSER-DÉPOSER ----------
// Les "pointer events" marchent pareil pour la souris, le doigt et le stylet :
//   pointerdown = on appuie,  pointermove = on bouge,  pointerup = on lâche.

let glisse = null; // les infos du glissement en cours (null = rien n'est glissé)

el.emplacements.forEach(function (emplacement) {
  emplacement.addEventListener("pointerdown", commencerGlisser);
  emplacement.addEventListener("pointermove", bougerGlisser);
  emplacement.addEventListener("pointerup", lacherGlisser);
  emplacement.addEventListener("pointercancel", lacherGlisser);
});

function commencerGlisser(e) {
  // On ignore si : déjà un glissement, partie finie, ou clic droit de la souris
  if (glisse || partieFinie || e.button > 0) return;

  const emplacement = e.currentTarget;            // l'emplacement touché
  const index = Number(emplacement.dataset.index); // son numéro : 0, 1 ou 2
  const piece = pieces[index];
  const elPiece = emplacement.querySelector(".piece");
  if (!piece || !elPiece || emplacement.dataset.retour) return; // vide, ou pièce en train de revenir

  Son.init(); // le son a le droit de démarrer : on vient de toucher l'écran

  // Pièce grisée : elle ne rentre nulle part, on fait "non" de la tête
  if (elPiece.classList.contains("bloquee")) {
    elPiece.classList.remove("refuse");
    void elPiece.offsetWidth; // astuce : force le navigateur à "oublier" l'animation pour la rejouer
    elPiece.classList.add("refuse");
    Son.refus();
    return;
  }

  e.preventDefault();
  // "Capturer" le pointeur : même si le doigt sort de l'emplacement,
  // c'est lui qui continue de recevoir les pointermove et pointerup.
  // (try/catch : si le doigt est déjà relevé, la capture échoue, sans gravité)
  try {
    emplacement.setPointerCapture(e.pointerId);
  } catch (erreur) {}

  // Crée la pièce flottante, en taille réelle, accrochée au <body>
  const flottante = document.createElement("div");
  flottante.className = "flottante";
  flottante.appendChild(creerElementPiece(piece));
  document.body.appendChild(flottante);

  // Mesures de la grille (gardées en mémoire, voir geometrie())
  const g = geometrie();

  glisse = {
    index: index,
    piece: piece,
    emplacement: emplacement,
    elPiece: elPiece,
    flottante: flottante,
    pointerId: e.pointerId,
    largeur: flottante.offsetWidth,   // taille de la pièce en pixels
    hauteur: flottante.offsetHeight,
    origineX: g.gauche + g.x0, // coin haut-gauche de la case [0][0], à l'écran
    origineY: g.haut + g.y0,
    pas: g.pas,                // distance d'une case à la suivante
    // Au doigt, la pièce flotte AU-DESSUS du doigt pour qu'on la voie. À la souris, elle est centrée.
    lever: e.pointerType === "mouse" ? null : g.taille * 1.3,
    x: e.clientX,
    y: e.clientY,
    cible: null,         // la case visée { l, c }, ou null si la pièce ne rentre pas
    casesApercu: [],     // les cases colorées par l'aperçu ("l,c")
    surbrillances: [],   // les cadres lumineux autour des lignes qui vont exploser
    signatureSurbrillance: "",
    imageApercu: 0,      // aperçu prévu pour la prochaine image (0 = rien de prévu)
  };

  elPiece.classList.add("cachee"); // la pièce "quitte" la réserve
  placerFlottante();
  void flottante.offsetWidth;      // le navigateur enregistre la petite taille de départ…
  flottante.classList.add("prise"); // …pour animer jusqu'à la taille réelle
  Son.prise();
}

// Calcule où est le coin haut-gauche de la pièce flottante, d'après le doigt
function positionFlottante() {
  const gauche = glisse.x - glisse.largeur / 2;
  const haut = glisse.lever === null
    ? glisse.y - glisse.hauteur / 2             // souris : centrée sur le curseur
    : glisse.y - glisse.hauteur - glisse.lever; // doigt : au-dessus du doigt
  return { gauche: gauche, haut: haut };
}

function placerFlottante() {
  const pos = positionFlottante();
  // translate3d déplace l'élément sans recalculer la page : c'est très fluide
  glisse.flottante.style.transform = "translate3d(" + pos.gauche + "px," + pos.haut + "px,0)";

  // Quelle case est sous le coin haut-gauche de la pièce ? On arrondit à la plus proche.
  const c = Math.round((pos.gauche - glisse.origineX) / glisse.pas);
  const l = Math.round((pos.haut - glisse.origineY) / glisse.pas);
  const cible = peutPlacer(glisse.piece.forme, l, c) ? { l: l, c: c } : null;

  // On ne redessine l'aperçu que si la cible a changé
  const avant = glisse.cible;
  const change = (cible === null) !== (avant === null) ||
                 (cible && (cible.l !== avant.l || cible.c !== avant.c));
  if (change) {
    glisse.cible = cible;
    demanderApercu();
  }
}

function bougerGlisser(e) {
  if (!glisse || e.pointerId !== glisse.pointerId) return;
  glisse.x = e.clientX;
  glisse.y = e.clientY;
  // On déplace la pièce TOUT DE SUITE (pas à l'image suivante) : elle colle au doigt
  // sans retard. C'est peu coûteux : on ne change que "transform". L'aperçu, lui,
  // n'est recalculé que si la case visée change, et au plus une fois par image.
  placerFlottante();
}

function lacherGlisser(e) {
  if (!glisse || e.pointerId !== glisse.pointerId) return;

  // Dernière position exacte du doigt au moment où il se lève
  if (e.type === "pointerup") {
    glisse.x = e.clientX;
    glisse.y = e.clientY;
    placerFlottante();
  }

  const g = glisse;
  glisse = null; // le glissement est terminé
  effacerApercu(g);

  if (e.type === "pointerup" && g.cible) {
    // Ça rentre : la pièce flottante "s'aimante" sur sa case en 90 ms puis disparaît.
    // Le tableau, lui, est mis à jour tout de suite : les vrais blocs sont déjà dessous.
    const x = g.origineX + g.cible.c * g.pas;
    const y = g.origineY + g.cible.l * g.pas;
    g.flottante.classList.add("aimantee");
    g.flottante.style.transform = "translate3d(" + x + "px," + y + "px,0)";
    setTimeout(function () { g.flottante.remove(); }, 100);
    poserPiece(g.index, g.cible.l, g.cible.c);
  } else {
    // Ça ne rentre pas : la pièce retourne à sa place en glissant
    renvoyerPiece(g);
  }
}

function renvoyerPiece(g) {
  const rect = g.elPiece.getBoundingClientRect();
  const centreX = rect.left + rect.width / 2;
  const centreY = rect.top + rect.height / 2;

  g.emplacement.dataset.retour = "1"; // on bloque l'emplacement pendant l'animation
  g.flottante.classList.add("retour");
  g.flottante.classList.remove("prise");
  g.flottante.style.transform =
    "translate3d(" + (centreX - g.largeur / 2) + "px," + (centreY - g.hauteur / 2) + "px,0)";

  setTimeout(function () {
    g.flottante.remove();
    g.elPiece.classList.remove("cachee");
    delete g.emplacement.dataset.retour;
  }, 270);
}

// L'aperçu est recalculé AU PLUS une fois par image d'écran.
// (Le doigt peut envoyer 120 à 240 mouvements par seconde, l'écran n'affiche que 60 images.)
function demanderApercu() {
  if (glisse.imageApercu) return; // déjà prévu pour la prochaine image
  glisse.imageApercu = requestAnimationFrame(function () {
    if (!glisse) return;
    glisse.imageApercu = 0;
    afficherApercu();
  });
}

// Aperçu : on colore en transparent les cases où la pièce va se poser,
// et on fait briller les lignes qui vont exploser.
function afficherApercu() {
  // 1) On calcule l'apparence voulue de chaque case concernée : { "l,c": "classes" }
  const voulu = {};
  const cible = glisse.cible;

  if (cible) {
    const piece = glisse.piece;
    const copie = grille.map(function (ligne) { return ligne.slice(); }); // copie du tableau

    piece.forme.forEach(function (ligne, i) {
      ligne.forEach(function (valeur, j) {
        if (valeur === 0) return;
        const l = cible.l + i;
        const c = cible.c + j;
        copie[l][c] = valeurBloc(piece, i, j);
        voulu[l + "," + c] = "case gemme apercu c" + copie[l][c];
      });
    });

    // On simule la pose sur la copie pour savoir quelles lignes seraient pleines.
    // Leurs gemmes de couleur (1 à 4) prennent la couleur de la pièce et s'éclaircissent.
    const pleines = trouverLignesPleines(copie);
    function surligner(l, c) {
      const cle = l + "," + c;
      if (voulu[cle]) voulu[cle] += " va-exploser";
      else {
        const v = grille[l][c];
        voulu[cle] = "case gemme va-exploser c" + (v >= 1 && v <= 4 ? piece.couleur : v);
      }
    }
    pleines.lignes.forEach(function (l) {
      for (let c = 0; c < TAILLE; c++) surligner(l, c);
    });
    pleines.colonnes.forEach(function (c) {
      for (let l = 0; l < TAILLE; l++) surligner(l, c);
    });

    // Un seul cadre lumineux par ligne (au lieu d'animer chaque case : bien plus léger)
    remplacerSurbrillances(pleines);
  } else {
    remplacerSurbrillances(null);
  }

  // 2) Les cases de l'ancien aperçu qui n'en font plus partie redeviennent normales
  glisse.casesApercu.forEach(function (cle) {
    if (!voulu[cle]) {
      const morceaux = cle.split(",");
      dessinerCase(Number(morceaux[0]), Number(morceaux[1]));
    }
  });

  // 3) On ne touche QUE les cases dont l'apparence change vraiment
  glisse.casesApercu = Object.keys(voulu);
  glisse.casesApercu.forEach(function (cle) {
    const morceaux = cle.split(",");
    const div = el.cases[Number(morceaux[0])][Number(morceaux[1])];
    if (div.className !== voulu[cle]) div.className = voulu[cle];
  });
}

// Les cadres lumineux autour des lignes qui vont exploser.
// On ne les recrée que si les lignes ont changé.
function remplacerSurbrillances(pleines) {
  const signature = pleines ? pleines.lignes.join("-") + "|" + pleines.colonnes.join("-") : "";
  if (signature === glisse.signatureSurbrillance) return;
  glisse.signatureSurbrillance = signature;

  glisse.surbrillances.forEach(function (div) { div.remove(); });
  glisse.surbrillances = [];
  if (!pleines) return;

  const g = geometrie();
  const longueur = (TAILLE - 1) * g.pas + g.taille;
  pleines.lignes.forEach(function (l) {
    const pos = positionCase(l, 0);
    glisse.surbrillances.push(creerSurbrillance(pos.x, pos.y, longueur, g.taille));
  });
  pleines.colonnes.forEach(function (c) {
    const pos = positionCase(0, c);
    glisse.surbrillances.push(creerSurbrillance(pos.x, pos.y, g.taille, longueur));
  });
}

function creerSurbrillance(x, y, largeur, hauteur) {
  const div = document.createElement("div");
  div.className = "surbrillance";
  div.style.left = x + "px";
  div.style.top = y + "px";
  div.style.width = largeur + "px";
  div.style.height = hauteur + "px";
  el.grille.appendChild(div);
  return div;
}

// Remet les cases de l'aperçu comme le tableau le dit
function effacerApercu(g) {
  cancelAnimationFrame(g.imageApercu);
  g.casesApercu.forEach(function (cle) {
    const morceaux = cle.split(",");
    dessinerCase(Number(morceaux[0]), Number(morceaux[1]));
  });
  g.casesApercu = [];
  g.surbrillances.forEach(function (div) { div.remove(); });
  g.surbrillances = [];
}


// ---------- 5. POSER, EXPLOSER, COMPTER ----------

function poserPiece(index, ligne, colonne) {
  const piece = pieces[index];
  let nbBlocs = 0;

  // On écrit la pièce dans le tableau, puis on redessine les cases touchées
  piece.forme.forEach(function (rangee, i) {
    rangee.forEach(function (valeur, j) {
      if (valeur === 0) return;
      const l = ligne + i;
      const c = colonne + j;
      grille[l][c] = valeurBloc(piece, i, j);
      dessinerCase(l, c);
      el.cases[l][c].classList.add("pose");
      nbBlocs++;
    });
  });

  // La pièce quitte la réserve
  pieces[index] = null;
  el.emplacements[index].innerHTML = "";

  Son.pose();
  vibrer(8);
  ajouterPoints(nbBlocs); // 1 point par bloc posé
  afficherPointsPose(nbBlocs, ligne, colonne, piece.forme);

  // Centre de la pièce : les explosions partiront de là, en vague
  const centreL = ligne + (piece.forme.length - 1) / 2;
  const centreC = colonne + (piece.forme[0].length - 1) / 2;
  const nbLignes = exploserLignes(centreL, centreC);

  // Mode niveau : on compte les lignes et les coups, puis on regarde si c'est gagné ou perdu
  if (mode === "niveau") {
    lignesNiveau += nbLignes;
    if (coupsRestants !== null) coupsRestants--;
    majHud();
    if (lignesNiveau >= niveau.objectif) {
      gagnerNiveau();
      return;
    }
    if (coupsRestants === 0) {
      perdre("coups");
      return;
    }
  }

  // Les 3 pièces sont posées ? On en donne 3 nouvelles
  if (pieces.every(function (p) { return p === null; })) {
    donnerNouvellesPieces();
  }

  verifierPieces();
  sauvegarder();
}

// Fait exploser les lignes et colonnes pleines. Renvoie le nombre de lignes explosées.
function exploserLignes(centreL, centreC) {
  const pleines = trouverLignesPleines(grille);

  if (pleines.lignes.length === 0 && pleines.colonnes.length === 0) {
    // Pas d'explosion. Après 3 poses sans explosion, la série s'arrête.
    posesSansExplosion++;
    if (posesSansExplosion >= 3) serie = 0;
    return 0;
  }

  // On rassemble toutes les cases à vider. Un Set est une liste sans doublon :
  // une case au croisement d'une ligne et d'une colonne ne compte qu'une fois.
  const aVider = new Set();
  const lignesFaites = new Set();
  const colonnesFaites = new Set();
  let obsidienneDeclenchee = false;

  // La "file d'attente" des lignes à faire exploser
  const file = [];
  pleines.lignes.forEach(function (l) { file.push({ type: "ligne", n: l }); });
  pleines.colonnes.forEach(function (c) { file.push({ type: "colonne", n: c }); });

  while (file.length > 0) {
    const x = file.shift();
    const dejaFaite = x.type === "ligne" ? lignesFaites : colonnesFaites;
    if (dejaFaite.has(x.n)) continue;
    dejaFaite.add(x.n);

    for (let k = 0; k < TAILLE; k++) {
      const l = x.type === "ligne" ? x.n : k;
      const c = x.type === "ligne" ? k : x.n;
      aVider.add(l + "," + c);
      // Bloc obsidienne dans une ligne qui explose → toute sa colonne explose aussi
      // (et dans une colonne → toute sa ligne). Ça peut faire une réaction en chaîne !
      if (grille[l][c] === 5) {
        obsidienneDeclenchee = true;
        if (x.type === "ligne") file.push({ type: "colonne", n: c });
        else file.push({ type: "ligne", n: l });
      }
    }
  }

  const nbLignes = lignesFaites.size + colonnesFaites.size;

  // Un rayon de lumière balaie chaque ligne et chaque colonne qui explose
  lignesFaites.forEach(function (l) { lancerRayon("ligne", l); });
  colonnesFaites.forEach(function (c) { lancerRayon("colonne", c); });

  // On vide le tableau et on lance les animations
  aVider.forEach(function (cle) {
    const morceaux = cle.split(",");
    const l = Number(morceaux[0]);
    const c = Number(morceaux[1]);
    const valeur = grille[l][c];
    if (valeur === 0) return;
    // Plus la case est loin de la pièce posée, plus elle explose tard : effet de vague.
    // (+90 ms : on attend que la pièce ait fini de s'aimanter)
    const distance = Math.abs(l - centreL) + Math.abs(c - centreC);
    const delai = 90 + distance * 30;

    if (valeur === 7) {
      // Rocher dur : il ne disparaît pas, il se fissure (il devient un rocher simple)
      grille[l][c] = 6;
      animerFissure(l, c, delai);
    } else {
      grille[l][c] = 0;
      animerExplosion(l, c, valeur, delai);
    }
  });

  // ----- Les points -----
  serie++;
  posesSansExplosion = 0;

  // 10 points par ligne, multipliés par le combo (2 lignes = x2, 3 lignes = x3…)
  let points = 10 * nbLignes * nbLignes;
  // Bonus série : à partir de la 2e explosion de suite
  if (serie >= 2) points += 20 * (serie - 1);
  // Bonus grille parfaite : plus aucun bloc !
  const parfaite = grille.every(function (rangee) {
    return rangee.every(function (v) { return v === 0; });
  });
  if (parfaite) points += 300;

  ajouterPoints(points);

  // ----- Les messages, sons et vibrations -----
  if (obsidienneDeclenchee) afficherMessage("OBSIDIENNE !", "special");
  if (nbLignes >= 2) afficherMessage("COMBO x" + nbLignes + " !", "");
  if (serie >= 2) afficherMessage("SÉRIE x" + serie, "serie");
  if (parfaite) afficherMessage("GRILLE PARFAITE !", "special");
  afficherMessage("+" + points, "points");

  if (nbLignes >= 2) {
    Son.combo(nbLignes);
    vibrer([30, 40, 60]);
  } else {
    Son.explosion();
    vibrer(30);
  }

  // Gros combo : l'écran tremble
  if (nbLignes >= 3 || obsidienneDeclenchee) {
    el.plateau.classList.remove("tremble");
    void el.plateau.offsetWidth;
    el.plateau.classList.add("tremble");
  }

  return nbLignes;
}

// Un rocher dur encaisse le choc : il tremble, perd des éclats et se fissure
function animerFissure(l, c, delai) {
  const div = el.cases[l][c];
  const pos = positionCase(l, c);
  setTimeout(function () {
    dessinerCase(l, c); // il prend l'apparence du rocher fissuré (6)
    div.classList.add("fissure");
    const couleurs = couleursGemme(7);
    Eclats.lancer(pos.ecranX, pos.ecranY, couleurs[0], couleurs[1], 4, geometrie().taille);
    Son.fissure();
  }, delai);
}

// Une case explose : animation CSS + éclats de gemmes sur le canvas
function animerExplosion(l, c, valeur, delai) {
  const div = el.cases[l][c];
  div.className = "case gemme explose c" + valeur;
  div.style.animationDelay = delai + "ms";

  // Les éclats partent quand la vague arrive sur la case
  // (position calculée tout de suite, depuis les mesures en mémoire : aucun recalcul)
  const pos = positionCase(l, c);
  setTimeout(function () {
    const couleurs = couleursGemme(valeur);
    Eclats.lancer(pos.ecranX, pos.ecranY, couleurs[0], couleurs[1], valeur === 5 ? 10 : 5, geometrie().taille);
  }, delai);

  // À la fin de l'animation, la case reprend l'apparence que le tableau indique
  setTimeout(function () {
    div.style.animationDelay = "";
    if (div.classList.contains("explose")) dessinerCase(l, c);
  }, delai + 400);
}

// Ajoute dans la grille un petit élément décoratif qui se supprime
// tout seul à la fin de son animation CSS
function ajouterDecor(classe, gauche, haut, largeur, hauteur) {
  const div = document.createElement("div");
  div.className = classe;
  div.style.left = gauche + "px";
  div.style.top = haut + "px";
  if (largeur) div.style.width = largeur + "px";
  if (hauteur) div.style.height = hauteur + "px";
  el.grille.appendChild(div);
  div.addEventListener("animationend", function () { div.remove(); });
  return div;
}

// Rayon de lumière sur toute une ligne (type "ligne") ou colonne (type "colonne")
function lancerRayon(type, n) {
  const g = geometrie();
  const longueur = (TAILLE - 1) * g.pas + g.taille; // de la 1re à la dernière case
  const debut = type === "ligne" ? positionCase(n, 0) : positionCase(0, n);
  ajouterDecor(
    "rayon " + type,
    debut.x,
    debut.y,
    type === "ligne" ? longueur : g.taille,
    type === "ligne" ? g.taille : longueur
  );
}

// "+4" qui s'envole du centre de la pièce posée
function afficherPointsPose(points, ligne, colonne, forme) {
  const g = geometrie();
  const coin = positionCase(ligne, colonne);
  const div = ajouterDecor(
    "points-pose",
    coin.x + (forme[0].length * g.pas) / 2,
    coin.y + (forme.length * g.pas) / 2
  );
  div.textContent = "+" + points;
}

// De temps en temps, une étoile scintille sur une gemme au hasard
function scintiller() {
  // Inutile si l'appli est cachée, si un écran est par-dessus ou pendant un glissement
  if (document.hidden || glisse || partieFinie || document.querySelector(".superpose.visible")) return;

  const gemmes = [];
  for (let l = 0; l < TAILLE; l++) {
    for (let c = 0; c < TAILLE; c++) {
      if (grille[l][c] !== 0) gemmes.push([l, c]);
    }
  }
  if (gemmes.length === 0) return;

  const choix = gemmes[entierAuHasard(gemmes.length)];
  const pos = positionCase(choix[0], choix[1]);
  const taille = geometrie().taille;
  ajouterDecor("scintille", pos.x + taille * 0.22, pos.y + taille * 0.22);
}

// Crée les gemmes qui montent derrière l'écran d'accueil
function creerGemmesAccueil() {
  const conteneur = document.getElementById("gemmes-fond");
  for (let i = 0; i < 12; i++) {
    const gemme = document.createElement("span");
    gemme.className = "gemme-volante gemme c" + (1 + (i % 4));
    gemme.style.left = Math.random() * 100 + "%";
    gemme.style.setProperty("--case", 14 + Math.random() * 26 + "px");
    gemme.style.animationDuration = 9 + Math.random() * 9 + "s";
    // Un délai négatif = l'animation a "déjà commencé" : les gemmes sont réparties dès le début
    gemme.style.animationDelay = -Math.random() * 18 + "s";
    conteneur.appendChild(gemme);
  }
}

// Couleurs [claire, foncée] d'une gemme, lues dans les variables CSS du thème
let couleursTheme = {};
function lireCouleursTheme() {
  const style = getComputedStyle(document.body);
  for (let n = 1; n <= 4; n++) {
    couleursTheme[n] = [
      style.getPropertyValue("--c" + n + "-clair").trim(),
      style.getPropertyValue("--c" + n + "-fonce").trim(),
    ];
  }
  couleursTheme[5] = ["#8A80A8", "#0B0812"]; // obsidienne
  couleursTheme[6] = ["#B4ADC2", "#4A4456"]; // rocher
  couleursTheme[7] = ["#8C8599", "#2A2533"]; // rocher dur
}
function couleursGemme(valeur) {
  return couleursTheme[valeur] || ["#fff", "#888"];
}

// Affiche un texte animé au-dessus de la grille ("COMBO x2 !")
function afficherMessage(texte, classe) {
  const span = document.createElement("span");
  span.className = "msg " + classe;
  span.textContent = texte;
  el.messages.appendChild(span);
  // Le message se supprime tout seul à la fin de son animation
  span.addEventListener("animationend", function () { span.remove(); });
}

// ----- Le score -----
let scoreAffiche = 0;  // le nombre écrit à l'écran (il "rattrape" le vrai score)
let animationScore = 0;

function ajouterPoints(points) {
  score += points;
  // Le record ne compte que pour le mode infini
  if (mode === "infini" && score > record) {
    record = score;
    ecrire(CLE_RECORD, record);
    el.record.classList.toggle("battu", recordAuDebut > 0);
  }
  afficherScore(true);
}

// Le score défile de l'ancienne valeur à la nouvelle, et rebondit
function afficherScore(animer) {
  el.record.textContent = record;
  cancelAnimationFrame(animationScore);

  if (!animer) {
    scoreAffiche = score;
    el.score.textContent = score;
    return;
  }

  const depart = scoreAffiche;
  const arrivee = score;
  const debut = performance.now();
  const duree = 450;

  function etape(maintenant) {
    // Math.max(0, …) : le 1er "maintenant" peut être un poil AVANT "debut" → jamais négatif
    const avancement = Math.max(0, Math.min(1, (maintenant - debut) / duree));
    const adouci = 1 - Math.pow(1 - avancement, 3); // ralentit à la fin
    scoreAffiche = Math.round(depart + (arrivee - depart) * adouci);
    el.score.textContent = scoreAffiche;
    if (avancement < 1) animationScore = requestAnimationFrame(etape);
  }
  animationScore = requestAnimationFrame(etape);

  el.score.classList.remove("saute");
  void el.score.offsetWidth;
  el.score.classList.add("saute");
}


// ---------- 6. FIN DE PARTIE ----------

// Grise les pièces qui ne rentrent nulle part.
// Si AUCUNE pièce restante ne rentre : la partie est finie.
function verifierPieces() {
  let auMoinsUne = false;
  pieces.forEach(function (piece, i) {
    if (!piece) return;
    const rentre = peutPlacerQuelquePart(piece.forme);
    const elPiece = el.emplacements[i].querySelector(".piece");
    if (elPiece) elPiece.classList.toggle("bloquee", !rentre);
    if (rentre) auMoinsUne = true;
  });

  if (!auMoinsUne) perdre("place");
}

// La partie est perdue. raison = "place" (plus rien ne rentre) ou "coups" (plus de coups)
function perdre(raison) {
  partieFinie = true;
  effacerSauvegarde();
  // On laisse le temps de voir la grille avant l'écran de fin
  plusTard(function () { finDePartie(raison); }, 900);
}

function finDePartie(raison) {
  const enNiveau = mode === "niveau";
  document.getElementById("titre-fin").textContent =
    raison === "coups" ? "Plus de coups !" : "Plus de place !";
  // Mode infini : on montre le record. Mode niveau : on montre l'objectif.
  document.getElementById("ligne-record-fin").hidden = enNiveau;
  document.getElementById("objectif-fin").hidden = !enNiveau;
  if (enNiveau) {
    document.getElementById("objectif-fin-valeur").textContent = lignesNiveau + "/" + niveau.objectif;
  }
  document.getElementById("btn-rejouer").textContent = enNiveau ? "Réessayer" : "Rejouer";
  document.getElementById("btn-accueil").textContent = enNiveau ? "Carte" : "Accueil";

  // La grille s'éteint en vague, du haut vers le bas
  for (let l = 0; l < TAILLE; l++) {
    for (let c = 0; c < TAILLE; c++) {
      el.cases[l][c].style.transitionDelay = l * 70 + c * 20 + "ms";
    }
  }
  el.grille.classList.add("eteinte");
  const nouveauRecord = !enNiveau && score > recordAuDebut && score > 0;

  document.getElementById("score-final").textContent = score;
  document.getElementById("record-fin").textContent = record;
  document.getElementById("nouveau-record").hidden = !nouveauRecord;

  Son.gameOver();
  vibrer([60, 50, 120]);
  if (nouveauRecord) plusTard(Son.record, 1000);

  plusTard(function () { montrerEcran("ecran-fin"); }, 1100);
}

// Niveau réussi !
function gagnerNiveau() {
  partieFinie = true;
  effacerSauvegarde();

  // Bonus : chaque coup restant rapporte 10 points
  const bonus = coupsRestants ? coupsRestants * 10 : 0;
  if (bonus > 0) ajouterPoints(bonus);

  const etoiles = calculerEtoiles(niveau, score);
  enregistrerVictoire(niveau.numero, etoiles, score);

  afficherMessage("NIVEAU RÉUSSI !", "special");
  if (bonus > 0) afficherMessage("+" + bonus + " coups restants", "serie");
  Son.victoire();
  vibrer([40, 60, 40, 60, 120]);

  // Une pluie d'éclats depuis chaque case de la grille, pour fêter ça
  const g = geometrie();
  const cote = TAILLE * g.pas;
  for (let i = 0; i < 12; i++) {
    const couleurs = couleursGemme(1 + (i % 4));
    Eclats.lancer(g.gauche + g.x0 + Math.random() * cote, g.haut + g.y0 + Math.random() * cote,
                  couleurs[0], couleurs[1], 6, g.taille);
  }

  plusTard(function () { afficherVictoire(etoiles, bonus); }, 1300);
}

function afficherVictoire(etoiles, bonus) {
  document.getElementById("vic-niveau").textContent = niveau.numero;
  document.getElementById("vic-score").textContent = score;
  document.getElementById("vic-detail").textContent =
    (bonus > 0 ? "Dont " + bonus + " points de coups restants. " : "") +
    (etoiles < 3 ? "3 étoiles à partir de " + niveau.troisEtoiles + " points." : "Parfait !");
  document.getElementById("btn-suivant").textContent =
    niveau.numero < NB_NIVEAUX ? "Niveau suivant" : "Tu as tout fini !";

  // Les étoiles apparaissent l'une après l'autre, avec un son qui monte
  const elEtoiles = document.querySelectorAll(".etoile-v");
  elEtoiles.forEach(function (etoile) { etoile.classList.remove("gagnee"); });
  montrerEcran("ecran-victoire");
  for (let i = 0; i < etoiles; i++) {
    plusTard(function () {
      elEtoiles[i].classList.add("gagnee");
      Son.etoile(i);
      vibrer(20);
    }, 450 + i * 350);
  }
}

// Démarre une partie. nouveauMode = "infini" ou "niveau" ; numero = le numéro du niveau.
function demarrerPartie(nouveauMode, numero) {
  numeroPartie++; // les écrans de fin de l'ancienne partie ne s'afficheront pas
  mode = nouveauMode;
  niveau = mode === "niveau" ? configNiveau(numero) : null;
  grille = mode === "niveau" ? grilleDepartNiveau(niveau) : creerGrilleVide();
  lignesNiveau = 0;
  coupsRestants = niveau ? niveau.coups : null;
  score = 0;
  serie = 0;
  posesSansExplosion = 0;
  partieFinie = false;
  recordAuDebut = record;
  el.record.classList.remove("battu");
  el.grille.classList.remove("eteinte");
  el.cases.forEach(function (rangee) {
    rangee.forEach(function (div) { div.style.transitionDelay = ""; });
  });
  el.messages.innerHTML = "";
  dessinerGrille();
  afficherScore(false);
  majHud();
  donnerNouvellesPieces();
  verifierPieces();
  sauvegarder();
}

// Met à jour l'affichage du haut : record (infini) ou niveau/coups/objectif (niveaux)
function majHud() {
  const enNiveau = mode === "niveau";
  // Le haut de l'écran change selon le mode : la grille peut bouger, on la remesurera
  geo = null;
  document.getElementById("bloc-niveau").hidden = !enNiveau;
  document.getElementById("bloc-objectif").hidden = !enNiveau;
  document.getElementById("bloc-record").hidden = enNiveau;
  if (!enNiveau) return;

  document.getElementById("hud-niveau").textContent = "Niveau " + niveau.numero;
  document.getElementById("hud-coups").textContent = coupsRestants === null ? "∞" : coupsRestants;
  // Plus que 3 coups : le compteur passe en rouge
  document.getElementById("hud-bloc-coups").classList.toggle("alerte", coupsRestants !== null && coupsRestants <= 3);
  document.getElementById("hud-lignes").textContent = Math.min(lignesNiveau, niveau.objectif);
  document.getElementById("hud-objectif").textContent = niveau.objectif;
  // La barre se remplit avec transform: scaleX (de 0 à 1) : animation fluide
  const avancement = Math.min(1, lignesNiveau / niveau.objectif);
  document.getElementById("hud-barre").style.transform = "scaleX(" + avancement + ")";
}


// ---------- 7. SAUVEGARDE ----------
// localStorage garde du texte même quand on ferme l'appli.
// JSON.stringify transforme nos tableaux en texte ; JSON.parse fait l'inverse.
// Les try/catch évitent un plantage si le stockage est interdit (navigation privée).

function lireNombre(cle) {
  try {
    return Number(localStorage.getItem(cle)) || 0;
  } catch (e) {
    return 0;
  }
}

function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, valeur);
  } catch (e) {}
}

function sauvegarder() {
  if (partieFinie) return;
  ecrire(CLE_PARTIE, JSON.stringify({
    grille: grille,
    pieces: pieces,
    score: score,
    serie: serie,
    posesSansExplosion: posesSansExplosion,
    mode: mode,
    numeroNiveau: niveau ? niveau.numero : null,
    lignesNiveau: lignesNiveau,
    coupsRestants: coupsRestants,
  }));
}

function effacerSauvegarde() {
  try {
    localStorage.removeItem(CLE_PARTIE);
  } catch (e) {}
}

// Recharge la partie sauvegardée. Renvoie false s'il n'y en a pas (ou si elle est abîmée).
function chargerPartie() {
  try {
    const donnees = JSON.parse(localStorage.getItem(CLE_PARTIE));
    if (!donnees || !Array.isArray(donnees.grille) || donnees.grille.length !== TAILLE) return false;
    grille = donnees.grille;
    pieces = donnees.pieces;
    score = donnees.score || 0;
    serie = donnees.serie || 0;
    posesSansExplosion = donnees.posesSansExplosion || 0;
    mode = donnees.mode === "niveau" && donnees.numeroNiveau ? "niveau" : "infini";
    niveau = mode === "niveau" ? configNiveau(donnees.numeroNiveau) : null;
    lignesNiveau = donnees.lignesNiveau || 0;
    coupsRestants = donnees.coupsRestants === undefined ? null : donnees.coupsRestants;
    // Toutes les pièces posées au moment de la sauvegarde ? On en redonne.
    if (pieces.every(function (p) { return p === null; })) {
      pieces = tirerPieces();
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Une partie est "en cours" s'il y a déjà des points
function partieEnCours() {
  return !partieFinie && score > 0;
}


// ---------- 8. ÉCRANS, THÈMES, BOUTONS ----------

const ecrans = ["ecran-accueil", "ecran-regles", "ecran-fin", "ecran-carte", "ecran-intro", "ecran-victoire"];

// Affiche un écran superposé (ou aucun avec null)
function montrerEcran(id) {
  ecrans.forEach(function (nom) {
    document.getElementById(nom).classList.toggle("visible", nom === id);
  });
}

function ouvrirAccueil() {
  document.getElementById("record-accueil").textContent = record;
  document.getElementById("accueil-etoiles").textContent = totalEtoiles(lireProgres());
  // Le bouton "Continuer" n'apparaît que si une partie est en cours
  const boutonContinuer = document.getElementById("btn-continuer");
  boutonContinuer.hidden = !partieEnCours();
  boutonContinuer.textContent = mode === "niveau"
    ? "Continuer · Niveau " + niveau.numero
    : "Continuer · Infini";
  montrerEcran("ecran-accueil");
}

// ----- La carte des niveaux -----

const SVG_ETOILE = '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/></svg>';
const SVG_CADENAS = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

// Construit les 100 boutons, rangés par monde de 10 niveaux
function construireCarte() {
  const progres = lireProgres();
  const liste = document.getElementById("liste-niveaux");
  liste.innerHTML = "";
  document.getElementById("carte-etoiles").textContent = totalEtoiles(progres);

  let boutonActuel = null;
  for (let m = 0; m < MONDES.length; m++) {
    const section = document.createElement("section");
    section.className = "monde";
    section.innerHTML = "<h3>Monde " + (m + 1) + " · " + MONDES[m] + "</h3>";
    const grilleMonde = document.createElement("div");
    grilleMonde.className = "grille-monde";

    for (let n = m * 10 + 1; n <= m * 10 + 10; n++) {
      const bouton = document.createElement("button");
      const verrouille = n > progres.debloque;
      const etoiles = progres.etoiles[n] || 0;
      // Chaque monde a sa couleur de gemme (violet, turquoise, rose, or, puis on recommence)
      bouton.className = "btn-niveau gemme c" + (1 + (m % 4));
      if (n % 10 === 0) bouton.classList.add("boss");
      if (verrouille) bouton.classList.add("verrou");
      if (n === progres.debloque) {
        bouton.classList.add("actuel");
        boutonActuel = bouton;
      }

      let html = verrouille ? '<span class="num">' + SVG_CADENAS + "</span>"
                            : '<span class="num">' + n + "</span>";
      if (n % 10 === 0) html += '<span class="marque-boss">BOSS</span>';
      // 3 petites étoiles sous le bouton (pleines si gagnées)
      html += '<span class="etoiles-niveau">';
      for (let e = 1; e <= 3; e++) {
        html += '<span class="' + (e <= etoiles ? "pleine" : "") + '">' + SVG_ETOILE + "</span>";
      }
      html += "</span>";
      bouton.innerHTML = html;
      bouton.setAttribute("aria-label", "Niveau " + n + (verrouille ? " (verrouillé)" : ""));

      bouton.addEventListener("click", function () {
        Son.init();
        if (verrouille) {
          Son.refus();
          return;
        }
        Son.clic();
        ouvrirIntro(n);
      });
      grilleMonde.appendChild(bouton);
    }
    section.appendChild(grilleMonde);
    liste.appendChild(section);
  }
  return boutonActuel;
}

function ouvrirCarte() {
  const boutonActuel = construireCarte();
  montrerEcran("ecran-carte");
  // On fait défiler la carte jusqu'au niveau à jouer
  if (boutonActuel) boutonActuel.scrollIntoView({ block: "center" });
}

// ----- La présentation d'un niveau -----

let niveauChoisi = 1;

function ouvrirIntro(numero) {
  niveauChoisi = numero;
  const config = configNiveau(numero);
  document.getElementById("intro-monde").textContent = "Monde " + (config.indexMonde + 1) + " · " + config.nomMonde;
  document.getElementById("intro-titre").textContent = "Niveau " + numero;
  const badgeBoss = document.getElementById("intro-boss");
  badgeBoss.hidden = !config.boss;
  badgeBoss.textContent = "BOSS · " + config.nomBoss;
  document.getElementById("intro-lignes").textContent = config.objectif;
  document.getElementById("intro-coups").textContent = config.coups === null ? "∞" : config.coups;
  document.getElementById("intro-astuce").textContent = astuceNiveau(config);

  // Mini-grille : on dessine les rochers de départ en petit
  const mini = document.getElementById("intro-grille");
  mini.innerHTML = "";
  grilleDepartNiveau(config).forEach(function (rangee) {
    rangee.forEach(function (valeur) {
      const div = document.createElement("div");
      div.className = valeur === 0 ? "case" : "case gemme c" + valeur;
      mini.appendChild(div);
    });
  });

  montrerEcran("ecran-intro");
}

const themes = ["obsidienne", "lave", "ocean"];
const couleursBarre = { obsidienne: "#1E1734", lave: "#3A0E06", ocean: "#06284A" };

function appliquerTheme(nom) {
  if (themes.indexOf(nom) === -1) nom = "obsidienne";
  document.body.className = "theme-" + nom;
  // La couleur de la barre du téléphone suit le thème
  document.querySelector('meta[name="theme-color"]').setAttribute("content", couleursBarre[nom]);
  document.querySelectorAll(".btn-theme").forEach(function (bouton) {
    bouton.classList.toggle("actif", bouton.dataset.theme === nom);
  });
  ecrire(CLE_THEME, nom);
  lireCouleursTheme();
}

// Petit raccourci : relie un bouton à une action (avec le son de clic)
function surClic(id, action) {
  document.getElementById(id).addEventListener("click", function () {
    Son.init();
    Son.clic();
    action();
  });
}

// Lance un niveau : la grille apparaît, avec un petit message
function lancerNiveau(numero) {
  demarrerPartie("niveau", numero);
  montrerEcran(null);
  afficherMessage("NIVEAU " + numero, "special");
  afficherMessage(niveau.objectif + " lignes", "serie");
}

// Accueil
surClic("btn-continuer", function () { montrerEcran(null); });
surClic("btn-niveaux", ouvrirCarte);
surClic("btn-infini", function () {
  demarrerPartie("infini");
  montrerEcran(null);
});
surClic("btn-regles", function () { montrerEcran("ecran-regles"); });
surClic("btn-fermer-regles", ouvrirAccueil);

// En jeu
surClic("btn-menu", ouvrirAccueil);

// Carte et présentation d'un niveau
surClic("btn-retour-carte", ouvrirAccueil);
surClic("btn-go", function () { lancerNiveau(niveauChoisi); });
surClic("btn-intro-carte", ouvrirCarte);

// Victoire
surClic("btn-suivant", function () {
  if (niveau.numero < NB_NIVEAUX) ouvrirIntro(niveau.numero + 1);
  else ouvrirCarte();
});
surClic("btn-vic-rejouer", function () { ouvrirIntro(niveau.numero); });
surClic("btn-vic-carte", ouvrirCarte);

// Défaite : "Réessayer"/"Rejouer" et "Carte"/"Accueil" selon le mode
surClic("btn-rejouer", function () {
  if (mode === "niveau") lancerNiveau(niveau.numero);
  else {
    demarrerPartie("infini");
    montrerEcran(null);
  }
});
surClic("btn-accueil", function () {
  if (mode === "niveau") ouvrirCarte();
  else ouvrirAccueil();
});

const boutonSon = document.getElementById("btn-son");
boutonSon.classList.toggle("muet", !Son.actif);
boutonSon.addEventListener("click", function () {
  Son.init();
  const actif = Son.basculer();
  boutonSon.classList.toggle("muet", !actif);
  boutonSon.setAttribute("aria-label", actif ? "Couper le son" : "Activer le son");
  Son.clic();
});

document.querySelectorAll(".btn-theme").forEach(function (bouton) {
  bouton.addEventListener("click", function () {
    Son.init();
    Son.clic();
    appliquerTheme(bouton.dataset.theme);
  });
});

// Quand l'appli passe en arrière-plan (on change d'appli), on sauvegarde
document.addEventListener("visibilitychange", function () {
  if (document.hidden) sauvegarder();
});


// ---------- 9. INSTALLATION ET HORS LIGNE ----------

// Le "service worker" (fichier sw.js) garde une copie du jeu dans le téléphone :
// le jeu marche ensuite sans Internet. Il ne fonctionne que sur un vrai site
// (https:// ou localhost), pas en ouvrant le fichier directement (file://).
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js");
  });
}

// Android / ordinateur : le navigateur propose l'installation → on affiche notre bouton
let invitationInstallation = null;
const boutonInstaller = document.getElementById("btn-installer");

window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault(); // on garde l'invitation pour plus tard
  invitationInstallation = e;
  boutonInstaller.hidden = false;
});

boutonInstaller.addEventListener("click", function () {
  if (!invitationInstallation) return;
  invitationInstallation.prompt();
  invitationInstallation = null;
  boutonInstaller.hidden = true;
});

window.addEventListener("appinstalled", function () {
  boutonInstaller.hidden = true;
});

// iPhone : pas de bouton possible, on explique comment faire
const estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const dejaInstallee = window.navigator.standalone === true ||
                      window.matchMedia("(display-mode: standalone)").matches;
document.getElementById("astuce-ios").hidden = !(estIOS && !dejaInstallee);


// ---------- DÉMARRAGE ----------

let themeSauve = "obsidienne";
try {
  themeSauve = localStorage.getItem(CLE_THEME) || "obsidienne";
} catch (e) {}
appliquerTheme(themeSauve);

construireGrille();
Eclats.init();
creerGemmesAccueil();
setInterval(scintiller, 900);

if (chargerPartie()) {
  dessinerGrille();
  dessinerReserve(true);
  afficherScore(false);
  majHud();
  verifierPieces();
} else {
  demarrerPartie("infini");
}
ouvrirAccueil();
