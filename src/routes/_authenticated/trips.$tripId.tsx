import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Heart, Loader2, MapPin, Sparkles, Star, Trash2, UserPlus, Users, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  getTripDetail,
  generateRecommendations,
  inviteParticipant,
  removeParticipant,
  selectRecommendation,
  toggleVote,
} from "@/lib/trips.functions";
import { categoryLabel, eventTypeLabel, formatEuro, TRIP_STATUS_LABELS } from "@/lib/krew/constants";
import type { BudgetBreakdown, ItineraryDay } from "@/lib/krew/engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  head: () => ({
    meta: [
      { title: "Détail du voyage — Krew" },
      { name: "description", content: "Propositions Krew, planning jour par jour, budget détaillé et votes du groupe." },
      { property: "og:title", content: "Détail du voyage — Krew" },
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
  const [email, setEmail] = useState("");

  const queryKey = ["trip", tripId];
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => fetchDetail({ data: { tripId } }) });
  const refresh = () => queryClient.invalidateQueries({ queryKey });

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
  const regenerateMutation = useMutation({
    mutationFn: () => regenerate({ data: { tripId } }),
    onSuccess: () => {
      toast.success("Nouvelles propositions générées");
      refresh();
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">{eventTypeLabel(trip.event_type)}</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{trip.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" /> {trip.participants_count} pers.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="size-4" /> {formatEuro(Number(trip.budget_per_person))} / pers.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" /> départ {trip.departure_city}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={trip.status === "valide" ? "success" : "lagoon"}>
            {TRIP_STATUS_LABELS[trip.status] ?? trip.status}
          </Badge>
          {data.isOwner ? (
            <Button
              variant="glass"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
            >
              {regenerateMutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Regénérer
            </Button>
          ) : null}
        </div>
      </div>

      <section className="mt-10 space-y-6">
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
                      <Badge variant="lagoon">Score {Math.round(reco.score)}/100</Badge>
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
                        {reco.accommodations.rating} · à {reco.accommodations.distance_center_km} km du centre ·{" "}
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
                        <p>Transport : {formatEuro(reco.budget.transport)}</p>
                        <p>Hébergement : {formatEuro(reco.budget.accommodation)}</p>
                        <p>Activités : {formatEuro(reco.budget.activities)}</p>
                        <p>Restauration : {formatEuro(reco.budget.food)}</p>
                      </div>
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

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Le groupe</h2>
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