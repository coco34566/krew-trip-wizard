import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";

export type CitySelection = {
  /** Nom normalisé de la ville (ex. "Lyon") */
  city: string;
  /** Code postal principal si connu */
  postalCode?: string;
  /** Identifiant fournisseur stable */
  code?: string;
  /** Aéroport principal auto (IATA) si mappé */
  airportIata?: string;
  /** Libellé aéroport / gare pour affichage */
  airportLabel?: string;
};

/** Principales villes FR → aéroport IATA le plus utile pour les API vols */
const CITY_AIRPORT: Record<string, { iata: string; label: string }> = {
  paris: { iata: "CDG", label: "Paris Charles de Gaulle (CDG)" },
  lyon: { iata: "LYS", label: "Lyon Saint-Exupéry (LYS)" },
  marseille: { iata: "MRS", label: "Marseille Provence (MRS)" },
  nice: { iata: "NCE", label: "Nice Côte d'Azur (NCE)" },
  toulouse: { iata: "TLS", label: "Toulouse Blagnac (TLS)" },
  bordeaux: { iata: "BOD", label: "Bordeaux Mérignac (BOD)" },
  nantes: { iata: "NTE", label: "Nantes Atlantique (NTE)" },
  lille: { iata: "LIL", label: "Lille Lesquin (LIL)" },
  strasbourg: { iata: "SXB", label: "Strasbourg (SXB)" },
  montpellier: { iata: "MPL", label: "Montpellier Méditerranée (MPL)" },
  rennes: { iata: "RNS", label: "Rennes Saint-Jacques (RNS)" },
  "clermont-ferrand": { iata: "CFE", label: "Clermont-Ferrand (CFE)" },
  biarritz: { iata: "BIQ", label: "Biarritz (BIQ)" },
  ajaccio: { iata: "AJA", label: "Ajaccio (AJA)" },
  bastia: { iata: "BIA", label: "Bastia (BIA)" },
  brest: { iata: "BES", label: "Brest Bretagne (BES)" },
  pau: { iata: "PUF", label: "Pau Pyrénées (PUF)" },
  perpignan: { iata: "PGF", label: "Perpignan (PGF)" },
  grenoble: { iata: "GNB", label: "Grenoble (GNB)" },
  "aix-en-provence": { iata: "MRS", label: "Marseille Provence (MRS)" },
  versailles: { iata: "CDG", label: "Paris Charles de Gaulle (CDG)" },
  boulogne: { iata: "CDG", label: "Paris Charles de Gaulle (CDG)" },
  "saint-etienne": { iata: "LYS", label: "Lyon Saint-Exupéry (LYS)" },
  "saint-étienne": { iata: "LYS", label: "Lyon Saint-Exupéry (LYS)" },
};

function airportForCity(cityName: string) {
  const key = cityName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
  if (CITY_AIRPORT[key]) return CITY_AIRPORT[key];
  for (const [k, v] of Object.entries(CITY_AIRPORT)) {
    if (key.startsWith(k) || k.startsWith(key)) return v;
  }
  return null;
}

type GeoCommune = {
  nom: string;
  code: string;
  codesPostaux?: string[];
  population?: number;
  pays?: string;
  latitude?: string;
  longitude?: string;
};

export function dedupeCitySuggestions(items: GeoCommune[]): GeoCommune[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const city = item.nom.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
    const country = (item.pays ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
    const latitude = item.latitude ? Number(item.latitude).toFixed(4) : "";
    const longitude = item.longitude ? Number(item.longitude).toFixed(4) : "";
    const geoKey = latitude && longitude ? `${latitude}:${longitude}` : "";
    const key = geoKey ? `${city}|${country}|${geoKey}` : `${city}|${country}|${item.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type Props = {
  id?: string;
  value: string;
  onChange: (cityName: string) => void;
  /** Appelé quand une ville est choisie (avec aéroport auto si dispo) */
  onSelect?: (sel: CitySelection) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Autocomplete villes Européennes via OpenStreetMap Nominatim
 * - saisie code postal ou nom de ville → suggestions
 * - sélection → ville normalisée + aéroport IATA auto si connu
 */
export function CityAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  placeholder = "Ville ou code postal (Europe)",
  className,
}: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<GeoCommune[]>([]);
  const [, setAirportHint] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
    const ap = airportForCity(value);
    setAirportHint(ap ? ap.label : null);
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=8&accept-language=fr`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "KrewGroupTripPlanner/1.0",
          },
        });
        if (!res.ok) throw new Error("OSM Nominatim API error");
        const data = await res.json();

        const mapped: GeoCommune[] = data
          .map((item: any) => {
            const address = item.address || {};
            const city =
              address.city ||
              address.town ||
              address.village ||
              address.municipality ||
              item.display_name.split(",")[0];
            const postcode = address.postcode || "";
            const country = address.country || "";
            return {
              nom: city,
              code: String(item.place_id),
              codesPostaux: postcode ? [postcode] : [],
              pays: country,
              latitude: item.lat ? String(item.lat) : undefined,
              longitude: item.lon ? String(item.lon) : undefined,
            };
          })
          .filter((item: GeoCommune) => item.nom);

        setItems(dedupeCitySuggestions(mapped));
        setOpen(true);
      } catch (err) {
        console.error("OSM Error", err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  function pick(c: GeoCommune) {
    const city = c.nom;
    const postal = c.codesPostaux?.[0];
    const ap = airportForCity(city);
    setQuery(city);
    onChange(city);
    setAirportHint(ap ? ap.label : null);
    setOpen(false);

    const selection: CitySelection = { city };
    if (postal !== undefined) selection.postalCode = postal;
    if (c.code !== undefined) selection.code = c.code;
    if (ap?.iata !== undefined) selection.airportIata = ap.iata;
    if (ap?.label !== undefined) selection.airportLabel = ap.label;

    onSelect?.(selection);
  }

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div className="relative">
        <KrewIcon name="map" tone="muted" size="sm" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          id={id}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
          }}
          onFocus={() => items.length && setOpen(true)}
          placeholder={placeholder}
          className="pl-9"
          autoComplete="off"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {open && items.length > 0 ? (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-card py-1 shadow-lg">
          {items.map((c) => (
            <li key={`${c.code}-${c.latitude ?? ""}-${c.longitude ?? ""}`}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-primary/10"
                onClick={() => pick(c)}
              >
                <span className="font-medium">{c.nom}</span>
                <span className="text-xs text-muted-foreground">
                  {c.codesPostaux?.[0] ? `${c.codesPostaux[0]} · ` : ""}
                  {c.pays ?? ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}