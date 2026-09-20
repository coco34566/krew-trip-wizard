# Audit de migration du Trip Hub vers les routes autonomes

## Contexte

La route `src/routes/_authenticated/trips.$tripId.index.tsx` contient encore des versions intégrées des chapitres historiques sélectionnés par `?view=voyage&section=...`.

Les routes autonomes existent déjà :

| Étape | Route autonome |
| --- | --- |
| Dates | `/trips/:tripId/dates` |
| Profil du voyage | `/trips/:tripId/profile` |
| Destination | `/trips/:tripId/destination` |
| Hébergement | `/trips/:tripId/accommodation` |
| Transport | `/trips/:tripId/transport` |
| Planning | `/trips/:tripId/planning` |
| Tâches | `/trips/:tripId/tasks` |
| À emporter | `/trips/:tripId/packing` |

Le layout parent `trips.$tripId.tsx` intercepte déjà les anciens paramètres `section` et rend les composants autonomes pour dates, profile, destination, accommodation, transport, planning, tasks et packing. L'UI réellement servie par les anciennes URLs est donc déjà majoritairement celle des pages autonomes ; les blocs intégrés de la route index sont du code shadowé.

`expenses` n'a pas de page autonome et reste une section du hub.

## Permissions communes

`getTripDetail().isOwner` est calculé via `isTripAdmin` : dans les pages ci-dessous, `isOwner` / `isAdmin` couvre donc l'organisateur et le co-organisateur. Un membre normal, y compris la Star identifiée comme membre, conserve les droits participant. Le transport de la Star secrète dispose en plus du contexte dédié `getStarTransportContext`.

## Comparaison

| Étape | Fonctionnalités / mutations | Permissions | États et erreurs | Invalidations / effets | Liens sortants | Écart par rapport au bloc intégré | Risque de régression |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dates | `chooseTripDates`, `unlockTripDates`, export ICS + Google/Outlook/M365 | Admin pour choisir/déverrouiller ; lecture pour membres | loading, error+retry, vide sans fenêtre commune, dates confirmées | `trip`, `trip-availability`, `generation-readiness` | retour hub ; calendriers externes | Parité fonctionnelle. La page autonome centralise les états loading/error que le bloc intégré n'isole pas. | Aucun |
| Profil | sélection 1–3 concepts, `validateStayProfile` | Admin modifie/valide ; membres lecture | loading, error+retry, profil non prêt, validé | `trip`, `generation-readiness` | hub, destination | La page autonome permet explicitement de modifier un profil validé tant qu'aucune destination n'est choisie ; c'est un superset sûr. | Aucun |
| Destination | `generateRecommendations`, `selectRecommendation`, `toggleVote` | Admin génère/finalise ; tous votent | loading, error+retry, locked si profil absent, vide, génération en cours | `trip`, `generation-readiness` | hub, profil, hébergement | Parité des mutations ; page autonome possède des états vides/verrouillés plus explicites. | Aucun |
| Hébergement | `proposeStayAndTransport(includeTransport:false)`, `voteHotel`, `setBookingStatus` | Admin lance recherche ; tous votent ; org/co-org marque réservé | loading, error+retry, destination manquante, vide, rate-limit, réservé | `trip`, `cost-split` | hub, destination, transport, liens hébergeurs | Parité ; la page autonome conserve le droit co-organisateur sur le statut réservé. | Aucun |
| Transport | recherche transport, choix individuel, statut réservé atomique, regroupements voiture, Star secrète | Admin lance recherche ; membre choisit son trajet ; admin gère Star ; propriétaire du pick/admin réserve | loading, error+retry, questionnaire manquant, vide, génération en cours | `trip`, `trip-progress`, `cost-split`, `group-time-window` | hub, questionnaire, planning, liens fournisseurs | Page autonome est plus complète : mutualisation/groupes et contexte Star atomique absents du vieux bloc intégré. | Aucun |
| Planning | `generateGroupItinerary`, `regenerateItinerarySlot` | Admin génère/régénère ; membres lecture | loading, error+retry, vide, voyage terminé en lecture seule | `trip` | hub, tâches, liens activités | Page autonome ajoute la protection lifecycle sur voyage terminé. | Aucun |
| Tâches | lecture Supabase, `updateTaskStatusSecure`, `reassignTaskSecure`, `generateTasksForTrip`, `sanitizeTaskAssignments` | Admin attribue ; membre modifie uniquement ses tâches ; lecture seule après voyage | loading, error+retry, pas de planning, vide, terminé | `trip-tasks` | hub, invite, transport, booking URLs | Page autonome utilise les mutations sécurisées et les tâches transport/Star ; le bloc intégré utilisait les anciennes mutations génériques. | Aucun — autonome plus sûre |
| À emporter | `PackingListCard` alimenté par hôtel/itinéraire/activités | droits internes de la packing list ; lecture seule lifecycle terminée | loading, error+retry, historique terminé | query `trip` | hub | Page autonome ajoute `TripLifecycleProvider` et l'historique en lecture seule. | Aucun |
| Dépenses | `CostSplitCard` | selon données du hub | absent si split indisponible | query `cost-split` du hub | aucun | Pas de page autonome. Bloc de ~20 lignes seulement. | Conservé dans le hub |

## Toasts et erreurs

Les pages autonomes utilisent les mêmes familles de messages d'erreur que les blocs intégrés pour les mutations équivalentes. Les différences sont principalement structurelles : les pages autonomes fournissent un `KrewJourneyLoadingState`, un `KrewJourneyErrorState` avec retry et des états verrouillés/vides explicites.

Aucun changement de texte ou design n'est nécessaire pour atteindre la parité avant la bascule.

## Gating du layout parent

Le layout `src/routes/_authenticated/trips.$tripId.tsx` applique `CompletedPreparationGate` aux routes autonomes profile, dates, destination, accommodation et transport. Planning/tasks/packing conservent leurs propres règles de lifecycle et de disponibilité dans leurs composants.

Ce gating est déjà utilisé lorsque les anciennes URLs `?section=...` sont ouvertes aujourd'hui.

## Conclusion Phase A

Aucune page autonome ne présente un écart identifié qui constituerait une régression par rapport à la section intégrée actuellement visible pour l'utilisateur.

Les écarts identifiés vont dans le sens inverse : transport, tâches, planning et packing sont plus complets ou plus sûrs dans leurs pages autonomes.

La phase B peut donc basculer les liens canoniques sans correction fonctionnelle préalable.
