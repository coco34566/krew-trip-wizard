import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Home, LocateFixed, MapPin, Minus, Plus, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  buildPlanningMapModel,
  findPlanningMapGeographicOutlierIds,
  formatMapSegmentDistance,
  type PlanningMapPoint,
  type PlanningMapSegment,
} from "@/lib/krew/planning-map";
import { KrewIcon, KrewMark } from "@/components/krew/visual-language";
import { KrewNote } from "@/components/krew/visual-language/KrewNote";

const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;

type ViewState = { centerX: number; centerY: number; zoom: number };
type Size = { width: number; height: number };
type TripMapPayload = {
  itinerary: { destination?: string; days?: { day?: unknown; slots?: unknown }[] } | null;
  logistics: Record<string, any>;
  selectedLodging: Record<string, any> | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lonToX(longitude: number) {
  return (longitude + 180) / 360;
}

function latToY(latitude: number) {
  const latRad = (clamp(latitude, -85.05112878, 85.05112878) * Math.PI) / 180;
  return (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2;
}

function fitView(points: PlanningMapPoint[], size: Size): ViewState {
  if (!points.length) return { centerX: 0.5, centerY: 0.5, zoom: 3 };
  const xs = points.map((point) => lonToX(point.longitude));
  const ys = points.map((point) => latToY(point.latitude));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  if (points.length === 1) return { centerX, centerY, zoom: 14 };

  const padding = size.width < 520 ? 64 : 92;
  const usableWidth = Math.max(120, size.width - padding * 2);
  const usableHeight = Math.max(120, size.height - padding * 2);
  const spanX = Math.max(maxX - minX, 0.000001);
  const spanY = Math.max(maxY - minY, 0.000001);
  return {
    centerX,
    centerY,
    zoom: clamp(
      Math.floor(Math.min(
        Math.log2(usableWidth / (spanX * TILE_SIZE)),
        Math.log2(usableHeight / (spanY * TILE_SIZE)),
      )),
      MIN_ZOOM,
      16,
    ),
  };
}

function pointToScreen(point: PlanningMapPoint, view: ViewState, size: Size) {
  const scale = TILE_SIZE * 2 ** view.zoom;
  return {
    x: (lonToX(point.longitude) - view.centerX) * scale + size.width / 2,
    y: (latToY(point.latitude) - view.centerY) * scale + size.height / 2,
  };
}

function tileUrl(z: number, x: number, y: number) {
  const count = 2 ** z;
  const wrappedX = ((x % count) + count) % count;
  return `https://tile.openstreetmap.org/${z}/${wrappedX}/${y}.png`;
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 760, height: 390 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
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

function PointCard({ point, onClose }: { point: PlanningMapPoint; onClose: () => void }) {
  return (
    <div className="relative rounded-[18px] border border-primary/10 bg-background/95 p-3.5 pr-9 shadow-lg backdrop-blur-md">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Fermer le détail"
      >
        <X className="size-3.5" />
      </button>
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {point.kind === "lodging" ? <Home className="size-4" /> : <MapPin className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.09em] text-primary">
            {point.kind === "lodging" ? "Logement" : `Point ${point.orderInDay}`}
            {point.time ? ` · ${point.time}` : ""}
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground">{point.label}</p>
          {point.address ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{point.address}</p> : null}
          {point.mapsUrl ? (
            <a
              href={point.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
            >
              Ouvrir dans Maps <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function KrewRasterMap({
  points,
  segments,
  showDayPrefix,
}: {
  points: PlanningMapPoint[];
  segments: PlanningMapSegment[];
  showDayPrefix: boolean;
}) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const fitted = useMemo(() => fitView(points, size), [points, size.width, size.height]);
  const [view, setView] = useState<ViewState>(fitted);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; centerX: number; centerY: number } | null>(null);

  useEffect(() => {
    setView(fitted);
    setActiveId(null);
  }, [fitted.centerX, fitted.centerY, fitted.zoom]);

  const positioned = useMemo(() => {
    const duplicates = new Map<string, number>();
    return points.map((point) => {
      const base = pointToScreen(point, view, size);
      const key = `${point.latitude.toFixed(6)}:${point.longitude.toFixed(6)}`;
      const duplicateIndex = duplicates.get(key) ?? 0;
      duplicates.set(key, duplicateIndex + 1);
      if (!duplicateIndex) return { point, ...base };
      const angle = duplicateIndex * 2.2;
      const radius = Math.min(18, 7 + duplicateIndex * 3);
      return { point, x: base.x + Math.cos(angle) * radius, y: base.y + Math.sin(angle) * radius };
    });
  }, [points, view, size.width, size.height]);

  const positionsById = useMemo(() => new Map(positioned.map((item) => [item.point.id, item])), [positioned]);
  const scale = TILE_SIZE * 2 ** view.zoom;
  const centerWorldX = view.centerX * scale;
  const centerWorldY = view.centerY * scale;
  const minTileX = Math.floor((centerWorldX - size.width / 2) / TILE_SIZE) - 1;
  const maxTileX = Math.floor((centerWorldX + size.width / 2) / TILE_SIZE) + 1;
  const minTileY = Math.max(0, Math.floor((centerWorldY - size.height / 2) / TILE_SIZE) - 1);
  const maxTileY = Math.min(2 ** view.zoom - 1, Math.floor((centerWorldY + size.height / 2) / TILE_SIZE) + 1);
  const tiles: { key: string; x: number; y: number; left: number; top: number }[] = [];

  for (let y = minTileY; y <= maxTileY; y += 1) {
    for (let x = minTileX; x <= maxTileX; x += 1) {
      tiles.push({
        key: `${view.zoom}-${x}-${y}`,
        x,
        y,
        left: x * TILE_SIZE - centerWorldX + size.width / 2,
        top: y * TILE_SIZE - centerWorldY + size.height / 2,
      });
    }
  }

  const zoomBy = (delta: number) => {
    setView((current) => ({ ...current, zoom: clamp(current.zoom + delta, MIN_ZOOM, MAX_ZOOM) }));
  };
  const activePoint = points.find((point) => point.id === activeId) ?? null;

  return (
    <div
      ref={ref}
      className="relative h-[330px] w-full overflow-hidden rounded-[22px] border border-primary/10 bg-[#F3F5F3] shadow-[0_12px_34px_rgba(55,34,50,0.08)] sm:h-[390px] lg:h-[430px]"
      style={{ touchAction: "pan-y" }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button,a")) return;
        dragRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          centerX: view.centerX,
          centerY: view.centerY,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setActiveId(null);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const worldScale = TILE_SIZE * 2 ** view.zoom;
        setView((current) => ({
          ...current,
          centerX: drag.centerX - (event.clientX - drag.x) / worldScale,
          centerY: clamp(drag.centerY - (event.clientY - drag.y) / worldScale, 0, 1),
        }));
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onDoubleClick={() => zoomBy(1)}
      aria-label="Carte interactive du séjour"
    >
      <div className="absolute inset-0 select-none bg-[#eef2ef]" aria-hidden="true">
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={tileUrl(view.zoom, tile.x, tile.y)}
            alt=""
            draggable={false}
            className="absolute max-w-none select-none"
            style={{
              width: TILE_SIZE,
              height: TILE_SIZE,
              left: tile.left,
              top: tile.top,
              filter: "grayscale(1) saturate(.32) contrast(.8) brightness(1.13)",
              opacity: 0.68,
            }}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.2),rgba(143,168,155,0.13))]" />
      </div>

      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
        {segments.map((segment) => {
          const from = positionsById.get(segment.fromId);
          const to = positionsById.get(segment.toId);
          if (!from || !to) return null;
          return (
            <g key={`${segment.fromId}-${segment.toId}`}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="white" strokeWidth="7" strokeOpacity="0.94" />
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="stroke-primary/80" strokeWidth="3" />
            </g>
          );
        })}
      </svg>

      {segments.map((segment) => {
        const from = positionsById.get(segment.fromId);
        const to = positionsById.get(segment.toId);
        if (!from || !to) return null;
        const fromOrder = from.point.orderInDay;
        const toOrder = to.point.orderInDay;
        const dayPrefix = showDayPrefix && from.point.day != null ? `J${from.point.day} · ` : "";
        return (
          <span
            key={`distance-${segment.fromId}-${segment.toId}`}
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-primary/15 bg-white/95 px-2 py-1 font-mono text-[9px] font-bold text-primary shadow-sm sm:text-[10px]"
            style={{ left: (from.x + to.x) / 2, top: (from.y + to.y) / 2 }}
          >
            {dayPrefix}{fromOrder} → {toOrder} · {formatMapSegmentDistance(segment.distanceKm)}
          </span>
        );
      })}

      {positioned.map(({ point, x, y }) => {
        const active = point.id === activeId;
        const markerText = point.kind === "lodging"
          ? null
          : showDayPrefix
            ? `J${point.day} · ${point.orderInDay}`
            : String(point.orderInDay);
        return (
          <button
            key={point.id}
            type="button"
            aria-label={point.kind === "lodging" ? `Logement : ${point.label}` : `Point ${point.orderInDay} : ${point.label}`}
            aria-expanded={active}
            onClick={(event) => {
              event.stopPropagation();
              setActiveId((current) => (current === point.id ? null : point.id));
            }}
            className={
              point.kind === "lodging"
                ? `absolute z-20 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-primary text-white shadow-[0_5px_16px_rgba(55,34,50,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${active ? "scale-110" : ""}`
                : `absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center border-[3px] border-white bg-primary font-mono font-bold text-white shadow-[0_5px_16px_rgba(55,34,50,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    showDayPrefix ? "h-9 min-w-9 rounded-full px-2 text-[9px]" : "size-9 rounded-full text-sm"
                  } ${active ? "scale-110 ring-2 ring-primary/25" : ""}`
            }
            style={{ left: x, top: y }}
          >
            {point.kind === "lodging" ? <Home className="size-4" /> : markerText}
          </button>
        );
      })}

      <div className="absolute right-3 top-3 z-30 flex flex-col gap-1.5">
        <button type="button" onClick={(event) => { event.stopPropagation(); zoomBy(1); }} className="flex size-9 items-center justify-center rounded-full border border-white/90 bg-white/95 text-foreground shadow-sm" aria-label="Zoomer"><Plus className="size-4" /></button>
        <button type="button" onClick={(event) => { event.stopPropagation(); zoomBy(-1); }} className="flex size-9 items-center justify-center rounded-full border border-white/90 bg-white/95 text-foreground shadow-sm" aria-label="Dézoomer"><Minus className="size-4" /></button>
        <button type="button" onClick={(event) => { event.stopPropagation(); setView(fitted); setActiveId(null); }} className="mt-1 flex size-9 items-center justify-center rounded-full border border-white/90 bg-white/95 text-primary shadow-sm" aria-label="Recentrer sur le parcours"><LocateFixed className="size-4" /></button>
      </div>

      {activePoint ? (
        <div className="absolute bottom-3 left-3 z-30 w-[min(285px,calc(100%-24px))] sm:bottom-4 sm:left-4 sm:w-[300px]">
          <PointCard point={activePoint} onClose={() => setActiveId(null)} />
        </div>
      ) : null}

      <div className="absolute bottom-1.5 right-2 z-20 rounded-full bg-white/85 px-2 py-0.5 text-[8px] text-muted-foreground backdrop-blur-sm">
        © OpenStreetMap
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
    return () => { cancelled = true; };
  }, [tripId]);

  const rawModel = useMemo(
    () => buildPlanningMapModel({
      days: payload?.itinerary?.days ?? [],
      destination: payload?.itinerary?.destination ?? null,
      selectedLodging: payload?.selectedLodging,
    }),
    [payload],
  );

  const outlierIds = useMemo(
    () => new Set(findPlanningMapGeographicOutlierIds(rawModel.points)),
    [rawModel.points],
  );

  const cleanModel = useMemo(() => {
    const keptActivities = rawModel.activityPoints.filter((point) => !outlierIds.has(point.id));
    const counters = new Map<number, number>();
    const renumberedActivities = keptActivities.map((point) => {
      const day = point.day ?? 0;
      const next = (counters.get(day) ?? 0) + 1;
      counters.set(day, next);
      return { ...point, orderInDay: next };
    });
    const keptIds = new Set(renumberedActivities.map((point) => point.id));
    const cleanSegments = rawModel.segments.filter(
      (segment) => keptIds.has(segment.fromId) && keptIds.has(segment.toId),
    );
    const distanceByTarget = new Map(cleanSegments.map((segment) => [segment.toId, segment.distanceKm]));
    const activities = renumberedActivities.map((point) => ({
      ...point,
      distanceFromPreviousKm: distanceByTarget.get(point.id) ?? null,
    }));
    const points = rawModel.lodgingPoint ? [rawModel.lodgingPoint, ...activities] : activities;
    return { points, activities, segments: cleanSegments };
  }, [rawModel, outlierIds]);

  const days = useMemo(
    () => Array.from(new Set(cleanModel.activities.map((point) => point.day).filter((day): day is number => day != null))).sort((a, b) => a - b),
    [cleanModel.activities],
  );

  const visiblePoints = useMemo(
    () => dayFilter === "all"
      ? cleanModel.points
      : cleanModel.points.filter((point) => point.kind === "lodging" || point.day === dayFilter),
    [cleanModel.points, dayFilter],
  );
  const visibleIds = useMemo(() => new Set(visiblePoints.map((point) => point.id)), [visiblePoints]);
  const visibleSegments = useMemo(
    () => cleanModel.segments.filter((segment) => visibleIds.has(segment.fromId) && visibleIds.has(segment.toId)),
    [cleanModel.segments, visibleIds],
  );

  const destination = payload?.itinerary?.destination?.trim();
  if (!loaded || cleanModel.points.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 pb-12" aria-labelledby="planning-map-title">
      <div className="overflow-hidden rounded-[24px] border border-primary/10 bg-card shadow-[0_18px_48px_rgba(55,34,50,0.06)]">
        <div className="relative px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
          <KrewMark type="sparkle" tone="sage" size="sm" className="pointer-events-none absolute right-5 top-4 hidden opacity-60 sm:block" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <KrewIcon name="destination" tone="plum" size="sm" className="size-5" />
                <h2 id="planning-map-title" className="font-display text-[26px] font-normal text-foreground sm:text-[30px]">Notre terrain de jeu</h2>
                <KrewNote variant="tape" tone="sage" rotation={-1} className="hidden px-2.5 py-1 text-xs sm:inline-block">Le voyage prend forme</KrewNote>
              </div>
              <KrewMark type="underline-wave" tone="sage" size="sm" className="mt-1 h-[7px] w-[112px] opacity-85" />
              <p className="mt-2 text-sm font-medium text-foreground/80">
                {days.length ? `${days.length} jour${days.length > 1 ? "s" : ""}` : "Le séjour"} · {cleanModel.activities.length} étape{cleanModel.activities.length > 1 ? "s" : ""}{destination ? ` · ${destination}` : ""}
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Chaque journée se lit simplement : point 1, puis 2, puis 3. La distance entre deux points consécutifs est indiquée directement sur leur liaison.
              </p>
            </div>
            {rawModel.lodgingPoint ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"><Home className="size-3.5" />Notre camp de base</span>
            ) : null}
          </div>

          {days.length > 1 ? (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Filtrer la carte par jour">
              <button type="button" onClick={() => setDayFilter("all")} className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${dayFilter === "all" ? "bg-primary text-primary-foreground shadow-sm" : "bg-surface text-muted-foreground hover:text-foreground"}`}>Tout le séjour</button>
              {days.map((day) => (
                <button key={day} type="button" onClick={() => setDayFilter(day)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${dayFilter === day ? "bg-primary text-primary-foreground shadow-sm" : "bg-surface text-muted-foreground hover:text-foreground"}`}>Jour {day}</button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="px-2 pb-3 sm:px-4 sm:pb-4">
          <KrewRasterMap points={visiblePoints} segments={visibleSegments} showDayPrefix={dayFilter === "all"} />
          <div className="mt-2 flex flex-wrap items-start justify-between gap-2 px-1 text-[10px] leading-relaxed text-muted-foreground">
            <p>Distances approximatives à vol d’oiseau ; les traits ne représentent pas un itinéraire routier.</p>
            {outlierIds.size > 0 ? (
              <p className="font-medium text-primary">{outlierIds.size} lieu{outlierIds.size > 1 ? "x" : ""} non affiché{outlierIds.size > 1 ? "s" : ""} car sa position semble incohérente avec le reste du séjour.</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
