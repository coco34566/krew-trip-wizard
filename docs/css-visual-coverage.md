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

L'audit vise les routes canoniques réellement utilisées par le produit, et non les anciens paramètres `?view=voyage&section=...`.

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

## Join couvert par `join-visual-audit.spec.ts`

Le test Join crée un vrai voyage depuis le parcours organisateur, récupère le vrai lien généré par l'écran Invite, puis retire l'authentification du navigateur avant de capturer le parcours invité. Il n'utilise donc ni token inventé pour le cas nominal, ni capture trompeuse avec un compte déjà membre.

États couverts :

| État | Couverture |
| --- | --- |
| Invité non connecté + lien valide | 7 viewports, screenshots mobile/tablette/desktop |
| Lien sans token | 7 viewports, screenshots mobile/tablette/desktop |
| Token UUID valide mais non courant | 7 viewports, screenshots mobile/tablette/desktop |
| Identifiant voyage malformé | 7 viewports, screenshots mobile/tablette/desktop |
| Utilisateur déjà reconnu comme membre/organisateur | assertion de redirection hors de Join |

Le parcours `/join/:tripId/questionnaire` reste couvert fonctionnellement par le parcours de questionnaire après adhésion ; s'il reçoit ultérieurement une composition visuelle propre distincte, il devra obtenir sa propre capture de référence avant migration de son CSS.

## États transverses protégés

La baseline de route ne suffit pas à protéger tous les états métier. Les protections existantes ou ajoutées sont classées ainsi :

| Famille d'état | Protection actuelle |
| --- | --- |
| Loading / thinking | composants `KrewThinkingState` présents sur les surfaces concernées ; contrôle ciblé requis lors de la migration du propriétaire |
| Empty | contrôle ciblé requis lors de la migration de la surface concernée |
| Locked / inaccessible | Journey audit accepte explicitement les variantes `data-journey-locked-section` sur les chapitres qui peuvent être verrouillés |
| Selected / active | contrôle ciblé requis lors de la migration du composant de sélection concerné |
| Completed / voyage terminé | scénario dédié `manual-completed-trip-user.spec.ts` |
| Archived / réactivé | scénario organisateur dans `manual-completed-trip-user.spec.ts` |
| Participant read-only sur voyage terminé | scénario participant dans `manual-completed-trip-user.spec.ts` |
| Erreur d'invitation | audit Join dédié |
| Organisateur / participant | Journey et scénario completed-trip selon les surfaces où les actions diffèrent |

Le test completed-trip utilise désormais les routes canoniques `/planning`, `/tasks` et `/packing`, et non les anciens paramètres de section.

Pour les états `loading`, `empty` et `selected`, il n'est pas sûr de fabriquer une fixture générique globale qui ne représenterait pas le vrai DOM de chaque feature. Ils sont donc **des garde-fous obligatoires par famille** : une règle CSS qui peut les toucher ne peut être supprimée sans vérifier l'état concerné sur son composant réel.

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
