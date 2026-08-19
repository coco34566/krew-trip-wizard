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
import { TripHubNav } from "@/components/krew/TripHubNav";
import { buildTripSteps } from "@/lib/krew/availability";
import { eventTypeLabel, formatEuro } from "@/lib/krew/constants";
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

/** Photos voyage (Unsplash) selon le type d'événement. */
/** Photos lifestyle premium (Unsplash) — voyage & ambiance, pas de clichés ballons/kitsch. */
function heroImageForEvent(eventType?: string | null) {
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
      title: "Indique tes disponibilités",
      desc: "Indispensable pour trouver une date commune.",
      href: `/trips/${tripId}/availability`,
      icon: CalendarDays,
    });
  }
  if (!myPreferencesDone) {
    push({
      key: "prefs",
      title: "Remplis tes préférences",
      desc: "Budget, ambiances, transports… pour scorer les destinations.",
      href: `/trips/${tripId}/questionnaire`,
      icon: ClipboardList,
    });
  }
  if (hasStar && !starDone) {
    push({
      key: "star",
      title: trip.celebrated_person
        ? `Préférences de ${trip.celebrated_person}`
        : "Préférences de la Star",
      desc: "Complète ses préférences pour le voyage.",
      href: `/trips/${tripId}/star`,
      icon: Star,
    });
  }

  // —— 2. Après destination : hôtel + transport (tous) ——
  if (destinationSelected) {
    if (hotelOffersReady && !myHotelVoted) {
      push({
        key: "hotel",
        title: "Vote pour un hôtel",
        desc: "Un vote par personne — l'orga réserve le plus plébiscité.",
        href: `#hub-logistics`,
        icon: Hotel,
      });
    }
    if (transportOffersReady && !myTransportPicked) {
      push({
        key: "transport",
        title: "Choisis ton trajet A/R",
        desc: "Selon ta ville + horaires d'arrivée / départ (utile pour le planning).",
        href: `#hub-transports`,
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
        desc: "Verrouille le week-end pour débloquer les destinations.",
        href: `#hub-dates`,
        icon: CalendarDays,
      });
    }
    if (datesLocked && !destinationSelected) {
      if (!hasRecommendations) {
        push({
          key: "gen",
          title: "Générer des destinations",
          desc: "Des propositions adaptées aux préférences du groupe.",
          href: `#hub-destination`,
          icon: Sparkles,
        });
      } else {
        push({
          key: "pick-dest",
          title: "Valider une destination",
          desc: "Débloque hôtels, trajets et planning.",
          href: `#hub-destination`,
          icon: MapPin,
        });
      }
    }
    if (destinationSelected && !hotelOffersReady) {
      push({
        key: "search-hotels",
        title: "Lancer la recherche hôtels",
        desc: "Propose des hébergements au groupe pour voter.",
        href: `#hub-logistics`,
        icon: Hotel,
      });
    }
    if (destinationSelected && !transportOffersReady) {
      push({
        key: "search-transport",
        title: "Proposer des trajets A/R",
        desc: "Options par ville de départ pour que chacun choisisse.",
        href: `#hub-transports`,
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
        title: "Générer le planning",
        desc: "Jour par jour, en tenant compte des horaires d'arrivée / départ.",
        href: `#hub-activities-plan`,
        icon: Sparkles,
      });
    }
    if (hasItinerary) {
      push({
        key: "refine",
        title: "Affiner l'organisation",
        desc: "Régénère un créneau, check hôtel top votes, partage le résumé.",
        href: `#hub-activities-plan`,
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
        href: `#invite-section`,
        icon: Users,
        primary: false,
      });
    }
  }

  const personalDone =
    myAvailabilityDone &&
    myPreferencesDone &&
    (!hasStar || starDone) &&
    (!destinationSelected || (myHotelVoted && myTransportPicked) || !hotelOffersReady);

  // Participant "à jour" si prefs+dispos (+ star) et, si offres ouvertes, a voté hôtel + trajet
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
                  ? "Planning en place — tu peux encore ajuster hôtels, trajets ou créneaux plus bas."
                  : destinationSelected
                    ? "Enchaîne hôtels, trajets et planning plus bas sur la page."
                    : "Dès que le groupe a assez répondu, valide dates et destination."
                : !destinationSelected
                  ? "C'est aux autres de répondre, et à l'organisateur·rice de faire avancer le parcours."
                  : "L'organisateur·rice finalise l'organisation. Tu seras prévenu·e dès qu'il y a du nouveau."}
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
        {/* Action principale (bloc horizontal léger) */}
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

        {/* Actions secondaires (lignes simples) */}
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
  const hotelBookingStatus = logistics.hotelBookingStatus || "estimé";
  const hotelVoted = hotelBookingStatus === "sélectionné" || hotelBookingStatus === "réservé";

  const activeParticipants = Array.isArray(trip.participants)
    ? trip.participants.filter((p: any) => p.status !== "absent")
    : [];

  const transportPicked =
    activeParticipants.length > 0 &&
    activeParticipants.every((p: any) => {
      const userPick = p.user_id
        ? (logistics.transportPicks ?? []).find((pk: any) => pk.userId === p.user_id)
        : null;
      return userPick && (userPick.status === "sélectionné" || userPick.status === "réservé");
    });
  const myHotelVoted = Boolean(
    viewerUserId && (logistics.hotelVotes ?? []).some((v: any) => v.userId === viewerUserId),
  );
  const myTransportPicked = Boolean(
    viewerUserId && (logistics.transportPicks ?? []).some((v: any) => v.userId === viewerUserId),
  );
  const hotelOffersReady = Boolean(logistics.hotels?.length);
  const transportOffersReady = Boolean(logistics.transports?.length);

  // Même seuil que `assessGenerationReadiness` côté serveur (MIN_ANSWERS / MIN_ANSWER_RATIO) :
  // Règle retirée pour toujours afficher les propositions sans seuil minimum de préférences
  const steps = buildTripSteps({
    tripId,
    participantsJoined: participantsCount,
    participantsExpected: trip.participants_count || 1,
    availabilityAnswered,
    questionnaireAnswered: progressAnswered,
    datesLocked,
    profileReady,
    profileValidated,
    hasRecommendations,
    destinationSelected,
    hotelVoted,
    transportPicked,
    hasItinerary,
    activitiesValidated: inputActivitiesValidated,
    tripEndDatePassed: inputTripEndDatePassed,
    showStarStep:
      isOwner &&
      Boolean(trip.has_star || trip.celebrated_person) &&
      logistics.star_mode === "secret",
    starName: trip.celebrated_person,
    starDone,
  });

  const theme = eventTypeLabel(trip.event_type);

  return (
    <div className="space-y-8">
      {/* Hero section : Titre + Métadonnées + Photo éditoriale */}
      <header className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
            {theme}
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl lg:text-5xl font-normal text-foreground tracking-tight">
            {trip.name}
          </h1>
          {destinationName ? (
            <p className="mt-1 font-display text-xl sm:text-2xl text-primary font-normal">
              {destinationName}
            </p>
          ) : null}
          {trip.celebrated_person ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80">
              <Star className="size-4 fill-amber-400 text-amber-400 shrink-0" /> Pour{" "}
              {trip.celebrated_person}
            </p>
          ) : null}
          {trip.participants &&
          Array.isArray(trip.participants) &&
          trip.participants.filter((p: any) => p.display_name || p.email).length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Avec{" "}
              {trip.participants
                .map((p: any) => p.display_name || p.email?.split("@")[0] || null)
                .filter(Boolean)
                .join(", ")}
            </p>
          ) : null}
        </div>

        {/* Métadonnées légères */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-sans">
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
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 font-sans text-foreground">
                <Wallet className="size-3.5 text-secondary" /> Réellement Réservé :{" "}
                <span className="font-mono">{formatEuro(totalReserved)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-sans">
                <Wallet className="size-3.5 text-muted-foreground" /> Reste estimé :{" "}
                <span className="font-mono">{formatEuro(totalEstimated)}</span>
              </span>
            </>
          ) : liveBudgetTotal != null && liveBudgetTotal > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-sans">
              <Wallet className="size-3.5 text-muted-foreground" /> ~
              <span className="font-mono">{formatEuro(liveBudgetTotal)}</span> / pers.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
              <Wallet className="size-3.5" /> Budget à définir
            </span>
          )}

          {datesLocked && (trip.start_date || provisionalStart) ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 font-sans text-foreground">
              <CalendarDays className="size-3.5 text-secondary" />
              {"Dates validées · "}
              {trip.start_date
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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
              <CalendarDays className="size-3.5" /> Date à définir
            </span>
          )}
        </div>

        {/* Photo éditoriale du voyage */}
        <div className="relative aspect-[16/10] sm:aspect-[16/7] w-full overflow-hidden rounded-2xl border border-border/60 bg-muted">
          <img
            src={heroImageForEvent(trip.event_type)}
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
          />
          <KrewMark
            type="circle"
            tone="sage"
            size="md"
            rotation={-4}
            className="absolute top-4 right-4 pointer-events-none opacity-80 text-white"
          />
        </div>
      </header>

      {/* Prochaines étapes (prioritaires) */}
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

      {/* Parcours du groupe */}
      <section className="space-y-3 relative">
        <div className="hidden sm:block absolute -top-4 right-8 pointer-events-none z-10">
          <KrewMark type="connector" tone="sage" size="md" rotation={-2} />
        </div>
        <TripHubNav
          tripId={tripId}
          steps={steps}
          availabilityAnswered={availabilityAnswered}
          availabilityExpected={availabilityExpected}
          progressAnswered={progressAnswered}
          progressTotal={progressTotal || trip.participants_count || 1}
        />
      </section>

      {children}
    </div>
  );
}
