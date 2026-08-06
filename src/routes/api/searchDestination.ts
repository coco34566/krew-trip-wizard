import { searchDestination } from '../../integrations/external/booking.rapidapi';

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const query = (body && body.query) || '';
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const payload = await searchDestination(query.trim());
    const items = (payload && payload.data) || [];

    const mapped = (items || []).map((d: any) => ({
      id: d.dest_id,
      label: d.label || d.name,
      name: d.name,
      type: d.dest_type || d.search_type || d.type,
      country: d.country,
      cc: d.cc1,
      lat: d.latitude,
      lon: d.longitude,
      nr_hotels: d.nr_hotels || d.hotels,
      image: d.image_url,
      raw: d,
    }));

    return new Response(JSON.stringify(mapped), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    const message = err?.message || String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
