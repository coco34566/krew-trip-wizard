// src/routes/_authenticated/trips.$tripId.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Heart, Loader2, MapPin, Sparkles, Star, Trash2, UserPlus, Users, Wallet, Copy, Link2, Check, ClipboardList } from "lucide-react";
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
  cancelTrip,
} from "@/lib/trips.functions";
import { getParticipantsProgress, getMyParticipantPreferences } from "@/lib/participant-preferences.functions";
import { searchExternalForTrip } from "@/lib/external/search-hotels.functions";
import { categoryLabel, eventTypeLabel, formatEuro, TRIP_STATUS_LABELS } from "@/lib/krew/constants";
import type { BudgetBreakdown, ItineraryDay } from "@/lib/krew/engine";
import { cn } from "@/lib/utils";
import { CostSplitCard } from "@/components/krew/CostSplitCard";
import { TripHubDashboard } from "@/components/krew/TripHubDashboard";
import { getTripAvailability } from "@/lib/availability.functions";

export const Route = createFileRoute("/_authenticated/trips/$tripId/")({
  head: () => ({
    meta: [
      { title: "Hub du voyage — Krew" },
      { name: "description", content: "Propositions Krew, planning jour par jour, budget détaillé et votes du groupe." },
      { property: "og:title", content: "Hub du voyage — Krew" },
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
      if (res?.skipped) {
        toast.error(res?.readiness?.message ?? "Pas assez de réponses pour générer");
      } else {
        toast.success("Nouvelles propositions générées");
      }
      refresh();
    },
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
  const participants = data.participants as { id: string; email: string; display_name: string | null; status: string }[];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <TripHubDashboard
        tripId={tripId}
        trip={trip}
        isOwner={data.isOwner}
        participantsCount={(data.participants?.length ?? trip.participants_count) || 1}
        progressAnswered={progress?.answered ?? 0}
        progressTotal={progress?.total ?? trip.participants_count ?? 1}
        availabilityAnswered={availData?.answered ?? 0}
        availabilityExpected={availData?.expected ?? trip.participants_count ?? 1}
        provisionalStart={availData?.windows?.[0]?.start ?? (trip as any).provisional_start_date}
        provisionalCoverage={availData?.windows?.[0]?.coverageRatio}
        myAvailabilityDone={Boolean(availData?.mine)}
        myPreferencesDone={Boolean((myPrefsData as any)?.preferences)}
        hasRecommendations={recommendations.length > 0}
        destinationSelected={recommendations.some((r) => r.is_selected)}
        topScores={recommendations.slice(0, 3).map((r) => ({
          name: r.destinations?.name ?? "Destination",
          score: r.score,
        }))}
      >
        <div className="flex flex-wrap gap-2">
          {data.isOwner ? (
            <>
              <Button
                variant="glass"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
              >
                {regenerateMutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}{" "}
                Régénérer les propositions
              </Button>
              <Button
                variant="outline"
                onClick={() => searchExternalMutation.mutate()}
                disabled={searchExternalMutation.isPending}
              >
                {searchExternalMutation.isPending ? <Loader2 className="animate-spin" /> : <MapPin />}{" "}
                Hébergements & activités
              </Button>
            </>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link to="/trips/$tripId/recap" params={{ tripId }}>
              <ClipboardList /> Récap du groupe
            </Link>
          </Button>
          {data.isOwner && trip.status !== "annule" ? (
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Annuler ce voyage ? Il disparaîtra de tes voyages actifs (tu pourras le supprimer définitivement ensuite si besoin).",
                  )
                ) {
                  cancelMutation.mutate(false);
                }
              }}
            >
              Annuler le voyage
            </Button>
          ) : null}
          {data.isOwner ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
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
          ) : null}
        </div>
      </TripHubDashboard>

{costSplitData?.isSelected && costSplitData.split ? (
        <section className="mt-10">
          <CostSplitCard split={costSplitData.split} tripName={trip.name} />
        </section>
      ) : null}


      {data.isOwner && readiness ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface/40 px-4 py-3 text-sm">
          <p className="font-medium">Qualité des données pour le scoring</p>
          <p className="mt-1 text-muted-foreground">
            {readiness.quality.answered}/{readiness.quality.expected} réponses ·{" "}
            {readiness.quality.vetoCount} veto budget ·{" "}
            {readiness.quality.exclusionCount} exclusion(s) de destination ·{" "}
            {readiness.quality.dealBreakerAmbiances} deal-breaker(s) ambiance
          </p>
          {!readiness.canGenerate ? (
            <p className="mt-2 text-amber-700 dark:text-amber-400">
              {readiness.message ?? "En attente de plus de réponses."}
              {readiness.missingLabels?.length
                ? ` Manquants : ${readiness.missingLabels.slice(0, 8).join(", ")}`
                : ""}
            </p>
          ) : (
            <p className="mt-2 text-muted-foreground">Échantillon suffisant pour générer des propositions.</p>
          )}
          {readiness.inconsistencies?.length ? (
            <ul className="mt-2 list-disc pl-5 text-amber-800 dark:text-amber-300">
              {readiness.inconsistencies.map((inc: any, i: number) => (
                <li key={i}>
                  Alerte participant{inc.userId ? ` (${String(inc.userId).slice(0, 8)}…)` : ""} :{" "}
                  {inc.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <section id="hub-destination" className="mt-10 space-y-6">
        <h2 className="font-display text-2xl font-semibold">Les propositions de Krew</h2>
        {recommendations.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucune proposition pour l'instant. Lancez une génération pour obtenir des destinations.
          </p>
        ) : (
          recommendations.map((reco, index) => {
            const recoVotes = votes.filter((v) => v.recommendation_id === reco.id);
            const hasVoted = recoVotes.some((v) => v.user_id === data.userId);
            const recoActivities = activities.filter((a) => (reco.activity_ids ?? []).includes(a.id));
            return (
              <article
                key={reco.id}
                className={cn(
                  "overflow-hidden rounded-3xl border bg-card shadow-elevated",
                  reco.is_selected ? "border-lagoon" : "border-border",
                )}
              >
                {reco.destinations?.image_url ? (
                  <img
                    src={reco.destinations.image_url}
                    alt={`Vue de ${reco.destinations.name}`}
                    loading="lazy"
                    className="h-48 w-full object-cover"
                  />
                ) : null}
                <div className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Proposition {index + 1} · {reco.destinations?.country}
                      </p>
                      <h3 className="font-display text-2xl font-semibold">{reco.destinations?.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {reco.is_selected ? <Badge variant="success">Choix du groupe</Badge> : null}
                      <Badge variant="lagoon">{Math.round(reco.score)} %</Badge>
                    </div>
                  </div>

                  {reco.rationale ? <p className="mt-3 text-sm text-muted-foreground">{reco.rationale}</p> : null}

                  {reco.match_reasons?.length ? (
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {reco.match_reasons.map((reason) => (
                        <li
                          key={reason}
                          className="rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground"
                        >
                          {reason}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {reco.accommodations ? (
                    <div className="mt-5 rounded-2xl border border-border bg-surface/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Hébergement</p>
                      <p className="mt-1 font-medium">
                        {reco.accommodations.name} · {reco.accommodations.type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <Star className="mr-1 inline size-3.5" />
                        {reco.accommodations.rating} · à {reco.accommodations.distance_center_km} km du centre · {" "}
                        {formatEuro(Number(reco.accommodations.price_per_night_per_person))} / nuit / pers.
                      </p>
                    </div>
                  ) : null}

                  {recoActivities.length ? (
                    <div className="mt-5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Activités sélectionnées</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {recoActivities.map((a) => (
                          <div key={a.id} className="rounded-2xl border border-border p-3 text-sm">
                            <p className="font-medium">{a.name}</p>
                            <p className="text-muted-foreground">
                              {categoryLabel(a.category)} · {formatEuro(Number(a.price_per_person))} / pers.
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {reco.itinerary?.length ? (
                    <div className="mt-5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Programme</p>
                      <div className="mt-2 space-y-3">
                        {reco.itinerary.map((day) => (
                          <div key={day.day} className="rounded-2xl border border-border p-4">
                            <p className="font-medium">
                              Jour {day.day} — {day.title}
                            </p>
                            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                              {day.slots.map((slot, i) => (
                                <li key={`${day.day}-${i}`}>
                                  <span className="font-medium text-foreground">{slot.moment}</span> · {slot.label}
                                  {slot.detail ? ` — ${slot.detail}` : ""}
                                  {slot.price ? ` (${formatEuro(slot.price)})` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {reco.budget ? (
                    <div className="mt-5 rounded-2xl border border-border bg-surface/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Budget estimé</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <p>
                          Transport : {formatEuro(reco.budget.transport)}
                          <span className="block text-xs text-muted-foreground">moy. / pers.</span>
                        </p>
                        {(reco.budget as any).budgetFitTotal ? (
                          <p className="col-span-2 text-xs text-muted-foreground sm:col-span-4">
                            {(reco.budget as any).hardBudgetFits === false
                              ? "⚠️ "
                              : "✅ "}
                            Dans le budget de {(reco.budget as any).budgetFitCount}/
                            {(reco.budget as any).budgetFitTotal} participants
                          </p>
                        ) : null}
                        <p>Hébergement : {formatEuro(reco.budget.accommodation)}</p>
                        <p>Activités : {formatEuro(reco.budget.activities)}</p>
                        <p>Restauration : {formatEuro(reco.budget.food)}</p>
                      </div>
                      {reco.budget.transportByOrigin && reco.budget.transportByOrigin.length > 1 ? (
                        <div className="mt-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                          <p className="mb-1 font-medium text-foreground">Transport par ville de départ</p>
                          <ul className="space-y-0.5">
                            {reco.budget.transportByOrigin.map((o) => (
                              <li key={o.city}>
                                {o.city} × {o.count} → {formatEuro(o.pricePerPerson)} A/R / pers.
                                <span className="text-muted-foreground/80">
                                  {" "}
                                  (sous-total {formatEuro(o.pricePerPerson * o.count)})
                                </span>
                              </li>
                            ))}
                          </ul>
                          {typeof reco.budget.transportGroup === "number" ? (
                            <p className="mt-1">
                              Transport groupe : {formatEuro(reco.budget.transportGroup)}
                            </p>
                          ) : null}
                        </div>
                      ) : typeof reco.budget.transportGroup === "number" &&
                        reco.budget.transportGroup > 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Transport groupe : {formatEuro(reco.budget.transportGroup)}
                        </p>
                      ) : null}
                      <Separator className="my-3" />
                      <p className="font-display text-lg font-semibold">
                        {formatEuro(reco.budget.totalPerPerson)} / personne
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          soit {formatEuro(reco.budget.totalGroup)} pour le groupe
                        </span>
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button
                      variant={hasVoted ? "lagoon" : "glass"}
                      onClick={() => voteMutation.mutate(reco.id)}
                      disabled={voteMutation.isPending}
                    >
                      <Heart className={cn(hasVoted && "fill-current")} /> {recoVotes.length} vote
                      {recoVotes.length > 1 ? "s" : ""}
                    </Button>
                    {data.isOwner && !reco.is_selected ? (
                      <Button variant="hero" onClick={() => selectMutation.mutate(reco.id)} disabled={selectMutation.isPending}>
                        <CheckCircle2 /> Choisir cette destination
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

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
    </main>
  );
}
