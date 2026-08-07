import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Plane,
  Train,
  Hotel,
  Users,
  Wallet,
  MapPin,
  Info,
  Bell,
  BellRing,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getTripRecap, watchPrice, getCostSplit } from "@/lib/trips.functions";
import { CostSplitCard } from "@/components/krew/CostSplitCard";
import { buildDeepLinksForProposal } from "@/lib/krew/deep-links";
import { formatEuro } from "@/lib/krew/constants";
import type { BudgetBreakdown } from "@/lib/krew/engine";

export const Route = createFileRoute("/_authenticated/trips/$tripId/recap")({
  head: () => ({
    meta: [
      { title: "Récap du groupe — Krew" },
      {
        name: "description",
        content: "Propositions shortlistées et liens pour vérifier les prix en temps réel.",
      },
    ],
  }),
  component: TripRecapPage,
});

function ExternalLinkButton({
  href,
  children,
  variant = "outline" as const,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "outline" | "hero" | "glass";
}) {
  return (
    <Button asChild variant={variant} size="sm" className="gap-1.5">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <ExternalLink className="size-3.5 opacity-70" />
      </a>
    </Button>
  );
}

function TripRecapPage() {
  const { tripId } = Route.useParams();
  const fetchRecap = useServerFn(getTripRecap);
  const doWatch = useServerFn(watchPrice);
  const fetchSplit = useServerFn(getCostSplit);
  const queryClient = useQueryClient();
  const [watched, setWatched] = useState<Record<string, boolean>>({});

  const watchMutation = useMutation({
    mutationFn: (payload: { recommendationId: string; destinationName: string }) =>
      doWatch({
        data: {
          tripId,
          recommendationId: payload.recommendationId,
          destinationName: payload.destinationName,
        },
      }),
    onSuccess: (_r, vars) => {
      setWatched((w) => ({ ...w, [vars.recommendationId]: true }));
      toast.success("Suivi activé — rappel sur ton tableau de bord");
      queryClient.invalidateQueries({ queryKey: ["price-watches"] });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? e);
      if (msg.includes("price_watch") || msg.includes("schema cache")) {
        toast.error("Table price_watch absente — applique la migration Supabase");
      } else {
        toast.error("Impossible d'activer le suivi");
      }
    },
  });

  const { data: costSplitData } = useQuery({
    queryKey: ["cost-split", tripId],
    queryFn: () => fetchSplit({ data: { tripId } }),
    retry: false,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["trip-recap", tripId],
    queryFn: () => fetchRecap({ data: { tripId } }),
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-48 w-full rounded-3xl" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-center">
        <p className="text-muted-foreground">
          {(error as Error)?.message ?? "Impossible de charger le récap."}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/trips/$tripId" params={{ tripId }}>
            Retour au voyage
          </Link>
        </Button>
      </main>
    );
  }

  const { trip, nights, departureOrigins, recommendations, progress } = data;
  const dateLabel =
    trip.startDate && trip.endDate
      ? `${new Date(trip.startDate).toLocaleDateString("fr-FR")} → ${new Date(trip.endDate).toLocaleDateString("fr-FR")}`
      : trip.startDate
        ? `À partir du ${new Date(trip.startDate).toLocaleDateString("fr-FR")} · ${nights} nuit(s)`
        : `${nights} nuit(s) · dates à confirmer`;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour au voyage
      </Link>

      <header className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Récap du groupe</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{trip.name}</h1>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" /> {dateLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" /> {trip.participantsCount} pers.
          </span>
          {progress ? (
            <Badge variant="lagoon">
              Questionnaire {progress.answered}/{progress.total}
            </Badge>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Villes de départ du groupe :{" "}
          {departureOrigins.map((o) => `${o.city} (${o.count})`).join(" · ")}
        </p>
      </header>

      <div className="mt-6 flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground/90">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Ces liens ouvrent les comparateurs avec vos critères pré-remplis — les prix affichés dans
          Krew sont des estimations, cliquez pour voir le prix réel du jour.
        </p>
      </div>

      <section className="mt-10 space-y-8">
        <h2 className="font-display text-2xl font-semibold">
          {recommendations.length} proposition{recommendations.length > 1 ? "s" : ""} shortlistée
          {recommendations.length > 1 ? "s" : ""}
        </h2>

        {recommendations.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucune proposition générée pour l&apos;instant. L&apos;organisateur peut lancer une
            génération depuis la fiche voyage.
          </p>
        ) : (
          recommendations.map((reco, index) => {
            const destName = reco.destination?.name ?? "Destination";
            const budget = reco.budget as BudgetBreakdown | null;
            const links = buildDeepLinksForProposal({
              destinationCity: destName,
              origins: departureOrigins,
              departDate: trip.startDate,
              returnDate: trip.endDate,
              nights,
              fallbackDistanceKm: reco.destination?.distanceKm,
              groupAdults: trip.participantsCount,
            });

            return (
              <article
                key={reco.id}
                className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
              >
                <div className="border-b border-border bg-surface/40 px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="muted">#{index + 1}</Badge>
                        <Badge variant="lagoon">Score {Math.round(reco.score)}</Badge>
                      </div>
                      <h3 className="mt-2 font-display text-xl font-semibold">
                        {destName}
                        {reco.destination?.country ? (
                          <span className="text-base font-normal text-muted-foreground">
                            {" "}
                            · {reco.destination.country}
                          </span>
                        ) : null}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
                    </div>
                    {budget ? (
                      <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-right">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Budget estimé
                        </p>
                        <p className="font-display text-lg font-semibold">
                          <Wallet className="mr-1 inline size-4" />
                          {formatEuro(budget.totalPerPerson)} / pers.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          soit {formatEuro(budget.totalGroup)} pour le groupe
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Transport moy. {formatEuro(budget.transport)}
                          {typeof budget.transportGroup === "number"
                            ? ` · groupe ${formatEuro(budget.transportGroup)}`
                            : ""}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-5 px-5 py-5 sm:px-6">
                  <div>
                    <h4 className="text-sm font-semibold">Vérifier les prix en temps réel</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Un bloc par ville de départ — les tarifs vols/trains dépendent de l&apos;origine.
                    </p>
                  </div>

                  {links.origins.map((origin) => (
                    <div
                      key={origin.originCity}
                      className="rounded-2xl border border-border/80 bg-surface/30 p-4"
                    >
                      <p className="text-sm font-medium">
                        Depuis {origin.originCity}{" "}
                        <span className="text-muted-foreground">
                          ({origin.adults} pers.)
                          {origin.distanceKm < 9000
                            ? ` · ~${origin.distanceKm} km`
                            : ""}
                        </span>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ExternalLinkButton href={origin.googleFlights} variant="hero">
                          <Plane className="size-3.5" /> Google Flights
                        </ExternalLinkButton>
                        <ExternalLinkButton href={origin.kayak}>
                          <Plane className="size-3.5" /> Kayak
                        </ExternalLinkButton>
                        {origin.showTrain && origin.omio ? (
                          <ExternalLinkButton href={origin.omio}>
                            <Train className="size-3.5" /> Omio
                          </ExternalLinkButton>
                        ) : null}
                        {origin.showTrain && origin.trainline ? (
                          <ExternalLinkButton href={origin.trainline}>
                            <Train className="size-3.5" /> Trainline
                          </ExternalLinkButton>
                        ) : null}
                        {origin.showTrain && origin.sncf ? (
                          <ExternalLinkButton href={origin.sncf}>
                            <Train className="size-3.5" /> SNCF Connect
                          </ExternalLinkButton>
                        ) : null}
                      </div>
                    </div>
                  ))}

                  <Separator />

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Hébergement (groupe) :</span>
                    <ExternalLinkButton href={links.bookingGroup} variant="glass">
                      <Hotel className="size-3.5" /> Booking.com — {destName}
                    </ExternalLinkButton>
                    <Button
                      type="button"
                      variant={watched[reco.id] ? "lagoon" : "outline"}
                      size="sm"
                      disabled={watchMutation.isPending}
                      onClick={() =>
                        watchMutation.mutate({
                          recommendationId: reco.id,
                          destinationName: destName,
                        })
                      }
                    >
                      {watched[reco.id] ? (
                        <BellRing className="size-3.5" />
                      ) : (
                        <Bell className="size-3.5" />
                      )}
                      {watched[reco.id] ? "Prix suivi" : "Suivre ce prix"}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      {costSplitData?.split ? (
        <section className="mt-12 space-y-4">
          <h2 className="font-display text-2xl font-semibold">
            {costSplitData.isSelected
              ? "Destination validée — qui paie quoi ?"
              : "Répartition (proposition)"}
          </h2>
          <CostSplitCard split={costSplitData.split} tripName={trip.name} />
        </section>
      ) : null}
    </main>
  );
}
