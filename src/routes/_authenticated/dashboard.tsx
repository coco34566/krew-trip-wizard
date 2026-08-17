import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Plus, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyTrips, listMyPriceWatches, cancelTrip } from "@/lib/trips.functions";
import { eventTypeLabel, formatEuro } from "@/lib/krew/constants";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Mes voyages — KREW" },
      {
        name: "description",
        content: "Retrouve tes voyages de groupe, tes brouillons et tes invitations reçues.",
      },
      { property: "og:title", content: "Mes voyages — KREW" },
      { property: "og:description", content: "Tableau de bord de tes voyages de groupe KREW." },
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
    <div className="relative rounded-3xl border border-border bg-card shadow-elevated transition-colors hover:border-primary/60">
      <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="group block p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {eventTypeLabel(trip.event_type)}
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold group-hover:text-primary">
              {trip.name}
            </h3>
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
            {invited
              ? `Invitation · ${trip.journey_stage ?? "à rejoindre"}`
              : (trip.journey_stage ?? "En préparation")}
          </Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" /> {trip.participants_count} pers.
          </span>
          {trip.start_date ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />{" "}
              {new Date(trip.start_date).toLocaleDateString("fr-FR")}
            </span>
          ) : null}
        </div>
      </Link>
      {onCancel ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-3 right-3 size-8 text-muted-foreground"
              aria-label="Archiver le voyage"
            >
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archiver ce voyage</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer ce voyage ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => onCancel(trip.id)}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const cancelFn = useServerFn(cancelTrip);
  const cancelMutation = useMutation({
    mutationFn: (tripId: string) => cancelFn({ data: { tripId, hardDelete: false } }),
    onSuccess: () => {
      toast.success("Voyage archivé");
      queryClient.invalidateQueries({ queryKey: ["my-trips", user?.id] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Annulation impossible").slice(0, 120)),
  });

  const fetchTrips = useServerFn(listMyTrips);
  const fetchPriceWatches = useServerFn(listMyPriceWatches);
  const { data: watchData } = useQuery({
    queryKey: ["price-watches", user?.id],
    queryFn: () => fetchPriceWatches({}),
    enabled: !!user && !authLoading,
    retry: false,
  });

  const {
    data,
    isLoading,
    error: tripsError,
  } = useQuery({
    queryKey: ["my-trips", user?.id],
    queryFn: () => fetchTrips(),
    enabled: !!user && !authLoading,
    retry: false,
  });

  const trips = (data?.trips ?? []) as TripRow[];
  const invitations = (data?.invitations ?? []) as { id: string; trips: TripRow | null }[];
  const archivedTrips = (data?.archivedTrips ?? []) as TripRow[];

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
                    💡 Pense à re-vérifier les prix pour <strong>{dest}</strong> ({tripName}) — ils
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
          <p className="mt-1 text-muted-foreground">
            Tes projets en cours et tes invitations reçues.
          </p>
        </div>
        <Button asChild variant="hero">
          <Link to="/trips/new">
            <Plus /> Nouveau voyage
          </Link>
        </Button>
      </div>

      {tripsError ? (
        <div className="mt-8 rounded-3xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-display text-lg font-semibold text-destructive">
            Impossible de charger tes voyages
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Erreur réelle du chargement : {String((tripsError as any)?.message ?? tripsError)}
          </p>
        </div>
      ) : isLoading ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36 rounded-3xl" />
          <Skeleton className="h-36 rounded-3xl" />
        </div>
      ) : trips.length === 0 && invitations.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <h2 className="font-display text-xl font-semibold">Aucun voyage pour l'instant</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Lance le questionnaire KREW : en quelques minutes tu obtiens destination, hébergement,
            activités et budget détaillé.
          </p>
          <Button asChild variant="hero" size="lg" className="mt-6">
            <Link to="/trips/new">Créer mon premier voyage</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          <section>
            <h2 className="mb-4 font-display text-lg font-semibold">Mes voyages</h2>
            {trips.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {trips.map((t) => (
                  <TripCard key={t.id} trip={t} onCancel={(id) => cancelMutation.mutate(id)} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun voyage.</p>
            )}
          </section>

          {invitations.length ? (
            <section>
              <h2 className="mb-4 font-display text-lg font-semibold">
                Voyages auxquels je suis invité(e)
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {invitations
                  .filter((i) => i.trips)
                  .map((i) => (
                    <TripCard key={i.id} trip={i.trips as TripRow} invited />
                  ))}
              </div>
            </section>
          ) : null}
          {archivedTrips.length ? (
            <section>
              <h2 className="mb-4 font-display text-lg font-semibold">Voyages archivés</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {archivedTrips.map((t) => (
                  <TripCard key={t.id} trip={t} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
