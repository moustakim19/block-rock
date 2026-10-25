// ==========================================================
// BLOCK ROCK — Les sons (Web Audio API)
// Aucun fichier son à télécharger : chaque son est FABRIQUÉ
// par le navigateur avec des oscillateurs (des "notes" pures)
// et du bruit (un "chhh" qui ressemble à une explosion).
// ==========================================================

const Son = {
  contexte: null,     // l'AudioContext : le "studio" où on fabrique les sons
  sortie: null,       // le volume général, branché sur les haut-parleurs
  bruitBuffer: null,  // 1 seconde de bruit blanc, préparée une seule fois
  actif: true,        // le son est-il allumé ?
};

// Lire le réglage sauvegardé (localStorage garde des données même après fermeture)
try {
  Son.actif = localStorage.getItem("blockrock-son") !== "off";
} catch (e) {
  // localStorage peut être interdit (navigation privée) : on garde le son allumé
}

// Les navigateurs interdisent le son tant que la personne n'a pas touché l'écran.
// On appelle donc Son.init() au premier toucher.
Son.init = function () {
  if (!Son.contexte) {
    const ContexteAudio = window.AudioContext || window.webkitAudioContext;
    if (!ContexteAudio) return; // très vieux navigateur : pas de son, tant pis

    Son.contexte = new ContexteAudio();

    // Un compresseur évite que les sons forts "saturent" quand ils s'additionnent
    const compresseur = Son.contexte.createDynamicsCompressor();
    compresseur.connect(Son.contexte.destination);

    Son.sortie = Son.contexte.createGain();
    Son.sortie.gain.value = 0.7;
    Son.sortie.connect(compresseur);

    // Bruit blanc = des valeurs au hasard entre -1 et 1
    const taille = Son.contexte.sampleRate;
    Son.bruitBuffer = Son.contexte.createBuffer(1, taille, taille);
    const donnees = Son.bruitBuffer.getChannelData(0);
    for (let i = 0; i < taille; i++) {
      donnees[i] = Math.random() * 2 - 1;
    }
  }
  // Sur iPhone, le contexte peut se "mettre en pause" : on le relance
  if (Son.contexte.state === "suspended") {
    Son.contexte.resume();
  }
};

// Peut-on jouer un son maintenant ?
Son.pret = function () {
  return Son.actif && Son.contexte !== null;
};

// Allumer / couper le son. Renvoie le nouvel état.
Son.basculer = function () {
  Son.actif = !Son.actif;
  try {
    localStorage.setItem("blockrock-son", Son.actif ? "on" : "off");
  } catch (e) {}
  return Son.actif;
};

// ---------- Les deux "instruments" de base ----------

// Une note : un oscillateur dont le volume monte vite puis redescend.
// debut et duree sont en secondes. freqFin permet de faire glisser la note.
function jouerNote(freq, debut, duree, options = {}) {
  const type = options.type || "sine";
  const volume = options.volume || 0.2;
  const ctx = Son.contexte;
  const t = ctx.currentTime + debut;

  const oscillateur = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillateur.type = type; // "sine" (doux), "triangle", "square" (rétro)…
  oscillateur.frequency.setValueAtTime(freq, t);
  if (options.freqFin) {
    oscillateur.frequency.exponentialRampToValueAtTime(options.freqFin, t + duree);
  }

  // L'enveloppe du volume : presque 0 → volume (très vite) → presque 0
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);

  oscillateur.connect(gain);
  gain.connect(Son.sortie);
  oscillateur.start(t);
  oscillateur.stop(t + duree + 0.02);
}

// Du bruit passé dans un filtre : grave = "boum", aigu = "tchk"
function jouerBruit(debut, duree, options = {}) {
  const ctx = Son.contexte;
  const t = ctx.currentTime + debut;

  const source = ctx.createBufferSource();
  source.buffer = Son.bruitBuffer;

  const filtre = ctx.createBiquadFilter();
  filtre.type = options.filtre || "lowpass";
  filtre.frequency.setValueAtTime(options.freq || 2000, t);
  if (options.freqFin) {
    filtre.frequency.exponentialRampToValueAtTime(options.freqFin, t + duree);
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(options.volume || 0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);

  source.connect(filtre);
  filtre.connect(gain);
  gain.connect(Son.sortie);
  source.start(t);
  source.stop(t + duree + 0.02);
}

// ---------- Les sons du jeu ----------

// Petit "tic" quand on attrape une pièce
Son.prise = function () {
  if (!Son.pret()) return;
  jouerNote(520, 0, 0.07, { volume: 0.1, freqFin: 780 });
};

// "Clac" de pierre quand on pose une pièce.
// Un peu de hasard sur la hauteur : le son n'est jamais exactement le même.
Son.pose = function () {
  if (!Son.pret()) return;
  const v = 1 + (Math.random() - 0.5) * 0.12;
  jouerNote(210 * v, 0, 0.12, { type: "triangle", volume: 0.4, freqFin: 105 * v });
  jouerBruit(0, 0.05, { filtre: "highpass", freq: 2500, volume: 0.2 });
  jouerNote(1500 * v, 0, 0.05, { volume: 0.05 });
};

// Explosion d'une ligne : un "boum" + des tintements de cristal
Son.explosion = function () {
  if (!Son.pret()) return;
  jouerBruit(0, 0.45, { freq: 4000, freqFin: 250, volume: 0.35 });
  jouerNote(90, 0, 0.3, { volume: 0.4, freqFin: 40 });
  [1318, 1568, 2093].forEach(function (freq, i) {
    jouerNote(freq, 0.03 + i * 0.05, 0.35, { volume: 0.09 });
  });
};

// Combo : explosion plus forte + une gamme qui monte (plus longue si gros combo)
Son.combo = function (nbLignes) {
  if (!Son.pret()) return;
  jouerBruit(0, 0.6, { freq: 5000, freqFin: 200, volume: 0.5 });
  jouerNote(65, 0, 0.5, { volume: 0.6, freqFin: 30 });
  const gamme = [523, 659, 784, 1046, 1318, 1568, 2093];
  const nbNotes = Math.min(gamme.length, 2 + nbLignes);
  for (let i = 0; i < nbNotes; i++) {
    jouerNote(gamme[i], 0.05 + i * 0.06, 0.4, { type: "triangle", volume: 0.2 });
    jouerNote(gamme[i] * 2, 0.05 + i * 0.06, 0.3, { volume: 0.06 });
  }
};

// Pièce grisée : petit "bzz" de refus
Son.refus = function () {
  if (!Son.pret()) return;
  jouerNote(160, 0, 0.12, { type: "square", volume: 0.05, freqFin: 120 });
};

// Clic des boutons
Son.clic = function () {
  if (!Son.pret()) return;
  jouerNote(880, 0, 0.05, { volume: 0.08, freqFin: 1200 });
};

// Game Over : 4 notes qui descendent, tristes
Son.gameOver = function () {
  if (!Son.pret()) return;
  [392, 330, 262, 196].forEach(function (freq, i) {
    jouerNote(freq, i * 0.22, 0.5, { type: "triangle", volume: 0.25, freqFin: freq * 0.97 });
  });
  jouerBruit(0, 1, { freq: 600, freqFin: 100, volume: 0.08 });
};

// Un rocher dur se fissure : "crac" sec
Son.fissure = function () {
  if (!Son.pret()) return;
  jouerBruit(0, 0.12, { filtre: "bandpass", freq: 900, volume: 0.35 });
  jouerNote(140, 0, 0.1, { type: "square", volume: 0.06, freqFin: 90 });
};

// Une étoile apparaît (i = 0, 1 ou 2 : chaque étoile sonne plus haut)
Son.etoile = function (i) {
  if (!Son.pret()) return;
  const freq = [784, 988, 1318][i] || 1318;
  jouerNote(freq, 0, 0.3, { type: "triangle", volume: 0.22 });
  jouerNote(freq * 2, 0.02, 0.25, { volume: 0.06 });
};

// Niveau réussi : fanfare de 5 notes + scintillement
Son.victoire = function () {
  if (!Son.pret()) return;
  [523, 659, 784, 1046, 1318].forEach(function (freq, i) {
    jouerNote(freq, i * 0.09, 0.4, { type: "triangle", volume: 0.22 });
  });
  jouerBruit(0, 0.5, { filtre: "highpass", freq: 6000, freqFin: 1500, volume: 0.12 });
};

// Nouveau record : petite fanfare qui monte
Son.record = function () {
  if (!Son.pret()) return;
  [523, 659, 784, 1046].forEach(function (freq, i) {
    jouerNote(freq, i * 0.1, 0.35, { type: "triangle", volume: 0.2 });
  });
};
