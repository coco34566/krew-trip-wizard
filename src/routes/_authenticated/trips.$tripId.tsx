import { useEffect, useState } from "react";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

import { PlanningMapSection } from "@/components/krew/PlanningMapSection";

const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.js";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.css";

/**
 * Layout parent du voyage : obligatoire pour que les routes enfants
 * (availability, questionnaire, invite, star, recap) s'affichent via <Outlet />.
 */
export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  component: TripLayout,
});

function TripLayout() {
  const { tripId } = Route.useParams();
  const location = useRouterState({ select: (state) => state.location });
  const search = location.search as Record<string, unknown>;
  const showPlanningMap = search.view === "voyage" && search.section === "planning";
  const [mapLibreReady, setMapLibreReady] = useState(() =>
    typeof window !== "undefined" && Boolean((window as typeof window & { maplibregl?: unknown }).maplibregl),
  );

  useEffect(() => {
    if (!showPlanningMap || mapLibreReady || typeof document === "undefined") return;

    if (!document.querySelector(`link[href="${MAPLIBRE_CSS}"]`)) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = MAPLIBRE_CSS;
      document.head.appendChild(css);
    }

    const markReady = () => setMapLibreReady(true);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${MAPLIBRE_JS}"]`);

    if (existing) {
      if ((window as typeof window & { maplibregl?: unknown }).maplibregl) {
        markReady();
        return;
      }
      existing.addEventListener("load", markReady, { once: true });
      existing.addEventListener("error", markReady, { once: true });
      return () => {
        existing.removeEventListener("load", markReady);
        existing.removeEventListener("error", markReady);
      };
    }

    const script = document.createElement("script");
    script.src = MAPLIBRE_JS;
    script.async = true;
    script.onload = markReady;
    script.onerror = markReady;
    document.head.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [showPlanningMap, mapLibreReady]);

  return (
    <>
      <Outlet />
      {showPlanningMap && mapLibreReady ? <PlanningMapSection tripId={tripId} /> : null}
    </>
  );
}
