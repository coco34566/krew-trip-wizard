import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ClipboardList,
  ArrowRight,
  MapPin,
  Sparkles,
  Star,
  Users,
  Wallet,
  Hotel,
  Plane,
} from "lucide-react";
import { eventTypeLabel, formatEuro, getTripTypeImage } from "@/lib/krew/constants";
import { cn } from "@/lib/utils";
import { KrewMark, KrewSectionWave } from "@/components/krew/visual-language";

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
  profileReady?: boolean;
  profileValidated?: boolean;
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
  profileReady = false,
  profileValidated = false,
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
    if (datesLocked && !profileValidated && profileReady) {
      push({
        key: "choose-profile",
        title: "Choisir le profil du voyage",
        desc: "Choisis 1 à 3 profils qui correspondent au séjour du groupe.",
        href: `/trips/${tripId}?view=voyage&section=profile`,
        icon: Sparkles,
      });
    }
    if (datesLocked && profileValidated && !destinationSelected) {
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
        href: `/trips/${tripId}#group-section`,
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

  const primaryAction = actions.find((a) => a.primary) ?? actions[0];
  const secondaryActions = actions.filter((a) => a !== primaryAction);

  return (
    <div className="-mx-4 sm:mx-0 my-4 sm:my-6 overflow-hidden">
      {/* Vague supérieure ouvrant la grande nappe sauge */}
      <KrewSectionWave position="top" tone="sage" className="text-sage/18" />

      {/* GRANDE NAPPE SAUGE PLEINE LARGEUR */}
      <div className="bg-sage/18 px-5 sm:px-8 py-6 sm:py-8 space-y-4">
        {actions.length === 0 && participantCaughtUp ? (
          <div className="flex gap-3.5 items-start py-2">
            <KrewMark type="check" tone="sage" size="sm" className="mt-0.5 size-6 shrink-0" />
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-normal tracking-tight text-foreground">
                Tout est à jour de ton côté
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-foreground/80 font-sans">
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
        ) : (
          <>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/75 font-sans">
                Tes prochaines actions
              </h2>
              <KrewMark type="arrow" tone="sage" size="sm" rotation={2} className="pointer-events-none opacity-90" />
            </div>

            {waitingOnOthers ? (
              <div className="rounded-2xl border border-border/70 bg-card/90 px-4 py-3.5 text-sm text-foreground/90 font-sans shadow-2xs">
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
                        "group flex items-center justify-between gap-4 rounded-2xl border border-sage/40 bg-card p-4 sm:p-5 transition hover:border-primary/50 shadow-sm",
                        primaryAction.href && "cursor-pointer",
                      )}
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                          <primaryAction.icon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-sans text-base font-semibold text-foreground group-hover:text-primary transition-colors">
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
                <div className="rounded-2xl border border-border/70 bg-card/95 p-4 space-y-3 shadow-2xs">
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
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-muted-foreground group-hover:text-primary transition-colors">
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
          </>
        )}
      </div>

      {/* Vague inférieure refermant la grande nappe sauge */}
      <KrewSectionWave position="bottom" tone="sage" className="text-sage/18" />
    </div>
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
    <div className="space-y-6 sm:space-y-8">
      {/* HERO COVER ÉDITORIAL & IMMERSIF */}
      <header className="relative overflow-hidden -mx-4 sm:mx-0 sm:rounded-[32px] bg-background border-b sm:border border-border/50">
        {/* Circle KrewMark expressif en filigrane d'angle */}
        <KrewMark
          type="circle"
          tone="sage"
          size="lg"
          rotation={4}
          className="absolute -top-7 -right-7 w-[140px] sm:w-[160px] opacity-40 pointer-events-none z-10"
        />

        <div className="grid lg:grid-cols-12 gap-0">
          {/* Photographie Dominante — Couverture éditoriale mobile (~280-320px tall) & Desktop (col-5) */}
          <div className="lg:col-span-5 order-first lg:order-last relative h-72 sm:h-80 lg:h-auto min-h-[280px] overflow-hidden border-b lg:border-b-0 lg:border-l border-border/40">
            <img
              src={heroImageForEvent(trip.event_type)}
              alt=""
              className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
              loading="eager"
            />
          </div>

          {/* Bloc Titre & Informations Voyage */}
          <div className="lg:col-span-7 p-5 sm:p-8 flex flex-col justify-between space-y-4 min-w-0 relative">
            <div className="space-y-2 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                {theme}
              </p>
              <h1 className="font-display text-[36px] sm:text-[44px] lg:text-[52px] font-normal leading-[0.95] tracking-tight text-foreground">
                {trip.name}
              </h1>

              {destinationName ? (
                <p className="font-display text-2xl sm:text-3xl text-primary font-normal flex items-center gap-2 pt-1">
                  <MapPin className="size-5 text-primary shrink-0" />
                  <span>{destinationName}</span>
                </p>
              ) : null}

              {trip.celebrated_person ? (
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80 pt-0.5">
                  <Star className="size-4 fill-amber-400 text-amber-400 shrink-0" /> Pour{" "}
                  <span className="font-semibold">{trip.celebrated_person}</span>
                </p>
              ) : null}

              {trip.participants &&
              Array.isArray(trip.participants) &&
              trip.participants.filter((p: any) => p.display_name || p.email).length > 0 ? (
                <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
                  Avec{" "}
                  {trip.participants
                    .map((p: any) => p.display_name || p.email?.split("@")[0] || null)
                    .filter(Boolean)
                    .join(", ")}
                </p>
              ) : null}
            </div>

            {/* Ligne de métadonnées compactes */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground font-sans pt-3 border-t border-border/40">
              <span className="inline-flex items-center gap-1.5 font-sans">
                <Users className="size-3.5 text-muted-foreground shrink-0" />
                <span className="font-mono text-foreground font-medium">{trip.participants_count}</span> pers.
              </span>

              {totalReserved != null && totalEstimated != null ? (
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <Wallet className="size-3.5 text-muted-foreground shrink-0" /> Réellement Réservé : {formatEuro(totalReserved)} / Reste estimé : {formatEuro(totalEstimated)}
                </span>
              ) : liveBudgetTotal != null && liveBudgetTotal > 0 ? (
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <Wallet className="size-3.5 text-muted-foreground shrink-0" /> ~{formatEuro(liveBudgetTotal)} / pers.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="size-3.5 text-muted-foreground shrink-0" /> Budget à définir
                </span>
              )}

              {datesLocked && (trip.start_date || provisionalStart) ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-foreground font-medium">
                  <CalendarDays className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-primary font-sans font-medium">Dates validées</span> · {trip.start_date
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
                  <CalendarDays className="size-3.5 text-muted-foreground shrink-0" /> Date à définir
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* GRANDE NAPPE SAUGE "TES PROCHAINES ACTIONS" ENCADRÉE PAR DEUX VAGUES */}
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
        profileReady={profileReady}
        profileValidated={profileValidated}
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
