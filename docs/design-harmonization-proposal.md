# Proposition d’harmonisation du design KREW

> **Statut : Phase 1 — proposition uniquement**
>
> **Référence auditée :** `main` au commit `5ae3d1a` (8 septembre 2026)
>
> **Aucun changement de composant, de token, de test ou de référence visuelle n’est inclus dans ce lot.**

## Objectif du document

Les PR #369 à #386 ont consolidé l’architecture CSS sans modifier le rendu. Elles ont donc correctement conservé plusieurs différences historiques. Ce document propose maintenant une règle de design explicite pour chacune des cinq incohérences identifiées.

Une balise HTML `h1` n’implique pas nécessairement une taille visuelle identique. `DESIGN.md` distingue déjà deux rôles :

- le **hero éditorial / la page d’entrée**, qui installe un univers ou une vue d’ensemble ;
- le **grand chapitre produit**, qui introduit une étape fonctionnelle du parcours.

La proposition ne cherche donc pas à rendre toutes les pages identiques. Elle remplace les variations accidentelles par des différences sémantiques documentées.

Les impacts ci-dessous sont calculés aux trois largeurs de validation KREW :

- mobile : **390 px** ;
- tablette : **834 px** ;
- desktop : **1440 px**.

## Synthèse des cinq décisions proposées

| Décision                      | Cible proposée                                                                                      | Effet visuel attendu                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| D1 — Échelle H1               | Deux échelles seulement : hero `42 → 50 → 56 px`, chapitre `30 → 34 px`                             | Changement visible, surtout sur les chapitres qui rétrécissent        |
| D2 — Rythme vertical          | Chapitre compact `32 px` ; vue d’ensemble éditoriale `32 → 48 px`                                   | Aucun changement de rendu ; différence rendue intentionnelle          |
| D3 — Gouttières               | Conserver form `16 → 24 → 32 px` et wide `16 → 24 → 40 px`                                          | Aucun changement de rendu ; écart desktop confirmé comme intentionnel |
| D4 — Interligne / tracking H1 | Hero `.94 / -.025em` ; chapitre `.98 / -.02em`                                                      | Léger ajustement sur Mes Voyages et Nouveau Voyage                    |
| D5 — Largeurs de conteneur    | Quatre largeurs numériques : `820 / 1024 / 1200 / 1280 px` ; `story` devient un alias de `standard` | Récap/Souvenirs +4 px ; Mes Voyages +20 px au maximum                 |

---

## D1 — Échelle du titre principal

### État actuel vérifié

Les trois pages d’entrée utilisent trois échelles locales différentes. Les pages du parcours consomment le token partagé `--krew-title-chapter`.

| Famille / page        | Mobile 390 | Tablette 834 | Desktop 1440 | Source actuelle                 |
| --------------------- | ---------: | -----------: | -----------: | ------------------------------- |
| TripHub               |      42 px |        56 px |        56 px | valeurs locales `42 / 56`       |
| Mes Voyages           |      42 px |        52 px |        58 px | valeurs locales `42 / 52 / 58`  |
| Nouveau Voyage        |      40 px |        50 px |        52 px | valeurs locales `40 / 50 / 52`  |
| Chapitres du parcours |      34 px |        40 px |        40 px | `--krew-title-chapter: 34 / 40` |

Les douze consommateurs du header de chapitre partagé sont : Disponibilités, Préférences, Préférences de la Star, Dates du groupe, Profil du voyage, Destination, Hébergement, Transport, Planning, Tâches, À emporter, ainsi que l’état partagé de chapitre clôturé rendu par la route voyage.

`DESIGN.md` donne une plage de **40–44 px mobile / 48–58 px desktop** pour un hero éditorial et de **28–30 px mobile / 30–34 px desktop** pour un grand chapitre produit. Les valeurs actuelles des chapitres (`34 / 40`) dépassent donc la plage documentée, particulièrement à partir de 640 px.

### Proposition

Adopter deux cibles, chacune unique dans son rôle :

| Rôle                   | Mobile `< 640` | Tablette `≥ 640` | Desktop `≥ 1024` |
| ---------------------- | -------------: | ---------------: | ---------------: |
| Hero / page d’entrée   |      **42 px** |        **50 px** |        **56 px** |
| Grand chapitre produit |      **30 px** |        **34 px** |        **34 px** |

TripHub, Mes Voyages et Nouveau Voyage appartiennent au premier rôle. Les douze surfaces utilisant `KrewJourneyPageHeader` appartiennent au second.

### Pourquoi cette cible

- Elle respecte la hiérarchie déjà définie dans `DESIGN.md` au lieu de confondre niveau HTML et rôle visuel.
- L’échelle hero reprend le token `--krew-title-hero` déjà présent (`42 / 50 / 56`) : elle est donc ancrée dans le système existant plutôt que créée comme compromis abstrait.
- L’échelle chapitre utilise la borne haute de la plage officielle (`30 / 34`) afin de conserver une présence éditoriale sans rivaliser avec les pages d’entrée.
- Deux rôles documentés sont plus lisibles que quatre courbes historiques page par page.

### Impact visuel par page

| Page / famille          |         Mobile 390 |       Tablette 834 |       Desktop 1440 | Ampleur                                                                         |
| ----------------------- | -----------------: | -----------------: | -----------------: | ------------------------------------------------------------------------------- |
| TripHub                 |  42 → 42, inchangé | 56 → 50, **−6 px** |  56 → 56, inchangé | Modérée sur tablette ; titre moins dominant et moins sujet au retour à la ligne |
| Mes Voyages             |  42 → 42, inchangé | 52 → 50, **−2 px** | 58 → 56, **−2 px** | Faible ; légère réduction                                                       |
| Nouveau Voyage          | 40 → 42, **+2 px** |  50 → 50, inchangé | 52 → 56, **+4 px** | Faible à modérée ; hero plus affirmé                                            |
| 12 surfaces de chapitre | 34 → 30, **−4 px** | 40 → 34, **−6 px** | 40 → 34, **−6 px** | Visible ; hiérarchie plus fonctionnelle et titres longs plus robustes           |

Le principal changement à examiner humainement est la réduction des chapitres à 834 et 1440 px. Elle est volontaire : ces pages doivent guider une tâche, pas se présenter comme un nouveau hero à chaque étape.

### Décision à valider

- [ ] **D1 validée :** deux niveaux H1, hero `42 / 50 / 56` et chapitre `30 / 34`.

---

## D2 — Rythme vertical entre les sections

### État actuel vérifié

L’état rendu diffère légèrement de l’audit initial :

- `--krew-content-gap` vaut bien **28 px mobile puis 32 px à partir de 640 px** ;
- son alias `--krew-journey-content-gap` existe également ;
- cependant, aucune page ne consomme actuellement ces deux variables ;
- les shells des chapitres utilisent directement `space-y-8`, soit **32 px à toutes les largeurs** ;
- Mes Voyages utilise directement `space-y-8 sm:space-y-12`, soit **32 px mobile puis 48 px à partir de 640 px**.

| Famille                      | Mobile 390 | Tablette 834 | Desktop 1440 | Valeur réellement rendue                  |
| ---------------------------- | ---------: | -----------: | -----------: | ----------------------------------------- |
| Chapitres du parcours        |      32 px |        32 px |        32 px | valeur locale `space-y-8`                 |
| Mes Voyages                  |      32 px |        48 px |        48 px | valeurs locales `space-y-8 sm:space-y-12` |
| Token actuellement inutilisé |      28 px |        32 px |        32 px | aucune incidence visuelle actuelle        |

### Proposition

Conserver deux rythmes sémantiques :

| Rôle                      | Mobile 390 | Tablette 834 | Desktop 1440 |
| ------------------------- | ---------: | -----------: | -----------: |
| Parcours / tâche compacte |  **32 px** |    **32 px** |    **32 px** |
| Vue d’ensemble éditoriale |  **32 px** |    **48 px** |    **48 px** |

La Phase 2 devra centraliser ces valeurs dans des tokens clairement nommés, puis remplacer les classes locales. Elle ne devra pas réutiliser un même nom de token pour deux intentions différentes.

### Pourquoi ne pas forcer 32 px partout

`DESIGN.md` associe explicitement **32 px** aux sections compactes et **48 px** à la respiration éditoriale. Mes Voyages est une vue de découverte et de collection, avec des groupes de voyages distincts. Les pages du parcours sont des surfaces de décision ou d’organisation plus denses.

L’écart est donc justifiable. Le défaut actuel n’est pas la différence visuelle elle-même, mais l’absence de règle explicite et la présence de valeurs en dur.

### Impact visuel par page

| Page / famille          | Impact                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Mes Voyages             | **Aucun changement visuel** : reste à 32 / 48 px                                    |
| 12 surfaces de chapitre | **Aucun changement visuel** : restent à 32 px                                       |
| Token mobile inutilisé  | 28 → 32 px dans la future règle compacte, sans impact tant qu’il n’est pas consommé |

### Décision à valider

- [ ] **D2 validée :** conserver une différence documentée entre rythme compact `32` et rythme éditorial `32 / 48`.

---

## D3 — Gouttières horizontales à desktop

### État actuel vérifié

Les variantes de gouttière utilisées par les familles concernées sont :

| Gouttière | Mobile 390 | Tablette 834 | Desktop 1440 |
| --------- | ---------: | -----------: | -----------: |
| `form`    |      16 px |        24 px |        32 px |
| `wide`    |      16 px |        24 px |        40 px |

L’écart desktop est donc de **8 px par côté**, soit **16 px de largeur utile totale**.

Nouveau Voyage utilise explicitement `form`. Mes Voyages, Récap et Souvenirs utilisent explicitement `wide`. Certaines autres pages de largeur `form` utilisent encore la gouttière `default`, mais celle-ci aboutit également à 32 px sur desktop ; ce détail n’altère donc pas l’arbitrage desktop présent.

### Proposition

Conserver les deux valeurs :

- **32 px** par côté pour les formulaires et surfaces étroites ;
- **40 px** par côté pour les vues larges, narratives ou de collection.

### Pourquoi conserver l’écart

Cette différence est déjà la règle officielle de `DESIGN.md` :

- Product Narrow : gutter desktop 32 px ;
- Product Wide et Public Editorial : gutter desktop 40 px.

Elle sert une hiérarchie réelle. Une surface étroite doit préserver la largeur de ses champs et de ses contrôles. Une surface large peut consacrer 8 px supplémentaires à la marge pour cadrer ses compositions, images et groupes de contenu.

Unifier à 32 px rendrait les pages larges légèrement plus tendues. Unifier à 40 px réduirait inutilement la largeur utile des formulaires. Aucun de ces deux changements n’améliorerait la cohérence sémantique.

### Impact visuel par page

| Page / famille                                       | Impact               |
| ---------------------------------------------------- | -------------------- |
| Nouveau Voyage et futures surfaces `form` explicites | **Aucun changement** |
| Mes Voyages, Récap, Souvenirs                        | **Aucun changement** |

### Décision à valider

- [ ] **D3 validée :** l’écart form 32 px / wide 40 px à desktop est intentionnel et doit être conservé.

---

## D4 — Interligne et tracking du titre principal

### État actuel vérifié

| Famille / page        |                      Line-height |                         Tracking |
| --------------------- | -------------------------------: | -------------------------------: |
| TripHub               |                            `.94` | `tracking-tight`, soit `-.025em` |
| Mes Voyages           |                            `.92` | `tracking-tight`, soit `-.025em` |
| Nouveau Voyage        | `.98` via `--krew-title-leading` | `tracking-tight`, soit `-.025em` |
| Chapitres du parcours |                            `.98` |    `-.02em` via le token partagé |

Le tracking des trois heroes est donc déjà identique. L’incohérence principale porte sur trois interlignes différents (`.92`, `.94`, `.98`). Le tracking des chapitres, légèrement plus ouvert, est cohérent avec leur taille plus petite.

### Proposition

Adopter une règle liée aux deux rôles de D1 :

| Rôle                   | Line-height cible | Tracking cible |
| ---------------------- | ----------------: | -------------: |
| Hero / page d’entrée   |         **`.94`** |  **`-.025em`** |
| Grand chapitre produit |         **`.98`** |   **`-.02em`** |

### Pourquoi cette cible

- `.94` est déjà éprouvé dans TripHub, le hero le plus contraint car il peut contenir un nom de destination dynamique sur une image.
- `.92` est très serré pour un titre susceptible de passer sur deux lignes ; `.94` conserve l’énergie éditoriale tout en réduisant le risque de collision optique.
- `.98` est plus confortable pour les titres de chapitre plus petits et parfois longs, par exemple « Préférences de … » ou « Dates du groupe ».
- Le tracking légèrement plus serré des heroes accompagne leur plus grande taille sans imposer ce traitement aux chapitres fonctionnels.

### Impact visuel par page

| Page / famille          | Changement                     | Ampleur                                                                                                              |
| ----------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| TripHub                 | `.94 → .94`, tracking inchangé | Aucun changement                                                                                                     |
| Mes Voyages             | `.92 → .94`, tracking inchangé | Très faible : lignes légèrement plus ouvertes ; environ 0,8 à 1,2 px de line-box en plus par ligne selon le viewport |
| Nouveau Voyage          | `.98 → .94`, tracking inchangé | Faible : titre plus compact verticalement ; environ 1,6 à 2,2 px de line-box en moins par ligne                      |
| 12 surfaces de chapitre | `.98 / -.02em` inchangé        | Aucun changement                                                                                                     |

L’effet devient surtout perceptible lorsqu’un titre passe sur deux lignes. Les captures de Phase 2 devront donc inclure au moins un nom de destination long dans TripHub, même si le titre nominal tient sur une ligne.

### Décision à valider

- [ ] **D4 validée :** hero `.94 / -.025em`, chapitre `.98 / -.02em`.

---

## D5 — Tailles de conteneur `KrewPageShell`

### État actuel vérifié

| Taille     | Largeur maximale | Consommateurs principaux actuels                                                                         |
| ---------- | ---------------: | -------------------------------------------------------------------------------------------------------- |
| `form`     |           820 px | Nouveau Voyage, invitation, disponibilité, questionnaires                                                |
| `story`    |          1020 px | Récap, Souvenirs                                                                                         |
| `standard` |          1024 px | TripHub et principaux chapitres du parcours                                                              |
| `wide`     |          1180 px | Mes Voyages                                                                                              |
| `site`     |          1280 px | token disponible ; aucun consommateur direct `KrewPageShell` trouvé dans le périmètre authentifié audité |

Deux anomalies ressortent :

1. `story` et `standard` ne diffèrent que de 4 px, sans bénéfice de composition mesurable ;
2. `wide` vaut 1180 px alors que `DESIGN.md` définit Product Wide dans une plage de 1200 à 1280 px.

### Proposition

Ramener l’échelle à quatre largeurs numériques :

| Rôle                      |       Cible |
| ------------------------- | ----------: |
| Formulaire / étroit       |  **820 px** |
| Produit standard et récit | **1024 px** |
| Produit large             | **1200 px** |
| Site / éditorial public   | **1280 px** |

Le nom sémantique `story` peut être conservé temporairement comme alias de `standard` afin de continuer à identifier Récap et Souvenirs dans les styles et les tests. Ce qui disparaît est la fausse différence de largeur, pas nécessairement le rôle de composition.

### Pourquoi cette cible

- 1024 px est une valeur de grille standard et déjà majoritaire dans les pages produit.
- Passer `story` de 1020 à 1024 px ne change pas la lecture ; cela retire une précision historique de 4 px sans justification.
- 1200 px place `wide` exactement à la borne basse officielle de Product Wide. Le changement reste mesuré par rapport à 1180 px.
- 820 et 1280 px ont chacun un rôle documenté et restent inchangés.

### Impact visuel par page

| Page / famille                                            | Changement     | Ampleur                                                                                                                                                 |
| --------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Récap et Souvenirs (`story`)                              | 1020 → 1024 px | Quasi imperceptible : +4 px au total, soit +2 px par côté lorsque le conteneur atteint sa largeur maximale ; aucun effet sur les viewports plus étroits |
| Pages `standard`, dont TripHub et les chapitres concernés | 1024 → 1024 px | Aucun changement                                                                                                                                        |
| Mes Voyages (`wide`)                                      | 1180 → 1200 px | Faible : +20 px au total, soit +10 px par côté à 1440 px ; aucun effet tant que le viewport ne permet pas au conteneur d’atteindre son maximum          |
| Pages `form`                                              | 820 → 820 px   | Aucun changement                                                                                                                                        |
| Futurs consommateurs `site`                               | 1280 → 1280 px | Aucun changement                                                                                                                                        |

### Décision à valider

- [ ] **D5 validée :** échelle `820 / 1024 / 1200 / 1280`, avec `story` aliasé à 1024 px.

---

## Ordre proposé pour la Phase 2

La Phase 2 ne doit commencer qu’après validation explicite de D1 à D5. Même si D1 et D4 concernent les mêmes titres, elles doivent rester deux changements séparés afin de pouvoir attribuer précisément chaque différence visuelle.

Ordre recommandé :

1. **D5 — largeurs**, car le changement est faible et clarifie le cadre de comparaison ;
2. **D3 — gouttières**, pour verrouiller officiellement l’exception sans changer le rendu ;
3. **D2 — rythme vertical**, pour remplacer les valeurs locales par les deux rythmes validés ;
4. **D1 — tailles H1**, changement visuel principal ;
5. **D4 — line-height / tracking**, finition typographique après validation de la taille.

Pour chaque décision : un commit dédié, mise à jour de la référence visuelle concernée, puis captures avant/après à **390 / 834 / 1440 px** avant de passer à la suivante.

## Hors périmètre de cette proposition

- Aucun composant React ou fichier CSS n’est modifié.
- Aucun test ni screenshot de référence n’est mis à jour.
- Les H1 des pages publiques, d’authentification, Récap et Souvenirs ne sont pas assimilés automatiquement aux heroes ou aux chapitres : leurs rôles éditoriaux restent distincts et devront être audités séparément si leur harmonisation est souhaitée.
- Aucun comportement produit, contenu, permission ou flux utilisateur n’est concerné.

## Validation humaine attendue

La validation peut être donnée sous la forme :

> D1 validée — D2 validée — D3 validée — D4 validée — D5 validée

Toute décision peut aussi être amendée individuellement. Aucune décision non explicitement validée ne devra être implémentée en Phase 2.
