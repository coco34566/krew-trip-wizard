import { searchHotelsForDestination, upsertAccommodationsFromHotels } from '../../integrations/external/booking.rapidapi';

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const {
      destinationId,
      destinationName,
      checkin,
      checkout,
      adults = 2,
      pageSize = 25,
      pageNumber = 1,
      tripId = null,
      upsert = true,
    } = body || {};

    if (!destinationId && !destinationName) {
      return new Response(JSON.stringify({ error: 'destinationId or destinationName required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const hotels = await searchHotelsForDestination({
      destinationId,
      destinationName,
      checkin,
      checkout,
      adults,
      pageSize,
      pageNumber,
    });

    // Optionally upsert into DB if tripId provided and upsert true
    let upsertResult = null;
    if (upsert && tripId) {
      upsertResult = await upsertAccommodationsFromHotels(hotels, tripId);
    }

    return new Response(JSON.stringify({ count: Array.isArray(hotels) ? hotels.length : 0, hotels, upsert: upsertResult }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    const message = err?.message || String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
