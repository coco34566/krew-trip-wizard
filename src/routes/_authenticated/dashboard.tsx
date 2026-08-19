import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Plus, Trash2, Users, Check, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyTrips, listMyPriceWatches, cancelTrip } from "@/lib/trips.functions";
import { eventTypeLabel } from "@/lib/krew/constants";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { KrewPhotoFallback } from "@/components/krew/KrewPhotoFallback";
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

function TripRowItem({
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
    <div className="py-5 first:pt-0 last:pb-0">
      {/* Desktop Layout */}
      <div className="hidden lg:grid grid-cols-[96px_minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-6 items-center">
        {/* Visuel 96x96 */}
        <div className="size-[96px] rounded-2xl overflow-hidden shrink-0">
          <KrewPhotoFallback className="size-full rounded-2xl" type="destination" aspectRatio="square" />
        </div>

        {/* Nom + Meta */}
        <div className="min-w-0 space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {eventTypeLabel(trip.event_type)}
          </p>
          <h3 className="font-display text-[30px] font-normal leading-snug text-foreground hover:text-primary transition-colors truncate">
            <Link to="/trips/$tripId" params={{ tripId: trip.id }}>
              {trip.name}
            </Link>
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-sans pt-0.5">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5 text-muted-foreground/70" /> {trip.participants_count} pers.
            </span>
            {trip.start_date ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5 text-muted-foreground/70" />{" "}
                {new Date(trip.start_date).toLocaleDateString("fr-FR")}
              </span>
            ) : null}
          </div>
        </div>

        {/* État existant */}
        <div className="space-y-2">
          <Badge
            variant={
              isCompleteStage
                ? "success"
                : isMiddleStage
                  ? "secondary"
                  : "muted"
            }
            className="font-normal"
          >
            {invited
              ? `Invitation · ${trip.journey_stage ?? "à rejoindre"}`
              : (trip.journey_stage ?? "En préparation")}
          </Badge>
          <div className="text-xs text-muted-foreground font-medium space-y-0.5">
            <div className="flex items-center justify-between gap-2 max-w-[180px]">
              <span>Disponibilités</span>
              <span className="tabular-nums font-mono text-foreground font-semibold">
                {team.availabilityAnswered} / {team.total}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 max-w-[180px]">
              <span>Préférences</span>
              <span className="tabular-nums font-mono text-foreground font-semibold">
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

        {/* Action existante */}
        <div className="flex items-center gap-3 justify-end">
          {onCancel ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-xl"
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
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden space-y-3">
        <div className="grid grid-cols-[72px_1fr] gap-4 items-start">
          <div className="size-[72px] rounded-xl overflow-hidden shrink-0">
            <KrewPhotoFallback className="size-full rounded-xl" type="destination" aspectRatio="square" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              {eventTypeLabel(trip.event_type)}
            </p>
            <h3 className="font-display text-2xl font-normal leading-snug text-foreground">
              <Link to="/trips/$tripId" params={{ tripId: trip.id }}>
                {trip.name}
              </Link>
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground pt-0.5">
              <span>{trip.participants_count} pers.</span>
              {trip.start_date ? (
                <span>{new Date(trip.start_date).toLocaleDateString("fr-FR")}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Badge
            variant={
              isCompleteStage
                ? "success"
                : isMiddleStage
                  ? "secondary"
                  : "muted"
            }
            className="font-normal"
          >
            {invited
              ? `Invitation · ${trip.journey_stage ?? "à rejoindre"}`
              : (trip.journey_stage ?? "En préparation")}
          </Badge>

          <div className="flex items-center gap-2 ml-auto">
            {onCancel ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-xl"
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
        </div>
      </div>
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
    <main className="space-y-8 sm:space-y-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="relative inline-block">
            <h1 className="font-display text-[38px] lg:text-[48px] font-normal leading-[0.95] tracking-tight text-foreground">
              Mes voyages
            </h1>
            <KrewMark
              type="underline"
              tone="sage"
              size="md"
              rotation={-2}
              className="absolute left-0 -bottom-2 w-[120px] lg:w-[180px] pointer-events-none"
            />
          </div>
          <p className="text-sm text-muted-foreground pt-1">
            Tes projets en cours et tes invitations reçues.
          </p>
        </div>
        <Button asChild className="self-start sm:self-auto rounded-xl">
          <Link to="/trips/new">
            <Plus className="size-4" /> Nouveau voyage
          </Link>
        </Button>
      </div>

      {(watchData?.watches?.length ?? 0) > 0 ? (
        <div className="price-watch-banner space-y-2 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm text-foreground">
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
        <div className="rounded-[28px] border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-display text-lg font-normal text-destructive">
            Impossible de charger tes voyages
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Erreur réelle du chargement : {String((tripsError as any)?.message ?? tripsError)}
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-[28px]" />
          <Skeleton className="h-28 rounded-[28px]" />
        </div>
      ) : trips.length === 0 && invitations.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-border bg-surface/40 p-10 text-center sm:p-16 relative">
          <h2 className="font-display text-2xl font-normal text-foreground">Aucun voyage pour l'instant</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Lance le questionnaire KREW : en quelques minutes tu obtiens destination, hébergement,
            activités et budget détaillé.
          </p>
          <div className="mt-6 inline-flex flex-col items-center gap-2 relative">
            <Button asChild size="lg" className="rounded-xl">
              <Link to="/trips/new">Créer mon premier voyage</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* SECTION J'ORGANISE */}
          <section className="bg-background rounded-[28px] p-5 sm:p-7 border border-border/50">
            <h2 className="font-sans font-semibold text-base text-foreground mb-4">
              J'organise
            </h2>
            {trips.length ? (
              <div className="divide-y divide-border/50">
                {trips.map((t) => (
                  <TripRowItem key={t.id} trip={t} onCancel={(id) => cancelMutation.mutate(id)} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun voyage.</p>
            )}
          </section>

          {/* SECTION JE PARTICIPE */}
          {invitations.length ? (
            <section className="bg-sage/6 rounded-[28px] p-5 sm:p-7 border border-border/50">
              <h2 className="font-sans font-semibold text-base text-foreground mb-4">
                Voyages auxquels je suis invité(e)
              </h2>
              <div className="divide-y divide-border/50">
                {invitations
                  .filter((i) => i.trips)
                  .map((i) => (
                    <TripRowItem key={i.id} trip={i.trips as TripRow} invited />
                  ))}
              </div>
            </section>
          ) : null}

          {archivedTrips.length ? (
            <section className="bg-background/60 rounded-[28px] p-5 sm:p-7 border border-border/50">
              <h2 className="font-sans font-semibold text-base text-foreground mb-4">
                Voyages archivés
              </h2>
              <div className="divide-y divide-border/50">
                {archivedTrips.map((t) => (
                  <TripRowItem key={t.id} trip={t} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
