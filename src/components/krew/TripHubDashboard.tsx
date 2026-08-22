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
      {/* COMPOSITION V5.1 INTEGRÉE (5 LAYERS, Z-INDEX STRUCTURÉS, ZÉRO CARD WRAPPER) */}
      <header className="relative overflow-visible -mx-4 sm:mx-0 pt-2 pb-8 min-h-[560px] sm:min-h-[600px]">
        {/* LAYER 1 (z-0) : Grande Forme Sauge Arrière-Plan */}
        <KrewOrganicBlob
          tone="sage"
          variant="soft"
          className="absolute -top-8 -right-6 w-[88%] h-[380px] z-0 opacity-80 pointer-events-none"
        />

        {/* LAYER 2 (z-10) : Photographie du Voyage avec Clip-Path Asymétrique Déterministe */}
        <div
          className="relative z-10 w-[92%] sm:w-[94%] h-[280px] sm:h-[340px] ml-auto sm:ml-0 overflow-hidden shadow-xs border border-border/20"
          style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 88%, 86% 100%, 0% 92%)" }}
        >
          <img
            src={heroImageForEvent(trip.event_type)}
            alt=""
            className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
            loading="eager"
          />
        </div>

        {/* LAYER 5a (z-40) : Circle KrewMark Ancré au Quart Supérieur Droit de la Photo */}
        <div className="absolute top-4 right-1 sm:right-6 z-40 pointer-events-none">
          <KrewMark
            type="circle"
            tone="sage"
            size="lg"
            rotation={2}
            className="w-[85px] sm:w-[105px] opacity-75"
          />
        </div>

        {/* LAYER 3 (z-20) : Surface Prune Organique Sweep chevauchant la Photo */}
        <div className="relative z-20 -mt-20 sm:-mt-24 w-[90%] sm:w-[85%] min-h-[190px] sm:min-h-[220px]">
          <KrewOrganicBlob
            tone="plum"
            variant="sweep"
            className="w-full h-full text-primary filter drop-shadow-md"
          />

          {/* LAYER 4 (z-30) : Titre & Destination positionnés SUR la Forme Prune */}
          <div className="absolute inset-0 z-30 p-6 sm:p-8 flex flex-col justify-center space-y-2 text-primary-foreground">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/80 font-sans">
              {theme}
            </p>

            <h1 className="font-display text-[40px] sm:text-[48px] font-normal leading-[0.98] tracking-tight text-white break-words">
              {trip.name}
            </h1>

            {destinationName ? (
              <div className="pt-1">
                <p className="font-display text-2xl sm:text-3xl text-sage font-normal relative inline-block">
                  <span className="relative z-10 flex items-center gap-1.5">
                    <KrewIcon name="destination" tone="sage" size="sm" />
                    <span>{destinationName}</span>
                  </span>
                  <KrewMark
                    type="underline"
                    tone="sage"
                    size="md"
                    className="absolute inset-x-0 -bottom-1 h-3.5 w-full opacity-90 pointer-events-none"
                  />
                </p>
              </div>
            ) : null}

            {trip.celebrated_person ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 pt-0.5">
                <KrewIcon name="favorite" tone="sage" size="sm" /> Pour{" "}
                <span className="font-semibold text-white">{trip.celebrated_person}</span>
              </p>
            ) : null}

            {trip.participants &&
            Array.isArray(trip.participants) &&
            trip.participants.filter((p: any) => p.display_name || p.email).length > 0 ? (
              <p className="text-xs text-primary-foreground/80 leading-relaxed pt-0.5 truncate">
                Avec{" "}
                {trip.participants
                  .map((p: any) => p.display_name || p.email?.split("@")[0] || null)
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        </div>

        {/* LAYER 4 & 5b (z-30 / z-40) : Métadonnées Éditoriales Asymétriques + Scène Loutre & Flèche */}
        <div className="relative z-30 pt-4 px-2 sm:px-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          {/* Métadonnées en Disposition Flex Asymétrique & Robuste sans risque de chevauchement */}
          <div className="flex flex-col gap-2 min-w-0 pr-16 sm:pr-0 max-w-md">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
              {/* Dates : Côté gauche avec Highlight Sauge */}
              <div className="shrink-0">
                {datesLocked && (trip.start_date || provisionalStart) ? (
                  <KrewHighlight tone="sage" className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground font-medium">
                    <KrewIcon name="calendar" tone="muted" size="sm" className="size-4" />
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
                  </KrewHighlight>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <KrewIcon name="calendar" tone="muted" size="sm" className="size-4" /> Date à définir
                  </span>
                )}
              </div>

              {/* Participants */}
              <div className="shrink-0">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
                  <KrewIcon name="group" tone="muted" size="sm" className="size-4" />
                  <span className="font-mono text-foreground font-medium">{trip.participants_count}</span> pers.
                </span>
              </div>
            </div>

            {/* Budget */}
            <div className="pt-0.5">
              {totalReserved != null && totalEstimated != null ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <KrewIcon name="budget" tone="muted" size="sm" className="size-4" /> Réellement Réservé : {formatEuro(totalReserved)} / Reste estimé : {formatEuro(totalEstimated)}
                </span>
              ) : liveBudgetTotal != null && liveBudgetTotal > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <KrewIcon name="budget" tone="muted" size="sm" className="size-4" /> ~{formatEuro(liveBudgetTotal)} / pers.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <KrewIcon name="budget" tone="muted" size="sm" className="size-4" /> Budget à définir
                </span>
              )}
            </div>
          </div>

          {/* LAYER 5c (z-40) : Petite Scène Graphique Loutre + Flèche Directionnelle */}
          <div className="self-end sm:self-auto shrink-0 flex items-center gap-1 pointer-events-none -mt-4 sm:mt-0">
            <Logo variant="icon" size="sm" className="size-12 sm:size-14 object-contain filter drop-shadow-xs" />
            <KrewMark type="arrow-down-right" tone="sage" size="md" className="w-10 h-7 text-sage opacity-85" />
          </div>
        </div>
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
