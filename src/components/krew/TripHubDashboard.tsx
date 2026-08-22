import { Link } from "@tanstack/react-router";
import { eventTypeLabel, formatEuro, getTripTypeImage } from "@/lib/krew/constants";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/krew/Logo";
import {
  KrewIcon,
  KrewMark,
  KrewOrganicBlob,
  KrewHighlight,
  KrewActionStack,
  type KrewActionItem,
} from "@/components/krew/visual-language";

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

  const actions: KrewActionItem[] = [];
  const push = (a: KrewActionItem) => {
    actions.push(a);
  };

  // —— 1. Actions perso (tous) ——
  if (!myAvailabilityDone) {
    push({
      key: "avail",
      title: "Indiquer mes disponibilités",
      description: "Indispensable pour trouver une date commune.",
      href: `/trips/${tripId}/availability`,
      iconName: "availability",
    });
  }
  if (!myPreferencesDone) {
    push({
      key: "prefs",
      title: "Renseigner mes préférences",
      description: "Budget, envies et transports pour trouver les destinations qui correspondent au groupe.",
      href: `/trips/${tripId}/questionnaire`,
      iconName: "preferences",
    });
  }
  if (hasStar && !starDone) {
    push({
      key: "star",
      title: trip.celebrated_person
        ? `Renseigner les préférences de ${trip.celebrated_person}`
        : "Renseigner les préférences de la Star",
      description: "Compléter ses préférences pour le voyage.",
      href: `/trips/${tripId}/star`,
      iconName: "favorite",
    });
  }

  // —— 2. Après destination : hébergement + transport (tous) ——
  if (destinationSelected) {
    if (hotelOffersReady && !myHotelVoted) {
      push({
        key: "hotel",
        title: "Voter pour un hébergement",
        description: "Un vote par personne — l’organisateur·rice finalise le choix.",
        href: `/trips/${tripId}?view=voyage&section=accommodation`,
        iconName: "accommodation",
      });
    }
    if (transportOffersReady && !myTransportPicked) {
      push({
        key: "transport",
        title: "Choisir mon trajet",
        description: "Selon la ville de départ et les contraintes horaires.",
        href: `/trips/${tripId}?view=voyage&section=transport`,
        iconName: "transport",
      });
    }
  }

  // —— 3. Actions orga uniquement ——
  if (isOwner) {
    if (myAvailabilityDone && myPreferencesDone && !datesLocked) {
      push({
        key: "lock-dates",
        title: "Valider les dates du groupe",
        description: "Cette validation débloque la suite du voyage.",
        href: `/trips/${tripId}?view=voyage&section=dates`,
        iconName: "calendar",
      });
    }
    if (datesLocked && !profileValidated && profileReady) {
      push({
        key: "choose-profile",
        title: "Choisir le profil du voyage",
        description: "Choisis 1 à 3 profils qui correspondent au séjour du groupe.",
        href: `/trips/${tripId}?view=voyage&section=profile`,
        iconName: "profile",
      });
    }
    if (datesLocked && profileValidated && !destinationSelected) {
      if (!hasRecommendations) {
        push({
          key: "gen",
          title: "Trouver des destinations",
          description: "Des propositions adaptées aux préférences du groupe.",
          href: `/trips/${tripId}?view=voyage&section=destination`,
          iconName: "destination",
        });
      } else {
        push({
          key: "pick-dest",
          title: "Valider une destination",
          description: "Cette validation débloque les hébergements, les trajets et le planning.",
          href: `/trips/${tripId}?view=voyage&section=destination`,
          iconName: "destination",
        });
      }
    }
    if (destinationSelected && !hotelOffersReady) {
      push({
        key: "search-hotels",
        title: "Rechercher des hébergements",
        description: "Proposer des hébergements au groupe pour le vote.",
        href: `/trips/${tripId}?view=voyage&section=accommodation`,
        iconName: "accommodation",
      });
    }
    if (destinationSelected && !transportOffersReady) {
      push({
        key: "search-transport",
        title: "Proposer des trajets A/R",
        description: "Des options adaptées aux villes de départ du groupe.",
        href: `/trips/${tripId}?view=voyage&section=transport`,
        iconName: "transport",
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
        description: "Construire le séjour jour par jour en tenant compte des horaires d’arrivée et de départ.",
        href: `/trips/${tripId}?view=voyage&section=planning`,
        iconName: "planning",
      });
    }
    if (hasItinerary) {
      push({
        key: "refine",
        title: "Affiner l’organisation",
        description: "Ajuster un créneau, vérifier les choix du groupe ou partager le résumé.",
        href: `/trips/${tripId}?view=voyage&section=planning`,
        iconName: "tasks",
      });
    }

    const missingAvail = Math.max(0, availabilityExpected - availabilityAnswered);
    const missingPrefs = Math.max(0, progressTotal - progressAnswered);
    if (missingAvail > 0 || missingPrefs > 0) {
      push({
        key: "nudge",
        title: "Relancer le groupe",
        description: [
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
        iconName: "group",
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
      <section className="-mx-4 sm:mx-0 rounded-3xl border border-sage/25 bg-sage/12 p-6 sm:p-7 relative overflow-hidden shadow-xs">
        <div className="flex items-start gap-4">
          <Logo variant="icon" size="sm" className="size-12 sm:size-14 shrink-0 pointer-events-none" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl sm:text-2xl font-normal tracking-tight text-foreground">
                Tout est à jour de ton côté
              </h2>
              <KrewMark type="check" tone="sage" size="sm" className="size-5 shrink-0" />
            </div>
            <p className="text-sm leading-relaxed text-foreground/80 font-sans pt-0.5">
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

  const primaryAction = actions[0];
  if (!primaryAction) return null;

  const secondaryActions = actions.slice(1, 4);

  const progressItems = [];
  if (availabilityExpected > 0) {
    progressItems.push({
      label: "Disponibilités",
      value: Math.round((availabilityAnswered / availabilityExpected) * 100),
      tone: "sage" as const,
    });
  }
  if (progressTotal > 0) {
    progressItems.push({
      label: "Préférences",
      value: Math.round((progressAnswered / progressTotal) * 100),
      tone: "plum" as const,
    });
  }

  return (
    <div className="-mx-4 sm:mx-0 my-4 sm:my-6 overflow-hidden relative space-y-3">
      {waitingOnOthers ? (
        <div className="rounded-2xl border border-border/70 bg-card/90 px-4 py-3.5 text-sm text-foreground/90 font-sans shadow-2xs">
          De ton côté c&apos;est bon pour l&apos;instant. La suite dépend du groupe ou de
          l&apos;organisateur·rice.
        </div>
      ) : null}

      <KrewActionStack
        primary={primaryAction}
        secondary={secondaryActions}
        progress={progressItems}
      />
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
      {/* ZONE 1 — COVER DU VOYAGE (EXACT BLUEPRINT) */}
      <header className="relative overflow-visible -mx-4 sm:mx-0 pb-2">
        {/* Conteneur photo & blob positioning */}
        <div className="relative w-full">
          {/* C2. BLOB SAUGE (z0) : derrière le haut/droite de la photo */}
          <KrewOrganicBlob
            tone="sage"
            variant="soft"
            className="absolute -top-5 right-0 w-[80%] h-[200px] sm:h-[240px] z-0 opacity-70 pointer-events-none"
          />

          {/* C1. PHOTO (z10) : largeur ~calc(100% - 8px), hauteur 260-280px, alignée gauche */}
          <div
            className="relative z-10 w-[calc(100%-8px)] h-[260px] sm:h-[280px] overflow-hidden"
            style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 88%, 88% 100%, 0% 93%)" }}
          >
            <img
              src={heroImageForEvent(trip.event_type)}
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>


          {/* C4. BLOB PRUNE (z20) : chevauche le bas de la photo de 64-76px */}
          <div className="relative z-20 -mt-[70px] w-[90%] sm:w-[88%] min-h-[180px]">
            <KrewOrganicBlob
              tone="plum"
              variant="sweep"
              className="w-full h-full text-primary filter drop-shadow-sm"
            />

            {/* C5. CONTENU DU BLOB PRUNE (z30) */}
            <div className="absolute inset-0 z-30 p-6 flex flex-col justify-center gap-2 text-primary-foreground">
              {/* Type de voyage */}
              <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-white/70">
                {theme}
              </p>

              {/* Nom du voyage */}
              <h1 className="font-display text-[40px] sm:text-[44px] font-normal leading-[0.98] tracking-tight text-white break-words max-h-[90px] line-clamp-2">
                {trip.name}
              </h1>

              {/* Destination */}
              {destinationName ? (
                <div className="pt-1 flex items-center gap-2">
                  <KrewIcon name="destination" tone="sage" size="sm" className="size-5 shrink-0" />
                  <div className="relative inline-block">
                    <span className="font-display text-[24px] text-sage font-normal leading-none">
                      {destinationName}
                    </span>
                    {/* C6. UNDERLINE DESTINATION */}
                    <KrewMark
                      type="underline"
                      tone="sage"
                      size="sm"
                      className="absolute left-0 -bottom-1 h-[8px] w-full opacity-90 pointer-events-none"
                    />
                  </div>
                </div>
              ) : null}

              {/* C7. PERSONNE CÉLÉBRÉE */}
              {trip.celebrated_person ? (
                <p className="inline-flex items-center gap-2 text-sm font-medium text-white/90 pt-0.5">
                  <KrewIcon name="favorite" tone="sage" size="sm" className="size-4 shrink-0" />
                  <span>Pour <strong className="font-semibold text-white">{trip.celebrated_person}</strong></span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* D. MÉTADONNÉES SOUS LE HERO (3 LIGNES SANS WRAP A 390PX) */}
        <div className="mt-6 space-y-2.5 px-4 font-sans text-[13px] font-medium leading-[1.2] whitespace-nowrap text-foreground">
          {/* D1. DATES (accent sauge sur les dates uniquement) */}
          <div className="flex items-center gap-2 text-foreground">
            <KrewIcon name="calendar" tone="sage" size="sm" className="size-4 shrink-0" />
            {datesLocked && (trip.start_date || provisionalStart) ? (
              <p className="whitespace-nowrap">
                <span className="text-foreground">Dates validées · </span>
                <KrewHighlight tone="sage" className="px-1 py-0.5 font-medium">
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
                </KrewHighlight>
              </p>
            ) : (
              <span className="text-muted-foreground">Date à définir</span>
            )}
          </div>

          {/* D2. PARTICIPANTS */}
          <div className="flex items-center gap-2 text-foreground/90">
            <KrewIcon name="group" tone="plum" size="sm" className="size-4 shrink-0" />
            <p className="whitespace-nowrap">
              <span>{trip.participants_count || 1} participants</span>
            </p>
          </div>

          {/* D3. BUDGET (WORDING RACCOURCI POUR ÉVITER TOUT WRAP) */}
          <div className="flex items-center gap-2 text-primary font-semibold text-[12.5px]">
            <KrewIcon name="budget" tone="plum" size="sm" className="size-4 shrink-0" />
            <div className="whitespace-nowrap">
              {totalReserved != null && totalEstimated != null ? (
                <span>Réservé {formatEuro(totalReserved)} · Reste estimé {formatEuro(totalEstimated)}</span>
              ) : liveBudgetTotal != null && liveBudgetTotal > 0 ? (
                <span>~{formatEuro(liveBudgetTotal)} / pers.</span>
              ) : (
                <span className="text-muted-foreground font-medium">Budget à définir</span>
              )}
            </div>
          </div>
        </div>

        {/* E. 32px RESPIRATION APRES METADATAS (PAS DE LOUTRE, PAS DE FLÈCHE, PAS DE DIVIDER) */}
        <div className="h-8" />
      </header>

      {/* PROCHAINES ACTIONS VIA KREW ACTION STACK */}
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
