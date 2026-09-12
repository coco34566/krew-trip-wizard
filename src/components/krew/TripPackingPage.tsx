import type { Tables } from "@/integrations/supabase/types";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";

import { KrewJourneyErrorState, KrewJourneyLoadingState } from "@/components/krew/KrewJourneyAsyncState";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewJourneyStatusPanel } from "@/components/krew/KrewJourneyStatusPanel";
import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { PackingListCard } from "@/components/krew/PackingListCard";
import { KrewNote } from "@/components/krew/visual-language";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import { TripLifecycleProvider } from "@/lib/krew/trip-lifecycle-context";
import { getTripDetail } from "@/lib/trips.functions";

type PackingItineraryDay = { slots?: any[] };

export function TripPackingPage({ tripId }: { tripId: string }) {
  const fetchDetail = useServerFn(getTripDetail);
  const detailQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });

  if (detailQuery.isLoading) {
    return <KrewJourneyLoadingState message="Préparation de la liste…" />;
  }

  if (!detailQuery.data || detailQuery.isError) {
    return (
      <KrewJourneyErrorState
        tripId={tripId}
        title="Impossible de charger À emporter"
        description="La liste du voyage n’est pas disponible pour le moment."
        retrying={detailQuery.isFetching}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const data = detailQuery.data as any;
  const trip = data.trip as Tables<"trips">;
  const logistics = (trip.group_logistics ?? {}) as any;
  const activities = (data.activities ?? []) as any[];
  const rawItinerary = trip.group_itinerary;
  const itinerary =
    rawItinerary && typeof rawItinerary === "object" && !Array.isArray(rawItinerary)
      ? rawItinerary
      : {};
  const itineraryDays = Array.isArray(itinerary["days"]) ? (itinerary["days"] as unknown as PackingItineraryDay[]) : [];
  const selectedHotel = (logistics.hotels ?? []).find((hotel: any) => hotel.id === logistics.selectedHotelId);
  const lifecycle = getTripLifecycleState({
    datesLocked: Boolean(trip.dates_locked),
    startDate: trip.start_date ?? null,
    endDate: trip.end_date ?? null,
  });
  const historical = lifecycle === "completed";
  const durationDays = Math.max(1, Number(trip.duration_nights || 1) + 1);
  const activityLabels = itineraryDays.length
    ? itineraryDays
        .flatMap((day: any) =>
          (day.slots ?? []).map((slot: any) => `${slot.label || ""} ${slot.detail || ""}`.trim()),
        )
        .filter(Boolean)
    : activities.map((activity: any) => activity.name).filter(Boolean);

  return (
    <TripLifecycleProvider lifecycle={lifecycle}>
      <KrewPageShell size="standard" className="space-y-[var(--krew-journey-content-gap)] py-8 sm:py-10">
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "voyage" }}
          className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Retour au parcours
        </Link>

        <KrewJourneyPageHeader
          tripName={trip.name ?? "Voyage"}
          title="À emporter"
          otterSrc="/brand/otter-states/trip-preparation.png"
          annotation={
            <KrewNote variant="tape" tone="sage" rotation={-2} size="xs" className="hidden sm:inline-block">
              {historical ? "Souvenir du voyage" : "Adaptée au séjour"}
            </KrewNote>
          }
        >
          <p>
            {historical
              ? "La liste du voyage, conservée avec son dernier état."
              : "Une liste adaptée au séjour et aux activités, à compléter avec le groupe."}
          </p>
        </KrewJourneyPageHeader>

        {historical ? (
          <KrewJourneyStatusPanel title="Voyage terminé · consultation" icon="check" tone="complete">
            <p>La liste reste accessible comme souvenir du voyage. Son dernier état est conservé en lecture seule.</p>
          </KrewJourneyStatusPanel>
        ) : null}

        <PackingListCard
          showHeader={false}
          tripId={tripId}
          participants={data.participants ?? []}
          avgTemp={null}
          activities={activityLabels}
          durationDays={durationDays}
          eventType={trip.event_type}
          accommodation={String(selectedHotel?.type || logistics.accommodationType || "")}
        />
      </KrewPageShell>
    </TripLifecycleProvider>
  );
}
