# Données externes : destinations, météo, saisonnalité et prix comparés

## Sources

| Donnée | Source | Clé requise |
| --- | --- | --- |
| Géocodage (coordonnées, pays) | Open-Meteo Geocoding | non |
| Météo prévisionnelle (J+15) | Open-Meteo Forecast | non |
| Saisonnalité (normales mensuelles 3 ans, meilleurs mois) | Open-Meteo Archive/ERA5 | non |
| Hôtels Hotels.com / Expedia | RapidAPI `hotels4` | `HOTELS_RAPIDAPI_KEY` |
| Hôtels Booking.com | RapidAPI `booking-com15` | idem |
| Hôtels Kayak | RapidAPI `kayak-hotel-search` | idem |
| Hôtels + attractions TripAdvisor | RapidAPI `tripadvisor16` | idem |
| Activités Klook | RapidAPI `klook-api` | idem |

## Variables d'environnement

- `HOTELS_RAPIDAPI_KEY` — clé RapidAPI partagée par tous les connecteurs.
- `HOTELS_RAPIDAPI_HOST`, `BOOKING_RAPIDAPI_HOST`, `KAYAK_RAPIDAPI_HOST`,
  `TRIPADVISOR_RAPIDAPI_HOST`, `KLOOK_RAPIDAPI_HOST` — hosts optionnels si vous
  utilisez d'autres produits RapidAPI équivalents.

Chaque source est indépendante : celles auxquelles le compte RapidAPI n'est pas
abonné renvoient une erreur qui est collectée dans `providerErrors` sans bloquer
les autres.

## Code

- `src/integrations/external/geo-weather.server.ts` — géocodage, climat, distance depuis Paris.
- `src/integrations/external/travel-providers.server.ts` — connecteurs hôtels/activités + fusion et comparaison de prix par établissement.
- `src/lib/external/search-hotels.functions.ts` — server function `searchExternalForTrip` : lit le voyage sous RLS, appelle les sources, puis upsert dans `destinations` / `accommodations` / `activities` (clé `source` + `external_id`).

## Stockage des prix comparés

`accommodations.price_offers` (jsonb) contient la liste `{ provider, pricePerNight, currency, url }`
triée du moins cher au plus cher ; `best_provider` et `booking_url` pointent la meilleure offre.
`activities.booking_url` renvoie vers la fiche Klook/TripAdvisor.
`destinations.climate` stocke les normales mensuelles et la prévision météo.

## Utilisation

Sur la page d'un voyage (propriétaire) : « Rechercher hébergements & activités »,
puis « Regénérer » pour intégrer les nouvelles données au scoring.
