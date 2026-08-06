# External search integration (Hotels.com via RapidAPI)

This document explains how the Hotels.com RapidAPI provider integration works and how to test it.

Environment variables
- HOTELS_RAPIDAPI_KEY: your RapidAPI key (secret)
- HOTELS_RAPIDAPI_HOST: the RapidAPI host (e.g. hotels4.p.rapidapi.com). Default is hotels4.p.rapidapi.com

Server-side function
- src/lib/external/search-hotels.functions.ts
  - Aggregates participant preferences for a trip
  - Calls the RapidAPI hotels provider
  - Maps & upserts accommodations into the `accommodations` table

Provider wrapper
- src/integrations/external/hotels.rapidapi.ts
  - Minimal wrapper around the RapidAPI endpoint `properties/list`.
  - The response shape varies by RapidAPI product; the mapper in the server function is defensive.

Local test
- Set the env vars (HOTELS_RAPIDAPI_KEY and optionally HOTELS_RAPIDAPI_HOST)
- Run: node --loader ts-node/esm scripts/search-sample.ts (or compile and run)

How to use in the app
- On a trip page (owner only) click: "Rechercher hébergements & activités". That will call the server function and upsert accommodations, then you can run "Regénérer" to include the new accommodations into proposals.

Notes & next steps
- The provider mapping is intentionally permissive: please test with real RapidAPI responses and provide sample payloads if fields are missing or mapping needs tuning.
- Add caching / rate-limiting if you expect many requests.
