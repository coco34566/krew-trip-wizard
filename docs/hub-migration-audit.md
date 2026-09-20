# Trip Hub migration audit

Date: 2026-09-20

## Scope

Cette migration compare les sections historiques intégrées à `src/routes/_authenticated/trips.$tripId.index.tsx` avec les pages autonomes déjà présentes.

Point important : avant cette migration, le layout parent `src/routes/_authenticated/trips.$tripId.tsx` intercepte déjà les anciennes URLs `?view=voyage&section=...` et rend les composants autonomes pour dates, profile, destination, accommodation, transport, planning, tasks et packing. Les sections intégrées de la route index sont donc du code legacy/shadowé pour ces URLs. L'audit ci-dessous compare néanmoins explicitement les deux implémentations avant suppression.

`data.isOwner` renvoyé par `getTripDetail` signifie administrateur du voyage via `isTripAdmin` : organisateur et co-organisateur. Les membres et la Star n'obtiennent pas ces droits d'administration sauf s'ils sont eux-mêmes administrateurs.

## Résultat synthétique

Un écart de parité a été identifié sur Planning : l’ancienne URL `?section=planning` ajoutait `PlanningMapSection` via le layout parent, alors que la route autonome ne l’affichait pas. La route autonome a été corrigée avant la phase B et un test de contrat protège cette parité. Aucun autre écart identifié ne rend la page autonome moins sûre ou moins fonctionnelle. Plusieurs pages autonomes ajoutent au contraire des états de chargement/erreur explicites et, pour transport/tâches, des contrôles de permissions plus stricts. Aucune correction fonctionnelle préalable n'est donc nécessaire avant la phase B.

| Étape | Fonctionnalités | Permissions | États | Mutations | Invalidations / refresh | Toasts | Liens sortants | Écart / décision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dates | Fenêtres communes, choix manuel, verrouillage/déverrouillage, export calendrier | Choix et déverrouillage réservés aux admins; lecture pour membres/Star | Autonome : loading, error, absence de fenêtre, dates verrouillées. Intégrée : mêmes états métier mais moins structurés | `chooseTripDates`, `unlockTripDates` | `trip`, `trip-availability`, `generation-readiness` | Erreurs choix, déverrouillage, export | Retour hub, calendriers externes | Parité. Page autonome conserve tous les usages. |
| Profile | Calcul et choix de 1–3 concepts, validation, consultation | Validation/modification admin; lecture membre/Star | Autonome : loading/error, profil non prêt, validé, modification avant destination | `validateStayProfile` | `trip`, `generation-readiness` | Erreur validation | Retour hub, destination | Autonome légèrement supérieure : édition explicite du profil validé avant choix destination. |
| Destination | Génération, vote, sélection/changement, budget | Génération/sélection admin; vote accessible aux membres | Autonome : loading/error, profil manquant, aucune destination, génération en cours, destination choisie | `generateRecommendations`, `selectRecommendation`, `toggleVote` | `trip`, `generation-readiness` | Préférences incomplètes, génération, sélection, vote | Retour hub, profil, hébergement | Parité fonctionnelle. |
| Accommodation | Recherche, vote, top vote, statut réservé, liens fournisseur | Recherche admin; vote membres; réservation organisateur/co-organisateur | Autonome : loading/error, destination absente, empty, rate-limit, recherche, retenu/réservé | `proposeStayAndTransport` (hébergement seulement), `voteHotel`, `setBookingStatus` | `trip`, `cost-split` | Recherche, vote, réservation | Retour hub, destination, transport, fournisseur externe | Parité. Le droit co-organisateur sur réservation est conservé. |
| Transport | Recherche, choix individuel, regroupement, réservation, Star secrète, préférences horaires | Recherche admin; chacun choisit son transport; admin gère Star; réservation participant/admin selon trajet | Autonome : loading/error, préférences manquantes, empty, recherche, trajets groupés | `proposeStayAndTransport`, choix transport, `setTransportPickStatusAtomic` | `trip`, `trip-progress`, `cost-split`, `group-time-window` | Recherche, choix, statut trajet | Retour hub, questionnaire, planning, fournisseur externe | Autonome supérieure : contexte Star et mise à jour atomique du statut transport. |
| Planning | Génération planning, régénération d'un créneau, liens activité, carte du planning | Génération/régénération admin; lecture membre/Star | Autonome : loading/error, empty, génération, voyage terminé en lecture seule | `generateGroupItinerary`, `regenerateItinerarySlot` | `trip` | Génération, autre option | Retour hub, tâches, liens activité | Écart corrigé en phase A : `PlanningMapSection` est maintenant rendue par la route autonome, comme sur l’ancienne URL. |
| Tasks | Génération, attribution, statut, tâches transport, liens réservation | Admin attribue; membre ne modifie que ses tâches; Star comme participant selon identité; voyage terminé readonly | Autonome : loading/error, aucun planning, aucune tâche, participants manquants, historique readonly | `generateTasksForTrip`, `reassignTaskSecure`, `updateTaskStatusSecure`, sanitation | `trip-tasks` | Permissions statut, réattribution, génération | Retour hub, invitation, transport, réservation externe | Autonome supérieure : mutations sécurisées et sanitation des affectations. |
| Packing | Liste adaptée aux activités/hébergement/durée | Lecture/édition selon `PackingListCard`; historique readonly | Autonome : loading/error, voyage terminé readonly | Mutations encapsulées dans `PackingListCard` | Gérées par `PackingListCard` | Gérées par `PackingListCard` | Retour hub | Parité, avec lifecycle explicite. |
| Expenses | Répartition des coûts via `CostSplitCard` | Lecture selon données du voyage | Affiché uniquement si split disponible et destination choisie | Aucune mutation locale | N/A | N/A | Aucun | Pas de page autonome. Décision : conserver cette petite section intégrée (≈20 lignes), plus simple et sans nouvelle route. |

## Permissions détaillées

- **Organisateur** : droits admin sur toutes les étapes.
- **Co-organisateur** : `getTripDetail().isOwner` repose sur `isTripAdmin`; les pages autonomes conservent donc les droits admin attendus. L'hébergement vérifie aussi explicitement `co_organizer_id` pour le statut de réservation.
- **Membre** : lecture des étapes collectives, vote destination/hébergement, choix de son transport et modification de ses propres tâches selon les fonctions sécurisées.
- **Star** : lorsqu'elle est identifiée comme participant, mêmes droits qu'un membre. En mode Star secrète, le transport est géré via le contexte dédié côté organisateur.

## États et erreurs

Les pages autonomes utilisent `KrewJourneyLoadingState` / `KrewJourneyErrorState` et des panneaux de statut dédiés. Cette migration ne change ni leur texte ni leur rendu.

## Mutations serveur

Aucune fonction serveur n'est modifiée par cette migration. La bascule conserve les fonctions déjà utilisées par les pages autonomes.

## Compatibilité anciennes URLs

Les anciennes URLs `/trips/:tripId?view=voyage&section=<étape>` doivent rester compatibles. La phase B ajoute une redirection explicite dans le `beforeLoad` de la route index vers les routes canoniques autonomes.

## Dépenses

`expenses` reste dans la route index. Créer une route dédiée n'apporterait pas de bénéfice fonctionnel pour une section d'environ 20 lignes et augmenterait inutilement la surface de migration.
