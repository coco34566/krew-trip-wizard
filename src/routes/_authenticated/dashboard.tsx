import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, MapPin, Plus, Users, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyTrips, listMyPriceWatches, cancelTrip } from "@/lib/trips.functions";
import { eventTypeLabel, formatEuro } from "@/lib/krew/constants";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Mes voyages — Krew" },
      { name: "description", content: "Retrouvez vos voyages de groupe, vos brouillons et vos invitations reçues." },
      { property: "og:title", content: "Mes voyages — Krew" },
      { property: "og:description", content: "Tableau de bord de vos voyages de groupe Krew." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type TripRow = {
  id: string;
  name: string;
  event_type: string;
  status: string;
  start_date: string | null;
  participants_count: number;
  budget_per_person: number;
  departure_city: string;
  dates_locked?: boolean;
  destination_selected?: boolean;
  has_itinerary?: boolean;
  /** Stade métier du parcours (remplace le status enum en UI) */
  journey_stage?: string;
};

function TripCard({
  trip,
  invited = false,
  onCancel,
}: {
  trip: TripRow;
  invited?: boolean;
  onCancel?: (tripId: string) => void;
}) {
  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      className="group rounded-3xl border border-border bg-card p-5 shadow-elevated transition-colors hover:border-primary/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{eventTypeLabel(trip.event_type)}</p>
          <h3 className="mt-1 font-display text-lg font-semibold group-hover:text-primary">{trip.name}</h3>
        </div>
        <Badge
          variant={
            trip.has_itinerary || trip.destination_selected
              ? "success"
              : trip.dates_locked
                ? "lagoon"
                : "muted"
          }
        >
          {invited ? `Invitation · ${trip.journey_stage ?? "à rejoindre"}` : (trip.journey_stage ?? "En préparation")}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-4" /> {trip.participants_count} pers.
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Wallet className="size-4" /> {formatEuro(Number(trip.budget_per_person))} / pers.
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-4" /> départ {trip.departure_city}
        </span>
        {trip.start_date ? (
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" /> {new Date(trip.start_date).toLocaleDateString("fr-FR")}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function Dashboard() {
  const queryClient = useQueryClient();
  const cancelFn = useServerFn(cancelTrip);
  const cancelMutation = useMutation({
    mutationFn: (tripId: string) => cancelFn({ data: { tripId, hardDelete: false } }),
    onSuccess: () => {
      toast.success("Voyage annulé");
      queryClient.invalidateQueries({ queryKey: ["my-trips"] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Annulation impossible").slice(0, 120)),
  });

  const fetchTrips = useServerFn(listMyTrips);
  const { data: watchData } = useQuery({
    queryKey: ["price-watches"],
    queryFn: () => listWatches({}),
    retry: false,
  });

  const { data, isLoading } = useQuery({ queryKey: ["my-trips"], queryFn: () => fetchTrips() });

  const trips = (data?.trips ?? []) as TripRow[];
  const invitations = (data?.invitations ?? []) as { id: string; trips: TripRow | null }[];
  const inPrep = trips.filter((t) => !t.destination_selected && !t.has_itinerary);
  const ready = trips.filter((t) => t.destination_selected || t.has_itinerary);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Mes voyages</h1>

      {(watchData?.watches?.length ?? 0) > 0 ? (
        <div className="price-watch-banner mt-6 space-y-2 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          {(watchData?.watches ?? []).slice(0, 5).map((w: any) => {
            const when = w.last_checked_at
              ? new Date(w.last_checked_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—";
            const tripName = (w.trips as any)?.name ?? "Voyage";
            const dest = w.destination_name ?? "destination";
            return (
              <p key={w.id}>
                💡 Pensez à re-vérifier les prix pour <strong>{dest}</strong> ({tripName}) — ils
                bougent vite. Dernière vérif. : {when}.{" "}
                <Link
                  to="/trips/$tripId/recap"
                  params={{ tripId: w.trip_id }}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Ouvrir le récap
                </Link>
              </p>
            );
          })}
        </div>
      ) : null}
          <p className="mt-1 text-muted-foreground">Vos projets en cours, validés et les invitations reçues.</p>
        </div>
        <Button asChild variant="hero">
          <Link to="/trips/new">
            <Plus /> Nouveau voyage
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36 rounded-3xl" />
          <Skeleton className="h-36 rounded-3xl" />
        </div>
      ) : trips.length === 0 && invitations.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <h2 className="font-display text-xl font-semibold">Aucun voyage pour l'instant</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Lancez le questionnaire Krew : en quelques minutes vous obtenez destination, hébergement, activités et
            budget détaillé.
          </p>
          <Button asChild variant="hero" size="lg" className="mt-6">
            <Link to="/trips/new">Créer mon premier voyage</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          <section>
            <h2 className="mb-4 font-display text-lg font-semibold">Mes voyages</h2>
            {inPrep.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {inPrep.map((t) => (
                  <TripCard key={t.id} trip={t} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Rien en préparation.</p>
            )}
          </section>

          {ready.length ? (
            <section>
              <h2 className="mb-4 font-display text-lg font-semibold">Prêts / en organisation</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {ready.map((t) => (
                  <TripCard key={t.id} trip={t} />
                ))}
              </div>
            </section>
          ) : null}

          {invitations.length ? (
            <section>
              <h2 className="mb-4 font-display text-lg font-semibold">Invitations reçues</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {invitations
                  .filter((i) => i.trips)
                  .map((i) => (
                    <TripCard key={i.id} trip={i.trips as TripRow} invited />
                  ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}