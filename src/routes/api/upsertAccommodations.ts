import { upsertAccommodationsFromHotels } from '../../integrations/external/booking.rapidapi';

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const { hotels, tripId } = body || {};
    if (!Array.isArray(hotels) || hotels.length === 0) {
      return new Response(JSON.stringify({ error: 'hotels array required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (!tripId) {
      return new Response(JSON.stringify({ error: 'tripId required for upsert' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await upsertAccommodationsFromHotels(hotels, tripId);
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    const message = err?.message || String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
