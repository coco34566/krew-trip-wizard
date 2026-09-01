import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewIcon } from "@/components/krew/visual-language";
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
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <KrewThinkingState
          context="generic"
          customMessage="Chargement des préférences de la Star…"
          delayMs={0}
        />
      </main>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "voyage" }}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Retour au parcours
        </Link>
        <section className="rounded-3xl border border-border/60 bg-card p-6 text-center sm:p-8" role="alert">
          <h1 className="font-display text-[28px] font-normal text-foreground sm:text-[32px]">
            Impossible de charger les préférences de la Star
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Les informations du voyage ne sont pas disponibles pour le moment.
          </p>
          <Button
            type="button"
            className="mt-5"
            onClick={() => void detailQuery.refetch()}
            disabled={detailQuery.isFetching}
            aria-busy={detailQuery.isFetching}
          >
            {detailQuery.isFetching ? "Chargement…" : "Réessayer"}
          </Button>
        </section>
      </main>
    );
  }

  if (detailQuery.data.isOwner) return <>{children}</>;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        search={{ view: "voyage" }}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour au parcours
      </Link>
      <section className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/8">
            <KrewIcon name="favorite" tone="plum" size="sm" className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-[28px] font-normal text-foreground sm:text-[32px]">
              Préférences de la Star
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Cette étape est gérée par l’organisateur·rice ou le co-organisateur·rice. Si la Star participe au voyage, elle renseigne ses propres préférences comme les autres membres du groupe.
            </p>
            <Link
              to="/trips/$tripId/questionnaire"
              params={{ tripId }}
              className="mt-4 inline-flex min-h-10 items-center font-semibold text-primary hover:underline"
            >
              Voir mes préférences →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
