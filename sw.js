// ==========================================================
// BLOCK ROCK — Le service worker (le mode hors ligne)
// C'est un petit programme qui se place ENTRE le jeu et Internet.
// Au premier lancement, il range tous les fichiers du jeu dans
// un "cache" (une réserve dans le téléphone). Ensuite, quand le
// jeu demande un fichier, il le donne depuis le cache : pas besoin
// d'Internet. En arrière-plan, il va chercher la version la plus
// récente pour la prochaine fois.
// ==========================================================

// Change ce nom si tu ajoutes ou renommes des fichiers : l'ancien cache sera supprimé
const NOM_CACHE = "block-rock-v5";

const FICHIERS = [
  "./",
  "index.html",
  "style.css",
  "js/sons.js",
  "js/pieces.js",
  "js/niveaux.js",
  "js/effets.js",
  "js/jeu.js",
  "logo-block-rock.svg",
  "manifest.webmanifest",
  "icones/icone-180.png",
  "icones/icone-192.png",
  "icones/icone-512.png",
  "icones/icone-maskable-512.png",
];

// 1) Installation : on remplit le cache
self.addEventListener("install", function (evenement) {
  evenement.waitUntil(
    caches.open(NOM_CACHE).then(function (cache) {
      return cache.addAll(FICHIERS);
    })
  );
  self.skipWaiting(); // la nouvelle version prend la main tout de suite
});

// 2) Activation : on supprime les anciens caches
self.addEventListener("activate", function (evenement) {
  evenement.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(
        noms
          .filter(function (nom) { return nom !== NOM_CACHE; })
          .map(function (nom) { return caches.delete(nom); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// 3) Chaque demande de fichier : réponse immédiate depuis le cache,
//    et mise à jour du cache en arrière-plan si Internet est là.
self.addEventListener("fetch", function (evenement) {
  const demande = evenement.request;
  if (demande.method !== "GET" || !demande.url.startsWith(self.location.origin)) return;

  evenement.respondWith(
    caches.open(NOM_CACHE).then(function (cache) {
      return cache.match(demande, { ignoreSearch: true }).then(function (enCache) {
        const depuisInternet = fetch(demande)
          .then(function (reponse) {
            if (reponse.ok) cache.put(demande, reponse.clone());
            return reponse;
          })
          .catch(function () {
            // Pas d'Internet et pas en cache : pour une page, on renvoie le jeu
            if (demande.mode === "navigate") return cache.match("index.html");
          });
        return enCache || depuisInternet;
      });
    })
  );
});
