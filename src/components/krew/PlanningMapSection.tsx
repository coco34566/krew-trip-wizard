import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Home, LocateFixed, MapPin, Minus, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  buildPlanningMapModel,
  formatAirDistance,
  type PlanningMapPoint,
} from "@/lib/krew/planning-map";
import { KrewIcon, KrewMark } from "@/components/krew/visual-language";
import { KrewNote } from "@/components/krew/visual-language/KrewNote";

const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@6.6.0/dist/maplibre-gl.js";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@6.6.0/dist/maplibre-gl.css";
const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

type TripMapPayload = {
  itinerary: { destination?: string; days?: { day?: unknown; slots?: unknown }[] } | null;
  logistics: Record<string, any>;
  selectedLodging: Record<string, any> | null;
};

type Segment = { fromId: string; toId: string };

declare global {
  interface Window {
    maplibregl?: any;
  }
}

let mapLibrePromise: Promise<any> | null = null;

function ensureMapLibre() {
  if (typeof window === "undefined") return Promise.reject(new Error("MapLibre requires the browser"));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (mapLibrePromise) return mapLibrePromise;

  mapLibrePromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${MAPLIBRE_CSS}"]`)) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = MAPLIBRE_CSS;
      document.head.appendChild(css);
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${MAPLIBRE_JS}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.maplibregl), { once: true });
      existing.addEventListener("error", () => reject(new Error("MapLibre failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = MAPLIBRE_JS;
    script.async = true;
    script.onload = () => resolve(window.maplibregl);
    script.onerror = () => reject(new Error("MapLibre failed to load"));
    document.head.appendChild(script);
  });

  return mapLibrePromise;
}

async function loadTripMapPayload(tripId: string): Promise<TripMapPayload | null> {
  const tripResult = await supabase
    .from("trips")
    .select("group_itinerary, group_logistics")
    .eq("id", tripId)
    .maybeSingle();

  if (tripResult.error || !tripResult.data) return null;

  const itinerary = (tripResult.data.group_itinerary ?? null) as TripMapPayload["itinerary"];
  const logistics = ((tripResult.data.group_logistics ?? {}) as Record<string, any>) || {};
  const selectedHotelId = typeof logistics.selectedHotelId === "string" ? logistics.selectedHotelId : null;
  const hotels = Array.isArray(logistics.hotels) ? logistics.hotels : [];
  let selectedLodging = selectedHotelId
    ? (hotels.find((hotel: any) => hotel?.id === selectedHotelId) ?? null)
    : null;

  const hasCoords = (hotel: any) => {
    const lat = Number(hotel?.latitude ?? hotel?.location?.latitude);
    const lon = Number(hotel?.longitude ?? hotel?.location?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon);
  };

  if (selectedHotelId && (!selectedLodging || !hasCoords(selectedLodging)) && !selectedHotelId.startsWith("portal-")) {
    const accommodationResult = await supabase
      .from("accommodations")
      .select("id, name, type, latitude, longitude")
      .eq("id", selectedHotelId)
      .maybeSingle();
    if (!accommodationResult.error && accommodationResult.data) {
      selectedLodging = { ...(selectedLodging ?? {}), ...accommodationResult.data };
    }
  }

  return { itinerary, logistics, selectedLodging };
}

function markerLabel(point: PlanningMapPoint) {
  if (point.kind === "lodging") return "Logement";
  return point.day != null && point.orderInDay != null
    ? `J${point.day} · ${point.orderInDay}`
    : "Étape";
}

function PointCard({ point }: { point: PlanningMapPoint }) {
  return (
    <div className="rounded-[18px] border border-primary/10 bg-background/95 p-3.5 shadow-sm backdrop-blur-md">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {point.kind === "lodging" ? <Home className="size-4" /> : <MapPin className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.09em] text-primary">
            {markerLabel(point)}
            {point.time ? ` · ${point.time}` : ""}
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground">{point.label}</p>
          {point.address ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{point.address}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {point.distanceFromPreviousKm != null ? (
              <span className="text-[11px] font-medium text-muted-foreground">
                {formatAirDistance(point.distanceFromPreviousKm)}
              </span>
            ) : null}
            {point.mapsUrl ? (
              <a
                href={point.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
              >
                Ouvrir dans Maps <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function routeGeoJson(points: PlanningMapPoint[], segments: Segment[]) {
  const byId = new Map(points.map((point) => [point.id, point]));
  return {
    type: "FeatureCollection",
    features: segments.flatMap((segment) => {
      const from = byId.get(segment.fromId);
      const to = byId.get(segment.toId);
      if (!from || !to) return [];
      return [{
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [from.longitude, from.latitude],
            [to.longitude, to.latitude],
          ],
        },
      }];
    }),
  };
}

function fitMap(map: any, maplibregl: any, points: PlanningMapPoint[], animate = true) {
  if (!points.length) return;
  if (points.length === 1) {
    map.flyTo({
      center: [points[0].longitude, points[0].latitude],
      zoom: 14,
      duration: animate ? 450 : 0,
    });
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
  const mobile = window.matchMedia("(max-width: 640px)").matches;
  map.fitBounds(bounds, {
    padding: mobile ? { top: 68, right: 46, bottom: 72, left: 46 } : { top: 76, right: 84, bottom: 78, left: 84 },
    maxZoom: 15,
    duration: animate ? 500 : 0,
  });
}

function KrewVectorMap({
  points,
  segments,
}: {
  points: PlanningMapPoint[];
  segments: Segment[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const maplibreRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const distanceMarkersRef = useRef<any[]>([]);
  const markerElementsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(points.find((point) => point.kind !== "lodging")?.id ?? points[0]?.id ?? null);

  const activePoint = points.find((point) => point.id === activeId) ?? null;

  useEffect(() => {
    let disposed = false;
    ensureMapLibre()
      .then((maplibregl) => {
        if (disposed || !containerRef.current) return;
        maplibreRef.current = maplibregl;
        const first = points[0];
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: OPENFREEMAP_STYLE,
          center: first ? [first.longitude, first.latitude] : [2.35, 48.86],
          zoom: first ? 12 : 4,
          attributionControl: false,
          maxZoom: 18,
          minZoom: 2,
          dragRotate: false,
          pitchWithRotate: false,
        });
        map.touchZoomRotate.disableRotation();
        mapRef.current = map;
        map.on("load", () => {
          if (disposed) return;
          map.addSource("krew-route", {
            type: "geojson",
            data: routeGeoJson(points, segments),
          });
          map.addLayer({
            id: "krew-route-halo",
            type: "line",
            source: "krew-route",
            paint: {
              "line-color": "#ffffff",
              "line-width": 6,
              "line-opacity": 0.86,
            },
          });
          map.addLayer({
            id: "krew-route",
            type: "line",
            source: "krew-route",
            paint: {
              "line-color": "#6B3A5D",
              "line-width": 2.5,
              "line-opacity": 0.72,
              "line-dasharray": [1.4, 2.2],
            },
          });
          fitMap(map, maplibregl, points, false);
          setMapReady(true);
        });
      })
      .catch(() => {
        if (!disposed) setMapFailed(true);
      });

    return () => {
      disposed = true;
      markersRef.current.forEach((marker) => marker.remove());
      distanceMarkersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      distanceMarkersRef.current = [];
      markerElementsRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !maplibreRef.current) return;
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;

    markersRef.current.forEach((marker) => marker.remove());
    distanceMarkersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    distanceMarkersRef.current = [];
    markerElementsRef.current.clear();

    points.forEach((point) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.active = String(point.id === activeId);
      button.setAttribute("aria-label", `${markerLabel(point)} : ${point.label}`);
      button.className = point.kind === "lodging"
        ? "flex size-10 items-center justify-center rounded-full border-[3px] border-white bg-primary text-[13px] font-bold text-white shadow-[0_5px_16px_rgba(55,34,50,0.22)] transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 data-[active=true]:scale-110 data-[active=true]:shadow-[0_7px_20px_rgba(55,34,50,0.3)]"
        : "whitespace-nowrap rounded-full border-2 border-white bg-[#EEF3EF] px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-tight text-[#43283E] shadow-[0_4px_13px_rgba(55,34,50,0.18)] transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 data-[active=true]:scale-110 data-[active=true]:bg-[#6B3A5D] data-[active=true]:text-white";
      button.textContent = point.kind === "lodging" ? "⌂" : markerLabel(point);
      button.onclick = (event) => {
        event.stopPropagation();
        setActiveId(point.id);
        map.flyTo({ center: [point.longitude, point.latitude], zoom: Math.max(map.getZoom(), 14), duration: 420 });
      };
      button.onmouseenter = () => setActiveId(point.id);
      button.onfocus = () => setActiveId(point.id);

      markerElementsRef.current.set(point.id, button);
      markersRef.current.push(
        new maplibregl.Marker({ element: button, anchor: "center" })
          .setLngLat([point.longitude, point.latitude])
          .addTo(map),
      );
    });

    const byId = new Map(points.map((point) => [point.id, point]));
    segments.forEach((segment) => {
      const from = byId.get(segment.fromId);
      const to = byId.get(segment.toId);
      if (!from || !to || to.distanceFromPreviousKm == null) return;
      const distance = document.createElement("span");
      distance.className = "rounded-full border border-white/90 bg-white/90 px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#6B3A5D] shadow-sm backdrop-blur";
      distance.textContent = `≈ ${to.distanceFromPreviousKm < 10 ? to.distanceFromPreviousKm.toFixed(1).replace(".", ",") : Math.round(to.distanceFromPreviousKm)} km`;
      distanceMarkersRef.current.push(
        new maplibregl.Marker({ element: distance, anchor: "center" })
          .setLngLat([(from.longitude + to.longitude) / 2, (from.latitude + to.latitude) / 2])
          .addTo(map),
      );
    });

    const source = map.getSource("krew-route");
    if (source?.setData) source.setData(routeGeoJson(points, segments));
    fitMap(map, maplibregl, points);
  }, [mapReady, points, segments]);

  useEffect(() => {
    markerElementsRef.current.forEach((element, id) => {
      element.dataset.active = String(id === activeId);
    });
  }, [activeId]);

  useEffect(() => {
    if (activeId && !points.some((point) => point.id === activeId)) {
      setActiveId(points.find((point) => point.kind !== "lodging")?.id ?? points[0]?.id ?? null);
    }
  }, [points, activeId]);

  const focusPoint = (point: PlanningMapPoint) => {
    setActiveId(point.id);
    mapRef.current?.flyTo({
      center: [point.longitude, point.latitude],
      zoom: Math.max(mapRef.current.getZoom(), 14),
      duration: 420,
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="relative h-[330px] w-full overflow-hidden rounded-[22px] border border-primary/10 bg-[#F7F8F7] shadow-[0_12px_34px_rgba(55,34,50,0.08)] sm:h-[390px] lg:h-[430px]">
        <div ref={containerRef} className="absolute inset-0" aria-label="Carte interactive du séjour" />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.11),rgba(143,168,155,0.05))]"
          aria-hidden="true"
        />

        {mapFailed ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface px-6 text-center text-sm text-muted-foreground">
            La carte n’a pas pu se charger. Les étapes restent accessibles juste en dessous.
          </div>
        ) : !mapReady ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
            <span className="rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
              La carte se dessine…
            </span>
          </div>
        ) : null}

        {mapReady ? (
          <>
            <div className="absolute right-3 top-3 z-20 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => mapRef.current?.zoomIn({ duration: 220 })}
                className="flex size-9 items-center justify-center rounded-full border border-white/90 bg-white/95 text-foreground shadow-sm backdrop-blur hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Zoomer"
              >
                <Plus className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => mapRef.current?.zoomOut({ duration: 220 })}
                className="flex size-9 items-center justify-center rounded-full border border-white/90 bg-white/95 text-foreground shadow-sm backdrop-blur hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Dézoomer"
              >
                <Minus className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => fitMap(mapRef.current, maplibreRef.current, points)}
                className="mt-1 flex size-9 items-center justify-center rounded-full border border-white/90 bg-white/95 text-primary shadow-sm backdrop-blur hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Recentrer sur le parcours"
              >
                <LocateFixed className="size-4" />
              </button>
            </div>

            {activePoint ? (
              <div className="absolute bottom-3 left-3 z-20 w-[min(285px,calc(100%-24px))] sm:bottom-4 sm:left-4 sm:w-[300px]">
                <PointCard point={activePoint} />
              </div>
            ) : null}

            <div className="absolute bottom-1.5 right-2 z-10 rounded-full bg-white/80 px-2 py-0.5 text-[8px] text-muted-foreground backdrop-blur-sm">
              OpenFreeMap · © OpenMapTiles · OpenStreetMap
            </div>
          </>
        ) : null}
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {points
          .filter((point) => point.kind !== "lodging")
          .map((point) => (
            <button
              key={point.id}
              type="button"
              onClick={() => focusPoint(point)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                point.id === activeId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/10 bg-background text-foreground hover:border-primary/25"
              }`}
            >
              <span className="font-mono text-[10px] opacity-75">{markerLabel(point)}</span>
              <span className="ml-1.5 max-w-[150px] truncate align-bottom inline-block">{point.label}</span>
            </button>
          ))}
      </div>
    </div>
  );
}

export function PlanningMapSection({ tripId }: { tripId: string }) {
  const [payload, setPayload] = useState<TripMapPayload | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dayFilter, setDayFilter] = useState<number | "all">("all");

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    loadTripMapPayload(tripId)
      .then((result) => {
        if (!cancelled) setPayload(result);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const model = useMemo(
    () =>
      buildPlanningMapModel({
        days: payload?.itinerary?.days ?? [],
        destination: payload?.itinerary?.destination ?? null,
        selectedLodging: payload?.selectedLodging,
      }),
    [payload],
  );

  const days = useMemo(
    () =>
      Array.from(
        new Set(
          model.points
            .filter((point) => point.kind !== "lodging" && point.day != null)
            .map((point) => point.day as number),
        ),
      ).sort((a, b) => a - b),
    [model.points],
  );

  const visiblePoints = useMemo(
    () =>
      dayFilter === "all"
        ? model.points
        : model.points.filter((point) => point.kind === "lodging" || point.day === dayFilter),
    [model.points, dayFilter],
  );

  const visibleIds = useMemo(() => new Set(visiblePoints.map((point) => point.id)), [visiblePoints]);
  const visibleSegments = useMemo(
    () => model.segments.filter((segment) => visibleIds.has(segment.fromId) && visibleIds.has(segment.toId)),
    [model.segments, visibleIds],
  );

  const activityCount = model.points.filter((point) => point.kind !== "lodging").length;
  const destination = payload?.itinerary?.destination?.trim();

  if (!loaded || model.points.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 pb-12" aria-labelledby="planning-map-title">
      <div className="overflow-hidden rounded-[24px] border border-primary/10 bg-card shadow-[0_18px_48px_rgba(55,34,50,0.06)]">
        <div className="relative px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
          <KrewMark
            type="sparkle"
            tone="sage"
            size="sm"
            className="pointer-events-none absolute right-5 top-4 hidden opacity-60 sm:block"
          />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <KrewIcon name="destination" tone="plum" size="sm" className="size-5" />
                <h2 id="planning-map-title" className="font-display text-[26px] font-normal text-foreground sm:text-[30px]">
                  Notre terrain de jeu
                </h2>
                <KrewNote variant="tape" tone="sage" rotation={-1} className="hidden px-2.5 py-1 text-xs sm:inline-block">
                  Le voyage prend forme
                </KrewNote>
              </div>
              <KrewMark type="underline-wave" tone="sage" size="sm" className="mt-1 h-[7px] w-[112px] opacity-85" />
              <p className="mt-2 text-sm font-medium text-foreground/80">
                {days.length ? `${days.length} jour${days.length > 1 ? "s" : ""}` : "Le séjour"}
                {" · "}
                {activityCount} étape{activityCount > 1 ? "s" : ""}
                {destination ? ` · ${destination}` : ""}
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Le logement et les activités retenues, dans l’ordre du planning. Les traits relient uniquement deux étapes consécutives géolocalisées.
              </p>
            </div>

            {model.lodgingPoint ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                <Home className="size-3.5" />
                Notre camp de base
              </span>
            ) : null}
          </div>

          {days.length > 1 ? (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Filtrer la carte par jour">
              <button
                type="button"
                onClick={() => setDayFilter("all")}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  dayFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                Tout le séjour
              </button>
              {days.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setDayFilter(day)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    dayFilter === day
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Jour {day}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="px-2 pb-3 sm:px-4 sm:pb-4">
          <KrewVectorMap points={visiblePoints} segments={visibleSegments} />
          <p className="mt-2 px-1 text-[10px] leading-relaxed text-muted-foreground">
            Les distances affichées sont approximatives et calculées à vol d’oiseau ; le tracé ne représente pas un itinéraire routier.
          </p>
        </div>
      </div>
    </section>
  );
}
