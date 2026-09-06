import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { KrewJourneyErrorState, KrewJourneyLoadingState } from "@/components/krew/KrewJourneyAsyncState";
import { KrewJourneyStatusPanel } from "@/components/krew/KrewJourneyStatusPanel";
import { getTripDetail } from "@/lib/trips.functions";

export function TripStarAccessGate({
  tripId,
  children,
}: {
  tripId: string;
  children: ReactNode;
}) {
  const fetchDetail = useServerFn(getTripDetail);
  const detailQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });

  if (detailQuery.isLoading) {
    return (
      <KrewJourneyLoadingState
        maxWidthClassName="max-w-[820px]"
        message="Chargement des préférences de la Star…"
      />
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <KrewJourneyErrorState
        tripId={tripId}
        maxWidthClassName="max-w-[820px]"
        title="Impossible de charger les préférences de la Star"
        description="Les informations du voyage ne sont pas disponibles pour le moment."
        retrying={detailQuery.isFetching}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  if (detailQuery.data.isOwner) return <>{children}</>;

  return (
    <main className="mx-auto w-full max-w-[820px] space-y-8 px-5 py-8 sm:px-7 sm:py-10 lg:px-8">
      <KrewJourneyStatusPanel
        title="Préférences de la Star"
        icon="attention"
        tone="locked"
        action={
          <Link
            to="/trips/$tripId/questionnaire"
            params={{ tripId }}
            className="inline-flex min-h-10 items-center text-[14px] font-semibold text-primary underline-offset-4 hover:underline"
          >
            Voir mes préférences
          </Link>
        }
      >
        <p>
          Cette étape est gérée par l’organisateur·rice ou le co-organisateur·rice. Si la Star participe au voyage, elle renseigne ses propres préférences comme les autres membres du groupe.
        </p>
      </KrewJourneyStatusPanel>
    </main>
  );
}
