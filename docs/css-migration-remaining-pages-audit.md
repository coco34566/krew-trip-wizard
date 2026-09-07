# KREW — Audit CSS des 15 surfaces restantes

> Audit postérieur aux PR #369 / #370 / #371.
>
> Ce document complète `docs/css-migration-baseline.md` sans modifier le contrat historique. Il décrit l'état réel du code après migration pixel-perfect de TripHub, Mes voyages et Nouveau voyage. Aucun changement de rendu, de composant applicatif ou de CSS n'est inclus dans ce lot.

## 1. État de référence après les trois premières migrations

Les trois surfaces suivantes utilisent désormais `KrewPageShell` et ont une preuve avant/après dédiée avec `threshold: 0` et `maxDiffPixels: 0` sur 390×844, 834×1112 et 1440×1000 :

- TripHub ;
- Mes voyages ;
- Nouveau voyage.

Le système de shell actuellement disponible est :

```ts
KrewPageShellSize = "form" | "standard" | "wide" | "site";
KrewPageShellGutter = "default" | "compact" | "form" | "wide";
```

Les largeurs de compatibilité sont :

- `form` : 820 px ;
- `standard` : 1024 px ;
- `wide` : 1180 px ;
- `site` : 1280 px.

Le gutter `default` correspond à 20 → 28 → 32 px. Le gutter `form` vaut 16 → 24 → 32 px, `wide` vaut 16 → 24 → 40 px et `compact` reste à 16 px.

## 2. Couverture de test : distinction importante

`tests/e2e/journey-visual-audit.spec.ts` couvre les chapitres Journey aux sept viewports contractuels :

- 320×568 ;
- 390×844 ;
- 844×390 ;
- 834×1112 ;
- 1112×834 ;
- 1440×1000 ;
- 1728×1100.

Il contrôle l'overflow horizontal et produit des captures aux trois viewports de référence, mais ce test **n'est pas une preuve avant/après pixel-à-pixel**. Il ne compare pas le rendu courant à une baseline avec `maxDiffPixels: 0`.

`tests/e2e/design-system-migration-visual.spec.ts` est actuellement le seul gate zéro-diff. Il ne contient que TripHub, Mes voyages et Nouveau voyage.

Conséquence : Packing, Dates et Profile sont déjà sur `KrewPageShell`, mais restent **non prouvées pixel-perfect** au sens du contrat appliqué aux trois migrations officielles.

Le mismatch connu dans le harnais Journey reste hors périmètre de cet audit : le test cherche `Envies & ambiance` alors que la page Questionnaire rend `Envies et ambiance`.

## 3. Matrice vérifiée des 15 surfaces restantes

| Surface | État normal actuel | Loading / error / empty / locked | Problème d'architecture | Propriétaire cible | Risque |
| --- | --- | --- | --- | --- | --- |
| **Packing** | `KrewPageShell size="standard"`, `space-y-8 py-8 sm:py-10` | Loading/error via `KrewJourneyAsyncState` en `standard`; état vide/contenu et historique restent dans le shell | Migration déjà présente mais aucune preuve zéro-diff dédiée | `TripPackingPage` + `KrewPageShell standard` | Moyen |
| **Dates** | `KrewPageShell size="standard"`, même rythme | Loading/error via shell `standard`; fenêtres vides, dates verrouillées et états admin restent dans le shell | Déjà migré sans gate avant/après dédié | `TripDatesPage` + shell `standard` | Moyen |
| **Profile** | `KrewPageShell data-krew-profile-page size="standard"` | Loading/error via shell `standard`; aucun concept / profil validé dans le shell | Déjà migré sans preuve zéro-diff dédiée | `TripProfilePage` + shell `standard` | Moyen |
| **Tasks** | `<main ... max-w-5xl space-y-8 px-5 py-8 sm:px-7 sm:py-10 lg:px-8>` | Loading/error déjà via `KrewJourneyAsyncState` standard; états sans planning / sans tâches dans le main legacy | Normal encore reconnu par utilitaires alors que géométrie = shell `standard` exact | `TripTasksPage` + shell `standard` | Moyen |
| **Planning** | Même main legacy 1024 / 20→28→32 | Loading/error déjà standard; planning vide/génération dans le main legacy | Surface scindée : `PlanningMapSection` est rendu comme **sibling** par `TripLayout`, hors du main de `TripPlanningPage` | `TripPlanningPage` + ownership explicite de `PlanningMapSection` | Élevé |
| **Transport** | Même main legacy 1024 / 20→28→32 | Loading/error standard; sans ville / sans trajets dans le main legacy | Normal non sémantique malgré une géométrie déjà exacte | `TripTransportPage` + shell `standard` | Moyen à élevé |
| **Destination** | Même main legacy 1024 / 20→28→32 | Loading/error standard; profil locked, aucune proposition, aucun résultat admissible dans le main legacy | Nombreux états produit/images ; shell simple mais surface riche | `TripDestinationPage` + shell `standard` | Élevé |
| **Accommodation** | Même main legacy 1024 / 20→28→32 | Loading/error standard; destination locked, aucun hôtel, rate-limit, réservé dans le main legacy | Surface riche et provider-dependent ; normal encore legacy | `TripAccommodationPage` + shell `standard` | Élevé |
| **Availability** | Raw `max-w-[820px]`, gutters 20→28→32, y 32→40 | Loading/error `max-w-[820px]` sont déjà traduits par `KrewJourneyAsyncState` en shell `form`; états clôturés du parent utilisent encore un main 820 | CSS vivant dépend de largeur + `:has(#availability-notes)` ; aucun hook `[data-krew-availability-page]` émis par la page normale | route Availability + `AvailabilityResponseGate` + hook sémantique | Très élevé |
| **Questionnaire** | Raw `max-w-[820px]`, gutters 20→28→32, y 32→40 | Loading/error legacy 820 déjà mappés vers shell `form`; états clôturés du parent restent mixtes | `krew-preferences.css` dépend de largeur **et** de structure DOM profonde ; normal n'émet pas `[data-krew-preferences-page]` | Questionnaire + `PreferencesResponseGate` + owner sémantique partagé | Très élevé |
| **Star** | Questionnaire Star normal et état « pas de Star » encore raw 820 | `TripStarAccessGate` loading/error + état non-owner sont déjà `size="form"`; child loading/error legacy 820 est mappé vers shell | Surface partiellement migrée, partage le CSS Preferences ; plusieurs couches de gate | `TripStarAccessGate` + route Star + owner Preferences partagé | Très élevé |
| **Invite** | **Surface réellement rendue :** `TripInvitePage`, raw 820, gutters 16→24→24, y 32→40 | Loading/error locaux = raw 820, x16/y40. `CompletedPreparationGate externalStatus` peut ajouter un bloc 1024 au-dessus et son propre loading/error standard | Géométrie d'états mixte 1024/820 ; gutter normal ne correspond à aucun variant existant ; seconde implémentation Invite dupliquée dans la route | `TripInvitePage` + gate parent + owner explicite Invite | Très élevé |
| **Memories** | Raw `max-w-[1020px]`, gutters 16→24→40, y 32→48, custom header | Error même largeur/gutter ; loading est **inline dans la page normale** via `KrewThinkingState`; empty = shell normal sans grille | Pas de shell ni Journey header ; code très dense/minifié ; `localStorage`, Supabase auth/storage/data directement dans la route | owner Memories explicite ; probablement famille 1020 partagée avec Recap | Très élevé |
| **Recap** | Raw `max-w-[1020px]`, gutters 16→24→40, y 32→48, custom hero | Loading/error = 1020, gutters 16→24→40, mais y40 constant ; empty recommendations dans normal | 1020 n'existe pas dans `KrewPageShellSize`; partage sa géométrie avec Memories | primitive 1020 de compatibilité justifiée par Recap+Memories, ou owner explicite commun | Élevé |
| **Account** | Raw `max-w-3xl` = 768 px, gutters 16→24→24, y 32→48 | Pas d'écran loading/error page-wide ; le profil se charge dans la page et les erreurs avatar restent inline | Largeur/gutter uniques sans équivalent exact dans le shell actuel ; ne pas créer un token global sans décision système | owner Account ; shell seulement si une variante 768 est réellement justifiée | Moyen |

## 4. Détail des familles

### 4.1 Packing / Dates / Profile : migrées mais non prouvées

Ces trois pages ont une géométrie normale homogène :

```tsx
<KrewPageShell size="standard" className="space-y-8 py-8 sm:py-10">
```

Leurs états loading/error passent aussi par `KrewJourneyAsyncState`, dont le défaut est désormais `size="standard"`.

Le manque n'est donc pas principalement architectural : c'est un **angle mort de preuve visuelle**. Avant de poursuivre le nettoyage des Journey pages, il est recommandé d'ajouter une comparaison runtime before/after équivalente au gate déjà utilisé pour les trois migrations officielles.

### 4.2 Tasks / Planning / Transport / Destination / Accommodation : même shell legacy

Les cinq pages partagent mot pour mot :

```tsx
<main className="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 sm:px-7 sm:py-10 lg:px-8">
```

Cette géométrie est exactement :

- largeur `standard` = 1024 px ;
- gutter `default` = 20→28→32 px ;
- y = 32→40 px ;
- stack = 32 px.

Aucune normalisation de valeur n'est nécessaire pour leur migration de shell. Le risque vient surtout de la richesse des états et des dépendances de surface, pas de la géométrie elle-même.

Planning est le cas le plus délicat du groupe : `TripLayout` ajoute `PlanningMapSection` **après** `TripPlanningPage`. Un changement de shell limité au composant principal ne suffit donc pas à définir l'owner visuel de toute la page Planning.

### 4.3 Availability / Questionnaire / Star : famille 820 liée

Les états normaux de Availability et Questionnaire sont encore des `<main>` 820 px. Leurs loading/error passent déjà par le pont de compatibilité suivant dans `KrewJourneyAsyncState` :

```ts
maxWidthClassName === "max-w-[820px]" ? "form" : undefined
```

Ce pont masque une migration partielle : les états asynchrones sont sémantiques, mais le rendu normal et certains états de `TripLayout` ne le sont pas encore.

Star est encore plus mixte : `TripStarAccessGate` utilise déjà `KrewPageShell size="form"`, tandis que le questionnaire Star lui-même reste raw 820.

Ces trois surfaces doivent être traitées comme une famille liée à cause des feuilles `krew-availability.css` et `krew-preferences.css` et des gates parent.

### 4.4 Invite : deux implémentations, une seule réellement rendue

`TripLayout` intercepte explicitement `/trips/:tripId/invite` :

```tsx
showInvitePage ? (
  <CompletedPreparationGate tripId={tripId} externalStatus>
    <TripInvitePage tripId={tripId} />
  </CompletedPreparationGate>
) : ...
```

Cela signifie que le composant `InvitePage` encore défini dans `trips.$tripId.invite.tsx` n'est pas rendu via `<Outlet />` dans ce chemin. La route reste utile pour ses métadonnées de route/head, mais son **second corps complet de page est un candidat fort de code mort/dupliqué**.

Aucune suppression ne doit avoir lieu sans preuve dédiée, mais cette duplication doit être résolue avant une migration CSS Invite pour éviter de migrer la mauvaise implémentation.

La surface réellement visible, `TripInvitePage`, possède par ailleurs une courbe de gutter 16→24→24 qui ne correspond exactement à aucun gutter actuel du shell. Utiliser `form` changerait le desktop de 24 à 32 px et violerait le contrat zéro-diff.

### 4.5 Recap / Memories : vraie famille 1020 px

Les deux pages utilisent 1020 px, pas 1024 px, avec gutters 16→24→40. Cette courbe de gutter correspond déjà au gutter `wide`, mais **la largeur n'a pas de rôle sémantique actuel** dans `KrewPageShell`.

Il serait incorrect de les passer silencieusement à `standard` 1024. La répétition sur deux pages justifie en revanche d'étudier une primitive de compatibilité 1020 explicite avant Memories.

Recap doit précéder Memories : son code est plus conventionnel et permet d'établir la géométrie 1020 sans toucher en même temps aux responsabilités photo/storage de Memories.

### 4.6 Memories : risque supérieur au CSS seul

Memories diverge de plusieurs manières :

- source très dense, avec de grandes portions compactées sur une ligne ;
- absence de `KrewPageShell` ;
- absence de `KrewJourneyPageHeader` ;
- custom hero basé sur `KrewOrganicBlob`, `KrewIcon`, `KrewMark`, `KrewNote` ;
- lecture directe de `localStorage` (`krew_photo_permission`) ;
- `supabase.auth.getUser()` directement dans le composant ;
- requêtes Supabase, signed URLs, storage upload/delete et likes directement depuis la route ;
- loading rendu **dans le corps de la page** plutôt qu'en shell alternatif.

La migration de shell elle-même peut rester visuellement simple, mais le risque de toucher accidentellement à un flux fonctionnel est supérieur. Memories doit rester la dernière des quinze surfaces.

### 4.7 Account : ne pas sur-tokeniser

Account est une page de 768 px avec gutter 16→24→24. Ce couple n'est partagé par aucune famille identifiée dans cet audit.

Selon le contrat initial, une dimension intrinsèque ou un cas unique ne doit pas devenir un token global uniquement pour éliminer une valeur arbitraire. Account doit donc être audité pixel-first ; un owner local explicite peut être préférable à l'ajout immédiat d'un nouveau rôle de shell.

## 5. Sélecteurs CSS fragiles et morts vérifiés

### 5.1 `krew-preferences.css` — fallback largeur encore vivant

Toutes les règles reposent sur :

```css
:is([data-krew-preferences-page], main[class*="max-w-[820px]"])
```

Le fallback 820 est **encore vivant** pour Questionnaire et Star normaux. Le hook sémantique est déjà vivant sur `TripStarAccessGate`, mais pas sur le Questionnaire normal.

Les règles dépendent aussi d'une structure DOM profonde :

```css
> :is([data-krew-journey-header], [data-krew-journey-status]) + div > section ...
```

Le fallback ne peut être retiré qu'après migration pixel-perfect de Questionnaire **et** Star, et après preuve que le hook sémantique reproduit la même cascade.

### 5.2 `krew-availability.css` — branche sémantique non utilisée, fallback vivant

Le sélecteur principal est :

```css
:is(
  [data-krew-availability-page],
  main[class*="max-w-[820px]"]:has(#availability-notes)
)
```

Constat :

- `#availability-notes` existe réellement dans la page Availability ;
- le fallback largeur+`:has()` est donc **vivant** ;
- aucune émission réelle de `[data-krew-availability-page]` n'a été trouvée dans la page actuelle : cette branche sémantique est **préparée mais actuellement non utilisée**.

La migration doit d'abord rendre ce hook réel et prouver le zéro-diff avant suppression du fallback.

### 5.3 `styles.css` — bloc New Trip confirmé mort

Le bloc :

```css
/* New-trip form: breathing rhythm only. */
main[class*="max-w-[820px]"] > form[class*="pt-2"] > div[class*="border-b"] ...
```

est mort : Nouveau voyage utilise désormais `KrewPageShell`, et même avant sa migration sa structure courante n'était déjà plus `form.pt-2 > div.border-b`.

Il peut être supprimé dans un **lot de cleanup distinct**, pas pendant une migration de page.

### 5.4 `krew-page-compat.css` — règle H1 + SVG morte

La règle :

```css
main[...] h1 + svg[class*="underline"] { ... }
```

ne correspond plus au marquage généré par `KrewMark` : le type `underline` / `underline-wave` n'est pas injecté comme classe CSS de l'élément SVG. Aucun caller actuel correspondant n'a été trouvé.

Cette règle est donc **morte**.

### 5.5 `krew-page-compat.css` — overflow : branches encore mixtes

Le bloc d'overflow basé sur les anciennes largeurs contient plusieurs branches :

- `max-w-[820px]` : **vivante** — Availability, Questionnaire, Star, Invite ;
- `max-w-[1020px]` : **vivante** — Recap, Memories ;
- `main.max-w-5xl` : **vivante** — cinq pages Journey legacy et certains états partagés ;
- `max-w-[1180px]` : **morte** après la migration Mes voyages.

Il faut donc nettoyer ce bloc branche par branche, jamais en suppression globale.

### 5.6 Sélecteurs Mes voyages 1180 résiduels — morts après #370

Des sélecteurs basés sur `main[class*="max-w-[1180px]"]` subsistent encore dans `styles.css` et `krew-mobile-review.css`.

Ils sont désormais morts car Mes voyages déclare son owner via `data-krew-page-surface="mes-voyages"` et n'utilise plus cette largeur en classe. Les comportements correspondants ont déjà des équivalents sémantiques dans `krew-mes-voyages.css`, notamment la cascade polaroid et la vague des H2.

Ils doivent être retirés dans le lot de cleanup legacy après les migrations de familles, avec un gate visuel pour Mes voyages.

## 6. Autres dettes détectées mais hors périmètre CSS

`trip: any` et des castings `as any` restent massifs dans plusieurs pages, notamment `TripTasksPage` et `TripPackingPage`.

C'est une dette TypeScript réelle, mais elle ne doit pas être mélangée à la migration de shell zéro-diff. Elle doit être suivie séparément pour ne pas élargir le risque des PR CSS.

## 7. Ordre de migration recommandé

L'ordre suivant cherche à réduire progressivement le risque et à supprimer les fallbacks uniquement lorsqu'ils n'ont plus d'utilisateur réel.

### Étape A — fermer l'angle mort de preuve, sans migration visuelle

1. **Packing** — ajouter un gate zéro-diff dédié à l'état déjà migré.
2. **Dates** — même preuve, avec états locked / windows empty.
3. **Profile** — même preuve, avec profil vide / validé / locked.

Ces trois étapes doivent idéalement être des lots de preuve très petits : le shell est déjà présent.

### Étape B — famille Journey 1024 exacte

4. **Tasks** — géométrie simple et exactement compatible avec `standard/default`.
5. **Transport** — même géométrie ; valider empty/search/selected states.
6. **Destination** — même shell mais davantage d'états/cards/images.
7. **Accommodation** — même shell, provider states et sélection/réservation.
8. **Planning** — en dernier du groupe car `PlanningMapSection` vit comme sibling hors du main principal.

Après cette étape, les usages réellement rendus de `main.max-w-5xl` doivent être réinventoriés avant tout retrait de la branche correspondante dans `krew-page-compat.css`.

### Étape C — famille 820 Questionnaire

9. **Availability** — rendre `[data-krew-availability-page]` réel, migrer page + gates, conserver le fallback jusqu'à preuve zéro-diff.
10. **Questionnaire** — owner sémantique Preferences sur page + gate, sans toucher au mismatch de texte hors scope.
11. **Star** — finir la migration du questionnaire Star et du no-Star state ; seulement après #10 et #11 réévaluer la suppression de `main[class*="max-w-[820px]"]` dans `krew-preferences.css`.

Cette séquence évite de casser Star en nettoyant trop tôt le fallback Questionnaire partagé.

### Étape D — Invite isolée

12. **Invite** — d'abord trancher l'implémentation dupliquée, puis migrer uniquement `TripInvitePage` réellement rendu et son `CompletedPreparationGate`. Le gutter 16→24→24 doit être préservé exactement ou rester local ; il ne faut pas utiliser `form` silencieusement.

### Étape E — surfaces indépendantes et 1020

13. **Account** — surface relativement simple mais largeur unique 768 ; décision explicite avant création éventuelle d'un token.
14. **Recap** — établir le rôle 1020 / 16→24→40 avec preuve pixel.
15. **Memories** — dernier lot, réutilisant si possible la primitive 1020 validée par Recap, sans refactor fonctionnel du stockage/photo dans le même changement.

## 8. Cleanup legacy après les quinze surfaces

Une fois les familles prouvées :

1. supprimer le bloc New Trip mort dans `styles.css` ;
2. supprimer la règle H1+SVG morte de `krew-page-compat.css` ;
3. supprimer les branches 1180 mortes (`styles.css`, `krew-mobile-review.css`, `krew-page-compat.css`) ;
4. retirer le fallback Availability seulement après migration et preuve ;
5. retirer le fallback Preferences seulement après Questionnaire + Star ;
6. retirer les branches `max-w-5xl` et 1020 du compat uniquement lorsqu'aucune surface réelle n'en dépend ;
7. investiguer puis retirer le corps dupliqué de la route Invite si son caractère non rendu est confirmé par test/route behavior ;
8. refaire un inventaire de `styles.css` avant toute suppression de fichier historique.

Chaque suppression reste soumise au contrat de `docs/css-migration-baseline.md` : morte, reproduite explicitement, contradictoire avec une décision plus récente, ou doublon sans effet supplémentaire.

## 9. Résumé exécutif

Après #369/#370/#371 :

- 3 surfaces sont migrées **et** prouvées pixel-perfect : TripHub, Mes voyages, Nouveau voyage ;
- 3 surfaces sont déjà migrées vers le shell mais sans preuve zéro-diff : Packing, Dates, Profile ;
- 5 surfaces Journey utilisent encore le même main 1024 legacy, exactement compatible avec `standard/default` ;
- Availability / Questionnaire / Star forment une famille 820 partiellement migrée et couplée par CSS ;
- Invite est un cas à haut risque à cause de sa géométrie mixte et de deux implémentations concurrentes ;
- Recap / Memories forment une vraie famille 1020 qui ne doit pas être normalisée silencieusement vers 1024 ;
- Account reste un cas unique 768 ;
- plusieurs sélecteurs legacy sont désormais prouvés morts, mais doivent être retirés seulement dans un cleanup séparé ;
- le mismatch `Envies & ambiance` / `Envies et ambiance` reste le seul défaut de harnais explicitement connu et n'est pas traité ici.

Aucune migration de page n'est incluse dans ce document.