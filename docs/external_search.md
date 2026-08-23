# KREW — Données externes, recherche voyage et affiliation

> Référence opérationnelle. Le code et les tests restent la source de vérité pour le comportement effectivement déployé. Ne pas réactiver un ancien provider simplement parce qu'il apparaît dans l'historique Git ou dans un ancien connecteur.

## Principes

1. Les contraintes KREW sont appliquées avant les fallbacks commerciaux.
2. Un fallback ne doit jamais réintroduire un mode refusé ou incompatible.
3. Une offre fournisseur réelle, une recherche externe/deep-link et une estimation KREW sont trois natures de données différentes et doivent rester identifiables.
4. Les liens d'affiliation ne doivent pas dégrader la pertinence produit : le meilleur lien commercial n'est utilisé que lorsqu'il correspond réellement au besoin généré.
5. Les secrets et identifiants privés restent en variables d'environnement ; seuls les noms de variables peuvent être documentés.

## Géographie et météo

- `src/integrations/external/geo-weather.server.ts` gère géocodage/météo/climat via les sources configurées.
- Ces données enrichissent la recommandation mais ne doivent pas être présentées comme une garantie météo future hors horizon vérifiable.

## Destination discovery

- Les LLM/providers configurés peuvent proposer des candidats de découverte.
- Les candidats passent ensuite par les enrichissements, contraintes dures et scoring déterministe KREW.
- Le LLM n'est pas autorisé à transformer une estimation ou une supposition en prix/disponibilité vérifiés.

## Hébergements

Le code contient plusieurs connecteurs historiques/actuels (notamment StayAPI et des connecteurs RapidAPI). Leur présence dans le dépôt ne signifie pas qu'ils sont tous actifs ou prioritaires en production.

Règles :
- disponibilité/prix vérifiés doivent conserver leur provenance ;
- une propriété non vérifiée ne doit pas être présentée comme disponible ;
- les données estimées/inférées restent explicitement distinctes ;
- les intégrations affiliées Booking.com / Trip.com via Travelpayouts sont à considérer comme **en attente de validation/configuration** tant que les programmes ne sont pas approuvés et testés ; ne pas les documenter comme live avant cela.

## Activités

GetYourGuide est l'intégration affiliée actuelle pour les activités réservables lorsqu'un résultat correspondant est disponible.

- préserver le lien spécifique vers l'activité quand il existe ;
- pour une activité gratuite ou sans page de réservation naturelle (quartier, balade, point d'intérêt), fournir une description utile plutôt que fabriquer un lien de réservation ;
- les anciens connecteurs Klook/TripAdvisor/RapidAPI peuvent exister dans le code ou l'historique mais ne constituent pas à eux seuls la priorité produit actuelle.

## Transport — invariants

### Filtrage

Le moteur doit d'abord respecter : modes autorisés/refusés, origine(s), dates, horaires impératifs et durée maximale. Il ne doit pas afficher des modes artificiels simplement pour compléter la page.

### Avion

Ordre actuel à préserver :
1. offre live/structurée si le provider configuré renvoie une offre réellement exploitable et compatible ;
2. sinon **Kiwi via Travelpayouts** comme recherche externe principale, avec origine, destination, dates et SubID KREW ;
3. Google Flights peut servir de comparaison/fallback secondaire selon le flux ;
4. Kayak et Omio ne sont pas des fallbacks principaux actifs et ne doivent pas être réintroduits sans décision explicite.

Le builder affilié Kiwi est centralisé dans `src/lib/krew/deep-links.ts`. Le fallback avion est notamment géré dans `src/integrations/external/transport.server.ts` et les flux d'agrégation/présentation doivent conserver cette priorité.

### Train

SNCF Connect / Trainline restent des options de recherche train selon la route. Ne pas proposer le train lorsqu'il est incompatible avec les contraintes du voyage.

### Voiture / covoiturage

Google Maps et BlaBlaCar sont conservés selon le comportement existant. Une modification du fallback avion ne doit pas les modifier.

### Cas sentinelle

Paris → Budapest, lorsque les contraintes rendent uniquement l'avion pertinent : aucun faux train/voiture ne doit apparaître et l'action avion principale doit utiliser le flux Kiwi/Travelpayouts configuré.

## Fichiers principaux à inspecter avant modification

- `src/lib/krew/deep-links.ts`
- `src/integrations/external/transport.server.ts`
- `src/integrations/external/searchapi-google-flights.server.ts`
- `src/integrations/external/sncf-fares.server.ts`
- `src/integrations/external/travel-providers.server.ts`
- `src/lib/travel-providers.server.ts`
- `src/lib/krew/getyourguide.server.ts`
- `src/lib/krew/activity-discovery.server.ts`
- `src/lib/krew/property-discovery.server.ts`
- `src/lib/krew/destination-discovery.server.ts`

Inspecter uniquement les fichiers réellement concernés par la modification ; ne pas lire tous ces fichiers systématiquement.

## Tests de non-régression pertinents

Le dépôt contient notamment des tests transport, deep-links, GetYourGuide, planning, property discovery, données réelles/estimées et cohérence E2E. Toute modification d'un provider doit exécuter les tests ciblés correspondants et, si le flux utilisateur change, un test runtime/Preview approprié.