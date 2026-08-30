import { ExternalLink, Home, MapPin, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { KrewIcon } from "@/components/krew/visual-language";
import {
  buildPlanningMapModel,
  type PlanningCoordinate,
  type PlanningMapActivity,
  type PlanningMapModel,
} from "@/lib/krew/planning-map";
import { cn } from "@/lib/utils";

type PlanningStayMapProps = {
  days: unknown;
  selectedAccommodation?: unknown;
  destination?: string | null;
};

type ViewState = { centerLat: number; centerLon: number; zoom: number };
type Size = { width: number; height: number };

const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 17;

function clampLatitude(latitude: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, latitude));
}

function worldPoint(coordinate: PlanningCoordinate, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lat = clampLatitude(coordinate.latitude) * (Math.PI / 180);
  return {
    x: ((coordinate.longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + Math.sin(lat)) / (1 - Math.sin(lat))) / (4 * Math.PI)) * scale,
  };
}

function coordinateFromWorld(x: number, y: number, zoom: number): PlanningCoordinate {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { latitude, longitude };
}

function screenPoint(coordinate: PlanningCoordinate, view: ViewState, size: Size) {
  const center = worldPoint({ latitude: view.centerLat, longitude: view.centerLon }, view.zoom);
  const point = worldPoint(coordinate, view.zoom);
  return { x: size.width / 2 + point.x - center.x, y: size.height / 2 + point.y - center.y };
}

function fitView(model: PlanningMapModel, size: Size): ViewState | null {
  if (!model.points.length || !size.width || !size.height) return null;
  if (model.points.length === 1) {
    const point = model.points[0];
    return { centerLat: point.latitude, centerLon: point.longitude, zoom: 14 };
  }

  const normalized = model.points.map((point) => worldPoint(point, 0));
  const minX = Math.min(...normalized.map((point) => point.x));
  const maxX = Math.max(...normalized.map((point) => point.x));
  const minY = Math.min(...normalized.map((point) => point.y));
  const maxY = Math.max(...normalized.map((point) => point.y));
  const padding = Math.min(72, Math.max(44, size.width * 0.09));
  const usableWidth = Math.max(80, size.width - padding * 2);
  const usableHeight = Math.max(80, size.height - padding * 2);
  const xZoom = maxX > minX ? Math.log2(usableWidth / (maxX - minX)) : MAX_ZOOM;
  const yZoom = maxY > minY ? Math.log2(usableHeight / (maxY - minY)) : MAX_ZOOM;
  const zoom = Math.max(MIN_ZOOM, Math.min(15, Math.floor(Math.min(xZoom, yZoom))));
  const center = coordinateFromWorld((minX + maxX) / 2, (minY + maxY) / 2, 0);
  return { centerLat: center.latitude, centerLon: center.longitude, zoom };
}

function distanceLabel(distanceKm: number) {
  if (distanceKm < 1) return `≈ ${Math.round(distanceKm * 1000)} m à vol d’oiseau`;
  return `≈ ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(distanceKm)} km à vol d’oiseau`;
}

function overlapOffset(point: PlanningCoordinate, pointIndex: number, allPoints: PlanningMapModel["points"]) {
  const siblings = allPoints.filter(
    (candidate) =>
      Math.abs(candidate.latitude - point.latitude) < 0.000001 &&
      Math.abs(candidate.longitude - point.longitude) < 0.000001,
  );
  if (siblings.length < 2) return { x: 0, y: 0 };
  const siblingIndex = siblings.findIndex((candidate) => candidate === allPoints[pointIndex]);
  const angle = (Math.PI * 2 * Math.max(0, siblingIndex)) / siblings.length;
  return { x: Math.cos(angle) * 13, y: Math.sin(angle) * 13 };
}

export function PlanningStayMap({ days, selectedAccommodation, destination }: PlanningStayMapProps) {
  const model = useMemo(
    () => buildPlanningMapModel({ days, selectedAccommodation, destination }),
    [days, selectedAccommodation, destination],
  );
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [view, setView] = useState<ViewState | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; center: PlanningCoordinate } | null>(null);

  const fingerprint = model.points
    .map((point) => `${point.id}:${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`)
    .join("|");

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fitted = fitView(model, size);
    if (fitted) setView(fitted);
  }, [fingerprint, size.width, size.height]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedId(null);
        setHoveredId(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  if (!model.points.length) return null;

  const activeId = selectedId ?? hoveredId;
  const activePoint = model.points.find((point) => point.id === activeId) ?? null;
  const previousSegment =
    activePoint?.kind === "activity"
      ? model.segments.find((segment) => segment.toId === activePoint.id) ?? null
      : null;
  const nextSegment =
    activePoint?.kind === "activity"
      ? model.segments.find((segment) => segment.fromId === activePoint.id) ?? null
      : null;

  const visibleTiles = (() => {
    if (!view || !size.width || !size.height) return [];
    const center = worldPoint({ latitude: view.centerLat, longitude: view.centerLon }, view.zoom);
    const topLeftX = center.x - size.width / 2;
    const topLeftY = center.y - size.height / 2;
    const startX = Math.floor(topLeftX / TILE_SIZE);
    const endX = Math.floor((topLeftX + size.width) / TILE_SIZE);
    const startY = Math.floor(topLeftY / TILE_SIZE);
    const endY = Math.floor((topLeftY + size.height) / TILE_SIZE);
    const tileCount = 2 ** view.zoom;
    const tiles: Array<{ key: string; x: number; y: number; left: number; top: number }> = [];
    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        if (y < 0 || y >= tileCount) continue;
        const wrappedX = ((x % tileCount) + tileCount) % tileCount;
        tiles.push({
          key: `${view.zoom}-${x}-${y}`,
          x: wrappedX,
          y,
          left: x * TILE_SIZE - topLeftX,
          top: y * TILE_SIZE - topLeftY,
        });
      }
    }
    return tiles;
  })();

  const changeZoom = (delta: number) => {
    setView((current) =>
      current
        ? { ...current, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.zoom + delta)) }
        : current,
    );
  };

  return (
    <div className="mt-8 border-t border-border/50 pt-6" aria-labelledby="planning-map-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <KrewIcon name="destination" tone="plum" size="sm" className="size-5" />
            <h3 id="planning-map-title" className="font-display text-2xl font-normal text-foreground sm:text-[28px]">
              Le séjour sur la carte
            </h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Les lieux du planning, dans l’ordre du voyage.</p>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {model.activities.length} étape{model.activities.length > 1 ? "s" : ""}
          {model.accommodation ? " · 1 logement" : ""}
        </p>
      </div>

      <div
        ref={mapRef}
        className="relative h-[300px] w-full overflow-hidden rounded-2xl border border-border/70 bg-muted/30 shadow-2xs sm:h-[360px] lg:h-[400px]"
        style={{ touchAction: "pan-y" }}
        role="region"
        aria-label="Carte des activités retenues et du logement choisi"
        onClick={() => setSelectedId(null)}
        onPointerDown={(event) => {
          if (event.pointerType === "touch" || !view) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            center: { latitude: view.centerLat, longitude: view.centerLon },
          };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId || !view) return;
          const start = worldPoint(drag.center, view.zoom);
          const next = coordinateFromWorld(start.x - (event.clientX - drag.x), start.y - (event.clientY - drag.y), view.zoom);
          setView((current) => (current ? { ...current, centerLat: next.latitude, centerLon: next.longitude } : current));
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        {view
          ? visibleTiles.map((tile) => (
              <img
                key={tile.key}
                src={`https://tile.openstreetmap.org/${view.zoom}/${tile.x}/${tile.y}.png`}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="pointer-events-none absolute h-64 w-64 select-none"
                style={{ left: tile.left, top: tile.top }}
              />
            ))
          : null}

        {view && size.width && size.height ? (
          <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
            {model.segments.map((segment) => {
              const from = screenPoint(segment.from, view, size);
              const to = screenPoint(segment.to, view, size);
              return (
                <line
                  key={`${segment.fromId}-${segment.toId}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="5 7"
                  className="text-primary/45"
                />
              );
            })}
          </svg>
        ) : null}

        {view && size.width && size.height
          ? model.points.map((point, pointIndex) => {
              const base = screenPoint(point, view, size);
              const offset = overlapOffset(point, pointIndex, model.points);
              const left = base.x + offset.x;
              const top = base.y + offset.y;
              const activity = point.kind === "activity" ? (point as PlanningMapActivity) : null;
              const label = activity ? `J${activity.day}${activity.sequenceInDay > 1 ? ` · ${activity.sequenceInDay}` : ""}` : "Logement";
              const isActive = activeId === point.id;
              return (
                <button
                  key={point.id}
                  type="button"
                  className={cn(
                    "absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-md transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    activity
                      ? "min-h-8 min-w-8 bg-primary px-2 text-[11px] font-bold text-primary-foreground"
                      : "flex size-9 items-center justify-center bg-sage text-primary",
                    isActive && "scale-110",
                  )}
                  style={{ left, top }}
                  aria-label={activity ? `${label} — ${point.name}` : `Logement — ${point.name}`}
                  aria-expanded={isActive}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId((current) => (current === point.id ? null : point.id));
                  }}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== "touch") setHoveredId(point.id);
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType !== "touch") setHoveredId((current) => (current === point.id ? null : current));
                  }}
                  onFocus={() => setSelectedId(point.id)}
                >
                  {activity ? label : <Home className="size-4" aria-hidden="true" />}
                </button>
              );
            })
          : null}

        {activePoint ? (
          <div
            className="absolute bottom-3 left-3 right-3 z-30 max-w-sm rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur-sm sm:right-auto sm:min-w-[280px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {activePoint.kind === "accommodation" ? <Home className="size-3.5" /> : <MapPin className="size-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-mono font-semibold uppercase tracking-wide text-primary">
                  {activePoint.kind === "accommodation"
                    ? "Logement"
                    : `Jour ${activePoint.day}${activePoint.time ? ` · ${activePoint.time}` : ""}`}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{activePoint.name}</p>
                {activePoint.address ? <p className="mt-0.5 text-xs text-muted-foreground">{activePoint.address}</p> : null}
                {previousSegment ? <p className="mt-1 text-xs text-muted-foreground">Depuis l’étape précédente · {distanceLabel(previousSegment.distanceKm)}</p> : null}
                {!previousSegment && nextSegment ? <p className="mt-1 text-xs text-muted-foreground">Vers l’étape suivante · {distanceLabel(nextSegment.distanceKm)}</p> : null}
                {activePoint.mapsUrl ? (
                  <a
                    href={activePoint.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Ouvrir dans Maps <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="absolute right-3 top-3 z-30 flex flex-col overflow-hidden rounded-xl border border-border bg-background/95 shadow-sm">
          <button type="button" className="flex size-10 items-center justify-center hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label="Zoomer" onClick={(event) => { event.stopPropagation(); changeZoom(1); }}>
            <Plus className="size-4" />
          </button>
          <button type="button" className="flex size-10 items-center justify-center border-t border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label="Dézoomer" onClick={(event) => { event.stopPropagation(); changeZoom(-1); }}>
            <Minus className="size-4" />
          </button>
        </div>

        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1 right-1 z-10 rounded bg-background/80 px-1.5 py-0.5 text-[9px] text-muted-foreground hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          © OpenStreetMap contributors
        </a>
      </div>

      {model.segments.length ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Distances ≈ à vol d’oiseau · les traits montrent seulement l’enchaînement des étapes, pas un itinéraire routier.
        </p>
      ) : null}
    </div>
  );
}
