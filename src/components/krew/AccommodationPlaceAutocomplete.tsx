import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { searchAccommodationPlaces } from "@/lib/accommodation-place-search.functions";
import { cn } from "@/lib/utils";

export type AccommodationPlaceSelection = {
  name: string;
  address: string;
  city?: string;
  country?: string;
  latitude: number;
  longitude: number;
  externalId?: string;
};

type NominatimHit = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  category?: string;
  address?: Record<string, string | undefined>;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (selection: AccommodationPlaceSelection) => void;
  placeholder?: string;
  className?: string;
  destinationHint?: string | null;
};

function displayName(hit: NominatimHit) {
  const address = hit.address ?? {};
  return (
    hit.name ||
    address.hotel ||
    address.hostel ||
    address.guest_house ||
    address.apartments ||
    address.house ||
    address.building ||
    hit.display_name.split(",")[0] ||
    "Hébergement"
  );
}

function cityName(hit: NominatimHit) {
  const address = hit.address ?? {};
  return address.city || address.town || address.village || address.municipality || address.county || undefined;
}

function isUsefulPlace(hit: NominatimHit) {
  const category = String(hit.category ?? "").toLowerCase();
  const type = String(hit.type ?? "").toLowerCase();
  if (category === "tourism" || category === "building" || category === "place") return true;
  return ["hotel", "hostel", "guest_house", "apartment", "apartments", "house", "residential", "building"].some(
    (token) => type.includes(token),
  );
}

export function AccommodationPlaceAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Rechercher un hôtel, une maison ou une adresse…",
  className,
  destinationHint,
}: Props) {
  const searchPlaces = useServerFn(searchAccommodationPlaces);
  const [query, setQuery] = useState(value);
  const [items, setItems] = useState<NominatimHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const skipNextSearchRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      setItems([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setItems([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const payload = (await searchPlaces({
          data: { query: trimmed, destinationHint: destinationHint || null },
        })) as NominatimHit[];
        if (requestId !== requestIdRef.current) return;

        const useful = payload.filter((hit) => Number.isFinite(Number(hit.lat)) && Number.isFinite(Number(hit.lon)));
        const preferred = useful.filter(isUsefulPlace);
        setItems((preferred.length ? preferred : useful).slice(0, 8));
        setOpen(true);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Accommodation autocomplete error", error);
        setItems([]);
        setOpen(false);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [query, destinationHint, searchPlaces]);

  function pick(hit: NominatimHit) {
    const name = displayName(hit);
    const address = hit.display_name;
    const selection: AccommodationPlaceSelection = {
      name,
      address,
      city: cityName(hit),
      country: hit.address?.country,
      latitude: Number(hit.lat),
      longitude: Number(hit.lon),
      externalId: String(hit.place_id),
    };

    skipNextSearchRef.current = true;
    requestIdRef.current += 1;
    setItems([]);
    setOpen(false);
    setQuery(name);
    onChange(name);
    onSelect(selection);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <KrewIcon name="accommodation" tone="muted" size="sm" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange(event.target.value);
          }}
          onFocus={() => items.length && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="pl-9"
        />
        {loading ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
      </div>

      {open && items.length > 0 ? (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-card py-1 text-left shadow-lg">
          {items.map((hit) => {
            const name = displayName(hit);
            const city = cityName(hit);
            return (
              <li key={hit.place_id}>
                <button
                  type="button"
                  onClick={() => pick(hit)}
                  className="w-full px-3 py-2 text-left hover:bg-primary/10"
                >
                  <span className="block text-sm font-medium text-foreground">{name}</span>
                  <span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                    {[city, hit.address?.country].filter(Boolean).join(" · ") || hit.display_name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
