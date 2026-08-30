import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Home, MapPin, Minus, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  buildPlanningMapModel,
  formatAirDistance,
  type PlanningMapPoint,
} from "@/lib/krew/planning-map";
import { KrewIcon, KrewMark } from "@/components/krew/visual-language";
import { KrewNote } from "@/components/krew/visual-language/KrewNote";

const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 18;

type ViewState = {
  centerX: number;
  centerY: number;
  zoom: number;
};

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
  if (!points.length) return { centerX: 0.5, centerY: 0.5, zoom: 2 };

  const xs = points.map((point) => lonToX(point.longitude));
  const ys = points.map((point) => latToY(point.latitude));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  if (points.length === 1) return { centerX, centerY, zoom: 14 };

  const padding = size.width < 520 ? 54 : 72;
  const usableWidth = Math.max(120, size.width - padding * 2);
  const usableHeight = Math.max(120, size.height - padding * 2);
  const spanX = Math.max(maxX - minX, 0.000001);
  const spanY = Math.max(maxY - minY, 0.000001);
  const zoomX = Math.log2(usableWidth / (spanX * TILE_SIZE));
  const zoomY = Math.log2(usableHeight / (spanY * TILE_SIZE));
  const zoom = clamp(Math.floor(Math.min(zoomX, zoomY)), 3, 16);

  return { centerX, centerY, zoom };
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
  const [size, setSize] = useState<Size>({ width: 760, height: 380 });

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

function markerLabel(point: PlanningMapPoint) {
  if (point.kind === "lodging") return "Logement";
  return point.day != null && point.orderInDay != null
    ? `J${point.day} · ${point.orderInDay}`
    : "Étape";
}

function PointPopover({ point }: { point: PlanningMapPoint }) {
  return (
    <div className="w-[220px] rounded-2xl border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur-sm">
      <div className="flex items-start gap-2">
        {point.kind === "lodging" ? (
          <Home className="mt-0.5 size-4 shrink-0 text-primary" />
        ) : (
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-wide text-primary">
            {markerLabel(point)}
            {point.time ? ` · ${point.time}` : ""}
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground">{point.label}</p>
          {point.address ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{point.address}</p>
          ) : null}
          {point.distanceFromPreviousKm != null ? (
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Depuis l’étape précédente · {formatAirDistance(point.distanceFromPreviousKm)}
            </p>
          ) : null}
          {point.mapsUrl ? (
            <a
              href={point.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Ouvrir dans Maps <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function KrewSlippyMap({ points, segments }: { points: PlanningMapPoint[]; segments: { fromId: string; toId: string }[] }) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const fitted = useMemo(() => fitView(points, size), [points, size.width, size.height]);
  const [view, setView] = useState<ViewState>(fitted);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; centerX: number; centerY: number } | null>(null);

  useEffect(() => setView(fitted), [fitted.centerX, fitted.centerY, fitted.zoom]);

  const positioned = useMemo(() => {
    const duplicateCounts = new Map<string, number>();
    return points.map((point) => {
      const base = pointToScreen(point, view, size);
      const duplicateKey = `${point.latitude.toFixed(6)}:${point.longitude.toFixed(6)}`;
      const duplicateIndex = duplicateCounts.get(duplicateKey) ?? 0;
      duplicateCounts.set(duplicateKey, duplicateIndex + 1);
      if (!duplicateIndex) return { point, ...base };
      const angle = duplicateIndex * 2.2;
      const radius = Math.min(18, 7 + duplicateIndex * 3);
      return {
        point,
        x: base.x + Math.cos(angle) * radius,
        y: base.y + Math.sin(angle) * radius,
      };
    });
  }, [points, view, size.width, size.height]);

  const positionsById = useMemo(
    () => new Map(positioned.map((item) => [item.point.id, item])),
    [positioned],
  );

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

  const closePopover = () => {
    setPinnedId(null);
    setActiveId(null);
  };

  return (
    <div
      ref={ref}
      className="relative h-[310px] w-full overflow-hidden rounded-[18px] border border-border/70 bg-muted/30 sm:h-[360px] lg:h-[390px]"
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
        closePopover();
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
      aria-label="Carte du séjour"
    >
      <div className="absolute inset-0 select-none" aria-hidden="true">
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={tileUrl(view.zoom, tile.x, tile.y)}
            alt=""
            draggable={false}
            className="absolute max-w-none select-none"
            style={{ width: TILE_SIZE, height: TILE_SIZE, left: tile.left, top: tile.top }}
          />
        ))}
        <div className="absolute inset-0 bg-background/5 pointer-events-none" />
      </div>

      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
        {segments.map((segment) => {
          const from = positionsById.get(segment.fromId);
          const to = positionsById.get(segment.toId);
          if (!from || !to) return null;
          return (
            <line
              key={`${segment.fromId}-${segment.toId}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className="stroke-primary/45"
              strokeWidth="2"
              strokeDasharray="5 6"
            />
          );
        })}
      </svg>

      {positioned.map(({ point, x, y }) => {
        const active = activeId === point.id || pinnedId === point.id;
        const isLodging = point.kind === "lodging";
        return (
          <div key={point.id} className="absolute z-10" style={{ left: x, top: y }}>
            <button
              type="button"
              aria-label={`${isLodging ? "Logement" : markerLabel(point)} : ${point.label}`}
              aria-expanded={active}
              onMouseEnter={() => setActiveId(point.id)}
              onMouseLeave={() => {
                if (pinnedId !== point.id) setActiveId(null);
              }}
              onFocus={() => setActiveId(point.id)}
              onBlur={() => {
                if (pinnedId !== point.id) setActiveId(null);
              }}
              onClick={(event) => {
                event.stopPropagation();
                setPinnedId((current) => (current === point.id ? null : point.id));
                setActiveId(point.id);
              }}
              className={
                isLodging
                  ? "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary p-2 text-primary-foreground shadow-md outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
                  : "absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border-2 border-background bg-sage px-2 py-1 text-[10px] font-mono font-bold text-foreground shadow-md outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
              }
            >
              {isLodging ? <Home className="size-4" /> : markerLabel(point)}
            </button>
            {active ? (
              <div
                className="absolute z-30"
                style={{
                  left: clamp(-110, -Math.max(110, x - 12), Math.max(-110, size.width - x - 220)),
                  top: y < 150 ? 20 : -12,
                  transform: y < 150 ? "translateY(0)" : "translateY(-100%)",
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <PointPopover point={point} />
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="absolute right-3 top-3 z-20 flex flex-col overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-sm">
        <button
          type="button"
          className="flex size-10 items-center justify-center text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          aria-label="Zoomer"
          onClick={(event) => {
            event.stopPropagation();
            zoomBy(1);
          }}
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          className="flex size-10 items-center justify-center border-t border-border/60 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          aria-label="Dézoomer"
          onClick={(event) => {
            event.stopPropagation();
            zoomBy(-1);
          }}
        >
          <Minus className="size-4" />
        </button>
      </div>

      <div className="absolute bottom-1.5 right-2 z-10 rounded-md bg-background/80 px-1.5 py-0.5 text-[9px] text-muted-foreground backdrop-blur-sm">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a>
      </div>
    </div>
  );
}

export function PlanningMapSection({ tripId }: { tripId: string }) {
  const [payload, setPayload] = useState<TripMapPayload | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  if (!loaded || model.points.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 pb-10" aria-labelledby="planning-map-title">
      <div className="space-y-4 rounded-[20px] border border-border/55 bg-card/55 p-4 shadow-2xs sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <KrewIcon name="destination" tone="plum" size="sm" className="size-5" />
              <h2 id="planning-map-title" className="font-display text-[24px] font-normal text-foreground sm:text-[28px]">
                Le séjour sur la carte
              </h2>
              <KrewNote variant="tape" tone="sage" rotation={1} className="hidden px-2.5 py-1 text-xs sm:inline-block">
                Où ça se passe
              </KrewNote>
            </div>
            <KrewMark type="underline-wave" tone="sage" size="sm" className="mt-1 h-[7px] w-[92px] opacity-80" />
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Les étapes du planning, dans leur ordre réel. Les liaisons sont visuelles et les distances indiquées sont à vol d’oiseau.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {model.lodgingPoint ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1">
                <Home className="size-3 text-primary" /> Logement
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1">
              <MapPin className="size-3 text-primary" /> Jours du planning
            </span>
          </div>
        </div>

        <KrewSlippyMap points={model.points} segments={model.segments} />
      </div>
    </section>
  );
}
