# Checklist Lovable / ops — Krew

Repo : `coco34566/krew-trip-wizard`  
Cible : Lovable Cloud + Supabase (schéma hébergé côté Lovable).

Objectif : finaliser la mise en prod de ce qui est déjà sur `main` mais dépend encore de **secrets**, **migrations SQL**, **redeploy** et **tests manuels**. Ne pas réécrire le code déjà poussé — appliquer la config et vérifier.

---

## 1. Secrets Lovable

### Supabase

| Secret | Rôle |
|--------|------|
| `SUPABASE_URL` | API Supabase |
| `SUPABASE_PUBLISHABLE_KEY` (ou anon) | Client auth / RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Critique** : `/join`, previews, opérations admin |

### Travel APIs (RapidAPI)

| Secret | Rôle |
|--------|------|
| `HOTELS_RAPIDAPI_KEY` | Clé unique partagée (Booking, Hotels.com, Expedia, TripAdvisor, Kayak, Kiwi, etc.) |

Hosts utilisés dans le code (override optionnel via secrets si besoin) :

- `booking-com15.p.rapidapi.com`
- `hotels-com6.p.rapidapi.com`
- `expedia13.p.rapidapi.com`
- `tripadvisor16.p.rapidapi.com`
- `kayak-search.p.rapidapi.com`
- `kiwi-com-cheap-flights.p.rapidapi.com`
- `openmeteo-weather-api.p.rapidapi.com` (si utilisé)

### LLM rationales (optionnel)

Sans clé → fallback texte template du moteur (0 token).

| Secret | Usage |
|--------|--------|
| `OPENAI_API_KEY` **ou** `GROQ_API_KEY` **ou** `XAI_API_KEY` | 1 appel groupé pour les 3 rationales |
| `LLM_RATIONALE_MODEL` | Optionnel (défaut `gpt-4o-mini` / modèle Groq / Grok) |
| `LLM_RATIONALE_BASE_URL` | Optionnel |

---

## 2. Migrations SQL

Exécuter dans l’éditeur SQL Supabase / Lovable Cloud **si pas déjà appliquées**, dans l’ordre :

| Fichier | Contenu |
|---------|---------|
| `supabase/migrations/20260807120000_trip_share_join.sql` | Policies share / join `/join/{tripId}` |
| `supabase/migrations/20260807140000_price_watch.sql` | Table `price_watch` + RLS (« Suivre ce prix ») |
| `supabase/migrations/20260807150000_deal_breaker_ambiances.sql` | `deal_breaker_ambiances` |
| `supabase/migrations/20260807160000_participant_api_fields.sql` | Aéroport/gare, modes transport, durée trajet, PMR, blackout dates, etc. |
| `supabase/migrations/20260807170000_scoring_feedback_weights.sql` | `scoring_feedback` + `scoring_weights` + seeds event_type |

Sans ces migrations : join, suivi de prix, deal-breakers, nouveaux champs questionnaire et feedback scoring peuvent casser.

---

## 3. Deploy

1. Sync / pull `main` depuis GitHub  
2. **Publish / Redeploy** Lovable  
3. Hard refresh navigateur  

---

## 4. Contenu légal (manuel)

Pages :

- `/mentions-legales`
- `/cgu`
- `/confidentialite`

Remplacer les placeholders `[À compléter]` : raison sociale, forme juridique, SIREN, siège, directeur de publication, emails `contact@` et `privacy@`.

---

## 5. Tests smoke

```text
□ Créer un voyage (participants ≤ 25, presets budget / distance OK)
□ Lien /join/{tripId} : un 2e compte rejoint
□ Questionnaire participant :
    - villes de départ différentes
    - deal-breakers ambiance
    - veto budget
    - aéroport/gare, modes transport, durée trajet max, PMR, blackout dates
□ Bandeau « qualité des données » (organisateur) : réponses / vetos / exclusions
□ Génération bloquée si < 2 réponses ou < ~40 % des attendus ; OK après seuil
□ Badges propositions : « Plaît à X/Y », « Dans le budget de X/Y »
□ Récap groupe : Flights / Kayak / train (< 700 km) / Booking par origine
□ Suivre ce prix → rappel dashboard + date de dernière vérif.
□ Valider une destination → répartition multi-origines + copie WhatsApp / image
□ Clé LLM présente → rationales reformulées ; sinon texte moteur
□ Footer : Mentions légales · CGU · Confidentialité
```

---

## 6. Hors Lovable (rappel)

- Abonnements RapidAPI actifs + quota  
- Job de recalibrage des poids (quand assez de votes) :

```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx src/jobs/recalibrate-scoring-weights.ts
```

---

## Priorité absolue

1. `SUPABASE_SERVICE_ROLE_KEY`  
2. Migrations SQL manquantes  
3. Redeploy  
4. `HOTELS_RAPIDAPI_KEY`  
5. Tests smoke  
6. Clé LLM (si rationales IA souhaitées)  

---

## Rapport attendu (après passage)

- Secrets : OK / KO  
- Migrations : appliquées / manquantes  
- Résultat de chaque test smoke  
