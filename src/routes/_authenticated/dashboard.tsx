import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Plus, Trash2, Users, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyTrips, listMyPriceWatches, cancelTrip } from "@/lib/trips.functions";
import { eventTypeLabel } from "@/lib/krew/constants";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
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

type TeamMember = {
  id: string;
  name: string;
  availabilityDone: boolean;
  preferencesDone: boolean;
  isStar: boolean;
};

type TeamSummary = {
  total: number;
  identifiedCount: number;
  availabilityAnswered: number;
  preferencesAnswered: number;
  members: TeamMember[];
};

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
  team_summary?: TeamSummary;
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
  const isCompleteStage = trip.has_itinerary || trip.destination_selected;
  const isMiddleStage = trip.dates_locked;

  const team = trip.team_summary ?? {
    total: Math.max(trip.participants_count || 1, 1),
    identifiedCount: 0,
    availabilityAnswered: 0,
    preferencesAnswered: 0,
    members: [],
  };

  return (
    <div className="relative rounded-xl border border-border/60 bg-card p-5 sm:p-6 transition-colors hover:border-primary/40 flex flex-col justify-between shadow-none">
      <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="group block space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {eventTypeLabel(trip.event_type)}
            </p>
            <h3 className="font-display text-xl sm:text-2xl font-normal text-foreground group-hover:text-primary transition-colors">
              {trip.name}
            </h3>
          </div>
          <Badge
            variant={
              isCompleteStage
                ? "success"
                : isMiddleStage
                  ? "secondary"
                  : "muted"
            }
            className="shrink-0 font-normal"
          >
            {invited
              ? `Invitation · ${trip.journey_stage ?? "à rejoindre"}`
              : (trip.journey_stage ?? "En préparation")}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-sans">
            <Users className="size-4 shrink-0 text-muted-foreground/70" /> {trip.participants_count} pers.
          </span>
          {trip.start_date ? (
            <span className="inline-flex items-center gap-1.5 font-sans">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground/70" />{" "}
              {new Date(trip.start_date).toLocaleDateString("fr-FR")}
            </span>
          ) : null}
        </div>

        {/* Bloc Team / Progression */}
        <div className="pt-2 border-t border-border/40 space-y-2">
          <div className="bg-sage/6 rounded-lg p-2.5 flex flex-col gap-1 text-xs text-muted-foreground font-medium">
            <div className="flex items-center justify-between">
              <span>Disponibilités</span>
              <span className="tabular-nums font-sans font-semibold text-foreground">
                {team.availabilityAnswered} / {team.total}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Préférences</span>
              <span className="tabular-nums font-sans font-semibold text-foreground">
                {team.preferencesAnswered} / {team.total}
              </span>
            </div>
          </div>

          {team.members.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-xs text-muted-foreground pr-8">
              {team.members.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  className="inline-flex items-center gap-1.5 text-[11px]"
                >
                  <span className="truncate max-w-[100px] text-foreground/90 font-medium">{m.name}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {m.availabilityDone ? (
                      <span className="size-1.5 rounded-full bg-success" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-muted-foreground/30" />
                    )}
                    {m.preferencesDone ? (
                      <Check className="size-3 text-sage shrink-0" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-muted-foreground/30" />
                    )}
                  </span>
                </div>
              ))}
              {team.members.length > 5 && (
                <span className="text-[11px] text-muted-foreground/70 font-medium">
                  +{team.members.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>

      {onCancel ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-4 right-4 size-8 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10"
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
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="relative inline-block">
            <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
              Mes voyages
            </h1>
            <KrewMark type="underline" tone="sage" size="md" rotation={-2} className="absolute left-0 -bottom-1.5 w-16 pointer-events-none" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Tes projets en cours et tes invitations reçues.
          </p>
        </div>
        <Button asChild>
          <Link to="/trips/new">
            <Plus className="size-4" /> Nouveau voyage
          </Link>
        </Button>
      </div>

      {(watchData?.watches?.length ?? 0) > 0 ? (
        <div className="price-watch-banner mt-8 space-y-2 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm text-foreground">
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

      {tripsError ? (
        <div className="mt-10 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-display text-lg font-normal text-destructive">
            Impossible de charger tes voyages
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Erreur réelle du chargement : {String((tripsError as any)?.message ?? tripsError)}
          </p>
        </div>
      ) : isLoading ? (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : trips.length === 0 && invitations.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center sm:p-16 relative">
          <h2 className="font-display text-2xl font-normal text-foreground">Aucun voyage pour l'instant</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Lance le questionnaire KREW : en quelques minutes tu obtiens destination, hébergement,
            activités et budget détaillé.
          </p>
          <div className="mt-6 inline-flex flex-col items-center gap-2 relative">
            <KrewMark type="arrow" tone="sage" size="md" rotation={-2} className="hidden sm:block absolute -left-12 -top-2 pointer-events-none" />
            <Button asChild size="lg">
              <Link to="/trips/new">Créer mon premier voyage</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-10 space-y-12">
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-medium text-foreground">Mes voyages</h2>
              <KrewMark type="connector" tone="sage" size="sm" rotation={2} className="pointer-events-none opacity-80" />
            </div>
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
            <section className="bg-sage/5 rounded-2xl p-4 sm:p-6 border border-sage/10">
              <h2 className="mb-4 text-lg font-medium text-foreground">
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
              <h2 className="mb-4 text-lg font-medium text-foreground">Voyages archivés</h2>
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
