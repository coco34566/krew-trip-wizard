// src/routes/_authenticated/trips.$tripId.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Heart, Loader2, MapPin, Sparkles, Star, Trash2, UserPlus, Users, Wallet, Copy, Link2, Check, ClipboardList, Lock, Unlock, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  getTripDetail,
  generateRecommendations,
  getGenerationReadiness,
  getCostSplit,
  inviteParticipant,
  removeParticipant,
  selectRecommendation,
  toggleVote,
  toggleActivityVote,
  finalizeSelectedActivities,
  cancelTrip,
} from "@/lib/trips.functions";
import { getParticipantsProgress, getMyParticipantPreferences } from "@/lib/participant-preferences.functions";
import { searchExternalForTrip } from "@/lib/external/search-hotels.functions";
import { categoryLabel, eventTypeLabel, formatEuro, TRIP_STATUS_LABELS } from "@/lib/krew/constants";
import type { BudgetBreakdown, ItineraryDay } from "@/lib/krew/engine";
import { cn } from "@/lib/utils";
import { CostSplitCard } from "@/components/krew/CostSplitCard";
import { TripHubDashboard } from "@/components/krew/TripHubDashboard";
import {
  getTripAvailability,
  chooseTripDates,
  unlockTripDates,
} from "@/lib/availability.functions";

export const Route = createFileRoute("/_authenticated/trips/$tripId/")({
  head: () => ({
    meta: [
      { title: "Mon Voyage — Krew" },
      { name: "description", content: "Propositions Krew, planning jour par jour, budget détaillé et votes du groupe." },
      { property: "og:title", content: "Mon Voyage — Krew" },
      { property: "og:description", content: "Comparez les propositions et validez le voyage avec votre groupe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TripDetail,
});

type Recommendation = {
  id: string;
  score: number;
  rationale: string | null;
  match_reasons: string[] | null;
  is_selected: boolean;
  itinerary: ItineraryDay[] | null;
  budget: BudgetBreakdown | null;
  activity_ids: string[] | null;
  destinations: { name: string; country: string; description: string | null; image_url: string | null; rating: number } | null;
  accommodations: { name: string; type: string; rating: number; price_per_night_per_person: number; distance_center_km: number } | null;
};

function TripDetail() {
  const { tripId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const vote = useServerFn(toggleVote);
  const select = useServerFn(selectRecommendation);
  const invite = useServerFn(inviteParticipant);
  const removeGuest = useServerFn(removeParticipant);
  const regenerate = useServerFn(generateRecommendations);
  const fetchReadiness = useServerFn(getGenerationReadiness);
  const { data: readiness } = useQuery({
    queryKey: ["generation-readiness", tripId],
    queryFn: () => fetchReadiness({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });
  const fetchProgress = useServerFn(getParticipantsProgress);
  const searchExternal = useServerFn(searchExternalForTrip);
  const fetchSplit = useServerFn(getCostSplit);
  const fetchAvail = useServerFn(getTripAvailability);
  const fetchStar = useServerFn(getStarPreferences);
  const { data: starData } = useQuery({
    queryKey: ["star-prefs", tripId],
    queryFn: () => fetchStar({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const chooseDatesFn = useServerFn(chooseTripDates);
  const unlockDatesFn = useServerFn(unlockTripDates);

  const { data: availData } = useQuery({
    queryKey: ["trip-availability", tripId],
    queryFn: () => fetchAvail({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });
  const { data: costSplitData } = useQuery({
    queryKey: ["cost-split", tripId],
    queryFn: () => fetchSplit({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });
  const [email, setEmail] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${tripId}`;
  }, [tripId]);

  const queryKey = ["trip", tripId];
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => fetchDetail({ data: { tripId } }) });
  const progressQueryKey = ["trip-progress", tripId];
  const { data: progress } = useQuery({
    queryKey: progressQueryKey,
    queryFn: () => fetchProgress({ data: { tripId } }),
  });
  const fetchMyPrefs = useServerFn(getMyParticipantPreferences);
  const { data: myPrefsData } = useQuery({
    queryKey: ["my-participant-prefs", tripId],
    queryFn: () => fetchMyPrefs({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: progressQueryKey });
  };

  const voteMutation = useMutation({
    mutationFn: (recommendationId: string) => vote({ data: { tripId, recommendationId } }),
    onSuccess: refresh,
  });

  const activityVoteFn = useServerFn(toggleActivityVote);
  const finalizeActivitiesFn = useServerFn(finalizeSelectedActivities);
  const activityVoteMutation = useMutation({
    mutationFn: (activityId: string) =>
      activityVoteFn({ data: { tripId, activityId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Vote activité impossible").slice(0, 120)),
  });
  const finalizeActivitiesMutation = useMutation({
    mutationFn: (activityIds: string[]) =>
      finalizeActivitiesFn({ data: { tripId, activityIds } }),
    onSuccess: () => {
      toast.success("Activités validées pour le voyage");
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Validation impossible").slice(0, 120)),
  });

  const selectMutation = useMutation({
    mutationFn: (recommendationId: string) => select({ data: { tripId, recommendationId } }),
    onSuccess: () => {
      toast.success("Destination validée pour le groupe !");
      refresh();
    },
  });
  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: { tripId, email: email.trim() } }),
    onSuccess: () => {
      toast.success("Invitation ajoutée");
      setEmail("");
      refresh();
    },
    onError: () => toast.error("Adresse email invalide ou déjà invitée"),
  });
  const removeMutation = useMutation({
    mutationFn: (participantId: string) => removeGuest({ data: { participantId } }),
    onSuccess: refresh,
  });
  const cancelFn = useServerFn(cancelTrip);
  const cancelMutation = useMutation({
    mutationFn: (hardDelete?: boolean) =>
      cancelFn({ data: { tripId, hardDelete: Boolean(hardDelete) } }),
    onSuccess: (res) => {
      toast.success(res.mode === "deleted" ? "Voyage supprimé" : "Voyage annulé");
      window.location.href = "/dashboard";
    },
    onError: (e: any) => toast.error(String(e?.message ?? e).slice(0, 120)),
  });
  const regenerateMutation = useMutation({
    mutationFn: () => regenerate({ data: { tripId, force: false } }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      if (res?.skipped) {
        toast.error(res?.readiness?.message ?? "Pas assez de réponses pour générer");
      } else if ((res?.count ?? 0) === 0) {
        toast.warning(
          res?.providerErrors?.length
            ? `Aucune proposition (${res.providerErrors[0]})`
            : "Aucune proposition générée — réessaie ou élargis les critères",
        );
      } else {
        toast.success(`${res.count} proposition(s) générée(s)`);
        document.getElementById("hub-destination")?.scrollIntoView({ behavior: "smooth" });
      }
      refresh();
    },
    onError: (e: any) =>
      toast.error(String(e?.message ?? "Erreur lors de la génération").slice(0, 160)),
  });

  const searchExternalMutation = useMutation({
    mutationFn: () => searchExternal({ data: { tripId } }),
    onSuccess: (res: any) => {
      if (res?.ok === false) {
        toast.warning(res.message ?? "Aucune donnée externe récupérée");
        return;
      }
      toast.success(
        `${res.destination} : ${res.accommodationsCount} hébergements comparés${
          res.comparedProviders?.length ? ` (${res.comparedProviders.join(", ")})` : ""
        }, ${res.activitiesCount} activités · ${res.weatherSummary}`,
      );
      if (res.providerErrors?.length) {
        console.warn("Sources indisponibles", res.providerErrors);
      }
      refresh();
    },
    onError: (err: any) => {
      console.error("Recherche externe échouée", err);
      toast.error(err?.message ?? "Recherche externe échouée");
    },
  });


  const chooseDatesMutation = useMutation({
    mutationFn: (payload: { start: string; end: string }) =>
      chooseDatesFn({ data: { tripId, startDate: payload.start, endDate: payload.end } }),
    onSuccess: () => {
      toast.success("Dates validées — les recherches destinations peuvent démarrer");
      queryClient.invalidateQueries({ queryKey: ["trip-availability", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Impossible de valider les dates").slice(0, 140)),
  });

  const unlockDatesMutation = useMutation({
    mutationFn: () => unlockDatesFn({ data: { tripId } }),
    onSuccess: () => {
      toast.success("Dates déverrouillées");
      queryClient.invalidateQueries({ queryKey: ["trip-availability", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Erreur").slice(0, 120)),
  });

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 rounded-3xl" />
      </main>
    );
  }

  const trip = data.trip;
  const recommendations = data.recommendations as unknown as Recommendation[];
  const activities = data.activities as { id: string; name: string; category: string; price_per_person: number; rating: number }[];
  const votes = data.votes as { recommendation_id: string; user_id: string }[];
  const activityVotes = ((data as any).activityVotes ?? []) as {
    activity_id: string;
    user_id: string;
  }[];
  const selectedActivityIds = new Set<string>(
    ((trip as any).selected_activity_ids ?? []) as string[],
  );
  const destinationSelected = recommendations.some((r) => r.is_selected);

  const participants = data.participants as { id: string; email: string; display_name: string | null; status: string }[];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <TripHubDashboard
        tripId={tripId}
        trip={trip}
        isOwner={data.isOwner}
        participantsCount={(data.participants?.length ?? trip.participants_count) || 1}
        progressAnswered={progress?.answered ?? 0}
        progressTotal={progress?.expected ?? progress?.total ?? trip.participants_count ?? 1}
        availabilityAnswered={availData?.answered ?? 0}
        availabilityExpected={availData?.expected ?? trip.participants_count ?? 1}
        provisionalStart={availData?.windows?.[0]?.start ?? (trip as any).provisional_start_date}
        provisionalCoverage={availData?.windows?.[0]?.coverageRatio}
        myAvailabilityDone={Boolean(availData?.mine)}
        myPreferencesDone={Boolean((myPrefsData as any)?.preferences)}
        starDone={Boolean(starData?.preferences)}
        hasRecommendations={recommendations.length > 0}
        destinationSelected={recommendations.some((r) => r.is_selected)}
        topScores={recommendations.slice(0, 3).map((r) => ({
          name: r.destinations?.name ?? "Destination",
          score: r.score,
        }))}
      >
      </TripHubDashboard>

{readiness ? (
        <div className="mt-8 space-y-3 rounded-2xl border border-border bg-surface/40 px-4 py-4 text-sm">
          <p className="font-medium">Statut des questionnaires</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>
              {(readiness as any).checklist?.prefsOk ? "✅" : "⏳"} Préférences :{" "}
              {readiness.quality.answered}/{readiness.quality.expected}
              {readiness.missingLabels?.length
                ? ` · en attente : ${readiness.missingLabels.slice(0, 5).join(", ")}`
                : ""}
            </li>
            <li>
              {(readiness as any).checklist?.availabilityOk ? "✅" : "⏳"} Disponibilités :{" "}
              {(readiness.quality as any).availabilityAnswered ?? 0}/{readiness.quality.expected}
            </li>
            <li>
              {(readiness as any).checklist?.datesLocked ? "✅" : "⏳"} Dates du séjour
              {(readiness.quality as any).datesLocked && (readiness.quality as any).lockedStart
                ? ` · validées (${new Date((readiness.quality as any).lockedStart + "T12:00:00").toLocaleDateString("fr-FR")} → ${new Date((readiness.quality as any).lockedEnd + "T12:00:00").toLocaleDateString("fr-FR")})`
                : " · en attente de validation par l'organisateur"}
            </li>
          </ul>
          {!readiness.canGenerate ? (
            <p className="text-amber-700 dark:text-amber-400">
              {readiness.message?.replace(/API|api/g, "").trim() ||
                "Encore des réponses manquantes avant les suggestions de destinations."}
            </p>
          ) : (
            <p className="text-lagoon">Tout est prêt pour les suggestions de destinations.</p>
          )}
        </div>
      ) : null}

{/* Résumé + validation des dates */}

      {/* 2. Vote activités — une fois la destination validée */}
      {destinationSelected ? (
        <section className="mt-10 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold">2. Activités proposées</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Votez pour les activités qui vous tentent
                {data.isOwner
                  ? " — validez ensuite la sélection finale."
                  : " — l'organisateur validera la sélection finale."}
              </p>
            </div>
            {data.isOwner ? (
              <Button
                variant="hero"
                disabled={finalizeActivitiesMutation.isPending}
                onClick={() => {
                  // Top activités par votes (au moins 1 vote), sinon toutes celles de la reco sélectionnée
                  const selectedReco = recommendations.find((r) => r.is_selected);
                  const ids = selectedReco?.activity_ids ?? [];
                  const ranked = [...ids].sort((a, b) => {
                    const va = activityVotes.filter((v) => v.activity_id === a).length;
                    const vb = activityVotes.filter((v) => v.activity_id === b).length;
                    return vb - va;
                  });
                  const withVotes = ranked.filter(
                    (id) => activityVotes.some((v) => v.activity_id === id),
                  );
                  const finalIds = withVotes.length ? withVotes : ranked;
                  finalizeActivitiesMutation.mutate(finalIds);
                }}
              >
                {finalizeActivitiesMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CheckCircle2 />
                )}
                Valider les activités
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(() => {
              const selectedReco = recommendations.find((r) => r.is_selected);
              const ids = (selectedReco?.activity_ids ?? []) as string[];
              const list = activities.filter((a: any) => ids.includes(a.id));
              if (!list.length) {
                return (
                  <p className="col-span-full text-sm text-muted-foreground">
                    Aucune activité liée à cette destination pour l&apos;instant.
                  </p>
                );
              }
              return list
                .slice()
                .sort((a: any, b: any) => {
                  const va = activityVotes.filter((v) => v.activity_id === a.id).length;
                  const vb = activityVotes.filter((v) => v.activity_id === b.id).length;
                  return vb - va;
                })
                .map((a: any) => {
                  const aVotes = activityVotes.filter((v) => v.activity_id === a.id);
                  const iVoted = aVotes.some((v) => v.user_id === data.userId);
                  const isFinal = selectedActivityIds.has(a.id);
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "rounded-2xl border bg-card p-4 shadow-sm",
                        isFinal ? "border-lagoon bg-lagoon/5" : "border-border",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{a.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {categoryLabel(a.category)} · {formatEuro(Number(a.price_per_person))} / pers.
                          </p>
                        </div>
                        {isFinal ? <Badge variant="success">Retenue</Badge> : null}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={iVoted ? "lagoon" : "outline"}
                          disabled={activityVoteMutation.isPending}
                          onClick={() => activityVoteMutation.mutate(a.id)}
                        >
                          <Heart className={cn("size-3.5", iVoted && "fill-current")} />
                          {iVoted ? "Mon vote" : "Voter"} · {aVotes.length}
                        </Button>
                      </div>
                    </div>
                  );
                });
            })()}
          </div>
        </section>

{/* CTA génération destinations */}
      {data.isOwner ? (
        <section className="mt-8 rounded-3xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Suggestions de destinations</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Basées sur les préférences du groupe + la date validée.
              </p>
            </div>
            <Button
              variant="hero"
              size="lg"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending || (readiness ? !readiness.canGenerate : true)}
              title={
                readiness && !readiness.canGenerate
                  ? readiness.message ?? "Complète dispos, préférences et valide les dates"
                  : undefined
              }
            >
              {regenerateMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              Générer les propositions
            </Button>
          </div>
          {readiness && !readiness.canGenerate ? (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
              {readiness.message}
            </p>
          ) : readiness?.canGenerate ? (
            <p className="mt-3 text-sm text-lagoon">
              Prêt — le scoring utilisera les budgets, ambiances, hébergements, villes de départ et la date verrouillée.
            </p>
          ) : null}

{(trip.celebrated_person ||
        ["evg", "evjf", "anniversaire", "retraite"].includes(String(trip.event_type))) && (
        <section className="mt-6 space-y-3 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Préférences de la star</h2>
            <a
              href={`/trips/${tripId}/star`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {starData?.preferences ? "Modifier" : "Remplir"} →
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Ces réponses pèsent ~×2,5 à ×3,2 dans le scoring par rapport aux autres participants.
          </p>
          {starData?.preferences ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">
                  {trip.celebrated_person || "Personne principale"}
                </span>{" "}
                — questionnaire enregistré
              </p>
              {(starData.preferences.wantedActivities?.length ?? 0) > 0 ? (
                <p>✅ Envies : {starData.preferences.wantedActivities.join(", ")}

<section id="invite-section" className="mt-12 scroll-mt-24">
        <h2 className="font-display text-2xl font-semibold">Inviter la bande</h2>
        <div className="mt-4 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Envoie ce lien (WhatsApp, SMS, Instagram…) — tes amis rejoignent le voyage et répondent au questionnaire.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input readOnly value={shareUrl} className="max-w-md font-mono text-xs" />
            <Button
              type="button"
              variant="hero"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  setShareCopied(true);
                  toast.success("Lien copié !");
                  setTimeout(() => setShareCopied(false), 2000);
                } catch {
                  toast.error("Impossible de copier — sélectionne le lien manuellement");
                }
              }}
            >
              {shareCopied ? <Check /> : <Copy />}
              {shareCopied ? "Copié" : "Copier le lien"}
            </Button>
            {typeof navigator !== "undefined" && typeof (navigator as any).share === "function" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  (navigator as any).share({
                    title: data.trip.name,
                    text: `Rejoins mon voyage « ${data.trip.name} » sur Krew`,
                    url: shareUrl,
                  })
                }
              >
                <Link2 /> Partager
              </Button>
            ) : null}
          </div>
        </div>

        <h3 className="mt-8 font-display text-lg font-semibold">Le groupe</h3>
        {data.isOwner ? (
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) inviteMutation.mutate();
            }}
          >
            <Input
              type="email"
              placeholder="email@ami.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-xs"
            />
            <Button type="submit" variant="hero" disabled={inviteMutation.isPending}>
              <UserPlus /> Inviter
            </Button>
          </form>
        ) : null}

        <ul className="mt-5 space-y-2">
          {participants.length === 0 ? (
            <li className="text-sm text-muted-foreground">Personne n'est encore invité.</li>
          ) : (
            participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div>
                  <p className="font-medium">{p.display_name ?? p.email}</p>
                  <p className="text-sm text-muted-foreground">{p.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={p.status === "accepte" ? "success" : "muted"}>{p.status}</Badge>
                  {data.isOwner ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Retirer ${p.email}`}
                      onClick={() => removeMutation.mutate(p.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {data.isOwner && trip.status !== "annule" ? (
        <section className="mt-16 border-t border-border pt-8">
          <p className="text-sm text-muted-foreground mb-3">Zone organisateur</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (window.confirm("Annuler ce voyage ? Il disparaîtra de la liste active.")) {
                  cancelMutation.mutate(false);
                }
              }}
            >
              Annuler le voyage
            </Button>
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Supprimer DÉFINITIVEMENT ce voyage et toutes ses données ? Irréversible.",
                  )
                ) {
                  cancelMutation.mutate(true);
                }
              }}
            >
              Supprimer définitivement
            </Button>
          </div>
        </section>
      ) : null}


    </main>
  );
}
