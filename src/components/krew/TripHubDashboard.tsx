import type { Tables } from "@/integrations/supabase/types";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { formatEuro, getTripTypeImage } from "@/lib/krew/constants";
import { Logo } from "@/components/krew/Logo";
import { TripWeatherBadge } from "@/components/krew/TripWeatherBadge";
import { TripLiveModePanel, isTripLiveMode } from "@/components/krew/TripLiveModePanel";
import { getTripWeather } from "@/lib/trip-weather.functions";
import { getKrewPulse, getTripCountdown, type KrewPulse, type TripCountdown } from "@/lib/krew/trip-dashboard-pulse";
import {
  KrewIcon,
  KrewMark,
  KrewOrganicBlob,
  KrewHighlight,
  KrewNote,
  KrewActionStack,
  type KrewActionItem,
} from "@/components/krew/visual-language";

type Props = {
  tripId: string;
  trip: Tables<"trips">;
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
  trip: Tables<"trips">;
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

  if (!datesLocked && !myAvailabilityDone) {
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
  if (isOwner && hasStar && !starDone) {
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

  if (isOwner) {
    if (myAvailabilityDone && myPreferencesDone && !datesLocked) {
      push({
        key: "lock-dates",
        title: "Choisir les dates du groupe",
        description: "Ce choix débloque la suite du voyage.",
        href: `/trips/${tripId}?view=voyage&section=dates`,
        iconName: "calendar",
      });
    }
    if (datesLocked && !profileValidated && profileReady) {
      push({
        key: "choose-profile",
        title: "Choisir le profil du voyage",
        description: "Choisis 1 à 3 options pour définir le Profil du voyage.",
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
          title: "Choisir la destination",
          description: "Ce choix débloque les hébergements, les trajets et le planning.",
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

    const missingAvail = datesLocked ? 0 : Math.max(0, availabilityExpected - availabilityAnswered);
    const missingPrefs = Math.max(0, progressTotal - progressAnswered);
    if (missingAvail > 0 || missingPrefs > 0) {
      push({
        key: "nudge",
        title: "Relancer le groupe",
        description: [
          missingAvail > 0
            ? `${missingAvail} disponibilité${missingAvail > 1 ? "s" : ""} manquante${missingAvail > 1 ? "s" : ""}`
            : null,
          missingPrefs > 0
            ? `${missingPrefs} préférence${missingPrefs > 1 ? "s" : ""} manquante${missingPrefs > 1 ? "s" : ""}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/trips/${tripId}/invite`,
        iconName: "group",
      });
    }
  }

  const participantCaughtUp =
    (datesLocked || myAvailabilityDone) &&
    myPreferencesDone &&
    (!isOwner || !hasStar || starDone) &&
    (!destinationSelected ||
      ((!hotelOffersReady || myHotelVoted) && (!transportOffersReady || myTransportPicked)));

  const waitingOnOthers =
    participantCaughtUp &&
    !isOwner &&
    ((!datesLocked && availabilityAnswered < availabilityExpected) ||
      progressAnswered < progressTotal ||
      !destinationSelected ||
      (destinationSelected && !hasItinerary));

  if (actions.length === 0 && participantCaughtUp) {
    return (
      <section className="mx-0 rounded-3xl border border-sage/25 bg-sage/12 p-6 sm:p-7 relative overflow-hidden shadow-xs">
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
                    : "Dès que le groupe a assez répondu, choisis les dates puis la destination."
                : "Tout est bon pour le moment. L’organisateur reviendra vers toi pour les prochaines étapes."}
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
  if (!datesLocked && availabilityExpected > 0) {
    progressItems.push({
      label: "Disponibilités",
      value: Math.round((availabilityAnswered / availabilityExpected) * 100),
      current: availabilityAnswered,
      total: availabilityExpected,
      tone: "sage" as const,
    });
  }
  if (progressTotal > 0) {
    progressItems.push({
      label: "Préférences",
      value: Math.round((progressAnswered / progressTotal) * 100),
      current: progressAnswered,
      total: progressTotal,
      tone: "plum" as const,
    });
  }

  return (
    <div className="mx-0 mt-2 mb-4 sm:mt-3 sm:mb-5 overflow-hidden relative space-y-3">
      {waitingOnOthers ? (
        <div className="rounded-2xl border border-border/70 bg-card/90 px-4 py-3.5 text-sm text-foreground/90 font-sans shadow-2xs">
          Tout est bon pour le moment. L&apos;organisateur reviendra vers toi pour les prochaines étapes.
        </div>
      ) : null}
      <KrewActionStack primary={primaryAction} secondary={secondaryActions} progress={progressItems} />
    </div>
  );
}

function CountdownInline({ countdown }: { countdown: TripCountdown }) {
  const muted = countdown.state === "ended";
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none ${
          muted
            ? "border-border/70 bg-muted/55 text-muted-foreground"
            : "border-sage/35 bg-sage/15 text-foreground"
        }`}
      >
        {countdown.label}
      </span>
      {countdown.microcopy ? (
        <span className="hidden text-[11px] font-medium text-muted-foreground min-[390px]:inline sm:text-xs">
          {countdown.microcopy}
        </span>
      ) : null}
    </span>
  );
}

function KrewPulseLine({ pulse }: { pulse: KrewPulse }) {
  return (
    <div className="mt-4 px-4">
      <div className="flex min-w-0 items-start gap-2.5 border-t border-sage/25 pt-3">
        <span
          aria-hidden="true"
          className={`mt-[7px] size-2 shrink-0 rounded-full ${pulse.state === "ready" ? "bg-sage" : "bg-primary/70"}`}
        />
        <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-2.5">
          <span className="block shrink-0 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-primary/75">
            Krew Pulse
          </span>
          <p className="mt-0.5 font-sans text-[13px] font-medium leading-snug text-foreground sm:mt-0 sm:text-sm">
            {pulse.message}
          </p>
        </div>
        {pulse.state === "ready" ? (
          <KrewMark type="check" tone="sage" size="sm" className="mt-0.5 size-4 shrink-0" />
        ) : null}
      </div>
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
  const weatherStartDate = (
    datesLocked ? trip.start_date || provisionalStart || null : provisionalStart || trip.start_date || null
  ) as string | null;
  const weatherEndDate = (datesLocked ? trip.end_date || weatherStartDate : weatherStartDate) as string | null;
  const fetchTripWeather = useServerFn(getTripWeather);
  const weatherQuery = useQuery({
    queryKey: ["trip-weather", tripId, destinationName, weatherStartDate, weatherEndDate, datesLocked],
    queryFn: () =>
      fetchTripWeather({
        data: {
          destinationName: destinationName!,
          startDate: weatherStartDate,
          endDate: weatherEndDate,
          datesLocked,
        },
      }),
    enabled: Boolean(destinationSelected && destinationName && weatherStartDate),
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 12 * 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const myHotelVoted = Boolean(
    viewerUserId && (logistics.hotelVotes ?? []).some((v: any) => v.userId === viewerUserId),
  );
  const myTransportPicked = Boolean(
    viewerUserId && (logistics.transportPicks ?? []).some((v: any) => v.userId === viewerUserId),
  );
  const hotelOffersReady = Boolean(logistics.hotels?.length);
  const hotelSelected = Boolean(logistics.selectedHotelId);
  const transportOffersReady = Boolean(logistics.transports?.length);
  const transportPickedCount = new Set(
    (logistics.transportPicks ?? []).map((pick: any) => pick?.userId).filter(Boolean),
  ).size;
  const transportExpectedCount = progressTotal || availabilityExpected || participantsCount || trip.participants_count || 0;

  const pulse = getKrewPulse({
    availabilityAnswered,
    availabilityExpected,
    preferencesAnswered: progressAnswered,
    preferencesExpected: progressTotal || trip.participants_count || 1,
    datesLocked,
    profileReady,
    profileValidated,
    destinationSelected,
    hotelOffersReady,
    hotelSelected,
    transportOffersReady,
    transportPickedCount,
    transportExpectedCount,
    hasItinerary,
  });

  const countdown = getTripCountdown({
    datesLocked,
    startDate: trip.start_date || null,
    endDate: trip.end_date || null,
  });
  const liveMode = isTripLiveMode({
    datesLocked,
    startDate: trip.start_date || null,
    endDate: trip.end_date || null,
  });
  const dashboardStageNote = !datesLocked || !profileValidated
    ? "Le groupe prend forme"
    : !destinationSelected
      ? "La suite se dessine"
      : !hasItinerary
        ? "La suite se prépare"
        : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <header data-krew-dashboard-hero="true" className="relative overflow-visible krew-trip-hub-hero-bleed pb-2">
        <div className="relative w-full">
          <KrewOrganicBlob
            tone="sage"
            variant="soft"
            className="absolute -top-5 right-0 w-[80%] h-[200px] sm:h-[240px] z-0 opacity-70 pointer-events-none"
          />
          <div
            className={`relative z-10 w-[calc(100%_-_8px)] overflow-hidden ${
              liveMode ? "h-[180px] sm:h-[220px]" : "h-[260px] sm:h-[280px]"
            }`}
            style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 88%, 88% 100%, 0% 93%)" }}
          >
            <img
              src={heroImageForEvent(trip.event_type)}
              alt=""
              data-krew-dashboard-photo="true"
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>

          <div className="pointer-events-none absolute left-3 top-3 z-30 max-w-[55%] sm:left-5 sm:top-4">
            <KrewNote variant="tape" tone="sage" rotation={-1} size="sm" className="max-w-full">
              {trip.name}
            </KrewNote>
          </div>

          <div className="relative z-20 -mt-10 krew-trip-hub-gutter-x pt-2">
            <div className="relative mt-1 text-left inline-block max-w-full">
              <KrewOrganicBlob
                tone="plum"
                variant="soft"
                className="absolute right-0 bottom-0 w-[130px] sm:w-[160px] h-[65px] sm:h-[75px] text-primary opacity-20 pointer-events-none z-0"
              />

              <h1 className="relative z-10 inline-block max-w-full break-words rounded-[10px] bg-background/75 px-2.5 py-1.5 font-display text-[length:var(--krew-title-hero)] font-normal leading-[var(--krew-title-hero-leading)] tracking-[var(--krew-title-hero-tracking)] text-foreground backdrop-blur-[2px]">
                <span className="relative inline-block max-w-full">
                  {destinationName || "Destination à définir"}
                  {destinationName ? (
                    <KrewMark
                      type="underline-wave"
                      tone="sage"
                      size="sm"
                      className="absolute left-0 -bottom-1.5 w-[90px] sm:w-[110px] h-[8px] opacity-90 pointer-events-none"
                    />
                  ) : null}
                </span>
                {trip.celebrated_person ? (
                  <span className="block sm:inline sm:ml-3 text-foreground/90">
                    pour {trip.celebrated_person}
                  </span>
                ) : null}
              </h1>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5 krew-trip-hub-gutter-x sm:gap-5">
          <div className="min-w-0 space-y-2.5 font-sans text-[13px] font-medium leading-[1.2] text-foreground">
            <div className="flex items-start gap-2 text-foreground min-w-0">
              <KrewIcon name="calendar" tone="sage" size="sm" className="size-4 shrink-0 mt-[1px]" />
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {datesLocked && (trip.start_date || provisionalStart) ? (
                  <p className="min-w-0">
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
                {countdown ? <CountdownInline countdown={countdown} /> : null}
              </div>
            </div>

            <div className="flex items-center gap-2 text-foreground/90">
              <KrewIcon name="group" tone="plum" size="sm" className="size-4 shrink-0" />
              <p className="whitespace-nowrap">
                <span>{trip.participants_count || 1} participants</span>
              </p>
            </div>

            <div className="flex items-center gap-2 text-primary font-semibold text-[12.5px] min-w-0">
              <KrewIcon name="budget" tone="plum" size="sm" className="size-4 shrink-0" />
              <div className="min-w-0">
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

          {weatherQuery.data ? (
            <div className="w-[132px] min-[380px]:w-[142px] sm:w-[220px]">
              <TripWeatherBadge weather={weatherQuery.data} />
            </div>
          ) : null}
        </div>

        {!liveMode ? <KrewPulseLine pulse={pulse} /> : null}
        <div className={liveMode ? "h-4" : "h-8"} />
      </header>

      {liveMode ? (
        <TripLiveModePanel
          tripId={tripId}
          trip={trip}
          destinationName={destinationName}
          weather={weatherQuery.data ?? null}
          isOwner={isOwner}
        />
      ) : null}

      {!liveMode ? (
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
      ) : null}

      <nav aria-label="Accès aux informations du voyage" className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-sm">
        <Link
          to="/trips/$tripId/questionnaire"
          params={{ tripId }}
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <KrewIcon name="preferences" tone="plum" size="sm" className="size-4" />
          Voir mes préférences
        </Link>
        {datesLocked && profileReady ? (
          <Link
            to="/trips/$tripId"
            params={{ tripId }}
            search={{ view: "voyage", section: "profile" }}
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <KrewIcon name="profile" tone="plum" size="sm" className="size-4" />
            Voir le profil du voyage
          </Link>
        ) : null}
      </nav>

      {dashboardStageNote ? (
        <div data-krew-dashboard-stage-note="true" className="flex justify-end px-1 -mb-5 sm:-mb-6 pointer-events-none">
          <KrewNote variant="tape" tone="plum" rotation={1} size="sm">
            {dashboardStageNote}
          </KrewNote>
        </div>
      ) : null}

      {children}
    </div>
  );
}
