# Booking RapidAPI integration

This folder contains helpers and server endpoints to search Booking destinations and import hotels into the `accommodations` table.

Required environment variables (set these in Lovable / your deploy environment):

- `BOOKING_RAPIDAPI_KEY` - your RapidAPI key (X-RapidAPI-Key)
- `BOOKING_RAPIDAPI_HOST` - booking-com15.p.rapidapi.com
- `SUPABASE_URL` - your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)

Endpoints added (on branch `feature/add-external-search`):

- POST `/api/searchDestination`  { query } -> returns mapped suggestions
- POST `/api/searchHotels`       { destinationId?, destinationName?, pageSize, pageNumber, tripId?, upsert? }
- POST `/api/upsertAccommodations` { hotels, tripId }

How the flow works

1. Client calls `/api/searchDestination` with `query` -> server uses `searchDestination()` wrapper to call RapidAPI and returns an array of suggestion objects.
2. Client selects a suggestion and calls `/api/searchHotels` with `destinationId` or `destinationName`.
3. Server calls `searchHotelsForDestination()` and optionally runs `upsertAccommodationsFromHotels()` to insert results into Supabase.

Testing

- Make sure env vars are set and redeploy. Then test suggestions using `curl`:

  curl -X POST https://<APP_URL>/api/searchDestination -H "Content-Type: application/json" -d '{"query":"man"}'

- To fetch hotels (and optionally upsert):

  curl -X POST https://<APP_URL>/api/searchHotels -H "Content-Type: application/json" -d '{"destinationId":"929","pageSize":10,"tripId":"<TRIP_ID>","upsert":true}'

Notes

- The mapping in `upsertAccommodationsFromHotels` tries several common fields returned by Booking-like providers. If you see missing fields in Supabase, send a sample of the hotel JSON and we will refine the mapper.
