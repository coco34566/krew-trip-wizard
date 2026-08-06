// src/integrations/external/booking.rapidapi.ts
// Wrapper helpers for booking-com15.p.rapidapi.com
// - searchDestination(query): returns destination suggestions
// - searchHotelsForDestination(opts): returns an array of hotel objects from the provider
// - upsertAccommodationsFromHotels(hotels, tripId): maps & upserts into Supabase 'accommodations' table

import { createClient } from '@supabase/supabase-js';

function getEnv(key: string): string {
  return (import.meta.env?.[key] as string) || (process.env?.[key] as string) || '';
}

const HOST = getEnv('BOOKING_RAPIDAPI_HOST') || 'booking-com15.p.rapidapi.com';
const KEY = getEnv('BOOKING_RAPIDAPI_KEY') || '';

const SUPABASE_URL = getEnv('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!KEY) {
  // do not throw at module import time in client bundles; server functions will validate at runtime
}

function makeHeaders(contentType = 'application/json') {
  const headers: Record<string, string> = {
    'x-rapidapi-host': HOST,
    'x-rapidapi-key': KEY,
    Accept: 'application/json',
  };
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

export async function searchDestination(query: string): Promise<any> {
  if (!KEY) throw new Error('Missing BOOKING_RAPIDAPI_KEY');
  const url = `https://${HOST}/api/v1/hotels/searchDestination?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: makeHeaders(),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Booking searchDestination failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export type SearchHotelsOpts = {
  // prefer destinationName or destinationId depending on the product
  destinationName?: string;
  destinationId?: string | number;
  checkin?: string | null;
  checkout?: string | null;
  adults?: number;
  pageSize?: number;
  pageNumber?: number;
};

export async function searchHotelsForDestination(opts: SearchHotelsOpts): Promise<any[]> {
  if (!KEY) throw new Error('Missing BOOKING_RAPIDAPI_KEY');
  const {
    destinationName,
    destinationId,
    checkin,
    checkout,
    adults = 2,
    pageSize = 25,
    pageNumber = 1,
  } = opts;

  // Many RapidAPI hotel endpoints accept POST /properties/v2/list with a JSON body.
  // We use that as the primary option because Booking-like providers commonly expect POST.
  const url = `https://${HOST}/properties/v2/list`;

  const body: any = {
    currency: 'EUR',
    locale: 'fr_FR',
    // The provider may expect a 'query' or 'destination' structure — include both reasonable fields.
    search: {
      query: destinationName || undefined,
      destinationId: destinationId || undefined,
    },
    checkIn: checkin || undefined,
    checkOut: checkout || undefined,
    adults,
    page: { size: pageSize, current: pageNumber },
  };

  // Remove undefined keys to keep request tidy
  function clean(obj: any) {
    if (!obj || typeof obj !== 'object') return obj;
    const out: any = Array.isArray(obj) ? [] : {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v === undefined) continue;
      out[k] = typeof v === 'object' ? clean(v) : v;
    }
    return out;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: makeHeaders('application/json'),
    body: JSON.stringify(clean(body)),
  });

  // If the provider does not support this endpoint/method, the response may be 404.
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Booking searchHotels failed: ${res.status} ${txt}`);
  }

  const payload = await res.json().catch(() => ({}));
  // Common fields where results may live: payload.results, payload.data, payload.properties, payload.items
  const list = payload.results || payload.data || payload.properties || payload.items || [];
  if (!Array.isArray(list)) return [];
  return list as any[];
}

export async function upsertAccommodationsFromHotels(hotels: any[], tripId?: string | null) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables for upsert');
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (!Array.isArray(hotels) || hotels.length === 0) return { count: 0 };

  // Map provider-specific hotel objects to your accommodations table schema.
  const rows = hotels.map((h) => {
    // Try several common id fields
    const id = String(h.id || h.property_id || h.hotelId || h.hotel_id || h.uid || Math.random().toString(36).slice(2));
    const name = h.name || h.title || h.hotel_name || null;
    const image_url = (h.images && h.images.length && (h.images[0].url || h.images[0])) || h.image || h.photo || null;
    const price = h.price?.amount || h.price || (h.price_breakdown && h.price_breakdown.gross_amount) || null;
    const rating = h.rating || h.review_score || null;
    const distance_center_km = h.distance?.value || (h.distance_to_center && h.distance_to_center.value) || null;

    return {
      id,
      trip_id: tripId || null,
      destination_id: h.destination_id || h.city_id || null,
      name,
      type: 'hotel',
      description: h.description || h.summary || null,
      price_per_night_per_person: price !== null ? Number(price) : null,
      capacity: h.capacity || null,
      rating: rating !== null ? Number(rating) : null,
      distance_center_km: distance_center_km !== null ? Number(distance_center_km) : null,
      image_url,
      updated_at: new Date().toISOString(),
    };
  });

  // Perform upsert. Use onConflict 'id' to replace existing rows with same id.
  const { error, data } = await supabase.from('accommodations').upsert(rows, { onConflict: 'id' });
  if (error) {
    throw error;
  }
  return { count: rows.length, data };
}
