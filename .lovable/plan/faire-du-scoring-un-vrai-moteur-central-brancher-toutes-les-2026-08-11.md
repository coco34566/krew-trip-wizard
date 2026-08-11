# Faire du scoring un vrai moteur central : brancher toutes les données collectées

## Constat (vérifié dans le code)

Une grande partie du questionnaire est déjà exploitée par le moteur (`engine.ts` / `trip-service.ts`) : budgets et veto, ambiances, catégories d'activités, dates et blackout, rythme de voyage, créneaux préférés, contraintes alimentaires, tranche d'âge, accessibilité, modes de transport et durée max, note minimale d'hébergement, chambre partagée, équipements, préférences de la star.

Trois trous réels :

1. **Type de lieu / environnement recherché** (`wanted_env_type` : urbain, quartier animé, bord de mer, nature, village de charme, montagne, lac) est **obligatoire dans le questionnaire participant et dans celui de la star, mais n'est utilisé nulle part** : ni dans l'agrégation de groupe, ni dans le scoring, ni dans le prompt IA, ni dans le choix d'hébergement. C'est exactement le cas cité : « majorité urbain → villes », « champêtre → maison/Airbnb à la campagne ».
2. **Type de logement souhaité** : le moteur calcule `mostDemandedLodgingType` à partir du champ **équipements** (`required_amenities`), pas à partir du champ logement (`room_type_preference`). Le tri des hébergements se base donc sur la mauvaise donnée.
3. Le catalogue de destinations n'a **aucune notion d'environnement** (pas de colonne), et la recherche externe d'hébergements ne demande jamais de maisons/villas/Airbnb : elle cherche des hôtels quelle que soit l'envie du groupe.

## Ce qui sera fait

### 1. L'environnement devient un signal de premier plan
- Agrégation : compter les choix d'environnement de tous les participants (avec le poids renforcé de la star, comme pour les autres préférences) et en déduire un profil de groupe : tags dominants + un axe « urbain / nature » avec sa force de majorité.
- Base de données : ajouter des tags d'environnement sur les destinations, remplis automatiquement (règles locales pour les villes connues, estimation IA + coordonnées/climat pour les nouvelles villes découvertes).
- Scoring : nouveau sous-score « Cadre » qui compare les tags de la destination au profil du groupe, intégré aux poids existants par type d'événement (donc réglable et suivi comme les autres). Consensus faible sur l'environnement = pas de veto, juste une pondération.

### 2. Les propositions suivent l'environnement choisi
- Découverte : les tags d'environnement sont injectés dans le prompt IA (« groupe majoritairement nature/campagne → propose villages, vallées, zones lacustres, pas seulement des capitales ») et dans le filtre des villes locales via leur profil existant citybreak / maison de groupe.
- Hébergement : si le groupe penche nature/campagne/village, priorité aux maisons, villas, gîtes et locations entières (avec le centre-ville qui cesse d'être un critère de tri) ; si le groupe penche urbain, priorité hôtels/apparts proches du centre. Le type de logement demandé est enfin lu depuis le bon champ.
- Recherche externe : la requête aux comparateurs transmet le type de bien souhaité (maison entière vs hôtel) et l'attente de centre-ville, pour que les offres comparées correspondent au cadre voulu.
- Itinéraire et activités : léger biais de catégories selon le cadre (nature/plein air côté campagne, bars/culture côté urbain), en respectant le rythme et les créneaux déjà gérés.

### 3. Transparence et cohérence
- La raison de la proposition et les motifs de correspondance mentionnent le cadre (« maison de groupe à la campagne, comme voulu par 5 participants sur 7 »).
- Le radar de score et la carte de proposition affichent le nouveau sous-score « Cadre ».
- Les destinations écartées (runner-ups) peuvent indiquer « cadre trop urbain / trop isolé » comme raison de rejet.

### 4. Audit de couverture
Une passe de vérification champ par champ du questionnaire, du questionnaire star et des disponibilités, pour confirmer que chaque donnée collectée alimente au moins un élément (filtre dur, sous-score, tri d'hébergement, requête externe ou affichage), et corriger les branchements manquants découverts au passage.

## Détails techniques

- Migration : `destinations.env_tags text[] not null default '{}'` (+ backfill des villes du catalogue à partir de `CITY_PROFILES.lodgingFocus` et des scores d'ambiance).
- `aggregateParticipantPreferences` : ajoute `envTags`, `envTagFreq`, `envAxis: "urbain" | "nature" | "mixte"` ; correction de `mostDemandedLodgingType` (source `room_type_preference`).
- `ScoringContext` : `envTags`, `envAxis`, `envMajorityRatio` ; `SubScores.sEnvironment` + poids `environment_weight` ajouté à `scoring_weights` (migration) avec valeur par défaut par type d'événement et renormalisation des poids existants.
- `destination-discovery.server.ts` : mapping `lodgingFocus` → tags, filtrage/bonus selon `envAxis` ; `destination-ai.server.ts` : contrainte de cadre dans le prompt et champ `env` dans le JSON retourné, mappé par `candidate-merge.ts` vers `env_tags`.
- `engine.ts` : `sEnvironment`, tri d'hébergement conditionné à `envAxis`, `needsCityCenter` neutralisé côté nature.
- `travel-providers.server.ts` / `search-hotels.functions.ts` : paramètre `propertyTypes` transmis aux connecteurs.
- Tests : extension de `src/lib/__tests__/engine.test.ts` et `candidate-merge.test.ts` (groupe urbain vs groupe nature → propositions et hébergements différents).
