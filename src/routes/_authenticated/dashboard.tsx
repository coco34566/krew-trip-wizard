import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyTrips, listMyPriceWatches, cancelTrip } from "@/lib/trips.functions";
import { reactivateArchivedTrip } from "@/lib/trip-archive.functions";
import { eventTypeLabel, getTripTypeImage } from "@/lib/krew/constants";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import { trackProductEvent } from "@/lib/product-analytics";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { KrewOrganicBlob } from "@/components/krew/visual-language/KrewOrganicBlob";
import { KrewPhotoFallback } from "@/components/krew/KrewPhotoFallback";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { KrewNote } from "@/components/krew/visual-language/KrewNote";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import "@/styles/krew-motion.css";
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
      { property: "og:description", content: "Retrouve tes voyages de groupe sur KREW." },
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

function lifecycleFor(trip: Trip) {
  return getTripLifecycleState({
    datesLocked: Boolean(trip.dates_locked),
    startDate: trip.start_date,
    endDate: trip.end_date,
  });
}

function nextActionFor(trip: Trip) {
  if (lifecycleFor(trip) === "completed") return "Voyage terminé";
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

function useSettledReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setRevealed(entry.isIntersecting && entry.intersectionRatio >= 0.18);
      },
      { threshold: [0, 0.18], rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, revealed };
}

function ArchiveControl({ trip, onArchive, compact = false }: { trip: Trip; onArchive: (tripId: string) => void; compact?: boolean }) {
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
          <AlertDialogDescription>Le voyage quittera tes voyages actifs. Tu pourras le retrouver et le réactiver plus tard dans tes voyages archivés.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Garder le voyage</AlertDialogCancel>
          <AlertDialogAction onClick={() => onArchive(trip.id)}>Archiver</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FeaturedTrip({ trip, onArchive }: { trip: Trip; onArchive: (tripId: string) => void }) {
  const image = tripImage(trip);
  const destinationLabel = trip.destination_name || "Destination à définir";
  const completed = lifecycleFor(trip) === "completed";
  const stageLabel = completed ? "Voyage terminé" : trip.journey_stage || nextActionFor(trip);
  const reveal = useSettledReveal<HTMLDivElement>();
  return (
    <article className="relative isolate overflow-visible pb-2 sm:grid sm:grid-cols-[minmax(0,1.16fr)_minmax(240px,.84fr)] sm:items-center sm:gap-8 lg:gap-10">
      <KrewOrganicBlob tone="sage" variant="soft" className="absolute -left-5 top-8 h-[300px] w-[72%] opacity-45 -z-10" />
      <div className="relative mx-auto w-[94%] max-w-[560px] rotate-[-1deg] bg-[#fffefa] p-3 pb-5 shadow-[0_16px_32px_-18px_rgba(42,25,37,.28)] ring-1 ring-black/[.06] sm:mx-0 sm:w-full sm:rotate-[-1.25deg]">
        <div className="absolute -top-3 left-[38%] z-10 hidden sm:block"><KrewNote variant="tape-strip" tone="cream" rotation={1}>Tape</KrewNote></div>
        <div className="absolute right-5 top-5 z-30" onClick={(event) => event.stopPropagation()}><ArchiveControl trip={trip} onArchive={onArchive} compact /></div>
        <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="group block">
          <div ref={reveal.ref} data-revealed={reveal.revealed} className="krew-trip-reveal aspect-[4/3] overflow-hidden bg-surface/60 sm:aspect-[16/11]">
            <div className="krew-trip-photo-settle size-full">{image ? <img src={image} alt={eventTypeLabel(trip.event_type)} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" /> : <KrewPhotoFallback className="size-full" type="destination" aspectRatio="16/9" />}</div>
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
          <div className="mb-2 flex items-center gap-2"><h3 className="font-display text-[22px] font-normal leading-none text-foreground sm:text-[24px]">{completed ? "Voyage terminé" : "Prochaines actions"}</h3>{!completed ? <KrewMark type="arrow-right" tone="sage" size="sm" className="h-4 w-6 opacity-65" /> : null}</div>
          <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{completed ? "Le séjour est terminé. Retrouve les informations et l’organisation du voyage." : nextActionFor(trip)}</p>
          <Button asChild className="h-10 rounded-xl px-4 text-sm font-medium"><Link to="/trips/$tripId" params={{ tripId: trip.id }} className="inline-flex items-center gap-2">Voir le voyage<KrewMark type="arrow-right" tone="sage" size="sm" className="h-4 w-6" /></Link></Button>
        </div>
      </div>
      <img src="/brand/otter-states/trip-progress.png" alt="" className="absolute -bottom-5 left-[4%] hidden h-auto w-[82px] object-contain pointer-events-none lg:block" />
    </article>
  );
}

function NotebookTrip({ trip, invited = false, onArchive, onReactivate, index = 0 }: { trip: Trip; invited?: boolean; onArchive?: (tripId: string) => void; onReactivate?: (tripId: string) => Promise<unknown>; index?: number }) {
  const image = tripImage(trip);
  const reveal = useSettledReveal<HTMLDivElement>();
  const mobileCompositions = [
    "rotate-[-2.5deg] -translate-x-2 translate-y-1 sm:rotate-[-1.4deg] sm:translate-x-0 sm:translate-y-0",
    "rotate-[2.2deg] translate-x-2 translate-y-3 sm:rotate-[1.1deg] sm:translate-x-0 sm:translate-y-3",
    "rotate-[-1.1deg] -translate-x-1 -translate-y-1 sm:rotate[-.7deg] sm:translate-x-0 sm:translate-y-0",
    "rotate-[1.8deg] translate-x-1 translate-y-2 sm:rotate-[.8deg] sm:translate-x-0 sm:translate-y-2",
    "rotate-[-2deg] translate-x-1 translate-y-3 sm:rotate-[-1deg] sm:translate-x-0 sm:translate-y-1",
  ];
  const composition = mobileCompositions[index % mobileCompositions.length];
  const entryX = index % 2 === 0 ? -34 : 34;
  const entryRotation = index % 2 === 0 ? -4.5 : 4.5;
  return (
    <article className={`group relative w-full max-w-[268px] px-1 py-4 sm:w-[250px] sm:max-w-none sm:py-3 lg:w-[260px] ${composition}`}>
      <div
        ref={reveal.ref}
        data-revealed={reveal.revealed}
        className="krew-trip-reveal"
        style={{
          opacity: reveal.revealed ? 1 : 0.28,
          transform: reveal.revealed
            ? "translate3d(0,0,0) rotate(0deg) scale(1)"
            : `translate3d(${entryX}px,58px,0) rotate(${entryRotation}deg) scale(.91)`,
          transition: "opacity 520ms ease-out, transform 980ms cubic-bezier(.16,.82,.22,1)",
          transitionDelay: reveal.revealed ? `${Math.min(index, 4) * 85}ms` : "0ms",
          willChange: "transform, opacity",
        }}
      >
        <div className="relative bg-[#fffefa] p-2 pb-4 shadow-[0_11px_24px_-18px_rgba(42,25,37,.26)] ring-1 ring-black/[.05] transition-transform duration-200 group-hover:-translate-y-1">
          {index % 3 === 1 ? <div className="absolute -top-3 left-[34%] z-10"><KrewNote variant="tape-strip" tone="cream" rotation={-2}>Tape</KrewNote></div> : null}
          <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="block">
            <div
              className="krew-trip-photo-settle relative aspect-[4/3] overflow-hidden bg-surface/50"
              style={{
                transform: reveal.revealed ? "scale(1)" : "scale(1.1)",
                transition: "transform 1050ms cubic-bezier(.16,.82,.22,1)",
                transformOrigin: "50% 48%",
              }}
            >
              {image ? <img src={image} alt={eventTypeLabel(trip.event_type)} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" loading="lazy" /> : <KrewPhotoFallback className="size-full" type="destination" aspectRatio="4/3" />}
            </div>
            <div className="px-1.5 pt-3">
              <p className="font-handwriting text-[20px] leading-[1.05] text-primary sm:text-[22px]">{trip.name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted-foreground sm:text-[13px]"><span className="font-mono uppercase tracking-[.06em]">{eventTypeLabel(trip.event_type)}</span>{trip.destination_name ? <span className="inline-flex min-w-0 items-center gap-1"><KrewIcon name="destination" tone="muted" size="sm" className="size-3.5 shrink-0" /><span className="break-words">{trip.destination_name}</span></span> : null}<span className="inline-flex items-center gap-1"><KrewIcon name="group" tone="muted" size="sm" className="size-3.5" />{trip.participants_count}</span></div>
              <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-foreground/75 sm:text-[13px]"><KrewIcon name="calendar" tone="sage" size="sm" className="mt-0.5 size-3.5 shrink-0" /><span>{formatTripDates(trip)}</span></p>
            </div>
          </Link>
          {onArchive ? <div className="absolute right-2.5 top-2.5 z-20"><ArchiveControl trip={trip} onArchive={onArchive} compact /></div> : null}
          <div className="mx-1.5 mt-2.5 flex items-center justify-between gap-2 border-t border-dashed border-sage/30 pt-2"><span className="font-handwriting text-[13px] leading-tight text-sage">{invited ? "avec le groupe" : nextActionFor(trip)}</span>{onReactivate ? <KrewStatefulButton variant="ghost" size="sm" className="relative z-10 px-1 text-[12px] font-semibold sm:text-[13px]" idleLabel="Réactiver" loadingLabel="Réactivation…" successLabel="Réactivé" errorLabel="Réessayer" onAction={() => onReactivate(trip.id)} /> : <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="relative z-10 inline-flex min-h-10 shrink-0 items-center gap-1 px-1 text-[12px] font-semibold text-primary sm:text-[13px]">Voir<KrewMark type="arrow-right" tone="plum" size="sm" className="h-3.5 w-5" /></Link>}</div>
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
  const archiveFn = useServerFn(cancelTrip);
  const reactivateFn = useServerFn(reactivateArchivedTrip);
  const archiveMutation = useMutation({
    mutationFn: (tripId: string) => archiveFn({ data: { tripId, hardDelete: false } }),
    onSuccess: (_result, tripId) => {
      void trackProductEvent("trip_archived", { trip_id: tripId, role: "organizer" });
      queryClient.invalidateQueries({ queryKey: ["my-trips", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["co-organized-archived", user?.id] });
    },
    onError: (e: any) => {
      console.error("Impossible d'archiver le voyage:", e);
      toast.error("Impossible d’archiver le voyage pour le moment.");
    },
  });
  const reactivateMutation = useMutation({
    mutationFn: (tripId: string) => reactivateFn({ data: { tripId } }),
    onSuccess: (_result, tripId) => {
      void trackProductEvent("trip_reactivated", { trip_id: tripId, role: "organizer" });
      queryClient.invalidateQueries({ queryKey: ["my-trips", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["co-organized-archived", user?.id] });
    },
    onError: (e: any) => {
      console.error("Impossible de réactiver le voyage:", e);
      toast.error("Impossible de réactiver le voyage pour le moment.");
    },
  });
  const fetchTrips = useServerFn(listMyTrips);
  const fetchPriceWatches = useServerFn(listMyPriceWatches);
  const { data: watchData } = useQuery({ queryKey: ["price-watches", user?.id], queryFn: () => fetchPriceWatches({}), enabled: !!user && !authLoading, retry: false });
  const { data, isLoading, error: tripsError } = useQuery({ queryKey: ["my-trips", user?.id], queryFn: () => fetchTrips(), enabled: !!user && !authLoading, retry: false });
  const { data: coOrganizedArchived = [] } = useQuery({
    queryKey: ["co-organized-archived", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as Trip[];
      const result = await supabase.from("trips").select("*").eq("co_organizer_id", user.id).eq("status", "annule").order("created_at", { ascending: false });
      if (result.error) throw result.error;
      return (result.data ?? []) as Trip[];
    },
    enabled: !!user && !authLoading,
    retry: false,
  });
  const trips = (data?.trips ?? []) as Trip[];
  const invitations = (data?.invitations ?? []) as { id: string; trips: Trip | null }[];
  const ownerArchivedTrips = (data?.archivedTrips ?? []) as Trip[];
  const archivedTrips = [...ownerArchivedTrips, ...coOrganizedArchived].filter((trip, index, all) => all.findIndex((candidate) => candidate.id === trip.id) === index);
  const activeTrips = trips.filter((trip) => lifecycleFor(trip) !== "completed");
  const completedTrips = trips.filter((trip) => lifecycleFor(trip) === "completed");
  const activeInvitations = invitations.filter((invitation) => invitation.trips && lifecycleFor(invitation.trips) !== "completed");
  const completedInvitations = invitations.filter((invitation) => invitation.trips && lifecycleFor(invitation.trips) === "completed");
  const featuredTrip = activeTrips[0];
  const otherTrips = activeTrips.slice(1);
  const hasCompletedTrips = completedTrips.length > 0 || completedInvitations.length > 0;

  return (
    <KrewPageShell size="wide" gutter="wide" data-krew-page-surface="mes-voyages" className="krew-mes-voyages-shell space-y-8 overflow-x-clip overflow-y-visible sm:space-y-12">
      <header className="relative flex min-h-[118px] items-start justify-between gap-4 sm:min-h-[142px]">
        <KrewOrganicBlob tone="sage" variant="soft" className="absolute -left-8 -top-6 h-[110px] w-[300px] opacity-45 pointer-events-none" />
        <div className="relative z-10 max-w-[680px]"><div className="relative inline-block"><h1 className="font-display text-[42px] font-normal leading-[.92] tracking-tight text-foreground sm:text-[52px] lg:text-[58px]">Mes voyages</h1><KrewMark type="underline-wave" tone="sage" size="lg" className="absolute -bottom-5 left-1 h-5 w-[150px] opacity-70 sm:w-[190px]" /></div><p className="mt-5 text-sm text-muted-foreground sm:text-base">Ce qui se prépare, ce qui approche et les voyages auxquels tu participes.</p></div>
        <Button asChild className="relative z-10 h-10 shrink-0 rounded-xl px-3 text-sm font-medium sm:px-4"><Link to="/trips/new" className="inline-flex min-w-max items-center justify-center gap-1.5 whitespace-nowrap text-center"><KrewIcon name="plus" size="sm" className="size-4 shrink-0" />Nouveau voyage</Link></Button>
        <KrewNote variant="margin" rotation={-2} className="absolute bottom-0 right-2 hidden text-sage sm:block">Le carnet des voyages</KrewNote>
      </header>

      {(watchData?.watches?.length ?? 0) > 0 ? <div className="relative ml-auto max-w-[760px] rotate-[.25deg] rounded-[20px_26px_18px_24px] border border-primary/15 bg-primary/[.035] px-4 py-3 text-xs text-foreground sm:text-sm"><KrewNote variant="tape" tone="sage" rotation={-2} size="xs" className="absolute -top-3 left-5">À garder à l'œil</KrewNote><div className="space-y-2 pt-1">{(watchData?.watches ?? []).slice(0, 5).map((w: any) => { const when = w.last_checked_at ? new Date(w.last_checked_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—"; const tripName = (w.trips as any)?.name ?? "Voyage"; const dest = w.destination_name ?? "destination"; return <p key={w.id} className="flex items-start gap-2"><KrewIcon name="calendar" tone="plum" size="sm" className="mt-0.5 size-4 shrink-0" /><span>Re-vérifier les prix pour <strong>{dest}</strong> ({tripName}). Dernière vérification : {when}. <Link to="/trips/$tripId" params={{ tripId: w.trip_id }} search={{ view: "voyage" }} className="font-medium text-primary underline-offset-2 hover:underline">Voir le voyage</Link></span></p>; })}</div></div> : null}

      {tripsError ? <div className="rounded-[28px] border border-destructive/30 bg-destructive/5 p-6"><h2 className="font-display text-lg font-normal text-destructive">Impossible de charger tes voyages</h2><p className="mt-2 text-sm text-muted-foreground">Réessaie dans un instant. Tes voyages sont toujours enregistrés.</p></div> : isLoading ? <div className="space-y-6"><Skeleton className="h-[430px] rounded-[28px]" /><div className="grid gap-6 sm:grid-cols-2"><Skeleton className="h-64 rounded-[24px]" /><Skeleton className="h-64 rounded-[24px]" /></div></div> : activeTrips.length === 0 && activeInvitations.length === 0 && !hasCompletedTrips && archivedTrips.length === 0 ? <div className="relative overflow-hidden rounded-[36px_28px_40px_30px] border border-dashed border-sage/50 bg-surface/30 p-10 text-center sm:p-16"><KrewOrganicBlob tone="sage" variant="soft" className="absolute inset-x-[15%] top-5 h-[150px] opacity-40" /><img src="/brand/otter-states/trip-progress.png" alt="" className="relative mx-auto mb-3 h-auto w-[82px] object-contain sm:w-[96px]" /><KrewNote variant="margin" rotation={-2} className="relative mb-1 text-sage">Première page à écrire</KrewNote><h2 className="relative font-display text-3xl font-normal text-foreground">Aucun voyage pour l'instant</h2><p className="relative mx-auto mt-2 max-w-md text-sm text-muted-foreground">Crée un voyage, puis invite le groupe pour commencer à l’organiser.</p><Button asChild size="lg" className="relative mt-6 rounded-xl"><Link to="/trips/new"><KrewIcon name="plus" size="sm" className="mr-1.5 size-4" />Créer mon premier voyage</Link></Button></div> : (
        <div className="space-y-14 sm:space-y-16">
          {featuredTrip ? <section><SectionHeading note={otherTrips.length ? `${activeTrips.length} voyages` : "le prochain voyage"}>J'organise</SectionHeading><FeaturedTrip trip={featuredTrip} onArchive={(id) => archiveMutation.mutate(id)} />{otherTrips.length ? <div className="mt-8 border-t border-sage/25 pt-7 sm:mt-9 sm:pt-8"><div className="flex flex-wrap items-start justify-center gap-x-9 gap-y-8 md:justify-center">{otherTrips.map((t, index) => <NotebookTrip key={t.id} trip={t} index={index} onArchive={(id) => archiveMutation.mutate(id)} />)}</div></div> : null}</section> : null}
          {activeInvitations.length ? <section className="relative pt-2"><KrewOrganicBlob tone="sage" variant="soft" className="absolute -right-16 top-0 -z-10 h-[180px] w-[320px] opacity-30" /><SectionHeading note="les voyages auxquels tu participes">Je participe</SectionHeading><div className="flex flex-wrap items-start justify-center gap-x-9 gap-y-7 md:justify-center">{activeInvitations.map((i, index) => <NotebookTrip key={i.id} trip={i.trips as Trip} invited index={index} />)}</div></section> : null}
          {hasCompletedTrips ? <section className="border-t border-dashed border-sage/40 pt-7"><SectionHeading note="les souvenirs et l’organisation restent accessibles">Voyages terminés</SectionHeading><div className="flex flex-wrap items-start justify-center gap-x-9 gap-y-7 md:justify-center">{completedTrips.map((t, index) => <NotebookTrip key={t.id} trip={t} index={index} onArchive={(id) => archiveMutation.mutate(id)} />)}{completedInvitations.map((i, index) => <NotebookTrip key={i.id} trip={i.trips as Trip} invited index={completedTrips.length + index} />)}</div></section> : null}
          {archivedTrips.length ? <section className="border-t border-dashed border-border/70 pt-7 opacity-75"><SectionHeading note="tu peux les réactiver sans perdre leur organisation">Voyages archivés</SectionHeading><div className="flex flex-wrap items-start justify-center gap-x-9 gap-y-7 md:justify-center">{archivedTrips.map((t, index) => <NotebookTrip key={t.id} trip={t} index={index} onReactivate={(id) => reactivateMutation.mutateAsync(id)} />)}</div></section> : null}
        </div>
      )}
    </KrewPageShell>
  );
}