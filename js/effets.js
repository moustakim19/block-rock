// ==========================================================
// BLOCK ROCK — Les effets : éclats de gemmes et vibrations
// Les éclats sont dessinés sur un <canvas> (une "toile" où on
// peint en JavaScript). C'est beaucoup plus rapide que de créer
// des centaines d'éléments HTML.
// ==========================================================

const Eclats = {
  canvas: null,
  ctx: null,          // le "pinceau" pour dessiner sur la toile
  ratio: 1,           // densité de pixels de l'écran (2 sur la plupart des téléphones)
  particules: [],     // tous les éclats en train de voler
  enCours: false,     // l'animation tourne-t-elle ?
  dernierTemps: 0,
};

// Au-delà, on n'ajoute plus d'éclats : le téléphone reste fluide
const MAX_PARTICULES = 320;

Eclats.init = function () {
  Eclats.canvas = document.getElementById("eclats");
  Eclats.ctx = Eclats.canvas.getContext("2d");
  Eclats.redimensionner();
  window.addEventListener("resize", Eclats.redimensionner);
};

// La taille de la toile en pixels. Chaque image, la toile entière est envoyée
// à la carte graphique : plus elle a de pixels, plus c'est lourd. Les éclats
// bougent très vite, on ne voit pas la différence entre 1,5 et 3 pixels par point.
Eclats.redimensionner = function () {
  Eclats.ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  Eclats.canvas.width = window.innerWidth * Eclats.ratio;
  Eclats.canvas.height = window.innerHeight * Eclats.ratio;
};

// Lance des éclats depuis le point (x, y) de l'écran.
// taille = taille d'une case, pour que les éclats soient proportionnels.
Eclats.lancer = function (x, y, clair, fonce, quantite, taille) {
  for (let i = 0; i < quantite; i++) {
    if (Eclats.particules.length >= MAX_PARTICULES) break;
    const angle = Math.random() * Math.PI * 2;
    const vitesse = 120 + Math.random() * 320; // en pixels par seconde
    Eclats.particules.push({
      type: "eclat",
      x: x + (Math.random() - 0.5) * taille * 0.6,
      y: y + (Math.random() - 0.5) * taille * 0.6,
      vx: Math.cos(angle) * vitesse,
      vy: Math.sin(angle) * vitesse - 180, // un peu vers le haut
      rotation: Math.random() * Math.PI * 2,
      vitesseRotation: (Math.random() - 0.5) * 14,
      taille: taille * (0.12 + Math.random() * 0.2),
      vie: 0,
      duree: 0.55 + Math.random() * 0.45, // en secondes
      couleur: Math.random() < 0.5 ? clair : fonce,
    });
  }
  // Une étincelle blanche en plus
  for (let i = 0; i < 1; i++) {
    if (Eclats.particules.length >= MAX_PARTICULES) break;
    Eclats.particules.push({
      type: "etincelle",
      x: x, y: y,
      vx: (Math.random() - 0.5) * 260,
      vy: -Math.random() * 300,
      rotation: 0, vitesseRotation: 3,
      taille: taille * 0.22,
      vie: 0,
      duree: 0.5 + Math.random() * 0.3,
      couleur: "#ffffff",
    });
  }
  Eclats.demarrer();
};

Eclats.demarrer = function () {
  if (Eclats.enCours) return;
  Eclats.enCours = true;
  Eclats.dernierTemps = performance.now();
  requestAnimationFrame(Eclats.image);
};

// Dessine UNE image de l'animation. requestAnimationFrame la rappelle
// ~60 fois par seconde, au rythme de l'écran.
Eclats.image = function (temps) {
  // dt = temps écoulé depuis l'image précédente (limité, si l'onglet était caché)
  const dt = Math.min(0.033, (temps - Eclats.dernierTemps) / 1000);
  Eclats.dernierTemps = temps;

  const ctx = Eclats.ctx;
  const r = Eclats.ratio;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, Eclats.canvas.width, Eclats.canvas.height);

  const liste = Eclats.particules;
  // On parcourt la liste à l'envers pour pouvoir retirer des éléments sans se tromper
  for (let i = liste.length - 1; i >= 0; i--) {
    const p = liste[i];
    p.vie += dt;
    if (p.vie >= p.duree) {
      // Éclat terminé : on le remplace par le dernier de la liste (rapide)
      liste[i] = liste[liste.length - 1];
      liste.pop();
      continue;
    }

    // Physique simple : la gravité tire vers le bas, l'air freine un peu
    p.vy += 900 * dt;
    p.vx *= 0.985;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rotation += p.vitesseRotation * dt;

    const avancement = p.vie / p.duree;   // de 0 (début) à 1 (fin)
    ctx.globalAlpha = 1 - avancement * avancement;

    // On place le pinceau sur l'éclat, tourné et à la bonne échelle
    const cos = Math.cos(p.rotation) * r;
    const sin = Math.sin(p.rotation) * r;
    ctx.setTransform(cos, sin, -sin, cos, p.x * r, p.y * r);

    const s = p.taille;
    if (p.type === "eclat") {
      // Un petit losange irrégulier = un morceau de gemme…
      ctx.fillStyle = p.couleur;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.8, 0);
      ctx.lineTo(0, s * 0.6);
      ctx.lineTo(-s * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      // …avec une facette claire
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.8, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      // Une étoile à 4 branches
      const k = s * (1 - avancement);
      ctx.fillStyle = p.couleur;
      ctx.beginPath();
      ctx.moveTo(0, -k);
      ctx.lineTo(k * 0.2, -k * 0.2);
      ctx.lineTo(k, 0);
      ctx.lineTo(k * 0.2, k * 0.2);
      ctx.lineTo(0, k);
      ctx.lineTo(-k * 0.2, k * 0.2);
      ctx.lineTo(-k, 0);
      ctx.lineTo(-k * 0.2, -k * 0.2);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  if (liste.length > 0) {
    requestAnimationFrame(Eclats.image);
  } else {
    // Plus rien à dessiner : on arrête la boucle (économise la batterie)
    Eclats.enCours = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, Eclats.canvas.width, Eclats.canvas.height);
  }
};

// Vibration du téléphone (en millisecondes, ou un motif [vibre, pause, vibre…]).
// Ne fait rien si l'appareil ne sait pas vibrer (ordinateur, iPhone).
function vibrer(motif) {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(motif);
    } catch (e) {}
  }
}
