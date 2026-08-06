import React, { useEffect, useState } from 'react';

type Suggestion = {
  id: string;
  label: string;
  name?: string;
  type?: string;
  country?: string;
  cc?: string;
  lat?: number;
  lon?: number;
  nr_hotels?: number;
  image?: string;
  raw?: any;
};

type Props = {
  tripId?: string | null; // optional: if provided, component will upsert hotels into this trip
};

export default function ExampleSearch({ tripId = null }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!query || query.trim().length === 0) {
      setSuggestions([]);
      return;
    }
    const id = setTimeout(() => fetchSuggestions(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  async function fetchSuggestions(q: string) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/searchDestination', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`server ${res.status}: ${txt}`);
      }
      const data = await res.json();
      setSuggestions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('fetchSuggestions error', err);
      setMessage('Impossible de récupérer les suggestions');
    } finally {
      setLoading(false);
    }
  }

  async function onSelect(s: Suggestion) {
    setSelected(s);
    setSuggestions([]);
    setQuery(s.label || s.name || '');
    // fetch hotels for this destination and upsert into DB if tripId provided
    setHotelsLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/searchHotels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationId: s.id, destinationName: s.name, pageSize: 10, tripId: tripId, upsert: !!tripId }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || `server ${res.status}`);
      }

      // If upsert was requested, payload.upsert contains DB result
      if (payload.upsert) {
        setMessage(`${payload.upsert.count} logements importés dans le voyage`);
      } else {
        setMessage(`${payload.count || 0} résultats récupérés`);
      }
    } catch (err: any) {
      console.error('onSelect error', err);
      setMessage('Erreur lors de la récupération des hôtels');
    } finally {
      setHotelsLoading(false);
    }
  }

  return (
    <div className="example-search">
      <label htmlFor="dest-search" className="block text-sm font-medium text-gray-700">Rechercher une destination</label>
      <div className="mt-1 relative">
        <input
          id="dest-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex: Paris, Manhattan..."
          className="w-full rounded-md border px-3 py-2"
        />
        {loading && <div className="absolute right-2 top-2 text-sm">Chargement…</div>}

        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white border rounded shadow max-h-60 overflow-auto">
            {suggestions.map((s) => (
              <li key={s.id} className="p-2 hover:bg-gray-50 cursor-pointer flex gap-2" onClick={() => onSelect(s)}>
                {s.image ? (
                  <img src={s.image} alt={s.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} />
                ) : (
                  <div style={{ width: 48, height: 48, background: '#eee', borderRadius: 8 }} />
                )}
                <div>
                  <div className="font-medium">{s.label}</div>
                  <div className="text-sm text-gray-500">{s.nr_hotels ?? '—'} hébergements</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div className="mt-4 p-3 border rounded">
          <div className="flex items-center gap-3">
            {selected.image && <img src={selected.image} alt={selected.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />}
            <div>
              <div className="font-semibold">{selected.label}</div>
              <div className="text-sm text-gray-500">{selected.country}</div>
            </div>
          </div>
          <div className="mt-3">
            <button onClick={() => onSelect(selected)} disabled={hotelsLoading} className="px-3 py-2 bg-blue-600 text-white rounded">
              {hotelsLoading ? 'Recherche...' : 'Récupérer les hôtels et importer'}
            </button>
          </div>
        </div>
      )}

      {message && <div className="mt-3 text-sm text-green-700">{message}</div>}
    </div>
  );
}
