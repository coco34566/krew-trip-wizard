# Test utilisateur manuel — fin de voyage

Ce scénario est volontairement **manuel uniquement** : ne jamais l’ajouter à `test:ci` ni à un workflow `push` / `pull_request`.

## Fixture dédiée

Utiliser exclusivement un voyage E2E terminé : dates verrouillées, `end_date` dans le passé, destination validée, transport/planning/tâches déjà présents. Le scénario recommandé contient 5 personnes : organisateur, co-organisateur et 3 participants.

Variables :

- `KREW_COMPLETED_TRIP_URL` : URL du voyage test côté organisateur ;
- `KREW_COMPLETED_TRIP_NAME` : nom exact affiché dans Mes voyages (défaut `E2E — Retour de voyage`) ;
- `KREW_E2E_EMAIL` / `KREW_E2E_PASSWORD` : compte organisateur E2E ;
- `KREW_COMPLETED_TRIP_PARTICIPANT_URL` : URL côté participant, optionnelle si identique ;
- `KREW_COMPLETED_TRIP_PARTICIPANT_EMAIL` / `KREW_COMPLETED_TRIP_PARTICIPANT_PASSWORD` : compte participant E2E.

## Parcours organisateur

Contexte : « Ton week-end vient de se terminer. Tu rouvres KREW pour voir ce qu’il reste et retrouver les informations du voyage. »

Vérifier : état `Voyage terminé`, absence de CTA de préparation, Planning/Tâches/À emporter en consultation, récap/souvenirs accessibles, archivage visible, voyage présent dans `Voyages archivés`, puis réactivation sans retour à un état de préparation.

## Parcours participant

Contexte : « Tu rentres du week-end et tu veux retrouver les infos et souvenirs du voyage. »

Vérifier : état terminé clair, aucune action organisateur, aucune demande de disponibilités/préférences, aucun CTA d’invitation/génération/réattribution.

## Exécution

Priorité mobile Safari :

```bash
KREW_COMPLETED_TRIP_URL="https://.../trips/<test-trip-id>" \
KREW_COMPLETED_TRIP_NAME="E2E — Retour de voyage" \
KREW_E2E_EMAIL="..." KREW_E2E_PASSWORD="..." \
KREW_COMPLETED_TRIP_PARTICIPANT_EMAIL="..." \
KREW_COMPLETED_TRIP_PARTICIPANT_PASSWORD="..." \
npx playwright test tests/e2e/manual-completed-trip-user.spec.ts --project=mobile-safari
```

Ce test ne doit utiliser aucune génération live. Le voyage fixture doit être préparé avant l’exécution et nettoyé selon le mécanisme E2E existant.
