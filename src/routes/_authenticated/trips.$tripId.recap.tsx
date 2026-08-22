import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";

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
import { formatEuro } from "@/lib/krew/constants";
import type { BudgetBreakdown } from "@/lib/krew/engine";
import { KrewIcon, KrewMark, KrewHighlight, KrewSectionWave } from "@/components/krew/visual-language";

export const Route = createFileRoute("/_authenticated/trips/$tripId/recap")({
  head: () => ({
    meta: [
      { title: "Récap du groupe — KREW" },
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
  variant?: "outline" | "default" | "secondary";
}) {
  return (
    <Button asChild variant={variant} size="sm" className="gap-1.5 rounded-xl font-medium">
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
    const title = encodeURIComponent(tripObj.name || "Mon Voyage KREW");
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

  const selectedDestinationReco = recommendations.find((r) => (r as any).status === "selected") || recommendations[0];
  const selectedPhotoUrl = selectedDestinationReco?.destination?.imageUrl;

  return (
    <main className="mx-auto max-w-[1020px] px-5 sm:px-6 lg:px-10 py-8 sm:py-12 space-y-8">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="size-4" /> Retour au voyage
      </Link>

      {/* HERO COVER HEADER */}
      <header className="space-y-4">
        {selectedPhotoUrl && /^https?:\/\//i.test(selectedPhotoUrl) ? (
          <div className="relative aspect-[21/9] sm:aspect-[24/9] w-full overflow-hidden rounded-[24px] border border-border/50 bg-surface/50">
            <img
              src={selectedPhotoUrl}
              alt=""
              className="size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          </div>
        ) : null}

        <div className="space-y-2 relative">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary font-mono">Récap du groupe</p>
          <div className="relative inline-block">
            <h1 className="font-display text-[36px] sm:text-[48px] font-normal leading-tight text-foreground">
              {trip.name}
            </h1>
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="md"
              className="absolute left-0 -bottom-2 w-[160px] pointer-events-none"
            />
          </div>
          <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground font-sans">
            <span className="inline-flex items-center gap-1.5 font-mono">
              <KrewIcon name="calendar" tone="plum" size="sm" className="size-4" /> {dateLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono">
              <KrewIcon name="group" tone="plum" size="sm" className="size-4" /> {trip.participantsCount} pers.
            </span>
            {progress ? (
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-primary font-medium">
                <KrewIcon name="check" tone="sage" size="sm" className="size-3.5" /> Réponses {progress.answered}/{progress.total}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground font-sans pt-1">
            Départs : {departureOrigins.map((o) => `${o.city} (${o.count})`).join(" · ")}
          </p>
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs sm:text-sm text-foreground/90 font-sans">
        <KrewIcon name="attention" tone="plum" size="sm" className="size-4 shrink-0 mt-0.5" />
        <p>
          Ces liens ouvrent les comparateurs avec tes critères pré-remplis — les prix affichés dans
          KREW sont des estimations, clique pour voir le prix réel du jour.
        </p>
      </div>

      {/* PROPOSITIONS SHORTLISTÉES */}
      <section className="space-y-6 pt-4">
        <div className="border-b border-border/50 pb-3">
          <h2 className="font-display text-2xl font-normal text-foreground">
            {recommendations.length} proposition{recommendations.length > 1 ? "s" : ""} shortlistée
            {recommendations.length > 1 ? "s" : ""}
          </h2>
        </div>

        {recommendations.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground font-sans">
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
                className="overflow-hidden rounded-[24px] border border-border/60 bg-background shadow-sm space-y-0"
              >
                <div className="border-b border-border/50 bg-surface/40 px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="muted">#{index + 1}</Badge>

                        {/* Réactions */}
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            size="sm"
                            variant={(reco as any).myReaction === "like" ? "default" : "outline"}
                            className="h-6 px-2 text-[11px] gap-1 rounded-full cursor-pointer"
                            onClick={() => handleReact(reco.id, (reco as any).myReaction === "like" ? null : "like")}
                          >
                            <KrewIcon name="vote" tone={(reco as any).myReaction === "like" ? "cream" : "plum"} size="sm" className="size-3" />
                            <span className="font-mono">{(reco as any).likesCount ?? 0}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant={(reco as any).myReaction === "dislike" ? "destructive" : "outline"}
                            className="h-6 px-2 text-[11px] gap-1 rounded-full cursor-pointer"
                            onClick={() => handleReact(reco.id, (reco as any).myReaction === "dislike" ? null : "dislike")}
                          >
                            <span className="font-mono">✕ {(reco as any).dislikesCount ?? 0}</span>
                          </Button>
                        </div>
                      </div>
                      <h3 className="mt-2 font-display text-2xl font-normal text-foreground">
                        {destName}
                        {reco.destination?.country ? (
                          <span className="text-base font-normal text-muted-foreground font-sans">
                            {" "}
                            · {reco.destination.country}
                          </span>
                        ) : null}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground font-mono">{dateLabel}</p>
                    </div>
                    {budget ? (
                      <div className="rounded-2xl border border-border/60 bg-background p-4 text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                          Budget estimé
                        </p>
                        <KrewHighlight tone="sage" className="font-mono text-xl sm:text-2xl font-bold text-primary inline-block my-1 px-2 py-0.5">
                          {formatEuro(budget.totalPerPerson)} / pers.
                        </KrewHighlight>
                        <p className="text-xs text-muted-foreground font-mono">
                          soit {formatEuro(budget.totalGroup)} pour le groupe
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground font-mono">
                          Transport moy. {formatEuro(budget.transport)}
                          {typeof budget.transportGroup === "number"
                            ? ` · groupe ${formatEuro(budget.transportGroup)}`
                            : ""}
                        </p>

                        {/* Fraîcheur des prix */}
                        <div className="mt-2 flex justify-end gap-1 flex-wrap">
                          {budget.priceSource?.transport === "provider" ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">Transport réel</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono text-muted-foreground">Transport estimé</Badge>
                          )}
                          {budget.priceSource?.accommodation === "provider" ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">Logement réel</Badge>
                          ) : budget.priceSource?.accommodation === "web" ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">Hébergement vérifié</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono text-muted-foreground">Logement estimé</Badge>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-5 p-5 sm:p-6">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5 font-sans">
                      <KrewIcon name="transport" tone="plum" size="sm" className="size-4" />
                      Vérifier les transports en temps réel
                    </h4>
                    <p className="mt-0.5 text-xs text-muted-foreground font-sans">
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
                        className="rounded-xl border border-border/60 bg-surface/30 p-3.5 font-sans"
                      >
                        <p className="text-xs font-semibold text-foreground">
                          Depuis {origin.originCity}{" "}
                          <span className="text-muted-foreground font-mono font-normal">
                            ({origin.adults} pers.)
                            {origin.distanceKm < 9000
                              ? ` · ~${origin.distanceKm} km`
                              : ""}
                          </span>
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {transportOfferUrl ? (
                            <ExternalLinkButton href={transportOfferUrl}>
                              <KrewIcon name="plane" tone="plum" size="sm" className="size-3.5" /> Voir l&apos;offre {matchedTransport?.label || "disponible"}
                            </ExternalLinkButton>
                          ) : null}
                          <ExternalLinkButton href={origin.googleFlights} variant={transportOfferUrl ? "outline" : "default"}>
                            <KrewIcon name="plane" tone="cream" size="sm" className="size-3.5" /> Google Flights
                          </ExternalLinkButton>
                          <ExternalLinkButton href={origin.kayak}>
                            <KrewIcon name="plane" tone="plum" size="sm" className="size-3.5" /> Kayak
                          </ExternalLinkButton>
                          {origin.showTrain && origin.omio ? (
                            <ExternalLinkButton href={origin.omio}>
                              <KrewIcon name="train" tone="plum" size="sm" className="size-3.5" /> Omio
                            </ExternalLinkButton>
                          ) : null}
                          {origin.showTrain && origin.trainline ? (
                            <ExternalLinkButton href={origin.trainline}>
                              <KrewIcon name="train" tone="plum" size="sm" className="size-3.5" /> Trainline
                            </ExternalLinkButton>
                          ) : null}
                          {origin.showTrain && origin.sncf ? (
                            <ExternalLinkButton href={origin.sncf}>
                              <KrewIcon name="train" tone="plum" size="sm" className="size-3.5" /> SNCF Connect
                            </ExternalLinkButton>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}

                  <Separator />

                  <div className="flex flex-wrap items-center gap-2 font-sans">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <KrewIcon name="accommodation" tone="plum" size="sm" className="size-4" /> Hébergement (groupe) :
                    </span>
                    {reco.accommodation?.bookingUrl ? (
                      <>
                        <ExternalLinkButton href={reco.accommodation.bookingUrl} variant="default">
                          <KrewIcon name="booked" tone="cream" size="sm" className="size-3.5" /> Réserver cet hébergement ({reco.accommodation.name})
                        </ExternalLinkButton>
                        <ExternalLinkButton href={links.bookingGroup}>
                          <KrewIcon name="search" tone="plum" size="sm" className="size-3.5" /> Comparer d&apos;autres hôtels
                        </ExternalLinkButton>
                      </>
                    ) : (
                      <ExternalLinkButton href={links.bookingGroup}>
                        <KrewIcon name="search" tone="plum" size="sm" className="size-3.5" /> Comparer d&apos;autres hôtels
                      </ExternalLinkButton>
                    )}
                    <Button
                      type="button"
                      variant={watched[reco.id] ? "secondary" : "outline"}
                      size="sm"
                      className="rounded-xl text-xs font-medium"
                      disabled={watchMutation.isPending}
                      onClick={() =>
                        watchMutation.mutate({
                          recommendationId: reco.id,
                          destinationName: destName,
                        })
                      }
                    >
                      <KrewIcon name="time" tone="plum" size="sm" className="size-3.5 mr-1" />
                      {watched[reco.id] ? "Prix suivi" : "Suivre ce prix"}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })
        )}

        {trip.runnerUps && trip.runnerUps.length > 0 ? (
          <div className="mt-6 rounded-2xl bg-surface/30 p-4 border border-border/60 text-xs text-muted-foreground font-sans">
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

      <KrewSectionWave tone="sage" position="bottom" className="my-8" />

      {costSplitData?.split ? (
        <section className="space-y-4 pt-4">
          <h2 className="font-display text-2xl font-normal text-foreground">
            {costSplitData.isSelected
              ? "Destination validée — qui paie quoi ?"
              : "Répartition des coûts (proposition)"}
          </h2>
          <CostSplitCard split={costSplitData.split} tripName={trip.name} tripId={tripId} />
        </section>
      ) : null}

      <div className="space-y-8 pt-6">
        <section className="rounded-[24px] border border-border/60 bg-background p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <KrewIcon name="calendar" tone="plum" size="sm" className="size-5" />
            <h2 className="font-display text-xl font-normal text-foreground">Exporter mon calendrier</h2>
          </div>
          <p className="text-xs text-muted-foreground font-sans">
            Télécharge le fichier de l'itinéraire ou ajoute le séjour complet à ton agenda.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button onClick={handleDownloadIcs} size="sm" className="rounded-xl gap-1.5 font-medium">
              <KrewIcon name="calendar" tone="cream" size="sm" className="size-4" /> Télécharger .ics
            </Button>
            {googleCalendarUrl && (
              <Button asChild variant="outline" size="sm" className="rounded-xl gap-1.5 font-medium">
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
