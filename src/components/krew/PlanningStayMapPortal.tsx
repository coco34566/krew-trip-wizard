/* eslint-disable @typescript-eslint/no-explicit-any -- existing trip logistics payload is JSON */
import { useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { PlanningStayMap } from "@/components/krew/PlanningStayMap";
import { getTripDetail } from "@/lib/trips.functions";

type PlanningStayMapPortalProps = { tripId: string };

export function PlanningStayMapPortal({ tripId }: PlanningStayMapPortalProps) {
  const location = useLocation();
  const fetchDetail = useServerFn(getTripDetail);
  const search = useMemo(() => new URLSearchParams(location.searchStr), [location.searchStr]);
  const isPlanning = location.pathname === `/trips/${tripId}` && search.get("section") === "planning";
  const [target, setTarget] = useState<HTMLElement | null>(null);

  const { data } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
    enabled: isPlanning,
  });

  useEffect(() => {
    if (!isPlanning) {
      setTarget(null);
      return;
    }
    setTarget(document.getElementById("hub-activities-plan"));
  }, [isPlanning, location.href, data]);

  if (!isPlanning || !target || !data?.trip) return null;

  const trip = data.trip as any;
  const logistics = (trip.group_logistics || {}) as any;
  const selectedAccommodation = logistics.selectedHotelId
    ? (logistics.hotels ?? []).find((hotel: any) => hotel.id === logistics.selectedHotelId) ?? null
    : null;
  const selectedRecommendation = (data.recommendations ?? []).find((recommendation: any) => recommendation.is_selected);
  const destination = selectedRecommendation?.destinations?.name ?? trip.group_itinerary?.destination ?? null;

  return createPortal(
    <PlanningStayMap
      days={trip.group_itinerary?.days ?? []}
      selectedAccommodation={selectedAccommodation}
      destination={destination}
    />,
    target,
  );
}
