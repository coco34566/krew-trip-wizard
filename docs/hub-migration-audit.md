# Audit de migration du Trip Hub

## Contexte

La route `src/routes/_authenticated/trips.$tripId.index.tsx` contient encore des sections intégrées historiques pilotées par `?view=voyage&section=...`.

En parallèle, les chapitres disposent de pages autonomes :

| Étape | Route autonome | Composant |
| --- | --- | --- |
| Dates | `/trips/:tripId/dates` | `TripDatesPage` |
| Profil | `/trips/:tripId/profile` | `TripProfilePage` |
| Destination | `/trips/:tripId/destination` | `TripDestinationPage` |
| Hébergement | `/trips/:tripId/accommodation` | `TripAccommodationPage` |
| Transport | `/trips/:tripId/transport` | `TripTransportPage` |
| Planning | `/trips/:tripId/planning` | `TripPlanningPage` |
| Tâches | `/trips/:tripId/tasks` | `TripTasksPage` |
| À emporter | `/trips/:tripId/packing` | `TripPackingPage` |

Le layout parent `trips.$tripId.tsx` intercepte déjà les anciennes URLs `?section=` et rend ces composants autonomes pour dates, profile, destination, accommodation, transport, planning, tasks et packing. Les gros blocs JSX restés dans la route index sont donc du code shadowé : ils ne constituent plus l'implémentation effectivement affichée pour ces anciennes URLs.

## Comparatif

| Étape | Section intégrée historique | Page autonome | Permissions / états / mutations / invalidations / liens | Écart et risque |
| --- | --- | --- | --- | --- |
| Dates | Affiche fenêtres communes, verrouillage manuel, export calendrier et réouverture des dates. | Même flux via `TripDatesPage`, avec loading/error dédiés et état vide explicite. | Admin = `data.isOwner` (qui provient de `isTripAdmin`, donc organisateur ou co-organisateur). Mutations `chooseTripDates`, `unlockTripDates`. Invalide `trip`, `trip-availability`, `generation-readiness`. Liens calendrier Google/Outlook/M365 et retour parcours. | Pas de régression. La page autonome ajoute des états loading/error plus propres et confirme les mêmes données. |
| Profil | Sélection 1–3 concepts, validation puis lien destination. Une fois validé, la section historique est essentiellement figée. | Même sélection/validation, avec possibilité de modifier un profil validé tant qu'aucune destination n'est choisie. | Admin via `data.isOwner`. Mutation `validateStayProfile`; invalide `trip` + `generation-readiness`. États loading/error, profil non prêt, profil enregistré. Lien destination canonique. | Pas de régression ; l'autonome est un superset fonctionnel contrôlé par les mêmes permissions. |
| Destination | Génération, vote de tous les membres, sélection finale admin, état choisi, liens profil/hébergement. | Même flux avec loading/error et état vide dédié. | Admin génère/sélectionne ; membres peuvent voter. Mutations `generateRecommendations`, `selectRecommendation`, `toggleVote`. Invalide `trip` + `generation-readiness`. Liens profil/hébergement canoniques. | Pas de régression. |
| Hébergement | Visible seulement si une destination est choisie. Recherche admin, vote groupe, réservation organisateur/co-organisateur, liens externes. | Affiche aussi un état verrouillé quand la destination manque. Même recherche/vote/réservation, états rate-limit/vide/loading/error. | Recherche réservée à `isOwner`/admin. Réservation autorisée organisateur ou `co_organizer_id`. Mutations `proposeStayAndTransport`, `voteHotel`, `setBookingStatus`. Invalide `trip` + `cost-split`. Liens externes via `SafeExternalLink`. | Pas de régression ; l'autonome améliore le cas destination absente. |
| Transport | Recherche admin, choix de trajet, statut réservé, horaires groupe, liens fournisseurs. | Même base + groupes de transport, mutualisation voiture et contexte Star secret. | Admin recherche ; chaque membre peut choisir son trajet ; admin peut gérer Star/participants selon contexte. Mutations `proposeStayAndTransport`, choix transport, statut atomique. Invalide `trip`, `trip-progress`, `cost-split`, `group-time-window`. Liens externes sécurisés. | Pas de régression ; l'autonome contient les fonctions transport récentes absentes du bloc historique. |
| Planning | Génération admin, alternatives par slot, liens GetYourGuide/booking, lien tâches. | Même génération/alternatives, plus prise en compte du cycle de vie : voyage terminé en consultation. | Admin uniquement pour génération/régénération, désactivée si voyage terminé. Mutations itinéraire + slot ; invalide `trip`. Liens externes via `SafeExternalLink`. | Pas de régression ; l'autonome protège mieux l'historique d'un voyage terminé. |
| Tâches | Génération, réassignation admin, changement de statut, liens booking. Les anciennes mutations venaient directement de `trips.functions.ts`. | Utilise `updateTaskStatusSecure`, `reassignTaskSecure`, `sanitizeTaskAssignments`, conserve génération, ajoute les tâches transport et la Star secrète. | Admin réassigne ; membre ne modifie que ses tâches ; terminé = lecture seule. Invalide `trip-tasks`. États loading/error/vide/historique. | Pas de régression ; l'autonome est plus stricte sur les permissions et couvre les tâches transport actuelles. |
| À emporter | `PackingListCard` intégré, rendu conditionnel à la section. | Même `PackingListCard` avec contexte lifecycle et état historique en lecture seule. | Pas de mutation propre à la page. Query `trip`. Loading/error dédiés. | Pas de régression. |
| Dépenses | Bloc intégré d'environ 20 lignes avec `CostSplitCard`. | Aucune route autonome. | Lecture seule à partir de `costSplitData.split`. | À conserver dans le hub : créer une route uniquement pour ~20 lignes ajouterait du routage sans bénéfice produit. |

## Permissions

`getTripDetail` expose `isOwner: isTripAdmin(trip, userId)`. Dans les composants autonomes, `data.isOwner` signifie donc « admin du voyage » et couvre organisateur + co-organisateur. Les contrôles qui doivent rester réservés au créateur continuent d'utiliser les données spécifiques correspondantes dans le hub.

La Star ne bénéficie pas d'un droit d'administration implicite. Le transport autonome utilise explicitement le contexte Star pour les cas de transport secret, et les tâches autonomes représentent la Star secrète comme une tâche gérée par l'organisateur.

## Conclusion de phase A

Aucun écart de la page autonome ne constitue une régression nécessitant une correction avant la bascule.

Les pages autonomes sont déjà les implémentations effectivement rendues par le layout parent pour les anciennes URLs `?section=`. La phase B peut donc rendre ces routes canoniques explicitement, conserver les anciens liens via redirection, puis la phase C supprimer le JSX shadowé sans changer l'interface réellement affichée.
