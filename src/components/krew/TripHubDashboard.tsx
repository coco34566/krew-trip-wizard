import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  ClipboardList,
  Copy,
  Check,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Sparkles,
  Star,
  Users,
  Wallet,
  Hotel,
  Plane,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildTripSteps } from "@/lib/krew/availability";
import { eventTypeLabel, formatEuro, getTripTypeImage } from "@/lib/krew/constants";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { updateTripParticipantsCount } from "@/lib/trips.functions";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";

type Props = {
  tripId: string;
  trip: any;
  isOwner: boolean;
  participantsCount: number;
  progressAnswered: number;
  progressTotal: number;
  availabilityAnswered: number;
  availabilityExpected: number;
  provisionalStart?: string | null;
  provisionalCoverage?: number | null;
  hasRecommendations: boolean;
  profileReady?: boolean;
  profileValidated?: boolean;
  destinationSelected: boolean;
  viewerUserId?: string | null;
  /** Nom de la destination validée */
  destinationName?: string | null;
  /** Budget estimé live (€ / pers.) si calculé */
  liveBudgetTotal?: number | null;
  totalReserved?: number | null;
  totalEstimated?: number | null;
  /** L'utilisateur connecté a déjà soumis ses dispos */
  myAvailabilityDone?: boolean;
  /** L'utilisateur connecté a déjà soumis ses préférences */
  myPreferencesDone?: boolean;
  /** Questionnaire star rempli */
  starDone?: boolean;
  topScores?: { name: string; score: number }[];
  activitiesValidated?: boolean;
  tripEndDatePassed?: boolean;
  children?: React.ReactNode;
};

/** Photos lifestyle premium (Unsplash) — voyage & ambiance, pas de clichés ballons/kitsch. */
function heroImageForEvent(eventType?: string | null) {
  const localImage = getTripTypeImage(eventType);
  if (localImage) return localImage;

  const q = "auto=format&fit=crop&w=1600&q=85";
  const map: Record<string, string> = {
    evg: `https://images.unsplash.com/photo-1514933651103-005eec06c04b?${q}`,
    evjf: `https://images.unsplash.com/photo-1527529482838-46479466cbfe?${q}`,
    anniversaire: `https://images.unsplash.com/photo-1414235077428-338989a2e8c0?${q}`,
    weekend: `https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?${q}`,
    voyage_groupe: `https://images.unsplash.com/photo-1527631746610-b998ef1c7d1d?${q}`,
    famille: `https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?${q}`,
    seminaire: `https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?${q}`,
    retraite: `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?${q}`,
    autre: `https://images.unsplash.com/photo-1488085061387-422e29b40080?${q}`,
  };

  let key = String(eventType || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[-\s]+/g, "_");

  if (key === "voyage") key = "voyage_groupe";
  if (key === "week_end") key = "weekend";

  return map[key] || map["autre"];
}

type NextActionsPanelProps = {
  tripId: string;
  isOwner: boolean;
  trip: any;
  myAvailabilityDone: boolean;
  myPreferencesDone: boolean;
  starDone: boolean;
  availabilityAnswered: number;
  availabilityExpected: number;
  progressAnswered: number;
  progressTotal: number;
  hasRecommendations: boolean;
  destinationSelected: boolean;
  datesLocked?: boolean;
  myHotelVoted?: boolean;
  myTransportPicked?: boolean;
  hotelOffersReady?: boolean;
  transportOffersReady?: boolean;
  hasItinerary?: boolean;
};

function NextActionsPanel({
  tripId,
  isOwner,
  trip,
  myAvailabilityDone,
  myPreferencesDone,
  starDone,
  availabilityAnswered,
  availabilityExpected,
  progressAnswered,
  progressTotal,
  hasRecommendations,
  destinationSelected,
  datesLocked = false,
  myHotelVoted = false,
  myTransportPicked = false,
  hotelOffersReady = false,
  transportOffersReady = false,
  hasItinerary = false,
}: NextActionsPanelProps) {
  const hasStar =
    Boolean(trip.celebrated_person) ||
    ["evg", "evjf", "anniversaire", "retraite"].includes(String(trip.event_type));

  type Action = {
    key: string;
    title: string;
    desc: string;
    href?: string;
    icon: typeof CalendarDays;
    primary?: boolean;
  };

  const actions: Action[] = [];
  const push = (a: Action) => {
    if (actions.length === 0) a.primary = true;
    else if (a.primary == null) a.primary = false;
    actions.push(a);
  };

  // —— 1. Actions perso (tous) ——
  if (!myAvailabilityDone) {
    push({
      key: "avail",
      title: "Indiquer mes disponibilités",
      desc: "Indispensable pour trouver une date commune.",
      href: `/trips/${tripId}/availability`,
      icon: CalendarDays,
    });
  }
  if (!myPreferencesDone) {
    push({
      key: "prefs",
      title: "Renseigner mes préférences",
      desc: "Budget, envies et transports pour trouver les destinations qui correspondent au groupe.",
      href: `/trips/${tripId}/questionnaire`,
      icon: ClipboardList,
    });
  }
  if (hasStar && !starDone) {
    push({
      key: "star",
      title: trip.celebrated_person
        ? `Renseigner les préférences de ${trip.celebrated_person}`
        : "Renseigner les préférences de la Star",
      desc: "Compléter ses préférences pour le voyage.",
      href: `/trips/${tripId}/star`,
      icon: Star,
    });
  }

  // —— 2. Après destination : hébergement + transport (tous) ——
  if (destinationSelected) {
    if (hotelOffersReady && !myHotelVoted) {
      push({
        key: "hotel",
        title: "Voter pour un hébergement",
        desc: "Un vote par personne — l’organisateur·rice finalise le choix.",
        href: `/trips/${tripId}?view=voyage&section=accommodation`,
        icon: Hotel,
      });
    }
    if (transportOffersReady && !myTransportPicked) {
      push({
        key: "transport",
        title: "Choisir mon trajet",
        desc: "Selon la ville de départ et les contraintes horaires.",
        href: `/trips/${tripId}?view=voyage&section=transport`,
        icon: Plane,
      });
    }
  }

  // —— 3. Actions orga uniquement ——
  if (isOwner) {
    if (myAvailabilityDone && myPreferencesDone && !datesLocked) {
      push({
        key: "lock-dates",
        title: "Valider les dates du groupe",
        desc: "Cette validation débloque la suite du voyage.",
        href: `/trips/${tripId}?view=voyage&section=dates`,
        icon: CalendarDays,
      });
    }
    if (datesLocked && !destinationSelected) {
      if (!hasRecommendations) {
        push({
          key: "gen",
          title: "Trouver des destinations",
          desc: "Des propositions adaptées aux préférences du groupe.",
          href: `/trips/${tripId}?view=voyage&section=destination`,
          icon: Sparkles,
        });
      } else {
        push({
          key: "pick-dest",
          title: "Valider une destination",
          desc: "Cette validation débloque les hébergements, les trajets et le planning.",
          href: `/trips/${tripId}?view=voyage&section=destination`,
          icon: MapPin,
        });
      }
    }
    if (destinationSelected && !hotelOffersReady) {
      push({
        key: "search-hotels",
        title: "Rechercher des hébergements",
        desc: "Proposer des hébergements au groupe pour le vote.",
        href: `/trips/${tripId}?view=voyage&section=accommodation`,
        icon: Hotel,
      });
    }
    if (destinationSelected && !transportOffersReady) {
      push({
        key: "search-transport",
        title: "Proposer des trajets A/R",
        desc: "Des options adaptées aux villes de départ du groupe.",
        href: `/trips/${tripId}?view=voyage&section=transport`,
        icon: Plane,
      });
    }
    if (
      destinationSelected &&
      (myHotelVoted || hotelOffersReady) &&
      (myTransportPicked || transportOffersReady) &&
      !hasItinerary
    ) {
      push({
        key: "plan",
        title: "Créer le planning",
        desc: "Construire le séjour jour par jour en tenant compte des horaires d’arrivée et de départ.",
        href: `/trips/${tripId}?view=voyage&section=planning`,
        icon: Sparkles,
      });
    }
    if (hasItinerary) {
      push({
        key: "refine",
        title: "Affiner l’organisation",
        desc: "Ajuster un créneau, vérifier les choix du groupe ou partager le résumé.",
        href: `/trips/${tripId}?view=voyage&section=planning`,
        icon: ClipboardList,
      });
    }

    const missingAvail = Math.max(0, availabilityExpected - availabilityAnswered);
    const missingPrefs = Math.max(0, progressTotal - progressAnswered);
    if (missingAvail > 0 || missingPrefs > 0) {
      push({
        key: "nudge",
        title: "Relancer le groupe",
        desc: [
          missingAvail > 0
            ? `${missingAvail} dispo${missingAvail > 1 ? "s" : ""} manquante${missingAvail > 1 ? "s" : ""}`
            : null,
          missingPrefs > 0
            ? `${missingPrefs} préférence${missingPrefs > 1 ? "s" : ""} manquante${missingPrefs > 1 ? "s" : ""}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/trips/${tripId}/invite`,
        icon: Users,
        primary: false,
      });
    }
  }

  const participantCaughtUp =
    myAvailabilityDone &&
    myPreferencesDone &&
    (!hasStar || starDone) &&
    (!destinationSelected ||
      ((!hotelOffersReady || myHotelVoted) && (!transportOffersReady || myTransportPicked)));

  const waitingOnOthers =
    participantCaughtUp &&
    !isOwner &&
    (availabilityAnswered < availabilityExpected ||
      progressAnswered < progressTotal ||
      !destinationSelected ||
      (destinationSelected && !hasItinerary));

  if (actions.length === 0 && participantCaughtUp) {
    return (
      <section className="rounded-2xl border border-sage/20 bg-sage/8 p-5">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-sage" />
          <div>
            <h2 className="font-display text-lg font-normal tracking-tight text-foreground">
              Tout est à jour de ton côté
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">
              {isOwner
                ? hasItinerary
                  ? "Le planning est en place. Les choix restent modifiables si nécessaire."
                  : destinationSelected
                    ? "L’hébergement, le transport et le planning restent à finaliser."
                    : "Dès que le groupe a assez répondu, valide dates et destination."
                : !destinationSelected
                  ? "De ton côté c'est bon pour l'instant. La suite dépend du groupe ou de l'organisateur·rice."
                  : "De ton côté c'est bon pour l'instant. La suite dépend du groupe ou de l'organisateur·rice."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const primaryAction = actions.find((a) => a.primary) ?? actions[0];
  const secondaryActions = actions.filter((a) => a !== primaryAction);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
            Tes prochaines actions
          </h2>
          <KrewMark type="arrow" tone="sage" size="sm" rotation={2} className="pointer-events-none opacity-80" />
        </div>
      </div>

      {waitingOnOthers ? (
        <div className="rounded-2xl border border-border/80 bg-muted/40 px-4 py-3 text-sm text-foreground/90">
          De ton côté c&apos;est bon pour l&apos;instant. La suite dépend du groupe ou de
          l&apos;organisateur·rice.
        </div>
      ) : null}

      <div className="space-y-3">
        {primaryAction ? (
          (() => {
            const Tag = primaryAction.href ? "a" : "div";
            return (
              <Tag
                key={primaryAction.key}
                {...(primaryAction.href ? { href: primaryAction.href } : {})}
                className={cn(
                  "group flex items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5 transition hover:border-primary/50",
                  primaryAction.href && "cursor-pointer",
                )}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <primaryAction.icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-sans font-semibold text-foreground group-hover:text-primary transition-colors">
                      {primaryAction.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                      {primaryAction.desc}
                    </p>
                  </div>
                </div>
                {primaryAction.href ? (
                  <ArrowRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
                ) : null}
              </Tag>
            );
          })()
        ) : null}

        {secondaryActions.length > 0 ? (
          <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3">
            {secondaryActions.map((a) => {
              const Tag = a.href ? "a" : "div";
              return (
                <Tag
                  key={a.key}
                  {...(a.href ? { href: a.href } : {})}
                  className={cn(
                    "group flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0 transition",
                    a.href && "cursor-pointer",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-primary transition-colors">
                      <a.icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {a.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{a.desc}</p>
                    </div>
                  </div>
                  {a.href ? (
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  ) : null}
                </Tag>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function TripHubDashboard({
  tripId,
  trip,
  isOwner,
  participantsCount,
  progressAnswered,
  progressTotal,
  availabilityAnswered,
  availabilityExpected,
  provisionalStart,
  provisionalCoverage,
  hasRecommendations,
  profileReady = false,
  profileValidated = false,
  destinationSelected,
  viewerUserId = null,
  destinationName = null,
  liveBudgetTotal = null,
  totalReserved = null,
  totalEstimated = null,
  myAvailabilityDone = false,
  myPreferencesDone = false,
  starDone = false,
  activitiesValidated: inputActivitiesValidated = false,
  tripEndDatePassed: inputTripEndDatePassed = false,
  children,
}: Props) {
  const queryClient = useQueryClient();
  const updateCount = useServerFn(updateTripParticipantsCount);
  const [editingCount, setEditingCount] = useState(false);
  const [participantsValue, setParticipantsValue] = useState(String(trip.participants_count));
  const countMutation = useMutation({
    mutationFn: () =>
      updateCount({ data: { tripId, participantsCount: Number(participantsValue) } }),
    onSuccess: async () => {
      setEditingCount(false);
      toast.success("Nombre de participants mis à jour");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trip", tripId] }),
        queryClient.invalidateQueries({ queryKey: ["trip-progress", tripId] }),
        queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] }),
      ]);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible"),
  });
  const datesLocked = Boolean((trip as any).dates_locked || (trip as any).datesLocked);
  const hasItinerary = Boolean((trip as any).group_itinerary?.days?.length);
  const logistics = ((trip as any).group_logistics || {}) as any;

  const myHotelVoted = Boolean(
    viewerUserId && (logistics.hotelVotes ?? []).some((v: any) => v.userId === viewerUserId),
  );
  const myTransportPicked = Boolean(
    viewerUserId && (logistics.transportPicks ?? []).some((v: any) => v.userId === viewerUserId),
  );
  const hotelOffersReady = Boolean(logistics.hotels?.length);
  const transportOffersReady = Boolean(logistics.transports?.length);

  const theme = eventTypeLabel(trip.event_type);

  return (
    <div className="space-y-8">
      {/* TRIP CONTEXT */}
      <header className="relative overflow-hidden rounded-[30px] bg-sage/8 border border-border/50 p-6 sm:p-8">
        <KrewMark
          type="circle"
          tone="sage"
          size="lg"
          rotation={4}
          className="absolute -top-6 -right-6 w-[120px] opacity-60 pointer-events-none"
        />

        <div className="grid lg:grid-cols-[1fr_180px] gap-6 items-center">
          <div className="space-y-3 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
              {theme}
            </p>
            <h1 className="font-display text-[38px] lg:text-[48px] font-normal leading-[0.95] tracking-tight text-foreground">
              {trip.name}
            </h1>
            {destinationName ? (
              <p className="font-display text-xl sm:text-2xl text-primary font-normal">
                {destinationName}
              </p>
            ) : null}
            {trip.celebrated_person ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <Star className="size-4 fill-amber-400 text-amber-400 shrink-0" /> Pour{" "}
                {trip.celebrated_person}
              </p>
            ) : null}
            {trip.participants &&
            Array.isArray(trip.participants) &&
            trip.participants.filter((p: any) => p.display_name || p.email).length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Avec{" "}
                {trip.participants
                  .map((p: any) => p.display_name || p.email?.split("@")[0] || null)
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground font-sans pt-1">
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5 text-muted-foreground" />
                {editingCount ? (
                  <>
                    <Input
                      aria-label="Nombre de participants"
                      type="number"
                      min={2}
                      max={25}
                      step={1}
                      value={participantsValue}
                      onChange={(e) => setParticipantsValue(e.target.value)}
                      className="h-6 w-14 px-1 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      disabled={
                        countMutation.isPending ||
                        !Number.isInteger(Number(participantsValue)) ||
                        Number(participantsValue) < 2 ||
                        Number(participantsValue) > 25
                      }
                      onClick={() => countMutation.mutate()}
                    >
                      Enregistrer
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setParticipantsValue(String(trip.participants_count));
                        setEditingCount(false);
                      }}
                    >
                      Annuler
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="font-mono">{trip.participants_count}</span> pers.
                    {isOwner ? (
                      <button
                        type="button"
                        className="ml-1 text-muted-foreground hover:text-foreground"
                        aria-label="Modifier le nombre de participants"
                        onClick={() => setEditingCount(true)}
                      >
                        <Pencil className="size-3" />
                      </button>
                    ) : null}
                  </>
                )}
              </span>

              {totalReserved != null && totalEstimated != null ? (
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <Wallet className="size-3.5 text-muted-foreground" /> Réellement Réservé : {formatEuro(totalReserved)} / Reste estimé : {formatEuro(totalEstimated)}
                </span>
              ) : liveBudgetTotal != null && liveBudgetTotal > 0 ? (
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <Wallet className="size-3.5 text-muted-foreground" /> ~{formatEuro(liveBudgetTotal)} / pers.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="size-3.5 text-muted-foreground" /> Budget à définir
                </span>
              )}

              {datesLocked && (trip.start_date || provisionalStart) ? (
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <CalendarDays className="size-3.5 text-muted-foreground" />
                  Dates validées · {trip.start_date
                    ? new Date(trip.start_date + "T12:00:00").toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })
                    : new Date(provisionalStart!).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                  {trip.end_date
                    ? ` → ${new Date(trip.end_date + "T12:00:00").toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}`
                    : ""}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-muted-foreground" /> Date à définir
                </span>
              )}
            </div>
          </div>

          <div className="w-full lg:w-[180px] h-[140px] lg:h-[120px] overflow-hidden rounded-[20px] shrink-0 border border-border/60">
            <img
              src={heroImageForEvent(trip.event_type)}
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
        </div>
      </header>

      {/* Prochaines actions prioritaires */}
      <NextActionsPanel
        tripId={tripId}
        isOwner={isOwner}
        trip={trip}
        myAvailabilityDone={myAvailabilityDone}
        myPreferencesDone={myPreferencesDone}
        starDone={starDone}
        availabilityAnswered={availabilityAnswered}
        availabilityExpected={availabilityExpected}
        progressAnswered={progressAnswered}
        progressTotal={progressTotal || trip.participants_count || 1}
        hasRecommendations={hasRecommendations}
        destinationSelected={destinationSelected}
        datesLocked={datesLocked}
        myHotelVoted={myHotelVoted}
        myTransportPicked={myTransportPicked}
        hotelOffersReady={hotelOffersReady}
        transportOffersReady={transportOffersReady}
        hasItinerary={hasItinerary}
      />

      {children}
    </div>
  );
}
