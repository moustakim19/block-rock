// ==========================================================
// BLOCK ROCK — Les 100 niveaux
// On ne dessine pas 100 niveaux à la main : une fonction,
// configNiveau(numero), CALCULE chaque niveau à partir de son
// numéro. Plus le numéro est grand, plus c'est difficile.
// Seuls les 10 niveaux BOSS (10, 20, … 100) sont dessinés à la main.
// ==========================================================

const NB_NIVEAUX = 100;

// 10 mondes de 10 niveaux
const MONDES = [
  "Grottes d'Améthyste",
  "Lagon Turquoise",
  "Falaises de Quartz Rose",
  "Mines d'Or",
  "Gouffre d'Obsidienne",
  "Volcan de Rubis",
  "Glacier de Saphir",
  "Forêt de Jade",
  "Cimes de Diamant",
  "Cœur de la Montagne",
];

// Les grilles des boss, dessinées avec du texte :
//   "." = vide,  "r" = rocher (1 explosion),  "R" = rocher dur (2 explosions)
// Règle importante : aucune ligne ni colonne ne doit être pleine au départ !
const BOSS = [
  { nom: "La Croix de pierre", motif: [
    "r......r",
    ".r....r.",
    "..r..r..",
    "........",
    "........",
    "..r..r..",
    ".r....r.",
    "r......r"] },
  { nom: "Les Quatre Piliers", motif: [
    "...rr...",
    "...rr...",
    "........",
    "rr....rr",
    "rr....rr",
    "........",
    "...rr...",
    "...rr..."] },
  { nom: "Le Damier", motif: [
    "r.r.....",
    ".r.r....",
    "r.r.....",
    "........",
    "........",
    ".....r.r",
    "....r.r.",
    ".....r.r"] },
  { nom: "Le Cœur de Pierre", motif: [
    "........",
    ".rr..rr.",
    "r..rr..r",
    "r......r",
    ".r....r.",
    "..r..r..",
    "...rr...",
    "........"] },
  { nom: "Les Murailles", motif: [
    "R......R",
    "R......R",
    "R......R",
    "........",
    "........",
    "R......R",
    "R......R",
    "R......R"] },
  { nom: "Le Diamant", motif: [
    "...RR...",
    "..r..r..",
    ".r....r.",
    "R......R",
    "R......R",
    ".r....r.",
    "..r..r..",
    "...RR..."] },
  { nom: "L'Escalier", motif: [
    "R.......",
    "RR......",
    ".RR.....",
    "..RR....",
    "....RR..",
    ".....RR.",
    "......RR",
    ".......R"] },
  { nom: "La Forteresse", motif: [
    "RR.RR.RR",
    "R......R",
    "........",
    "R..RR..R",
    "R..RR..R",
    "........",
    "R......R",
    "RR.RR.RR"] },
  { nom: "Le Labyrinthe", motif: [
    ".R.R.R.R",
    "........",
    "R.R.R.R.",
    "........",
    ".R.R.R.R",
    "........",
    "R.R.R.R.",
    "........"] },
  { nom: "Le Cœur de la Montagne", motif: [
    "RRR..RRR",
    "R..rr..R",
    "R.r..r.R",
    "..r..r..",
    "..r..r..",
    "R.r..r.R",
    "R..rr..R",
    "RRR..RRR"] },
];

// Calcule tout ce qui définit un niveau à partir de son numéro (1 à 100).
function configNiveau(numero) {
  // d = la difficulté, de 0 (niveau 1) à 1 (niveau 100)
  const d = (numero - 1) / (NB_NIVEAUX - 1);
  const boss = numero % 10 === 0;
  const indexMonde = Math.floor((numero - 1) / 10);
  // Nombre de lignes à faire exploser : 3 au début, 30 au niveau 100 (+2 pour un boss)
  const objectif = 3 + Math.floor(numero / 4) + (boss ? 2 : 0);

  return {
    numero: numero,
    boss: boss,
    indexMonde: indexMonde,
    nomMonde: MONDES[indexMonde],
    nomBoss: boss ? BOSS[numero / 10 - 1].nom : null,
    motif: boss ? BOSS[numero / 10 - 1].motif : null,
    objectif: objectif,
    // Rochers posés au départ : aucun avant le niveau 4, puis de plus en plus (24 maximum)
    rochers: numero < 4 ? 0 : Math.min(24, 2 * Math.floor(1 + (numero - 4) * 0.12)),
    // Proportion de rochers DURS : à partir du niveau 25, jusqu'à 60 %
    partDurs: numero < 25 ? 0 : Math.min(0.6, 0.15 + (numero - 25) / 150),
    // Coups illimités jusqu'au niveau 10, puis de moins en moins de marge
    coups: numero <= 10 ? null : Math.round(objectif * (4.2 - 1.6 * d)) + 2,
    // Plus d est grand, plus les grosses pièces sortent souvent (voir pieces.js)
    difficulte: d,
    // Avant le niveau 40, le jeu garantit que les 3 pièces rentrent
    toutesJouables: numero < 40,
    // Score à atteindre pour 2 et 3 étoiles
    deuxEtoiles: objectif * 24,
    troisEtoiles: objectif * 34,
  };
}

// Un générateur de hasard "avec graine" : pour une même graine, il donne
// toujours la même suite de nombres. Ainsi le niveau 37 a toujours les
// mêmes rochers au même endroit, comme un vrai niveau dessiné.
// (C'est l'algorithme "mulberry32" : pas besoin de comprendre les calculs.)
function generateurAleatoire(graine) {
  return function () {
    graine = (graine + 0x6D2B79F5) | 0;
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Vrai si une ligne ou une colonne de la grille g est pleine
function aUneLignePleine(g) {
  for (let i = 0; i < 8; i++) {
    let lignePleine = true;
    let colonnePleine = true;
    for (let j = 0; j < 8; j++) {
      if (g[i][j] === 0) lignePleine = false;
      if (g[j][i] === 0) colonnePleine = false;
    }
    if (lignePleine || colonnePleine) return true;
  }
  return false;
}

// Fabrique la grille de départ d'un niveau (avec ses rochers)
function grilleDepartNiveau(config) {
  const g = [];
  for (let l = 0; l < 8; l++) g.push([0, 0, 0, 0, 0, 0, 0, 0]);

  // Boss : on traduit le dessin en nombres (6 = rocher, 7 = rocher dur)
  if (config.motif) {
    config.motif.forEach(function (texte, l) {
      for (let c = 0; c < 8; c++) {
        if (texte[c] === "r") g[l][c] = 6;
        if (texte[c] === "R") g[l][c] = 7;
      }
    });
    return g;
  }

  // Niveau normal : rochers placés "au hasard avec graine", en miroir
  // gauche/droite (c'est plus joli), et plutôt en bas (comme un éboulis)
  const alea = generateurAleatoire(config.numero * 9973 + 17);
  let places = 0;
  for (let essai = 0; essai < 400 && places < config.rochers; essai++) {
    const l = Math.min(7, Math.floor(Math.sqrt(alea()) * 8)); // sqrt → plus souvent vers le bas
    const c = Math.floor(alea() * 4);                          // moitié gauche…
    const miroir = 7 - c;                                      // …et son reflet à droite
    if (g[l][c] !== 0) continue;

    const valeur = alea() < config.partDurs ? 7 : 6;
    g[l][c] = valeur;
    g[l][miroir] = valeur;
    if (aUneLignePleine(g)) {
      // Interdit : on annule ce rocher et on essaie ailleurs
      g[l][c] = 0;
      g[l][miroir] = 0;
      continue;
    }
    places += 2;
  }
  return g;
}

// Le petit conseil affiché avant chaque niveau
function astuceNiveau(config) {
  const n = config.numero;
  if (n === 1) return "Remplis une ligne ou une colonne pour la faire exploser !";
  if (n === 4) return "Des rochers gris encombrent la grille : ils explosent avec les lignes, comme les gemmes.";
  if (n === 11) return "À partir de maintenant, tes coups sont comptés. Chaque coup restant rapporte 10 points à la fin !";
  if (n === 25) return "Nouveau : les rochers durs (foncés et tachetés) résistent à la 1re explosion. Il en faut 2 !";
  if (n === 40) return "Attention : les pièces ne rentrent plus forcément toutes. Garde de la place !";
  if (config.boss) return "Niveau BOSS : une grille piégée t'attend. Bonne chance !";
  const conseils = [
    "Vise plusieurs lignes d'un coup : les combos multiplient les points.",
    "Garde un grand espace libre pour les pièces 3×3 et les lignes de 5.",
    "Le bloc obsidienne fait exploser sa ligne ET sa colonne.",
    "Enchaîne les explosions pour faire monter ta série.",
  ];
  return conseils[n % conseils.length];
}

// Nombre d'étoiles gagnées (1 à 3) selon le score final
function calculerEtoiles(config, scoreFinal) {
  if (scoreFinal >= config.troisEtoiles) return 3;
  if (scoreFinal >= config.deuxEtoiles) return 2;
  return 1;
}

// ---------- La progression (sauvegardée dans localStorage) ----------
// { debloque: 12, etoiles: { "1": 3, "2": 2, … }, scores: { "1": 340, … } }

const CLE_PROGRES = "blockrock-niveaux";

function lireProgres() {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_PROGRES));
    if (p && p.debloque) return p;
  } catch (e) {}
  return { debloque: 1, etoiles: {}, scores: {} };
}

// Enregistre une victoire. On garde toujours le MEILLEUR résultat.
function enregistrerVictoire(numero, etoiles, scoreFinal) {
  const p = lireProgres();
  p.etoiles[numero] = Math.max(p.etoiles[numero] || 0, etoiles);
  p.scores[numero] = Math.max(p.scores[numero] || 0, scoreFinal);
  p.debloque = Math.max(p.debloque, Math.min(NB_NIVEAUX, numero + 1));
  try {
    localStorage.setItem(CLE_PROGRES, JSON.stringify(p));
  } catch (e) {}
  return p;
}

function totalEtoiles(p) {
  let total = 0;
  for (const numero in p.etoiles) total += p.etoiles[numero];
  return total;
}
