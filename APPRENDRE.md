# Block Rock — Ton guide pour comprendre le jeu

Ce guide suit les étapes du projet. Ouvre les fichiers à côté pendant ta lecture : chaque ligne de code est commentée en français.

---

## ① La grille : un tableau 2D

Un tableau simple est une liste : `[0, 0, 0, 0, 0, 0, 0, 0]`.
Un **tableau 2D** est un tableau qui contient des tableaux. Chaque élément est une **ligne**, et chaque ligne contient 8 **cases** :

```js
grille = [
  [0, 0, 0, 0, 0, 0, 0, 0],   // ligne 0
  [0, 0, 0, 0, 0, 0, 0, 0],   // ligne 1
  ...
  [0, 0, 0, 0, 0, 0, 0, 0],   // ligne 7
]
```

- On lit une case avec `grille[ligne][colonne]` : d'abord la ligne, puis la colonne.
- Les numéros commencent à **0** : de 0 à 7.
- Ce que veulent dire les nombres : `0` = vide, `1` à `4` = une gemme (violet, turquoise, rose, or), `5` = obsidienne.

**La règle d'or du jeu** : le tableau décide et l'écran obéit. On ne lit jamais l'écran pour savoir ce qu'il y a dans une case, on lit le tableau. La fonction `dessinerCase(l, c)` de [js/jeu.js](js/jeu.js) recopie simplement la valeur du tableau à l'écran.

Pour parcourir toute la grille, on utilise **deux boucles imbriquées** : la première passe sur les lignes et la seconde sur les colonnes. Ça fait 8 × 8 = 64 passages. Tu retrouveras ce motif partout.

## ② Comment une forme devient un tableau

Une pièce, c'est aussi un petit tableau 2D, avec `1` pour un bloc et `0` pour un trou :

```
[ [1, 1, 1],        ███
  [0, 1, 0] ]  =     █        ← le T
```

Dans [js/pieces.js](js/pieces.js) :
- `tourner(forme)` fait pivoter une forme d'un quart de tour : la 1re colonne, lue de bas en haut, devient la 1re ligne.
- `quatreRotations(forme)` fabrique les 4 orientations. On n'a donc pas besoin de dessiner chaque L à la main.
- Chaque famille a un **poids** : plus il est grand, plus la pièce sort souvent.
- Pour poser une pièce en `(ligne, colonne)`, chaque `1` de la forme situé en `[i][j]` va dans `grille[ligne + i][colonne + j]`.

## ③ Le glisser-déposer, expliqué

Les **pointer events** marchent pareil à la souris, au doigt et au stylet. Le code se trouve dans la partie 4 de [js/jeu.js](js/jeu.js).

**`commencerGlisser(e)`** (on appuie sur une pièce) :
1. `e.currentTarget` est l'emplacement touché, et `dataset.index` donne son numéro (0, 1 ou 2).
2. Si la pièce est grisée, on la fait trembler et on s'arrête là.
3. `setPointerCapture` : même si le doigt sort de l'emplacement, c'est lui qui reçoit la suite des mouvements.
4. On crée une **pièce flottante** (`.flottante`) en taille réelle, accrochée au `<body>`.
5. On mesure une seule fois où se trouve la case `[0][0]` de la grille, et le `pas` (la distance d'une case à la suivante).
6. `lever` : au doigt, la pièce flotte **au-dessus** du doigt (1,3 case plus haut) pour qu'on la voie. À la souris, elle est centrée sur le curseur.
7. On cache la pièce de la réserve, puis on ajoute la classe `prise` : la transition CSS la fait grandir de 52 % à 100 %.

**`bougerGlisser(e)`** (on bouge) :
- On note la position du doigt, puis on demande `requestAnimationFrame`. Le doigt peut envoyer 120 mouvements par seconde alors que l'écran n'affiche que 60 images : on redessine donc une seule fois par image, c'est ça qui rend le mouvement fluide.

**`placerFlottante()`** :
- `translate3d(x, y, 0)` déplace la pièce sans recalculer la page, ce qui est très rapide.
- `Math.round((gauche - origineX) / pas)` donne la colonne la plus proche, et pareil pour la ligne.
- `peutPlacer` dit si la pièce rentre. Si la cible change, on redessine l'**aperçu** : les cases transparentes, et les lignes qui vont exploser, qui brillent dans la couleur de la pièce.

**`lacherGlisser(e)`** (on lâche) :
- Si on a une cible : on supprime la pièce flottante et on appelle `poserPiece`.
- Sinon, `renvoyerPiece` : la classe `retour` active une transition, et la pièce glisse jusqu'à sa place en 0,26 s.

## ④ Les points de pose

`poserPiece` compte les blocs posés (`nbBlocs`) et appelle `ajouterPoints(nbBlocs)`. `afficherScore` fait défiler les chiffres de l'ancien score vers le nouveau, et la classe `saute` donne le petit rebond.

## ⑤ Faire exploser les lignes : les indices

Tu voulais essayer toi-même. Comme tu m'as demandé tout le jeu d'un coup, je l'ai codé (fonctions `trouverLignesPleines` et `exploserLignes`). **Exercice** : efface le contenu de `trouverLignesPleines`, garde seulement le `return`, et réécris-le avec ces indices :

1. **Ligne pleine ?** Une ligne est pleine si **aucune** case ne vaut 0. Regarde ce que fait la méthode `every()` sur un tableau.
2. **Colonne pleine ?** Une colonne, ce n'est pas un tableau tout prêt : il faut une boucle sur les lignes en gardant la colonne fixe, `grille[l][c]`. Utilise une variable `pleine = true` qui passe à `false` dès qu'une case est vide.
3. **Piège classique** : trouve **toutes** les lignes et colonnes pleines **avant** d'en vider une seule. Sinon, vider une ligne casse la colonne qui la croisait.
4. **Vider** : remets les cases à `0` dans le tableau, puis redessine-les.
5. **Points** : 10 × le nombre de lignes.

Si tu bloques plus de 15 minutes, colle-moi ton code et je t'expliquerai tes erreurs.

## ⑥ Nouvelles pièces et fin de partie

- Quand `pieces` ne contient plus que des `null`, `donnerNouvellesPieces()` en tire 3 nouvelles.
- `tirerTroisPieces` essaie jusqu'à 40 tirages pour trouver 3 pièces qui rentrent toutes. C'est plus juste que le hasard pur.
- `verifierPieces()` essaie chaque pièce sur les 64 positions. Une pièce qui ne rentre nulle part est **grisée**. Si aucune ne rentre, c'est le **Game Over**.

## ⑦ Combos et effets

- **Combo** : points = 10 × lignes × lignes. 2 lignes donnent 40 (x2), 3 lignes donnent 90 (x3).
- **Série** : +20 × (série − 1). Elle s'arrête après 3 poses sans explosion.
- **Grille parfaite** : +300.
- **Éclats** : [js/effets.js](js/effets.js) dessine sur un `<canvas>` avec une petite physique (vitesse + gravité). La boucle s'arrête toute seule quand il n'y a plus d'éclats, pour économiser la batterie.
- **Vague** : chaque case explose avec un délai qui dépend de sa distance à la pièce posée.
- **Vibration** : `navigator.vibrate(30)`. Ça marche sur Android, pas sur iPhone, qui ne le permet pas.

## ⑧ Les sons

[js/sons.js](js/sons.js) ne contient aucun fichier audio : les sons sont **fabriqués** avec deux briques.
- `jouerNote` : un oscillateur, c'est-à-dire une note pure, dont le volume monte puis redescend.
- `jouerBruit` : du bruit blanc passé dans un filtre. Un filtre grave donne un « boum », un filtre aigu donne un « tchk ».

Les navigateurs interdisent le son avant que la personne ait touché l'écran. C'est pour ça que `Son.init()` est appelé au premier toucher.

## ⑨ Meilleur score et accueil

`localStorage` garde du texte même quand on ferme l'appli. On y range le record, le thème, le réglage du son et **la partie en cours** : si tu fermes l'appli, tu reprends où tu en étais. `JSON.stringify` transforme les tableaux en texte, et `JSON.parse` fait l'inverse.

## ⑩ Ta touche perso

- **Obsidienne** : valeur `5`. Dans `exploserLignes`, une « file d'attente » contient les lignes à faire exploser. Quand on rencontre un `5`, on ajoute sa colonne à la file, et ça peut faire une **réaction en chaîne**.
- **Thèmes** : toutes les couleurs sont des **variables CSS** (`--c1-clair`, etc.). Changer de thème revient à changer la classe du `<body>`.

## Les 100 niveaux

On n'a pas dessiné 100 niveaux à la main. Dans [js/niveaux.js](js/niveaux.js), la fonction `configNiveau(numero)` **calcule** chaque niveau à partir de son numéro, avec une difficulté `d` qui va de 0 (niveau 1) à 1 (niveau 100) :

| Ce qui devient plus dur | Comment |
|---|---|
| Lignes à faire exploser | 3 au niveau 1, 30 au niveau 100 |
| Rochers au départ | à partir du niveau 4, jusqu'à 24 |
| Coups limités | à partir du niveau 11, avec de moins en moins de marge |
| Rochers durs (2 explosions) | à partir du niveau 25, jusqu'à 60 % des rochers |
| Pièces | les grosses pièces sortent plus souvent (`poidsAjuste` dans [js/pieces.js](js/pieces.js)) |
| Équité | avant le niveau 40, les 3 pièces rentrent toujours ; après, au moins une seulement |

- **Boss** (10, 20… 100) : leur grille est **dessinée avec du texte** (`"r......r"`), puis traduite en tableau 2D. `.` = vide, `r` = rocher, `R` = rocher dur.
- **Hasard avec graine** : `generateurAleatoire(graine)` donne toujours la même suite de nombres pour une même graine. Le niveau 37 a donc toujours les mêmes rochers, comme un niveau fait main.
- **Rochers** : ce sont juste de nouvelles valeurs dans le tableau, `6` (rocher) et `7` (rocher dur). Quand une ligne explose, un `7` devient `6` au lieu de `0`.
- **Progression** : niveau débloqué, étoiles et meilleurs scores sont rangés dans `localStorage`, comme le record.
- **Mode infini** : la difficulté des pièces monte aussi doucement avec ton score.

**À toi de jouer** : pour changer la difficulté, modifie les nombres de `configNiveau`. Par exemple, `objectif * 34` règle le score à atteindre pour 3 étoiles. Pour inventer un boss, change un dessin dans la liste `BOSS`, mais aucune ligne ni colonne ne doit être pleine au départ !

## ⑪ Le jeu, fichier par fichier

| Fichier | Rôle |
|---|---|
| [index.html](index.html) | La structure : barre, score, grille, réserve, et les écrans accueil, règles et fin |
| [style.css](style.css) | Les thèmes, la taille qui s'adapte à l'écran (`--case`), les gemmes, les animations |
| [js/sons.js](js/sons.js) | Les sons générés |
| [js/pieces.js](js/pieces.js) | Les formes et le tirage au hasard (selon la difficulté) |
| [js/niveaux.js](js/niveaux.js) | Les 100 niveaux, les boss, les étoiles, la progression |
| [js/effets.js](js/effets.js) | Les éclats et les vibrations |
| [js/jeu.js](js/jeu.js) | Le cœur : grille, glisser-déposer, explosions, score, sauvegarde, écrans |
| [manifest.webmanifest](manifest.webmanifest) | La « carte d'identité » de l'appli : nom, icônes, couleurs |
| [sw.js](sw.js) | Le service worker : garde une copie du jeu pour jouer **hors ligne** |
| [icones/](icones/) | Les icônes PNG de l'appli (Android, iPhone) |

**Le trajet d'un coup joué** : doigt posé → `commencerGlisser` → `bougerGlisser` / `placerFlottante` (aperçu) → `lacherGlisser` → `poserPiece` (tableau + score) → `exploserLignes` (tableau, animations, sons) → nouvelles pièces ? → `verifierPieces` (pièces grisées ou Game Over) → `sauvegarder`.

**Pourquoi c'est fluide** :
- **La règle d'or des animations** : n'animer que `transform` (bouger, tourner, agrandir) et `opacity` (transparence). Ces deux propriétés sont gérées par la carte graphique. Animer `filter`, `width` ou `box-shadow` oblige le navigateur à redessiner les pixels à chaque image, et ça saccade sur téléphone. Les explosions, les rayons, les « +4 », les étoiles et les halos du fond suivent tous cette règle ;
- on ne déplace la pièce qu'avec `transform` ;
- on redessine au plus une fois par image ;
- l'aperçu n'est recalculé que quand la case visée change ;
- les éclats sont limités à 500 et dessinés sur un canvas.

## Ce que tu as appris aujourd'hui

- Représenter un plateau de jeu avec un **tableau 2D** et le parcourir avec des **boucles imbriquées**.
- Séparer les **données** (le tableau) de l'**affichage** (le HTML).
- Les **pointer events** pour la souris et le tactile, et `requestAnimationFrame` pour des animations fluides.
- Les **variables CSS**, CSS Grid, les **animations** et transitions.
- Dessiner sur un **canvas** avec une petite physique.
- Fabriquer des sons avec la **Web Audio API**.
- Sauvegarder avec **localStorage** et **JSON**.
- Transformer un site en **appli installable et hors ligne** (PWA : manifest + service worker).

## ⑫ La mise en ligne

1. Va sur **app.netlify.com/drop** et crée un compte gratuit.
2. Glisse le **dossier `block-rock`** entier dans la zone.
3. Netlify te donne une adresse en `https://…netlify.app`. Ouvre-la sur ton téléphone :
   - **Android (Chrome)** : bouton « Installer l'appli » sur l'accueil, ou menu ⋮ → « Installer l'application ».
   - **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».
4. Lance le jeu une fois avec Internet. Ensuite, il marche **sans Internet**.

**Quand tu modifies le jeu** : renvoie le dossier sur Netlify. Les joueurs reçoivent la nouvelle version au lancement suivant. Si tu ajoutes ou renommes un fichier, ajoute-le à la liste `FICHIERS` de [sw.js](sw.js) et change `NOM_CACHE` (par exemple `block-rock-v2`).

> Le service worker ne marche pas si tu ouvres `index.html` en double-cliquant dessus (adresse `file://`). Le jeu fonctionne quand même, mais le mode hors ligne ne s'active qu'une fois le jeu en ligne.
