# Proposition d’harmonisation du design KREW — lot 2

> **Statut : Phase 1 — audit et proposition uniquement**
>
> **Référence auditée :** branche courante au commit `baa34f2` (9 septembre 2026)
>
> **Aucun composant, token, test ou snapshot visuel n’est modifié dans ce lot.**

## Objectif et méthode

Ce document prolonge les décisions D1 à D5 de la PR #387. Il vérifie trois familles restées hors de ce premier lot : l’illustration de marque du header, la géométrie des états secondaires et l’échelle des titres de section.

L’audit distingue volontairement :

- un **rôle visuel** (illustration d’étape, décor de fond, titre de section, titre de carte) ;
- un **niveau HTML** (`h2`, `h3`, etc.), qui ne suffit pas à déterminer une taille ;
- la **géométrie de page** (largeur et gouttières du shell), qui doit rester stable lorsque les données chargent ou échouent ;
- la **géométrie locale** d’un état vide ou sélectionné, qui peut varier à l’intérieur de ce shell sans déplacer toute la page.

Les impacts sont évalués aux largeurs de validation KREW : **390 / 834 / 1440 px**.

## Synthèse des décisions proposées

| Décision                    | Cible proposée                                                                                                                     | Effet attendu                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| D6 — Illustration du header | Conserver la loutre journey à `88 → 104 px` de slot et `76 → 88 px` de haut ; ne pas l’aligner sur le blob de TripHub              | Aucun changement visuel ; faux positif documenté                      |
| D7 — États secondaires      | Un état pleine page hérite toujours du même `KrewPageShell` que l’état normal ; corriger séparément le gate parent d’Invite        | Changement visible seulement pour le gate Invite ; stabilité ailleurs |
| D8 — Titres de section      | `24 → 26 px` pour un vrai titre de section de page ; conserver des échelles distinctes pour carte, modal et composition éditoriale | Harmonisation mesurée de cinq familles de sections                    |

---

## D6 — Taille et rôle de la loutre

### État actuel vérifié

L’hypothèse de départ ne correspond plus au code courant : l’élément de TripHub mesurant `130 → 160 px` de large et `65 → 75 px` de haut est un **`KrewOrganicBlob` prune**, pas une loutre. Il est placé derrière le H1, à 20 % d’opacité, sur la partie basse du hero photo.

| Contexte        | Élément réel                        | Dimensions                           | Rôle et accessibilité                                                                                                                       | Contrainte de composition                                                            |
| --------------- | ----------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| TripHub         | Blob prune `soft`                   | `130 × 65 px` puis `160 × 75 px`     | Pur décor, `pointer-events-none`                                                                                                            | Derrière le titre, sans colonne réservée ; le H1 possède son propre fond translucide |
| Headers journey | Image d’une loutre propre à l’étape | slot `88 × 76 px` puis `104 × 88 px` | Décorative pour le lecteur d’écran (`alt=""`), mais elle renforce visuellement l’étape (`availability`, `preferences`, `destination`, etc.) | Colonne dédiée dans une grille ; elle ne chevauche pas le titre                      |

Les consommateurs vérifiés du header partagé couvrent Disponibilités, Préférences, Préférences de la Star, Dates du groupe, Profil du voyage, Destination, Hébergement, Transport, Planning, Tâches et À emporter, plus l’état partagé de chapitre clôturé. Selon la route et l’état du voyage, ce dernier réemploie l’un des mêmes headers : il ne crée pas une treizième échelle.

Toutes les loutres du header partagé utilisent les mêmes tokens :

- `--krew-journey-otter-slot-width: 88 px`, puis `104 px` à partir de 640 px ;
- `--krew-journey-otter-height: 76 px`, puis `88 px` à partir de 640 px.

### Proposition

Conserver l’échelle actuelle du header journey et documenter deux rôles distincts :

1. **illustration d’étape journey** : colonne `88 → 104 px`, hauteur `76 → 88 px` ;
2. **forme décorative de hero** : dimensions libres liées à la composition du hero, sans token « otter ».

Il n’y a pas lieu de créer une taille unique entre TripHub et les pages journey, puisqu’il ne s’agit ni du même composant ni du même objet graphique.

### Pourquoi cette cible

- La colonne journey réserve explicitement l’espace nécessaire aux titres longs et empêche une superposition accidentelle.
- Les fichiers d’illustration changent avec l’étape ; leur information est redondante avec le titre, ce qui justifie `alt=""`, mais leur cohérence de taille reste importante visuellement.
- Le blob TripHub sert au contraste et à la profondeur du hero. Le redimensionner selon les tokens de loutre détériorerait sa composition sans résoudre d’incohérence réelle.

### Impact visuel par page

| Pages                                             | Impact                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| TripHub                                           | **Aucun** : le blob reste un décor du hero, indépendant des loutres                            |
| 11 pages journey et leurs états clôturés partagés | **Aucun** : conservation de `88 → 104 / 76 → 88 px`                                            |
| À emporter dans sa variante de carte              | **Aucun** : elle réemploie la même réservation de slot et reste alignée sur le langage journey |

### Décision à valider

- [ ] **D6 validée :** conserver l’échelle journey actuelle et classer la comparaison avec TripHub comme faux positif (blob et loutre = rôles différents).

---

## D7 — Géométrie des états secondaires

### Règle proposée

Tout état qui remplace une page entière — chargement, erreur, absence de données ou lecture seule — doit utiliser la **même taille et la même variante de gouttière `KrewPageShell` que l’état normal de cette page**.

Un état local peut conserver son propre padding lorsqu’il vit dans une carte ou une section déjà contenue par le shell. Un état sélectionné peut modifier bordure, fond ou emphase de la carte, mais ne doit pas modifier la largeur ou l’alignement global de la page.

### Audit des 15 pages

| Page                   | État normal                                                        | Loading / erreur                                                                                          | Vide                                                     | Sélectionné / actif                             | Verdict                                                                         |
| ---------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| À emporter             | `standard`, gutter par défaut, `py 32 → 40`                        | `KrewJourneyLoadingState/ErrorState` en `standard`, même padding                                          | Liste vide rendue dans la carte normale                  | Cases/éléments locaux                           | Conforme                                                                        |
| Dates du groupe        | `standard`, défaut, `py 32 → 40`                                   | États partagés `standard`                                                                                 | Absence de créneau dans le contenu normal                | Créneau retenu dans le contenu                  | Conforme                                                                        |
| Profil du voyage       | `standard`, défaut, `py 32 → 40`                                   | États partagés `standard`                                                                                 | Choix non renseignés dans le shell normal                | Cartes `aria-pressed`, sans changement de shell | Conforme                                                                        |
| Tâches                 | `standard`, défaut, `py 32 → 40`                                   | États partagés `standard`                                                                                 | Liste vide dans la page normale                          | Statut et attribution locaux                    | Conforme                                                                        |
| Planning               | `standard`, défaut, `py 32 → 40`                                   | États partagés `standard` ; génération via `KrewThinkingState` dans le shell normal                       | Planning absent dans le contenu normal                   | Jour/activité actifs localement                 | Conforme ; la carte de carte géographique reste une structure sœur à surveiller |
| Transport              | `standard`, défaut, `py 32 → 40`                                   | États partagés `standard` ; recherche dans le shell normal                                                | Offres absentes dans le contenu normal                   | Choix local dans les cartes                     | Conforme                                                                        |
| Destination            | `standard`, défaut, `py 32 → 40`                                   | États partagés `standard` ; génération dans le shell normal                                               | Recommandations absentes dans le contenu normal          | Carte choisie, triée en tête, shell inchangé    | Conforme                                                                        |
| Hébergement            | `standard`, défaut, `py 32 → 40`                                   | États partagés `standard` ; recherche dans le shell normal                                                | Offres absentes dans le contenu normal                   | Hôtel retenu/réservé localement                 | Conforme                                                                        |
| Disponibilités         | `form` (820), défaut, `py 32 → 40`                                 | Route et gate parent utilisent `form`                                                                     | Aucune date : aide locale sous le bouton                 | Jours/mode de saisie actifs dans le même shell  | Conforme                                                                        |
| Préférences            | `form` (820), défaut, `py 32 → 40`                                 | Route et gate parent utilisent `form`                                                                     | Réponse absente = formulaire normal                      | Options actives locales                         | Conforme                                                                        |
| Préférences de la Star | `form` (820), défaut, `py 32 → 40`                                 | Route en `form` ; gate d’accès rendu dans un shell `form`                                                 | Accès ou réponse absente dans le même cadre              | Options actives locales                         | Conforme                                                                        |
| Invite                 | `form` (820), gutter `narrow`, `py 32 → 40`                        | États propres à la page : `form` + `narrow`, `py 40` ; **gate parent : `standard` (1024), gutter défaut** | Places libres intégrées à la liste normale               | Rôles et participants locaux                    | Écart structurel au niveau du gate parent                                       |
| Souvenirs              | `story` = 1024, gutter `wide`, `py 32 → 48`                        | Erreur : même shell ; loading : `KrewThinkingState` injecté dans le corps normal, `py 32` local           | Carte vide dans le shell normal                          | Sélection KREW dans le header et les cartes     | Largeur conforme ; architecture de chargement atypique                          |
| Récap                  | `story` = 1024, gutter `wide`, `py 32 → 48`                        | Loading/erreur : même `story` + `wide`, mais `py 40` constant                                             | Recommandation absente gérée dans la composition normale | Destination/réactions locales                   | Largeur conforme ; rythme vertical diffère de 8 px selon le viewport            |
| Compte                 | conteneur local `max-w-3xl` (768), gutters `16 → 24`, `py 32 → 48` | Pas d’état pleine page ; erreurs et activité sont locales                                                 | Données optionnelles omises dans le même conteneur       | Avatar/suppression locaux                       | Hors shell partagé, mais stable entre états                                     |

### Cas prioritaires à risque élevé

#### Invite

L’état normal, son chargement local et son erreur locale sont maintenant tous à **820 px**. L’écart historique subsiste toutefois un niveau plus haut : `CompletedPreparationGate externalStatus` vérifie le cycle du voyage avant d’afficher Invite et rend son loading/erreur en **1024 px**. Pour un voyage terminé, il ajoute également un panneau 1024 px au-dessus de la page Invite 820 px.

**Cible :** transmettre explicitement `size="form"` et `gutter="narrow"` au gate lorsqu’il enveloppe Invite, ou déplacer son statut dans le shell Invite. Ce choix touche la propriété du layout entre route et composant : il doit être traité comme une petite correction d’architecture, pas comme une surcharge CSS.

#### Souvenirs

L’écart historique `1020 / 1024` a disparu avec D5 : normal, erreur et chargement vivent tous dans `story = 1024` avec gutter `wide`. En revanche, le chargement n’est pas une branche pleine page : le header, la carte d’import et un état vide provisoire sont déjà rendus, puis `KrewThinkingState` apparaît plus bas.

**Cible :** ne pas forcer une migration CSS. Décider en Phase 2 si le chargement progressif est intentionnel. S’il ne l’est pas, séparer le chargement initial avant le rendu du contenu ; cela constitue un changement structurel et comportemental à valider à part.

#### Récap

L’écart historique de largeur a également disparu : tous les états utilisent `story = 1024` et `wide`. Seul le padding vertical varie : état normal `32 → 48 px`, loading/erreur `40 px` constant.

**Cible :** faire hériter loading et erreur du rythme normal (`py 32 → 48`) afin d’éviter un déplacement de **+8 px sur mobile** et **−8 px sur tablette/desktop**.

### Impact visuel proposé

| Page / famille  | Impact de D7                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Invite          | Gate de vérification : largeur 1024 → 820 px et gutter défaut → `narrow` ; panneau de voyage terminé à réaligner avec la page |
| Récap           | Loading/erreur : `py 40` → `32 px` à 390 px et `48 px` à 834/1440 px                                                          |
| Souvenirs       | Aucun changement automatique ; revue structurelle préalable obligatoire                                                       |
| 11 autres pages | Aucun changement attendu ; leur conformité devient un contrat explicite                                                       |
| Compte          | Aucun changement ; son conteneur local reste une exception documentée                                                         |

### Décision à valider

- [ ] **D7 validée :** même shell pour tous les états pleine page ; corriger le gate Invite et le rythme de Récap, sans restructurer Souvenirs sans arbitrage séparé.

---

## D8 — Échelle des titres de section

### État actuel vérifié

Le token existe mais n’a actuellement **aucun consommateur** dans `src` :

- `--krew-title-section: 24 px` sous 640 px ;
- `--krew-title-section: 26 px` à partir de 640 px ;
- `--krew-journey-section-title` n’est qu’un alias, lui aussi inutilisé.

Les tailles locales ne représentent pas toutes le même rôle :

| Rôle observé                     | Pages / exemples                            | Taille actuelle                                          |
| -------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| Section principale de formulaire | Disponibilités « Mes disponibilités »       | `25 → 28 px`                                             |
| Sections de questionnaire        | Préférences et Star                         | `24 → 30 px`                                             |
| Section principale journey       | Planning, Destination                       | `24 px` constant                                         |
| Section de page étroite          | Invite « Fais entrer la Krew »              | `24 px` constant                                         |
| Section éditoriale mise en avant | Récap « Le voyage en bref »                 | `28 → 32 px`                                             |
| Section standard dans Récap      | Bloc suivant / actions                      | `24 px` constant ; sous-action calendrier `20 px`        |
| Modales / album                  | Souvenirs                                   | `20`, `24 → 30`, `24`, et composition album `30 → 48 px` |
| Compte                           | « Mes informations » puis gestion du compte | `20 → 24 px`, puis `14 px`                               |
| Titres de cartes ou d’items      | Transport, hébergement, tâches, profil      | `14` à `24 px`, souvent en graisse semibold              |

### Proposition : une règle par rôle

| Rôle                                    | Cible                                                            | Traitement                                               |
| --------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| **Titre de section de page**            | `24 → 26 px`                                                     | Consommer `--krew-title-section`                         |
| **Titre de carte / item / sous-action** | Échelle du composant (`14–24 px`)                                | Ne pas le promouvoir artificiellement au niveau section  |
| **Titre de modal**                      | Échelle de dialogue (`20–24 px`, jusqu’à 30 si modal éditoriale) | Rester piloté par le composant de dialogue               |
| **Intertitre éditorial majeur**         | `28 → 32 px`                                                     | Conserver une hiérarchie distincte, explicitement nommée |

Cette proposition harmonise le même rôle sans transformer tous les `h2` en un style unique.

### Impact visuel par page

| Page                                                      | Élément concerné                                   | Changement à 390 / 834 / 1440 px                                                             |
| --------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Disponibilités                                            | « Mes disponibilités »                             | `25 / 28 / 28` → `24 / 26 / 26` : −1 / −2 / −2 px                                            |
| Disponibilités                                            | « Créneaux possibles »                             | `24 / 24 / 24` → `24 / 26 / 26` : 0 / +2 / +2 px                                             |
| Préférences                                               | Titres des sections du questionnaire               | `24 / 30 / 30` → `24 / 26 / 26` : 0 / −4 / −4 px                                             |
| Préférences de la Star                                    | Titres des sections du questionnaire               | `24 / 30 / 30` → `24 / 26 / 26` : 0 / −4 / −4 px                                             |
| Planning                                                  | Titre principal de la section générée              | `24 / 24 / 24` → `24 / 26 / 26` : 0 / +2 / +2 px                                             |
| Destination                                               | Titre de la destination dans la section principale | `24 / 24 / 24` → `24 / 26 / 26` : 0 / +2 / +2 px ; conserver sa graisse comme choix de carte |
| Invite                                                    | « Fais entrer la Krew »                            | `24 / 24 / 24` → `24 / 26 / 26` : 0 / +2 / +2 px                                             |
| Récap                                                     | Section standard à 24 px                           | `24 / 24 / 24` → `24 / 26 / 26` : 0 / +2 / +2 px                                             |
| Récap                                                     | Intertitre éditorial `28 → 32` et sous-action 20   | Aucun changement : rôles distincts                                                           |
| Souvenirs                                                 | Titres d’album et de modales                       | Aucun changement automatique : rôles dialogue/éditorial, pas sections journey standard       |
| Compte                                                    | « Mes informations » et « Gestion du compte »      | Aucun changement automatique : hiérarchie propre à la page compte                            |
| Dates, Profil, Tâches, Transport, Hébergement, À emporter | Titres rencontrés dans cartes/items                | Aucun changement : ce ne sont pas des titres de section de page                              |

### Pourquoi cette cible

- `24 → 26 px` existe déjà dans les tokens et produit un écart stable avec le H1 journey `30 → 34 px` validé en D1.
- La réduction des questionnaires à 26 px évite que chaque groupe de champs rivalise avec le titre de page.
- Les compositions éditoriales de Récap et Souvenirs ont besoin d’un niveau supérieur à 26 px ; les ramener au token section effacerait leur hiérarchie.
- Les titres de cartes parfois codés en `h2` décrivent un item, pas une nouvelle grande section. Leur taille doit suivre leur composant, pas leur balise.

### Décision à valider

- [ ] **D8 validée :** `24 → 26 px` pour les vrais titres de section de page, avec exceptions sémantiques documentées pour cartes, modales et intertitres éditoriaux.

---

## Ordre proposé pour la Phase 2

La Phase 2 ne commence qu’après validation explicite de D6, D7 et D8. Chaque décision reste un commit séparé :

1. **D6 — illustration du header :** documentation/contrat uniquement si la décision reste sans changement visuel ; aucune référence pixel ne doit être régénérée artificiellement.
2. **D7 — états secondaires :** corriger Invite puis Récap dans le même commit de décision, avec scénarios distincts ; arrêter avant Souvenirs si une restructuration est requise.
3. **D8 — titres de section :** brancher uniquement les vrais titres de section sur le token et mettre à jour intentionnellement leurs références.

Pour toute décision qui modifie le rendu : captures avant/après à **390 / 834 / 1440 px**, mise à jour explicite du contrat visuel et non un assouplissement des tests.

## Validation humaine attendue

La validation peut être donnée sous la forme :

> D6 validée — D7 validée — D8 validée

Une décision peut être amendée séparément. Aucune décision non explicitement validée ne doit être implémentée.
