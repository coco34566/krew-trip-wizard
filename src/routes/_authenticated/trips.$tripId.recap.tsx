import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  CalendarDays,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getTripRecap, watchPrice, getCostSplit, reactToRecommendation } from "@/lib/trips.functions";
import { CostSplitCard } from "@/components/krew/CostSplitCard";
import { buildDeepLinksForProposal } from "@/lib/krew/deep-links";
import { buildTripIcs } from "@/lib/krew/calendar-export";
import { PackingListCard } from "@/components/krew/PackingListCard";
import { ProposalScoreRadar } from "@/components/krew/ProposalScoreRadar";
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
  const doReact = useServerFn(reactToRecommendation);
  const queryClient = useQueryClient();
  const [watched, setWatched] = useState<Record<string, boolean>>({});

  const reactMutation = useMutation({
    mutationFn: (payload: { recommendationId: string; reaction: "like" | "dislike" | null }) =>
      doReact({
        data: {
          tripId,
          recommendationId: payload.recommendationId,
          reaction: payload.reaction,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-recap", tripId] });
    },
    onError: (e: any) => {
      toast.error(String(e?.message ?? "Erreur lors de l'enregistrement de la réaction"));
    },
  });

  const handleReact = (recommendationId: string, reaction: "like" | "dislike" | null) => {
    reactMutation.mutate({ recommendationId, reaction });
  };

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
        console.error("Table price_watch absente — applique la migration Supabase", msg);
        toast.error("Une erreur est survenue, réessaie dans un instant");
      } else {
        console.error("Impossible d'activer le suivi:", e);
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

  const googleCalendarUrl = useMemo(() => {
    const tripObj = data?.trip;
    if (!tripObj?.startDate || !tripObj?.endDate) return "";
    const start = tripObj.startDate.replace(/[-]/g, "");
    const endDateObj = new Date(tripObj.endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const nextDay = endDateObj.toISOString().slice(0, 10).replace(/[-]/g, "");
    const title = encodeURIComponent(tripObj.name || "Mon Voyage Krew");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${nextDay}`;
  }, [data?.trip?.startDate, data?.trip?.endDate, data?.trip?.name]);

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

  const handleDownloadIcs = () => {
    const groupItinerary = (trip as any).group_itinerary ?? null;
    const compliantTrip = {
      ...trip,
      dates_locked: true,
      group_itinerary: groupItinerary,
    };
    const icsContent = buildTripIcs(compliantTrip as any, groupItinerary);
    if (!icsContent) {
      toast.error("Impossible d'exporter le calendrier.");
      return;
    }
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${trip.name || "voyage"}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Calendrier .ics téléchargé !");
  };

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
          Ces liens ouvrent les comparateurs avec tes critères pré-remplis — les prix affichés dans
          Krew sont des estimations, clique pour voir le prix réel du jour.
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
              fallbackDistanceKm: reco.destination?.distanceKm ?? null,
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

                        {/* Réactions */}
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            size="sm"
                            variant={(reco as any).myReaction === "like" ? "lagoon" : "outline"}
                            className="h-6 px-1.5 text-[11px] gap-1 cursor-pointer"
                            onClick={() => handleReact(reco.id, (reco as any).myReaction === "like" ? null : "like")}
                          >
                            <ThumbsUp className="size-3" />
                            <span>{(reco as any).likesCount ?? 0}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant={(reco as any).myReaction === "dislike" ? "destructive" : "outline"}
                            className="h-6 px-1.5 text-[11px] gap-1 cursor-pointer"
                            onClick={() => handleReact(reco.id, (reco as any).myReaction === "dislike" ? null : "dislike")}
                          >
                            <ThumbsDown className="size-3" />
                            <span>{(reco as any).dislikesCount ?? 0}</span>
                          </Button>
                        </div>
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

                        {/* Fraîcheur des prix */}
                        <div className="mt-2 flex justify-end gap-1 flex-wrap">
                          {budget.priceSource?.transport === "api" ? (
                            <Badge variant="lagoon" className="text-[10px] px-1.5 py-0 font-medium">Transport réel</Badge>
                          ) : (
                            <Badge variant="muted" className="text-[10px] px-1.5 py-0 font-medium text-muted-foreground bg-muted/30">Transport estimé</Badge>
                          )}
                          {budget.priceSource?.accommodation === "api" ? (
                            <Badge variant="lagoon" className="text-[10px] px-1.5 py-0 font-medium">Logement réel</Badge>
                          ) : (
                            <Badge variant="muted" className="text-[10px] px-1.5 py-0 font-medium text-muted-foreground bg-muted/30">Logement estimé</Badge>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-5 px-5 py-5 sm:px-6">
                  <ProposalScoreRadar
                    subScores={((budget as any)?.subScores ?? {}) as any}
                    consensusScore={(budget as any)?.consensusScore ?? null}
                    minSatisfaction={(budget as any)?.minSatisfaction ?? null}
                    satisfiedCount={(budget as any)?.satisfiedCount ?? null}
                    participantsEvaluated={(budget as any)?.participantsEvaluated ?? null}
                  />
                  <div>
                    <h4 className="text-sm font-semibold">Vérifier les prix en temps réel</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Un bloc par ville de départ — les tarifs vols/trains dépendent de l&apos;origine.
                    </p>
                  </div>

                  {links.origins.map((origin) => {
                    const transportOrigins = Array.isArray((budget as any)?.transportByOrigin)
                      ? (budget as any).transportByOrigin
                      : [];
                    const matchedTransport = transportOrigins.find(
                      (t: any) => String(t.city || "").toLowerCase().trim() === origin.originCity.toLowerCase().trim()
                    );
                    const transportOfferUrl = matchedTransport?.url || matchedTransport?.searchUrl || null;

                    return (
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
                          {transportOfferUrl ? (
                            <ExternalLinkButton href={transportOfferUrl} variant="hero">
                              <Plane className="size-3.5" /> Voir l&apos;offre {matchedTransport?.label || matchedTransport?.provider || "réelle"}
                            </ExternalLinkButton>
                          ) : null}
                          <ExternalLinkButton href={origin.googleFlights} variant={transportOfferUrl ? "outline" : "hero"}>
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
                  );
                })}

                  <Separator />

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Hébergement (groupe) :</span>
                    {reco.accommodation?.bookingUrl ? (
                      <>
                        <ExternalLinkButton href={reco.accommodation.bookingUrl} variant="hero">
                          <Hotel className="size-3.5" /> Réserver cet hébergement ({reco.accommodation.name})
                        </ExternalLinkButton>
                        <ExternalLinkButton href={links.bookingGroup} variant="glass">
                          <Hotel className="size-3.5" /> Comparer d&apos;autres hôtels
                        </ExternalLinkButton>
                      </>
                    ) : (
                      <ExternalLinkButton href={links.bookingGroup} variant="glass">
                        <Hotel className="size-3.5" /> Comparer d&apos;autres hôtels
                      </ExternalLinkButton>
                    )}
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

        {trip.runnerUps && trip.runnerUps.length > 0 ? (
          <div className="mt-8 rounded-2xl bg-surface/30 p-4 border border-border/60 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground mr-1.5">Aussi envisagées :</span>
            {trip.runnerUps.map((r: any, idx: number) => (
              <span key={r.name}>
                <span className="font-medium text-foreground/80">{r.name}</span>{" "}
                <span>({r.reason})</span>
                {idx < trip.runnerUps.length - 1 ? " · " : ""}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {costSplitData?.split ? (
        <section className="mt-12 space-y-4">
          <h2 className="font-display text-2xl font-semibold">
            {costSplitData.isSelected
              ? "Destination validée — qui paie quoi ?"
              : "Répartition (proposition)"}
          </h2>
          <CostSplitCard split={costSplitData.split} tripName={trip.name} tripId={tripId} />
        </section>
      ) : null}

      <div className="space-y-8 mt-12">
        <section className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            <h2 className="font-display text-xl font-semibold tracking-tight">Exporter mon calendrier</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">
            Télécharge le fichier de l'itinéraire ou ajoute le séjour complet à ton agenda.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button onClick={handleDownloadIcs} variant="hero" size="sm" className="gap-1.5">
              <CalendarDays className="size-4" /> Télécharger .ics
            </Button>
            {googleCalendarUrl && (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer">
                  Ajouter à Google Calendar
                </a>
              </Button>
            )}
          </div>
        </section>

        <PackingListCard
          avgTemp={null}
          activities={recommendations.flatMap((r: any) => r.match_reasons || [])}
          durationDays={nights || 2}
          eventType={null}
        />
      </div>
    </main>
  );
}
