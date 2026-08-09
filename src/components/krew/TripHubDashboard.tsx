import { Link } from "@tanstack/react-router";
import { useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TripHubNav } from "@/components/krew/TripHubNav";
import { buildTripSteps } from "@/lib/krew/availability";
import { eventTypeLabel, formatEuro } from "@/lib/krew/constants";
import { cn } from "@/lib/utils";

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
  destinationSelected: boolean;
  viewerUserId?: string | null;
  /** Nom de la destination validée */
  destinationName?: string | null;
  /** Budget estimé live (€ / pers.) si calculé */
  liveBudgetTotal?: number | null;
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
    // EVG — rooftop / night out entre potes (pas la teuf de campus)
    evg: `https://images.unsplash.com/photo-1514933651103-005eec06c04b?${q}`,
    // EVJF — champagne, lumière dorée, élégance
    evjf: `https://images.unsplash.com/photo-1527529482838-46479466cbfe?${q}`,
    // Anniversaire — dîner en ville / toast, zéro ballon
    anniversaire: `https://images.unsplash.com/photo-1414235077428-338989a2e8c0?${q}`,
    // Week-end — route côtière / escapade
    weekend: `https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?${q}`,
    // Voyage de groupe — amis en hauteur, vue panorama
    voyage_groupe: `https://images.unsplash.com/photo-1527631746610-b998ef1c7d1d?${q}`,
    // Famille — bord de mer, moment vrai
    famille: `https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?${q}`,
    // Séminaire — skyline / business trip moderne
    seminaire: `https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?${q}`,
    // Retraite — terrasse golden hour, sérénité
    retraite: `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?${q}`,
    // Autre
    autre: `https://images.unsplash.com/photo-1488085061387-422e29b40080?${q}`,
  };
  const key = String(eventType || "").toLowerCase();
  return map[key] || `https://images.unsplash.com/photo-1488085061387-422e29b40080?${q}`;
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
        : "Préférences de la star",
      desc: "Réponses pondérées plus fort dans le scoring.",
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
          desc: "Propositions Krew basées sur les prefs du groupe.",
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
      <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-emerald-900 dark:text-emerald-200">
              Tout est à jour de ton côté
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-emerald-800/90 dark:text-emerald-300/90">
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

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Tes prochaines actions
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Uniquement ce qui te reste à faire.
          </p>
        </div>
      </div>

      {waitingOnOthers ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          De ton côté c&apos;est bon pour l&apos;instant. La suite dépend du groupe ou de
          l&apos;organisateur·rice.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.slice(0, 6).map((a) => {
          const Tag = a.href ? "a" : "div";
          return (
            <Tag
              key={a.key}
              {...(a.href ? { href: a.href } : {})}
              className={cn(
                "group flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm transition",
                a.primary
                  ? "border-primary/40 bg-primary/5 hover:border-primary hover:shadow-glow"
                  : "border-border hover:border-primary/30",
                a.href && "cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  a.primary
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-primary",
                )}
              >
                <a.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-semibold leading-snug",
                    a.primary && "text-primary",
                    "group-hover:text-primary",
                  )}
                >
                  {a.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{a.desc}</p>
              </div>
              {a.href ? (
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
              ) : null}
            </Tag>
          );
        })}
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
  destinationSelected,
  viewerUserId = null,
  destinationName = null,
  liveBudgetTotal = null,
  myAvailabilityDone = false,
  myPreferencesDone = false,
  starDone = false,
  topScores = [],
  activitiesValidated: inputActivitiesValidated = false,
  tripEndDatePassed: inputTripEndDatePassed = false,
  children,
}: Props) {

  const datesLocked = Boolean(
    (trip as any).dates_locked || (trip as any).datesLocked,
  );
  const hasItinerary = Boolean(
    (trip as any).group_itinerary?.days?.length,
  );
  const logistics = ((trip as any).group_logistics || {}) as any;
  const hotelVoted =
    (Array.isArray(logistics.hotelVotes) && logistics.hotelVotes.length > 0) ||
    Boolean(logistics.selectedHotelId);
  const transportPicked =
    Array.isArray(logistics.transportPicks) && logistics.transportPicks.length > 0;
  const myHotelVoted = Boolean(
    viewerUserId &&
      (logistics.hotelVotes ?? []).some((v: any) => v.userId === viewerUserId),
  );
  const myTransportPicked = Boolean(
    viewerUserId &&
      (logistics.transportPicks ?? []).some((v: any) => v.userId === viewerUserId),
  );
  const hotelOffersReady = Boolean(logistics.hotels?.length);
  const transportOffersReady = Boolean(logistics.transports?.length);

  // Même seuil que `assessGenerationReadiness` côté serveur (MIN_ANSWERS / MIN_ANSWER_RATIO) :
  // on masque les propositions tant que le questionnaire de préférences n'est pas assez rempli.
  const prefsExpected = Math.max(progressTotal || trip.participants_count || 1, 1);
  const prefsMinRequired = Math.max(1, Math.ceil(prefsExpected * 0.4));
  const prefsOkForProposals = progressAnswered >= prefsMinRequired;

  const steps = buildTripSteps({
    tripId,
    participantsJoined: participantsCount,
    participantsExpected: trip.participants_count || 1,
    availabilityAnswered,
    questionnaireAnswered: progressAnswered,
    datesLocked,
    hasRecommendations,
    destinationSelected,
    hotelVoted,
    transportPicked,
    hasItinerary,
    activitiesValidated: inputActivitiesValidated,
    tripEndDatePassed: inputTripEndDatePassed,
  });

  const theme = eventTypeLabel(trip.event_type);

  
  return (
    <div className="space-y-8">
      {/* Hero image + titre */}
      <header className="relative overflow-hidden rounded-3xl border border-border shadow-elevated">
        <div className="relative h-44 sm:h-56 md:h-64">
          <img
            src={heroImageForEvent(trip.event_type)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
          <div className="relative z-10 flex h-full flex-col justify-end p-5 sm:p-7 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
              {theme}
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl">
              {trip.name}
            </h1>
            {trip.celebrated_person ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-white/90">
                <Star className="size-4 fill-amber-400 text-amber-400" /> Pour{" "}
                {trip.celebrated_person}
              </p>
            ) : null}
            {trip.participants && Array.isArray(trip.participants) && trip.participants.length > 0 ? (
              <p className="mt-1 text-xs text-white/70">
                Avec {trip.participants.map((p: any) => p.display_name || p.email?.split("@")[0] || "Ami").join(", ")}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border/60 bg-card/95 px-5 py-3.5 sm:px-7">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-sm">
            <Users className="size-3.5 text-primary" /> {trip.participants_count} pers.
          </span>
          {liveBudgetTotal != null && liveBudgetTotal > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-sm">
              <Wallet className="size-3.5 text-primary" />{" "}
              ~{formatEuro(liveBudgetTotal)} / pers.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-sm text-muted-foreground">
              <Wallet className="size-3.5" /> Budget à définir
            </span>
          )}
          {datesLocked && (trip.start_date || provisionalStart) ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-800 dark:text-emerald-300">
              <CalendarDays className="size-3.5" />
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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-sm text-muted-foreground">
              <CalendarDays className="size-3.5" /> Date à définir
            </span>
          )}
        </div>
      </header>

      {/* Progression */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Parcours du groupe
        </h2>
        <TripHubNav tripId={tripId} steps={steps} />
      </section>

      {/* Résumé des retours x/N */}
      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          État des réponses · groupe de {trip.participants_count || participantsCount}
        </h2>
        <ul className="mt-4 space-y-3 text-sm">
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
            <span className="font-medium">Disponibilités</span>
            <span className="tabular-nums">
              <strong>{availabilityAnswered}</strong>/{availabilityExpected}
              {availabilityExpected - availabilityAnswered > 0 ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  · {availabilityExpected - availabilityAnswered} n&apos;ont pas répondu
                </span>
              ) : (
                <span className="ml-2 text-xs text-lagoon">· tout le monde a répondu</span>
              )}
            </span>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
            <span className="font-medium">Préférences</span>
            <span className="tabular-nums">
              <strong>{progressAnswered}</strong>/{progressTotal || trip.participants_count}
              {(progressTotal || trip.participants_count) - progressAnswered > 0 ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  · {(progressTotal || trip.participants_count) - progressAnswered} n&apos;ont pas répondu
                </span>
              ) : (
                <span className="ml-2 text-xs text-lagoon">· tout le monde a répondu</span>
              )}
            </span>
          </li>
        </ul>
      </section>

      {/* Prochaines étapes (perso, pas un doublon du parcours) */}
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

      {/* Scores live */}
      {topScores.length > 0 && prefsOkForProposals ? (
        <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="font-semibold">Propositions en cours</h2>
            <span className="text-xs text-muted-foreground">évoluent avec les réponses</span>
          </div>
          <ul className="mt-4 -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:block sm:space-y-2 sm:overflow-visible sm:px-0 sm:pb-0">
            {topScores.map((s, i) => (
              <li
                key={s.name}
                className={cn(
                  "flex min-w-[72%] shrink-0 snap-center items-center justify-between rounded-2xl border px-4 py-3 sm:min-w-0 sm:shrink",
                  i === 0 ? "border-primary/30 bg-primary/5" : "border-border/70 bg-surface/30",
                )}
              >
                <span className="font-medium">
                  {i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : ""}
                  {s.name}
                </span>
                <span className="text-lg font-bold tabular-nums text-primary">
                  {Math.round(s.score)} %
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <Link to="/trips/$tripId" params={{ tripId }} hash="hub-destination">
                <MapPin className="size-3.5" /> Voir le détail
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {children}

    </div>
  );
}
