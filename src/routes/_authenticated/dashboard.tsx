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
      { name: "description", content: "Retrouve tes voyages de groupe, tes brouillons et tes invitations reçues." },
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
  end_date?: string | null;
  participants_count: number;
  budget_per_person: number;
  departure_city: string;
  dates_locked?: boolean;
  destination_selected?: boolean;
  has_itinerary?: boolean;
  journey_stage?: string;
  destination_name?: string | null;
  destination_image_url?: string | null;
  star_name?: string | null;
};

function nextActionFor(trip: Trip) {
  if (!trip.dates_locked) return "Finaliser les disponibilités";
  if (!trip.destination_selected) return "Choisir la destination";
  if (!trip.has_itinerary) return "Construire le planning";
  return "Retrouver le voyage";
}

function tripImage(trip: Trip) {
  return trip.destination_image_url || getTripTypeImage(trip.event_type);
}

function formatTripDates(trip: Trip) {
  if (!trip.start_date) return "Dates à confirmer";

  const start = new Date(trip.start_date);
  const end = trip.end_date ? new Date(trip.end_date) : null;
  if (!end || Number.isNaN(end.getTime())) {
    return start.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${end.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;
  }
  if (sameYear) {
    return `${start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
  }
  return `${start.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} – ${end.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
}

function ArchiveControl({ trip, onCancel, compact = false }: { trip: Trip; onCancel: (tripId: string) => void; compact?: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className={compact ? "size-8 rounded-full bg-background/90 backdrop-blur-sm text-muted-foreground hover:text-destructive shadow-sm" : "size-9 rounded-full bg-background/90 backdrop-blur-sm text-muted-foreground hover:text-destructive shadow-sm"} aria-label="Archiver le voyage">
          <Trash2 className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archiver ce voyage</AlertDialogTitle>
          <AlertDialogDescription>Le voyage quittera tes voyages actifs. Tu pourras le retrouver plus tard dans tes voyages archivés.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Garder le voyage</AlertDialogCancel>
          <AlertDialogAction onClick={() => onCancel(trip.id)}>Archiver</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FeaturedTrip({ trip, onCancel }: { trip: Trip; onCancel: (tripId: string) => void }) {
  const image = tripImage(trip);
  const destinationLabel = trip.destination_name || "Destination à définir";
  const stageLabel = trip.journey_stage || nextActionFor(trip);

  return (
    <article className="relative isolate overflow-visible pb-2 sm:grid sm:grid-cols-[minmax(0,1.16fr)_minmax(240px,.84fr)] sm:items-center sm:gap-8 lg:gap-10">
      <KrewOrganicBlob tone="sage" variant="soft" className="absolute -left-5 top-8 h-[300px] w-[72%] opacity-45 -z-10" />

      <div className="relative mx-auto w-[94%] max-w-[560px] rotate-[-1deg] bg-[#fffefa] p-3 pb-5 shadow-[0_16px_32px_-18px_rgba(42,25,37,.28)] ring-1 ring-black/[.06] sm:mx-0 sm:w-full sm:rotate-[-1.25deg]">
        <div className="absolute -top-3 left-[38%] z-10 hidden sm:block"><KrewNote variant="tape" tone="cream" rotation={1} className="min-w-[74px] px-3 py-1 text-transparent select-none">Tape</KrewNote></div>
        <div className="absolute right-5 top-5 z-30" onClick={(event) => event.stopPropagation()}><ArchiveControl trip={trip} onCancel={onCancel} compact /></div>
        <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="group block">
          <div className="aspect-[4/3] overflow-hidden bg-surface/60 sm:aspect-[16/11]">
            {image ? <img src={image} alt={eventTypeLabel(trip.event_type)} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" /> : <KrewPhotoFallback className="size-full" type="destination" aspectRatio="16/9" />}
          </div>
          <div className="px-2 pb-1 pt-4">
            <p className="break-words font-handwriting text-[24px] leading-[1.05] text-primary sm:text-[28px]">{trip.name}</p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[.08em] text-muted-foreground sm:text-[12px]">{eventTypeLabel(trip.event_type)}</p>
          </div>
        </Link>
      </div>

      <div className="relative mt-5 min-w-0 px-1 sm:mt-0 sm:px-0">
        <div className="grid grid-cols-1 gap-2.5 text-[13px] text-muted-foreground sm:text-sm">
          <p className="flex min-w-0 items-start gap-2 font-medium text-foreground"><KrewIcon name="destination" tone="plum" size="sm" className="mt-0.5 size-4 shrink-0" /><span className="break-words">{destinationLabel}</span></p>
          <p className="flex min-w-0 items-start gap-2"><KrewIcon name="calendar" tone="muted" size="sm" className="mt-0.5 size-4 shrink-0" /><span className="break-words">{formatTripDates(trip)}</span></p>
          <p className="flex items-center gap-2"><KrewIcon name="group" tone="muted" size="sm" className="size-4 shrink-0" />{trip.participants_count} participants</p>
          <p className="flex min-w-0 items-start gap-2"><KrewIcon name="planning" tone="sage" size="sm" className="mt-0.5 size-4 shrink-0" /><span className="break-words">{stageLabel}</span></p>
        </div>

        <div className="relative mt-5 pt-1 sm:mt-6">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="font-display text-[22px] font-normal leading-none text-foreground sm:text-[24px]">Prochaines actions</h3>
            <KrewMark type="arrow-right" tone="sage" size="sm" className="h-4 w-6 opacity-65" />
          </div>
          <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{nextActionFor(trip)}</p>
          <Button asChild className="h-10 rounded-xl px-4 text-sm font-medium">
            <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="inline-flex items-center gap-2">
              Continuer l'organisation
              <KrewMark type="arrow-right" tone="sage" size="sm" className="h-4 w-6" />
            </Link>
          </Button>
        </div>
      </div>

      <img src="/brand/otter-states/trip-progress.png" alt="" className="absolute -bottom-5 left-[4%] hidden h-auto w-[82px] object-contain pointer-events-none lg:block" />
    </article>
  );
}

function NotebookTrip({ trip, invited = false, onCancel, index = 0 }: { trip: Trip; invited?: boolean; onCancel?: (tripId: string) => void; index?: number }) {
  const image = tripImage(trip);
  const mobileCompositions = [
    "rotate-[-2.5deg] -translate-x-2 translate-y-1 sm:rotate-[-1.4deg] sm:translate-x-0 sm:translate-y-0",
    "rotate-[2.2deg] translate-x-2 translate-y-3 sm:rotate-[1.1deg] sm:translate-x-0 sm:translate-y-3",
    "rotate-[-1.1deg] -translate-x-1 -translate-y-1 sm:rotate-[-.7deg] sm:translate-x-0 sm:translate-y-0",
    "rotate-[1.8deg] translate-x-1 translate-y-2 sm:rotate-[.8deg] sm:translate-x-0 sm:translate-y-2",
    "rotate-[-2deg] translate-x-1 translate-y-3 sm:rotate-[-1deg] sm:translate-x-0 sm:translate-y-1",
  ];
  const composition = mobileCompositions[index % mobileCompositions.length];

  return (
    <article className={`group relative w-full max-w-[268px] px-1 py-4 sm:w-[250px] sm:max-w-none sm:py-3 lg:w-[260px] ${composition}`}>
      <div className="relative bg-[#fffefa] p-2 pb-4 shadow-[0_11px_24px_-18px_rgba(42,25,37,.26)] ring-1 ring-black/[.05] transition-transform duration-200 group-hover:-translate-y-1">
        {index % 3 === 1 ? <div className="absolute -top-3 left-[34%] z-10"><KrewNote variant="tape" tone="cream" rotation={-2} className="min-w-[52px] px-2 py-0.5 text-transparent select-none">Tape</KrewNote></div> : null}
        <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="block">
          <div className="relative aspect-[4/3] overflow-hidden bg-surface/50">
            {image ? <img src={image} alt={eventTypeLabel(trip.event_type)} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" loading="lazy" /> : <KrewPhotoFallback className="size-full" type="destination" aspectRatio="4/3" />}
          </div>
          <div className="px-1.5 pt-3">
            <p className="font-handwriting text-[20px] leading-[1.05] text-primary sm:text-[22px]">{trip.name}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted-foreground sm:text-[13px]">
              <span className="font-mono uppercase tracking-[.06em]">{eventTypeLabel(trip.event_type)}</span>
              {trip.destination_name ? <span className="inline-flex min-w-0 items-center gap-1"><KrewIcon name="destination" tone="muted" size="sm" className="size-3.5 shrink-0" /><span className="break-words">{trip.destination_name}</span></span> : null}
              <span className="inline-flex items-center gap-1"><KrewIcon name="group" tone="muted" size="sm" className="size-3.5" />{trip.participants_count}</span>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-foreground/75 sm:text-[13px]"><KrewIcon name="calendar" tone="sage" size="sm" className="mt-0.5 size-3.5 shrink-0" /><span>{formatTripDates(trip)}</span></p>
          </div>
        </Link>
        {onCancel ? <div className="absolute right-2.5 top-2.5 z-20"><ArchiveControl trip={trip} onCancel={onCancel} compact /></div> : null}
        <div className="mx-1.5 mt-2.5 flex items-center justify-between gap-2 border-t border-dashed border-sage/30 pt-2">
          <span className="font-handwriting text-[13px] leading-tight text-sage">{invited ? "avec la team" : nextActionFor(trip)}</span>
          <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="relative z-10 inline-flex min-h-10 shrink-0 items-center gap-1 px-1 text-[12px] font-semibold text-primary sm:text-[13px]">{invited ? "Voir" : "Continuer"}<KrewMark type="arrow-right" tone="plum" size="sm" className="h-3.5 w-5" /></Link>
        </div>
      </div>
    </article>
  );
}

function SectionHeading({ children, note }: { children: React.ReactNode; note?: string }) {
  return <div className="relative mb-5 flex items-end gap-3"><div className="relative inline-block"><h2 className="font-display text-[29px] sm:text-[34px] font-normal leading-none text-foreground">{children}</h2><KrewMark type="underline-wave" tone="sage" size="sm" className="absolute -bottom-3 left-0 h-4 w-[92px] opacity-60" /></div>{note ? <KrewNote variant="margin" rotation={2} className="hidden sm:block pb-0.5 text-muted-foreground">{note}</KrewNote> : null}</div>;
}

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const cancelFn = useServerFn(cancelTrip);
  const cancelMutation = useMutation({ mutationFn: (tripId: string) => cancelFn({ data: { tripId, hardDelete: false } }), onSuccess: () => { toast.success("Voyage archivé"); queryClient.invalidateQueries({ queryKey: ["my-trips", user?.id] }); }, onError: (e: any) => toast.error(String(e?.message ?? "Annulation impossible").slice(0, 120)) });
  const fetchTrips = useServerFn(listMyTrips);
  const fetchPriceWatches = useServerFn(listMyPriceWatches);
  const { data: watchData } = useQuery({ queryKey: ["price-watches", user?.id], queryFn: () => fetchPriceWatches({}), enabled: !!user && !authLoading, retry: false });
  const { data, isLoading, error: tripsError } = useQuery({ queryKey: ["my-trips", user?.id], queryFn: () => fetchTrips(), enabled: !!user && !authLoading, retry: false });
  const trips = (data?.trips ?? []) as Trip[];
  const invitations = (data?.invitations ?? []) as { id: string; trips: Trip | null }[];
  const archivedTrips = (data?.archivedTrips ?? []) as Trip[];
  const featuredTrip = trips[0];
  const otherTrips = trips.slice(1);

  return (
    <main className="mx-auto max-w-[1180px] space-y-8 overflow-x-clip overflow-y-visible px-4 py-8 sm:space-y-12 sm:px-6 sm:py-10 lg:px-10">
      <header className="relative flex min-h-[118px] items-start justify-between gap-4 sm:min-h-[142px]">
        <KrewOrganicBlob tone="sage" variant="soft" className="absolute -left-8 -top-6 h-[110px] w-[300px] opacity-45 pointer-events-none" />
        <div className="relative z-10 max-w-[680px]"><div className="relative inline-block"><h1 className="font-display text-[42px] font-normal leading-[.92] tracking-tight text-foreground sm:text-[52px] lg:text-[58px]">Mes voyages</h1><KrewMark type="underline-wave" tone="sage" size="lg" className="absolute -bottom-5 left-1 h-5 w-[150px] opacity-70 sm:w-[190px]" /></div><p className="mt-5 text-sm text-muted-foreground sm:text-base">Ce qui se prépare, ce qui approche, et les voyages où ta KREW t'attend.</p></div>
        <Button asChild className="relative z-10 shrink-0 px-4 font-medium sm:px-5"><Link to="/trips/new" className="inline-flex min-w-max items-center justify-center gap-1.5 whitespace-nowrap text-center"><KrewIcon name="plus" size="sm" className="size-4" /><span className="hidden sm:inline">Nouveau voyage</span><span className="sm:hidden">Nouveau</span></Link></Button>
        <KrewNote variant="margin" rotation={-2} className="absolute bottom-0 right-2 hidden text-sage sm:block">Le carnet de la KREW</KrewNote>
      </header>

      {(watchData?.watches?.length ?? 0) > 0 ? <div className="relative ml-auto max-w-[760px] rotate-[.25deg] rounded-[20px_26px_18px_24px] border border-primary/15 bg-primary/[.035] px-4 py-3 text-xs text-foreground sm:text-sm"><KrewNote variant="tape" tone="sage" rotation={-2} className="absolute -top-3 left-5 min-w-0 px-2 py-0.5 text-[12px] sm:text-[13px]">À garder à l'œil</KrewNote><div className="space-y-2 pt-1">{(watchData?.watches ?? []).slice(0, 5).map((w: any) => { const when = w.last_checked_at ? new Date(w.last_checked_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—"; const tripName = (w.trips as any)?.name ?? "Voyage"; const dest = w.destination_name ?? "destination"; return <p key={w.id} className="flex items-start gap-2"><KrewIcon name="calendar" tone="plum" size="sm" className="mt-0.5 size-4 shrink-0" /><span>Re-vérifier les prix pour <strong>{dest}</strong> ({tripName}). Dernière vérif. : {when}. <Link to="/trips/$tripId" params={{ tripId: w.trip_id }} search={{ view: "voyage" }} className="font-medium text-primary underline-offset-2 hover:underline">Ouvrir</Link></span></p>; })}</div></div> : null}

      {tripsError ? <div className="rounded-[28px] border border-destructive/30 bg-destructive/5 p-6"><h2 className="font-display text-lg font-normal text-destructive">Impossible de charger tes voyages</h2><p className="mt-2 text-sm text-muted-foreground">Erreur réelle du chargement : {String((tripsError as any)?.message ?? tripsError)}</p></div> : isLoading ? <div className="space-y-6"><Skeleton className="h-[430px] rounded-[28px]" /><div className="grid gap-6 sm:grid-cols-2"><Skeleton className="h-64 rounded-[24px]" /><Skeleton className="h-64 rounded-[24px]" /></div></div> : trips.length === 0 && invitations.length === 0 ? <div className="relative overflow-hidden rounded-[36px_28px_40px_30px] border border-dashed border-sage/50 bg-surface/30 p-10 text-center sm:p-16"><KrewOrganicBlob tone="sage" variant="soft" className="absolute inset-x-[15%] top-5 h-[150px] opacity-40" /><img src="/brand/otter-states/trip-progress.png" alt="" className="relative mx-auto mb-3 h-auto w-[82px] object-contain sm:w-[96px]" /><KrewNote variant="margin" rotation={-2} className="relative mb-1 text-sage">Première page à écrire</KrewNote><h2 className="relative font-display text-3xl font-normal text-foreground">Aucun voyage pour l'instant</h2><p className="relative mx-auto mt-2 max-w-md text-sm text-muted-foreground">Lance un voyage et construis le plan avec toute la KREW.</p><Button asChild size="lg" className="relative mt-6 rounded-xl"><Link to="/trips/new"><KrewIcon name="plus" size="sm" className="mr-1.5 size-4" />Créer mon premier voyage</Link></Button></div> : (
        <div className="space-y-14 sm:space-y-16">
          {featuredTrip ? <section><SectionHeading note={otherTrips.length ? `${trips.length} voyages en préparation` : "le prochain à faire avancer"}>J'organise</SectionHeading><FeaturedTrip trip={featuredTrip} onCancel={(id) => cancelMutation.mutate(id)} />{otherTrips.length ? <div className="mt-8 border-t border-sage/25 pt-7 sm:mt-9 sm:pt-8"><div className="flex flex-wrap items-start justify-center gap-x-9 gap-y-8 md:justify-center">{otherTrips.map((t, index) => <NotebookTrip key={t.id} trip={t} index={index} onCancel={(id) => cancelMutation.mutate(id)} />)}</div></div> : null}</section> : null}
          {invitations.length ? <section className="relative pt-2"><KrewOrganicBlob tone="sage" variant="soft" className="absolute -right-16 top-0 -z-10 h-[180px] w-[320px] opacity-30" /><SectionHeading note="les plans où tu fais partie de la team">Je participe</SectionHeading><div className="flex flex-wrap items-start justify-center gap-x-9 gap-y-7 md:justify-center">{invitations.filter((i) => i.trips).map((i, index) => <NotebookTrip key={i.id} trip={i.trips as Trip} invited index={index} />)}</div></section> : null}
          {archivedTrips.length ? <section className="border-t border-dashed border-border/70 pt-7 opacity-75"><SectionHeading note="rien n'est perdu">Voyages archivés</SectionHeading><div className="flex flex-wrap items-start justify-center gap-x-9 gap-y-7 md:justify-center">{archivedTrips.map((t, index) => <NotebookTrip key={t.id} trip={t} index={index} />)}</div></section> : null}
        </div>
      )}
    </main>
  );
}