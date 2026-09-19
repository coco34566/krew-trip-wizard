# Audit de migration du Trip Hub vers les pages autonomes

## Objectif

La route `src/routes/_authenticated/trips.$tripId.index.tsx` contient encore des sections historiques pilotées par `?view=voyage&section=...`, alors que les mêmes étapes disposent de routes autonomes. Cet audit vérifie qu'une bascule vers les routes canoniques ne retire ni fonctionnalité, ni permission, ni état produit.

Point structurel important : avant cette migration, `src/routes/_authenticated/trips.$tripId.tsx` intercepte déjà la plupart des anciennes URLs `?section=...` et rend les composants autonomes. Les gros blocs JSX de la route index sont donc en grande partie du code shadowé. La migration vise à rendre les routes canoniques explicites et à supprimer ensuite ce doublon.

`data.isOwner` provient de `isTripAdmin(...)` : il couvre l'organisateur principal **et** le co-organisateur. `data.isCreator` reste réservé au créateur pour les actions irréversibles. Les membres et la Star n'obtiennent aucun droit administrateur supplémentaire.

## Tableau des écarts

| Étape | Section intégrée historique | Page autonome | Permissions | États / erreurs | Mutations, invalidations et toasts | Liens sortants | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dates | Fenêtres communes, choix manuel, verrouillage/déverrouillage, export ICS + Google/Outlook/M365. | `TripDatesPage` couvre les mêmes fonctions avec shell dédié. | Organisateur + co-organisateur choisissent/déverrouillent ; membre/Star consultent. | Autonome ajoute loading/error explicites, vide et état confirmé. | Même `chooseTripDates` / `unlockTripDates`; invalidation `trip`, `trip-availability`, `generation-readiness`; mêmes toasts d'échec. | Retour hub, calendriers externes. | Parité / superset, aucune régression. |
| Profil | Choix 1–3 concepts, validation, verrouillage après choix destination. | `TripProfilePage` reprend le flux et permet aussi de modifier un profil validé tant que la destination n'est pas choisie. | Admin uniquement pour modifier/valider ; membres/Star consultent. | Autonome ajoute loading/error, absence de concepts et état validé. | Même `validateStayProfile`; invalidation `trip` + `generation-readiness`; même toast d'échec. | Retour hub, destination. | Superset, aucune régression. |
| Destination | Génération, vote, sélection/changement de destination. | `TripDestinationPage` couvre les mêmes actions avec états verrouillés et vides explicites. | Admin génère/sélectionne ; tous les membres peuvent voter ; Star sans privilège admin. | Loading/error, profil requis, aucune proposition, génération en cours. | `generateRecommendations`, `selectRecommendation`, `toggleVote`; invalidations `trip` + readiness ; toasts dédiés. | Profil, hébergement, photos de destination. | Parité / superset. |
| Hébergement | Recherche, vote, statut réservé, liens fournisseurs. | `TripAccommodationPage` couvre la même logique et les cas destination absente / rate-limit. | Admin lance la recherche ; membres votent ; organisateur + co-organisateur peuvent marquer réservé. | Loading/error, destination verrouillée, vide, rate-limit, top vote, réservé. | `proposeStayAndTransport(includeTransport:false)`, `voteHotel`, `setBookingStatus`; invalidation `trip` / `cost-split`; mêmes toasts métier. | Destination, transport, hébergement externe via `SafeExternalLink`. | Parité / superset. |
| Transport | Recherche, choix individuel, réservation, créneaux et liens fournisseurs. | `TripTransportPage` ajoute la mutualisation, contexte Star et statut atomique par participant. | Admin lance la recherche ; chacun choisit son trajet ; admin/participant concerné gèrent le statut ; Star secrète gérée explicitement par l'admin. | Loading/error, aucun départ, aucun trajet, génération, trajets groupés. | Même recherche/choix, plus fonctions atomiques ; invalidation `trip`, `trip-progress`, `cost-split`, `group-time-window`; toasts dédiés. | Questionnaire, planning, fournisseurs externes. | Superset, aucune régression. |
| Planning | Génération du planning, régénération d'un créneau, liens activités. L'ancienne URL rend aussi `PlanningMapSection` comme sibling. | `TripPlanningPage` couvre le planning mais la route canonique omettait la carte. | Admin génère/régénère ; membres consultent ; voyage terminé en lecture seule sur l'autonome. | Loading/error, vide, génération, historique terminé. | `generateGroupItinerary`, `regenerateItinerarySlot`; invalidation `trip`; toasts identiques. | Tâches, liens activités/réservation externes. | **Écart régressif corrigé en phase A** : la route `/planning` rend désormais aussi `PlanningMapSection`, avec test. |
| Tâches | Génération, réassignation admin, changement de statut, liens réservation. | `TripTasksPage` utilise les mutations de permissions sécurisées et ajoute tâches transport/Star. | Admin réassigne ; membre ne modifie que sa tâche ; terminé = lecture seule. | Loading/error, aucun planning, aucune tâche, historique terminé. | `generateTasksForTrip`, `updateTaskStatusSecure`, `reassignTaskSecure`, `sanitizeTaskAssignments`; invalidation `trip-tasks`; toasts plus précis. | Invitation, transport, réservation externe. | Superset plus sûr, aucune régression. |
| À emporter | `PackingListCard` alimentée par itinéraire, activités, durée, hébergement. | `TripPackingPage` fournit les mêmes données et le lifecycle. | Pas d'action admin spécifique sur la page ; droits du composant de liste inchangés. | Loading/error et voyage terminé en lecture seule ajoutés. | Pas de mutation de route spécifique. | Retour hub. | Parité / superset. |
| Dépenses | Section `CostSplitCard` intégrée, ~20 lignes. | Aucune route autonome. | Lecture selon données existantes. | Affichée seulement si destination + split disponibles. | Pas de mutation locale. | Aucun. | **Conservée intégrée** : créer une route dédiée augmenterait la surface et le risque pour 20 lignes sans gain produit. |

## Écarts transverses

- Les pages autonomes ont généralement de meilleurs états loading/error/locked que les blocs historiques.
- Les fonctions serveur restent inchangées.
- Les liens externes continuent de passer par les composants/validateurs de liens sûrs existants.
- Les permissions Star restent celles déjà implémentées dans les pages autonomes ; aucune élévation n'est introduite.
- Aucun changement visuel volontaire n'est prévu, hors restitution de la carte du planning qui existait déjà sur l'ancienne URL.

## Correction préalable à la bascule

La route `/trips/$tripId/planning` rend maintenant `TripPlanningPage` **et** `PlanningMapSection`. Un test de route verrouille cette parité avant toute modification des liens du hub.
