import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyTrips, listMyPriceWatches, cancelTrip } from "@/lib/trips.functions";
import { eventTypeLabel, getTripTypeImage } from "@/lib/krew/constants";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { KrewOrganicBlob } from "@/components/krew/visual-language/KrewOrganicBlob";
import { KrewPhotoFallback } from "@/components/krew/KrewPhotoFallback";
import { KrewNote } from "@/components/krew/visual-language/KrewNote";
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

type Trip = {
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
  journey_stage?: string;
  destination_name?: string | null;
  destination_image_url?: string | null;
};

function FeaturedTripCard({
  trip,
  onCancel,
}: {
  trip: Trip;
  onCancel?: (tripId: string) => void;
}) {
  const typeImage = getTripTypeImage(trip.event_type);

  return (
    <div className="relative">
      <div className="absolute -top-3 right-4 z-20 hidden sm:block pointer-events-none">
        <KrewNote variant="tape" tone="sage" rotation={2} className="text-xs py-1 px-2.5 min-w-0">
          Prochain départ ! ✈️
        </KrewNote>
      </div>

      <article className="group relative overflow-hidden rounded-[28px] border border-border/70 bg-background shadow-2xs transition-all hover:border-primary/50">
        <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="block">
          <div className="grid lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-5 relative aspect-[16/10] lg:aspect-auto w-full overflow-hidden bg-surface/50 border-b lg:border-b-0 lg:border-r border-border/40">
              {typeImage ? (
                <img
                  src={typeImage}
                  alt={eventTypeLabel(trip.event_type)}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <KrewPhotoFallback className="size-full" type="destination" aspectRatio="16/9" />
              )}
            </div>

            <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">
                    {eventTypeLabel(trip.event_type)}
                  </span>

                  {onCancel ? (
                    <div className="relative z-20" onClick={(e) => e.stopPropagation()}>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-full text-muted-foreground hover:text-destructive"
                            aria-label="Archiver le voyage"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Archiver ce voyage</AlertDialogTitle>
                            <AlertDialogDescription>
                              Êtes-vous sûr de vouloir archiver ce voyage ?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onCancel(trip.id)}>
                              Archiver
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ) : null}
                </div>

                <h3 className="font-display text-3xl sm:text-4xl font-normal text-foreground group-hover:text-primary transition-colors">
                  {trip.name}
                </h3>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:text-base text-muted-foreground pt-1">
                  {trip.destination_name ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                      <KrewIcon name="destination" tone="plum" size="sm" className="size-4" />
                      {trip.destination_name}
                    </span>
                  ) : null}
                  {trip.start_date ? (
                    <span className="inline-flex items-center gap-1.5 font-mono">
                      <KrewIcon name="calendar" tone="muted" size="sm" className="size-4" />
                      {new Date(trip.start_date).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5 font-mono">
                    <KrewIcon name="group" tone="muted" size="sm" className="size-4" />
                    {trip.participants_count} participants
                  </span>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-border/50">
                <span className="inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-primary transition-transform group-hover:translate-x-1">
                  Continuer l'organisation <KrewMark type="arrow-right" tone="plum" size="md" className="size-4" />
                </span>
              </div>
            </div>
          </div>
        </Link>
      </article>
    </div>
  );
}

function TripCard({
  trip,
  invited = false,
  onCancel,
}: {
  trip: Trip;
  invited?: boolean;
  onCancel?: (tripId: string) => void;
}) {
  const ctaLabel = invited ? "Voir le voyage" : "Continuer l'organisation";
  const typeImage = getTripTypeImage(trip.event_type);

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-border/60 bg-background transition-all hover:border-primary/40">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface/50 border-b border-border/40">
        {typeImage ? (
          <img
            src={typeImage}
            alt={eventTypeLabel(trip.event_type)}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <KrewPhotoFallback className="size-full" type="destination" aspectRatio="16/9" />
        )}

        {onCancel ? (
          <div className="absolute top-3 right-3 z-10">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-8 rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-destructive hover:bg-background"
                  aria-label="Archiver le voyage"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archiver ce voyage</AlertDialogTitle>
                  <AlertDialogDescription>
                    Êtes-vous sûr de vouloir archiver ce voyage ?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onCancel(trip.id)}>Archiver</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </div>

      <div className="p-5 sm:p-6 space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
            {eventTypeLabel(trip.event_type)}
          </p>
          <h3 className="font-display text-[28px] font-normal leading-snug text-foreground">
            <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="focus:outline-none">
              <span className="absolute inset-0" aria-hidden="true" />
              {trip.name}
            </Link>
          </h3>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] sm:text-sm text-muted-foreground pt-1">
            {trip.destination_name ? (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <KrewIcon name="destination" tone="muted" size="sm" className="size-4" />
                {trip.destination_name}
              </span>
            ) : null}
            {trip.start_date ? (
              <span className="inline-flex items-center gap-1 font-mono">
                <KrewIcon name="calendar" tone="muted" size="sm" className="size-4" />
                {new Date(trip.start_date).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 font-mono">
              <KrewIcon name="group" tone="muted" size="sm" className="size-4" />
              {trip.participants_count} pers.
            </span>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-border/40">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-transform group-hover:translate-x-0.5">
            {ctaLabel} <KrewMark type="arrow-right" tone="plum" size="sm" className="size-3.5" />
          </span>
        </div>
      </div>
    </article>
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

  const trips = (data?.trips ?? []) as Trip[];
  const invitations = (data?.invitations ?? []) as { id: string; trips: Trip | null }[];
  const archivedTrips = (data?.archivedTrips ?? []) as Trip[];

  return (
    <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10 space-y-8 sm:space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
        <div className="space-y-1 relative">
          <KrewOrganicBlob
            tone="sage"
            variant="soft"
            className="absolute -top-4 -left-4 w-[180px] sm:w-[260px] h-[80px] opacity-40 pointer-events-none z-0"
          />
          <div className="relative inline-block z-10">
            <h1 className="font-display text-[40px] sm:text-[44px] lg:text-[52px] font-normal leading-[0.95] tracking-tight text-foreground">
              Mes voyages
            </h1>
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="md"
              className="absolute left-0 -bottom-2 w-[120px] lg:w-[180px] pointer-events-none"
            />
          </div>
          <p className="text-sm sm:text-base text-muted-foreground pt-1 font-sans">
            Tes projets en cours et tes invitations reçues.
          </p>
        </div>
        <Button asChild className="min-h-[44px] h-auto rounded-xl px-5 font-medium self-start sm:self-auto">
          <Link to="/trips/new" className="flex w-full items-center justify-center text-center whitespace-nowrap">
            Nouveau voyage
          </Link>
        </Button>
      </div>

      {(watchData?.watches?.length ?? 0) > 0 ? (
        <div className="price-watch-banner space-y-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs sm:text-sm text-foreground">
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
              <p key={w.id} className="flex items-start gap-2">
                <KrewIcon name="attention" tone="plum" size="sm" className="size-4 shrink-0 mt-0.5" />
                <span>
                  Pense à re-vérifier les prix pour <strong>{dest}</strong> ({tripName}) — ils
                  bougent vite. Dernière vérif. : {when}.{" "}
                  <Link
                    to="/trips/$tripId"
                    params={{ tripId: w.trip_id }}
                    search={{ view: "voyage" }}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Ouvrir le récap
                  </Link>
                </span>
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
        <div className="grid gap-6 sm:grid-cols-2">
          <Skeleton className="h-64 rounded-[24px]" />
          <Skeleton className="h-64 rounded-[24px]" />
        </div>
      ) : trips.length === 0 && invitations.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-border bg-surface/40 p-10 text-center sm:p-16 relative overflow-hidden">
          <div className="mx-auto mb-4 w-20 h-20 flex items-center justify-center">
            <img
              src="/brand/otter-states/trip-progress.png"
              alt=""
              className="w-[72px] sm:w-[80px] h-auto object-contain"
            />
          </div>
          <h2 className="font-display text-2xl font-normal text-foreground">Aucun voyage pour l'instant</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground font-sans">
            Lance le questionnaire KREW : en quelques minutes tu obtiens destination, hébergement,
            activités et budget détaillé.
          </p>
          <div className="mt-6 inline-flex flex-col items-center gap-2 relative">
            <Button asChild size="lg" className="rounded-xl">
              <Link to="/trips/new">
                <KrewIcon name="plus" size="sm" className="size-4 mr-1.5" />
                Créer mon premier voyage
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          <section className="space-y-4">
            <h2 className="font-sans font-semibold text-lg text-foreground">
              J'organise
            </h2>
            {trips.length === 1 ? (
              <FeaturedTripCard trip={trips[0]} onCancel={(id) => cancelMutation.mutate(id)} />
            ) : trips.length > 1 ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {trips.map((t) => (
                  <TripCard key={t.id} trip={t} onCancel={(id) => cancelMutation.mutate(id)} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun voyage.</p>
            )}
          </section>

          {invitations.length ? (
            <section className="space-y-4 pt-4 border-t border-border/50">
              <h2 className="font-sans font-semibold text-lg text-foreground">
                Je participe
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {invitations
                  .filter((i) => i.trips)
                  .map((i) => (
                    <TripCard key={i.id} trip={i.trips as Trip} invited />
                  ))}
              </div>
            </section>
          ) : null}

          {archivedTrips.length ? (
            <section className="space-y-4 pt-4 border-t border-border/50">
              <h2 className="font-sans font-semibold text-base text-muted-foreground">
                Voyages archivés
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 opacity-70">
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
