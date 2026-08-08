# TODO_AGENT.md — Krew Trip Wizard

Ce fichier regroupe 3 chantiers à traiter par l'agent de code (Grok Build).
Lis `AGENTS.md` et `.agents/memory/` avant de commencer quoi que ce soit.

**Règles transversales, valables pour les 3 chantiers :**
- Ne modifie pas les formules de pondération dans `src/lib/krew/engine.ts`.
- TypeScript strict, fonctions pures pour tout ce qui touche au scoring,
  commentaires en français, cohérent avec le style existant du repo.
- Toute nouvelle table/colonne passe par une migration dans
  `supabase/migrations/`.
- Ajoute des tests dans `src/lib/__tests__/` pour toute nouvelle logique
  de scoring, de cache ou de transformation de données.
- À la fin de chaque chantier : résume les fichiers modifiés et les
  migrations créées.
- Traite les chantiers dans l'ordre ci-dessous (1 → 2 → 3), chacun peut
  faire l'objet d'un commit/PR séparé.

---

## Chantier 1 — Sortir des 40 villes sans réduire les appels IA

**Objectif** : les propositions de destination ne doivent plus être
limitées aux ~40 villes codées en dur dans `CITY_PROFILES`
(`src/lib/krew/destination-discovery.server.ts`). Le nombre d'appels IA
existants ne doit **pas diminuer** — il ne s'agit pas d'économiser des
tokens ici, uniquement d'élargir le champ des destinations possibles.

Fichiers concernés :
- `src/lib/krew/destination-discovery.server.ts` (candidats rule-based)
- `src/lib/krew/destination-ai.server.ts` (candidats LLM,
  `discoverDestinationsWithAi`)
- `src/lib/krew/engine.ts` (scoring — ne pas toucher aux pondérations)
- `src/lib/krew/providers.server.ts` (catalogue,
  `createInternalProvider`)
- `src/integrations/external/geo-weather.server.ts` (saison/météo réelle)

### Tâches

1. **Fusionner les deux sources de candidats** au lieu de choisir l'une
   ou l'autre. Dans le point d'entrée qui orchestre la découverte
   (celui qui appelle `discoverCandidateDestinations` ET
   `discoverDestinationsWithAi`), combine les deux listes, déduplique
   par nom de ville normalisé (fonction `norm()` déjà présente), et
   transmets l'ensemble au scoring dans `engine.ts`. Les deux sources
   doivent toujours être appelées (pas de condition sur le nombre de
   résultats rule-based).

2. **Quota "wildcard" dans le prompt système** `SYSTEM` de
   `destination-ai.server.ts` : sur les 6 à 8 villes demandées, exige
   explicitement 2 à 3 destinations "hors des sentiers battus / moins
   évidentes pour ce type d'événement" qui respectent quand même
   budget, distance et ambiance. Garde le format JSON de sortie
   identique (`{"cities":[...]}`).

3. **Enrichissement automatique des villes IA absentes du catalogue.**
   Une ville renvoyée par `discoverDestinationsWithAi` sans
   `DestinationRecord` (ni dans `CITY_PROFILES` ni dans la table
   `destinations`) doit pouvoir entrer dans le scoring de `engine.ts` :
   - Demande au LLM, **dans le même appel** (pas d'appel
     supplémentaire), une estimation compacte par ville : coût
     journalier moyen €/pers, distance approximative km depuis la
     ville de départ, 2-3 mois idéaux. Étends le schéma JSON en
     conséquence, clés courtes pour ne pas gonfler les tokens :
     `{"name":"...","country":"...","why":"...","cost":70,"km":1200,"months":[5,6,9]}`.
   - Transforme cette estimation en `DestinationRecord` partiel
     exploitable par `engine.ts` (valeurs par défaut raisonnables pour
     rating/popularity si absentes, ex. 3.8 / 0.5).
   - Marque ces destinations comme `source: "ai_estimate"` (pour
     affichage différencié côté UI dans le Chantier 3).

4. **Auto-apprentissage du catalogue.** Quand une destination
   `ai_estimate` est effectivement sélectionnée par un groupe
   (via le flux qui écrit `scoring_feedback` / `recommendations`),
   upsert-la définitivement dans la table `destinations` avec ses
   valeurs réelles/estimées. Ajoute la migration nécessaire si des
   colonnes manquent (ex. colonne `source text`).

5. **Saison réelle pour les nouvelles villes.** Vérifie si
   `geo-weather.server.ts` est déjà branché sur le calcul de `sSeason`
   dans `engine.ts`. Si non, branche-le pour toute destination sans
   `bestMonths` connus (en particulier les villes `ai_estimate`), avec
   fallback sur l'estimation LLM du point 3 si l'API météo échoue.

---

## Chantier 2 — Améliorations de la proposition de destination

Fichiers concernés :
- `src/lib/krew/engine.ts` (types `Proposal`, `SubScores`)
- `src/routes/_authenticated/trips.$tripId.recap.tsx`
- table `scoring_feedback` existante (utilisée par
  `src/jobs/recalibrate-scoring-weights.ts`)

### Tâches

1. **Feedback granulaire par destination.**
   - Migration : ajoute à `scoring_feedback` (ou crée une table dédiée
     `destination_feedback` si plus propre) un champ `reaction`
     (`'like' | 'dislike' | null`) par `(trip_id, recommendation_id,
     participant_id)`, indépendant du fait que la destination ait été
     sélectionnée ou non.
   - Server function pour enregistrer/mettre à jour cette réaction.
   - Petit composant UI (2 boutons pouce haut/bas) sur chaque carte de
     proposition dans `recap.tsx`.
   - Adapte `src/jobs/recalibrate-scoring-weights.ts` pour prendre en
     compte ce signal en plus de `was_selected` (un like pèse comme un
     mini-signal positif même sans sélection finale).

2. **Destinations écartées avec raison.**
   - Conserve les 2-3 meilleures destinations calculées mais non
     retenues dans le top final (`selectDiverseTop` dans `engine.ts`
     les élimine actuellement en silence).
   - Expose-les via un champ additionnel de la réponse, ex.
     `runnerUps: {name: string, reason: string}[]`, avec une raison
     courte générée à partir de `matchReasons`/`subScores` existants
     (sans appel LLM).
   - Affiche-les en petit, en bas de la section propositions dans
     `recap.tsx` (ex. *"Aussi envisagées : Porto (budget un peu serré),
     Milan (ambiance moins fêtarde)"*).

3. **Historique cross-trip (personnalisation légère).**
   - Si l'utilisateur/le groupe a déjà des trips passés avec une
     destination validée, ajoute un petit bonus de score dans
     `engine.ts` basé sur des caractéristiques déjà présentes
     (ambiance dominante, pays) des destinations précédemment
     appréciées. Implémente-le comme sous-score optionnel
     `sHistorique`, désactivé si pas d'historique, poids faible (3-5)
     dans `DEFAULT_WEIGHTS_BY_EVENT`, sans casser les valeurs par
     défaut existantes.

4. **Badge fraîcheur des prix.**
   - Ajoute un champ `priceSource: 'api' | 'estimate'` sur `transport`
     et `accommodation` dans `BudgetBreakdown`, déterminé par la
     présence ou non d'une quote provider réelle
     (`transportByDestinationId` rempli via providers vs estimation
     locale).
   - Affiche un petit badge "prix réel" / "estimation" à côté du
     budget dans `recap.tsx`.

---

## Chantier 3 — Passe UI concrète sur TripHubDashboard.tsx et recap.tsx

Design system : Tailwind + oklch dans `src/styles.css` (charte
menthe/sage + bleu électrique + noir), composants shadcn/ui dans
`src/components/ui/`. Consulte le skill `frontend-design` si
disponible.

Fichiers concernés :
- `src/components/krew/TripHubDashboard.tsx`
- `src/routes/_authenticated/trips.$tripId.recap.tsx`

### Tâches

1. **`recap.tsx` — carte de proposition** (section
   `recommendations.map(...)`) :
   - Remplace le badge plat `Score {reco.score}` par un mini
     radar/donut chart (recharts, déjà présent dans le projet)
     affichant 4 sous-scores : ambiance, budget, activités, consensus
     (`reco.subScores` existe déjà côté data). Nouveau composant
     réutilisable : `src/components/krew/ScoreRadar.tsx`.
   - Ajoute une barre de consensus groupe sous le titre de la
     destination : *"{satisfiedCount}/{participantsEvaluated} du
     groupe convaincu"* avec une barre de progression colorée (variant
     succès/avertissement selon le ratio), via le composant `Progress`
     existant (`src/components/ui/progress.tsx`).
   - Si le Chantier 2 est fait : intègre les boutons like/dislike en
     haut à droite de chaque carte, et la section "Aussi envisagées"
     en bas de la liste avec un style discret (texte muted, pas de
     carte pleine).

2. **`TripHubDashboard.tsx`** :
   - Section "Progression" (~ligne 566) : remplace le texte brut par
     une timeline horizontale à étapes (questionnaire → dates
     verrouillées → destination shortlistée → destination validée),
     étape courante mise en avant (couleur primary, icône remplie),
     étapes passées cochées (icônes lucide-react).
   - Section "Propositions en cours" (~ligne 646) : si plusieurs
     propositions existent, affiche-les en carrousel horizontal sur
     mobile (Embla, déjà disponible via
     `src/components/ui/carousel.tsx`) plutôt qu'empilées
     verticalement.
   - Hero header (~ligne 492) : ajoute un léger overlay dégradé
     (`bg-gradient-to-t from-black/60`) derrière le titre blanc pour
     garantir la lisibilité quelle que soit l'image renvoyée par
     `heroImageForEvent()`.

3. **Cohérence** :
   - Toute nouvelle couleur passe par les tokens définis dans
     `src/styles.css` (`@theme inline` / oklch), jamais de couleur en
     dur.
   - Vérifie le rendu en dark mode (classe `.dark`) pour chaque
     élément ajouté.

**Livrable** : composants créés/modifiés, description précise du rendu,
résumé des fichiers touchés à la fin.
