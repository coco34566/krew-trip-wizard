# KREW — couverture visuelle avant migration CSS

> Inventaire des surfaces client à protéger avant toute simplification du CSS. Cette cartographie complète le contrat `css-migration-baseline.md` et ne change aucun rendu.

## Principe

Une route technique n'est pas une surface visuelle. Les routes API, MCP, OAuth callbacks et autres endpoints sans écran client sont donc exclues de la baseline visuelle. En revanche, toute page réellement visible par un utilisateur KREW doit être couverte soit par un audit visuel automatisé, soit par un scénario d'état explicitement identifié.

## Viewports communs

Les audits de référence utilisent :

- 320 × 568 ;
- 390 × 844 — screenshot ;
- 844 × 390 ;
- 834 × 1112 — screenshot ;
- 1112 × 834 ;
- 1440 × 1000 — screenshot ;
- 1728 × 1100.

Tous les viewports contrôlent l'overflow horizontal.

## Surfaces publiques couvertes par `reference-surfaces-visual-audit.spec.ts`

| Surface | Route | Couverture |
| --- | --- | --- |
| Landing | `/` | Référence multi-viewport |
| FAQ | `/faq` | Référence multi-viewport |
| Tarifs | `/tarifs` | Référence multi-viewport |
| À propos | `/a-propos` | Référence multi-viewport |
| CGU | `/cgu` | Référence multi-viewport |
| Confidentialité | `/confidentialite` | Référence multi-viewport |
| Mentions légales | `/mentions-legales` | Référence multi-viewport |
| Authentification | `/auth` | Référence multi-viewport |

## Surfaces authentifiées de référence

| Surface | Route | Couverture |
| --- | --- | --- |
| Mes voyages | `/dashboard` | Référence multi-viewport |
| Nouveau voyage | `/trips/new` | Référence multi-viewport |
| TripHub / parcours global | `/trips/:tripId` | Référence multi-viewport + Journey audit |
| Compte | `/account` | Référence multi-viewport |
| Récapitulatif | `/trips/:tripId/recap` | Référence multi-viewport |
| Souvenirs | `/trips/:tripId/memories` | Référence multi-viewport |

## Chapitres Journey couverts par `journey-visual-audit.spec.ts`

L'audit doit viser les routes canoniques réellement utilisées par le produit, et non les anciens paramètres `?view=voyage&section=...`.

| Chapitre | Route canonique |
| --- | --- |
| Parcours | `/trips/:tripId` |
| Inviter | `/trips/:tripId/invite` |
| Disponibilités | `/trips/:tripId/availability` |
| Préférences | `/trips/:tripId/questionnaire` |
| Dates | `/trips/:tripId/dates` |
| Profil du voyage | `/trips/:tripId/profile` |
| Destination | `/trips/:tripId/destination` |
| Hébergement | `/trips/:tripId/accommodation` |
| Transport | `/trips/:tripId/transport` |
| Planning | `/trips/:tripId/planning` |
| Tâches | `/trips/:tripId/tasks` |
| À emporter | `/trips/:tripId/packing` |
| Star | `/trips/:tripId/star` |

## Surfaces nécessitant un scénario d'état dédié

### Rejoindre un voyage

Routes :

- `/join/:tripId` ;
- `/join/:tripId/questionnaire`.

Cette surface dépend fortement de l'identité et de l'état du visiteur : invité non connecté, participant déjà reconnu, lien invalide/expiré, questionnaire déjà rempli, etc. Réutiliser simplement le compte QA connecté peut provoquer une redirection et donner une fausse impression de couverture.

Décision de sécurité : **ne pas fabriquer une capture trompeuse**. Avant de migrer du CSS appartenant au parcours Join, créer ou réutiliser une fixture déterministe pour les états réellement visibles et capturer au minimum l'état invité nominal mobile/tablette/desktop.

### États fonctionnels des pages Journey

Les screenshots de route protègent la composition principale mais ne remplacent pas les contrôles d'état. Lorsqu'une famille CSS concernée est migrée, vérifier explicitement les états pertinents :

- loading / thinking ;
- empty ;
- locked / inaccessible ;
- réponses enregistrées ;
- selected / active ;
- completed / voyage terminé ;
- erreur ;
- organisateur / co-organisateur / participant lorsque leurs actions visibles diffèrent.

Aucun de ces états ne doit être modifié opportunément pendant la migration CSS.

## Routes volontairement hors baseline visuelle client

Sont exclues de la comparaison de screenshots lorsqu'elles ne rendent pas un écran produit client :

- routes sous `/api/*` ;
- endpoints MCP ;
- callbacks et endpoints OAuth ;
- endpoints techniques de génération/diagnostic ;
- autres loaders/endpoints serveur sans UI.

La page éventuelle de design-system/sandbox interne n'est pas une référence de rendu produit : elle sert à inspecter des primitives, pas à décider qu'une surface client est correcte.

## Règle de migration

Avant de modifier une règle CSS :

1. identifier la ou les surfaces de cette matrice qu'elle peut affecter ;
2. identifier les états métier susceptibles de changer le DOM ;
3. conserver le rendu validé et déplacer seulement la responsabilité CSS ;
4. exécuter TypeScript, build et audits visuels ;
5. comparer mobile, tablette et desktop ;
6. ne supprimer l'ancienne règle qu'après preuve que le nouveau propriétaire reproduit son comportement nécessaire.

Une surface non couverte ou un état ambigu bloque la suppression d'une règle qui pourrait l'affecter.
