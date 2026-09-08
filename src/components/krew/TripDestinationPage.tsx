import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Heart } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KrewJourneyErrorState, KrewJourneyLoadingState } from "@/components/krew/KrewJourneyAsyncState";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewJourneyStatusPanel } from "@/components/krew/KrewJourneyStatusPanel";
import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { KrewPhotoFallback } from "@/components/krew/KrewPhotoFallback";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewMark, KrewNote } from "@/components/krew/visual-language";
import { destinationBudgetTotal, isDestinationBudgetEstimated } from "@/lib/krew/destination-budget";
import { formatEuro } from "@/lib/krew/constants";
import {
  generateRecommendations,
  getGenerationReadiness,
  getTripDetail,
  selectRecommendation,
  toggleVote,
} from "@/lib/trips.functions";
import { cn } from "@/lib/utils";

function destinationPhotoUrl(name?: string | null, imageUrl?: string | null) {
  if (imageUrl && /^https?:\/\//i.test(String(imageUrl))) return String(imageUrl);
  const key = String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  const known: Record<string, string> = {
    barcelone: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
    barcelona: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
    lisbonne: "https://images.unsplash.com/photo-1555881403-64995e224d73?auto=format&fit=crop&w=800&q=80",
    lisbon: "https://images.unsplash.com/photo-1555881403-64995e224d73?auto=format&fit=crop&w=800&q=80",
    porto: "https://images.unsplash.com/photo-1555881403-26d5c5c6e0e1?auto=format&fit=crop&w=800&q=80",
    rome: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80",
    paris: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
    madrid: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=800&q=80",
    amsterdam: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=800&q=80",
    berlin: "https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=800&q=80",
    prague: "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=800&q=80",
    budapest: "https://images.unsplash.com/photo-1541343672885-9be56236302a?auto=format&fit=crop&w=800&q=80",
  };
  for (const [city, url] of Object.entries(known)) {
    if (key.includes(city)) return url;
  }
  return null;
}

export function TripDestinationPage({ tripId }: { tripId: string }) {
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const fetchReadiness = useServerFn(getGenerationReadiness);
  const regenerate = useServerFn(generateRecommendations);
  const select = useServerFn(selectRecommendation);
  const vote = useServerFn(toggleVote);

  const detailQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });
  const readinessQuery = useQuery({
    queryKey: ["generation-readiness", tripId],
    queryFn: () => fetchReadiness({ data: { tripId } }),
    retry: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
  };

  const regenerateMutation = useMutation({
    mutationFn: () => regenerate({ data: { tripId, force: false } }),
    onSuccess: (result: any) => {
      refresh();
      if (result?.skipped) toast.error("Les préférences nécessaires du groupe ne sont pas encore toutes renseignées.");
    },
    onError: (error) => {
      console.error("Impossible de proposer des destinations:", error);
      toast.error("Impossible de proposer des destinations pour le moment.");
    },
  });

  const selectMutation = useMutation({
    mutationFn: (recommendationId: string) => select({ data: { tripId, recommendationId } }),
    onSuccess: refresh,
    onError: (error) => {
      console.error("Impossible de choisir la destination:", error);
      toast.error("Impossible de choisir cette destination pour le moment.");
    },
  });

  const voteMutation = useMutation({
    mutationFn: (recommendationId: string) => vote({ data: { tripId, recommendationId } }),
    onSuccess: refresh,
    onError: (error) => {
      console.error("Impossible d’enregistrer le vote destination:", error);
      toast.error("Impossible d’enregistrer ton vote pour le moment.");
    },
  });

  if (detailQuery.isLoading || readinessQuery.isLoading) {
    return <KrewJourneyLoadingState context="destinations" />;
  }

  if (!detailQuery.data || detailQuery.isError || readinessQuery.isError) {
    const retrying = detailQuery.isFetching || readinessQuery.isFetching;
    return (
      <KrewJourneyErrorState
        tripId={tripId}
        title="Impossible de charger les destinations"
        description="Les propositions de destination ne sont pas disponibles pour le moment."
        retrying={retrying}
        onRetry={() => {
          void detailQuery.refetch();
          void readinessQuery.refetch();
        }}
      />
    );
  }

  const data = detailQuery.data as any;
  const trip = data.trip as any;
  const readiness = readinessQuery.data as any;
  const profile = data.profile as any;
  const recommendations = (data.recommendations ?? []) as any[];
  const votes = (data.votes ?? []) as any[];
  const activities = (data.activities ?? []) as any[];
  const isAdmin = Boolean(data.isOwner);
  const destinationSelected = recommendations.some((recommendation) => recommendation.is_selected);
  const selectedRecommendation = recommendations.find((recommendation) => recommendation.is_selected);
  const noAdmissibleProposals = trip?.group_logistics?.destinationGenerationState === "no_admissible_proposals";

  return (
    <KrewPageShell size="standard" className="space-y-8 py-8 sm:py-10">
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
        title="Destination"
        otterSrc="/brand/otter-states/destination.png"
        annotation={
          <KrewNote variant="tape" tone="sage" rotation={-2} size="xs" className="hidden sm:inline-block">
            Où on va
          </KrewNote>
        }
      >
        <p>Compare les propositions qui correspondent le mieux au profil et aux contraintes du groupe.</p>
      </KrewJourneyPageHeader>

      {!profile?.validated && !profile?.legacyBypass ? (
        <KrewJourneyStatusPanel
          title="Profil du voyage à choisir"
          icon="attention"
          tone="locked"
          action={
            <Button asChild size="sm">
              <Link to="/trips/$tripId/profile" params={{ tripId }}>Choisir le Profil du voyage</Link>
            </Button>
          }
        >
          <p>Choisis d’abord le Profil du voyage avant de chercher des destinations.</p>
        </KrewJourneyStatusPanel>
      ) : (
        <>
          {destinationSelected ? (
            <KrewJourneyStatusPanel
              title="Destination choisie"
              icon="check"
              tone="complete"
              action={
                <Button asChild size="sm">
                  <Link to="/trips/$tripId/accommodation" params={{ tripId }}>Choisir l’hébergement</Link>
                </Button>
              }
            >
              <p>
                {selectedRecommendation?.destinations?.name ?? "La destination du groupe"} est retenue pour la suite de l’organisation
                {isAdmin ? ". Tu peux encore changer de choix ci-dessous." : "."}
              </p>
            </KrewJourneyStatusPanel>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {recommendations.length
                ? `${recommendations.length} proposition${recommendations.length > 1 ? "s" : ""} disponible${recommendations.length > 1 ? "s" : ""}.`
                : "Les propositions apparaîtront ici."}
            </p>
            {isAdmin ? (
              <KrewStatefulButton
                variant="outline"
                className="w-full sm:w-auto"
                idleLabel={recommendations.length ? "Voir d’autres propositions" : "Voir les destinations"}
                loadingLabel="Recherche en cours…"
                successLabel="Propositions actualisées"
                errorLabel="Réessayer"
                resetAfterMs={1400}
                onAction={() => regenerateMutation.mutateAsync()}
                disabled={readiness ? !readiness.canGenerate : false}
              />
            ) : null}
          </div>

          {regenerateMutation.isPending ? (
            <KrewThinkingState context="destinations" />
          ) : recommendations.length === 0 ? (
            readiness && !readiness.canGenerate ? (
              <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {isAdmin
                  ? "Les préférences nécessaires du groupe doivent être renseignées avant de proposer des destinations."
                  : "Les propositions de destinations arriveront bientôt."}
              </div>
            ) : noAdmissibleProposals ? (
              <KrewJourneyStatusPanel title="Aucune destination compatible pour le moment" icon="attention" tone="info">
                <p>Aucune destination ne respecte suffisamment les contraintes actuelles. Reviens sur les préférences ou le Profil du voyage pour élargir les possibilités.</p>
              </KrewJourneyStatusPanel>
            ) : (
              <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {isAdmin
                  ? "Génère les premières propositions pour le groupe."
                  : "Les propositions de destinations arriveront bientôt."}
              </div>
            )
          ) : (
            <div className="grid gap-4">
              {[...recommendations]
                .sort(
                  (a, b) =>
                    Number(b.is_selected) - Number(a.is_selected) ||
                    Number(b.score || 0) - Number(a.score || 0),
                )
                .map((recommendation, index) => {
                  const recommendationVotes = votes.filter(
                    (voteItem) => voteItem.recommendation_id === recommendation.id,
                  );
                  const hasVoted = recommendationVotes.some(
                    (voteItem) => voteItem.user_id === data.userId,
                  );
                  const recommendationActivities = activities
                    .filter((activity) => (recommendation.activity_ids ?? []).includes(activity.id))
                    .slice(0, 3);
                  const budgetTotal = recommendation.budget
                    ? destinationBudgetTotal(recommendation.budget)
                    : null;
                  const budgetEstimated = recommendation.budget
                    ? isDestinationBudgetEstimated(recommendation.budget)
                    : false;
                  const photo = destinationPhotoUrl(
                    recommendation.destinations?.name,
                    recommendation.destinations?.image_url,
                  );

                  return (
                    <article
                      key={recommendation.id}
                      className={cn(
                        "rounded-2xl border bg-card p-4 shadow-2xs transition sm:p-5",
                        recommendation.is_selected
                          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/10"
                          : "border-border/50 hover:border-primary/25",
                      )}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row">
                        {photo ? (
                          <img
                            src={photo}
                            alt={
                              recommendation.destinations?.name
                                ? `Vue de ${recommendation.destinations.name}`
                                : "Destination"
                            }
                            className="h-44 w-full shrink-0 rounded-xl object-cover sm:h-32 sm:w-44"
                            loading="lazy"
                          />
                        ) : (
                          <KrewPhotoFallback
                            type="destination"
                            aspectRatio="4/3"
                            className="h-44 w-full shrink-0 sm:h-32 sm:w-44"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                                #{index + 1}
                                {recommendation.destinations?.country
                                  ? ` · ${recommendation.destinations.country}`
                                  : ""}
                              </p>
                              <h2 className="font-display text-2xl font-semibold leading-tight">
                                {recommendation.destinations?.name}
                              </h2>
                            </div>
                            {recommendation.is_selected ? <Badge variant="success">Choisie</Badge> : null}
                          </div>

                          {budgetTotal != null && budgetTotal > 0 ? (
                            <p className="mt-2 text-sm">
                              <span className="font-mono font-semibold text-foreground">
                                {budgetEstimated ? "Budget estimé ~" : ""}
                                {formatEuro(budgetTotal)}
                              </span>
                              <span className="text-muted-foreground"> / pers.</span>
                            </p>
                          ) : null}

                          {(recommendation.match_reasons ?? []).length ? (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {recommendation.match_reasons.slice(0, 4).map((reason: string) => (
                                <li
                                  key={reason}
                                  className="rounded-full bg-primary/8 px-2.5 py-0.5 text-[11px] text-foreground/80"
                                >
                                  {reason}
                                </li>
                              ))}
                            </ul>
                          ) : recommendation.rationale ? (
                            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                              {recommendation.rationale}
                            </p>
                          ) : null}

                          {recommendationActivities.length ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground/80">À faire · </span>
                              {recommendationActivities
                                .map(
                                  (activity) =>
                                    `${activity.name}${activity.price_per_person ? ` (${formatEuro(Number(activity.price_per_person))})` : ""}`,
                                )
                                .join(" · ")}
                            </p>
                          ) : null}

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant={hasVoted ? "lagoon" : "outline"}
                              disabled={voteMutation.isPending}
                              onClick={() => voteMutation.mutate(recommendation.id)}
                            >
                              <Heart className={cn("size-3.5", hasVoted && "fill-current")} />
                              {hasVoted ? "Mon vote" : "Voter"} · {recommendationVotes.length}
                            </Button>
                            {isAdmin && recommendation.is_selected ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                className="border-sage/50 bg-sage/15 text-primary"
                              >
                                <KrewMark type="check" tone="sage" size="sm" className="size-3.5" />
                                Destination choisie
                              </Button>
                            ) : isAdmin ? (
                              <KrewStatefulButton
                                size="sm"
                                variant={destinationSelected ? "outline" : "default"}
                                idleLabel={
                                  destinationSelected
                                    ? "Changer pour celle-ci"
                                    : "Choisir cette destination"
                                }
                                loadingLabel="Sélection…"
                                successLabel="Destination choisie"
                                errorLabel="Réessayer"
                                onAction={() => selectMutation.mutateAsync(recommendation.id)}
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
        </>
      )}
    </KrewPageShell>
  );
}
