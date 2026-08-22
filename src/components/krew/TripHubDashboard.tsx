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
import { Logo } from "@/components/krew/Logo";
import {
  KrewMark,
  KrewSectionWave,
  KrewProgressRing,
  KrewOrganicBlob,
  KrewHighlight,
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

function getKrewMarkForAction(key: string): { type: "circle" | "arrow" | "check" | "connector" | "highlight"; tone: "plum" | "sage" } {
  switch (key) {
    case "avail":
      return { type: "circle", tone: "sage" };
    case "prefs":
    case "star":
      return { type: "highlight", tone: "plum" };
    case "lock-dates":
      return { type: "check", tone: "sage" };
    case "choose-profile":
    case "gen":
    case "pick-dest":
      return { type: "circle", tone: "plum" };
    case "search-hotels":
    case "search-transport":
      return { type: "arrow", tone: "sage" };
    case "plan":
      return { type: "connector", tone: "plum" };
    case "refine":
      return { type: "check", tone: "sage" };
    default:
      return { type: "arrow", tone: "sage" };
  }
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

  const primaryAction = actions.find((a) => a.primary) ?? actions[0];
  const secondaryActions = actions.filter((a) => a !== primaryAction);
  const primaryMark = primaryAction ? getKrewMarkForAction(primaryAction.key) : null;

  return (
    <div className="-mx-4 sm:mx-0 my-4 sm:my-6 overflow-hidden relative">
      {/* Vague supérieure ouvrant la grande nappe sauge */}
      <KrewSectionWave position="top" tone="sage" className="text-sage/18" />

      {/* GRANDE NAPPE SAUGE PLEINE LARGEUR */}
      <div className="bg-sage/18 px-5 sm:px-8 py-6 sm:py-8 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/75 font-sans">
              Tes prochaines actions
            </h2>
            <KrewMark type="arrow" tone="sage" size="sm" rotation={2} className="pointer-events-none opacity-90" />
          </div>
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
                    "group relative flex items-center justify-between gap-4 rounded-2xl border border-sage/40 bg-card p-4 sm:p-5 transition hover:border-primary/50 shadow-sm",
                    primaryAction.href && "cursor-pointer",
                  )}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                      <primaryAction.icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-sans text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                          {primaryAction.title}
                        </p>
                        {primaryMark ? (
                          <KrewMark
                            type={primaryMark.type}
                            tone={primaryMark.tone}
                            size="sm"
                            className="w-8 h-4 shrink-0 pointer-events-none"
                          />
                        ) : null}
                      </div>
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
                  <span className="relative z-10 flex items-center gap-2">
                    <MapPin className="size-5 text-sage shrink-0" />
                    <span>{destinationName}</span>
                  </span>
                  <KrewMark
                    type="underline"
                    tone="sage"
                    size="md"
                    className="absolute inset-x-0 -bottom-2 h-4 w-full opacity-85 pointer-events-none"
                  />
                </p>
              </div>
            ) : null}

            {trip.celebrated_person ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 pt-0.5">
                <Star className="size-4 fill-amber-300 text-amber-300 shrink-0" /> Pour{" "}
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
        <div className="relative z-30 pt-5 px-3 sm:px-6 min-h-[90px]">
          {/* Métadonnées en Disposition Asymétrique (Dates bas-gauche, Participants bas-droite, Budget bas-gauche-centre) */}
          <div className="relative min-h-[70px]">
            {/* Dates : Côté gauche avec Highlight Sauge */}
            <div className="absolute top-0 left-0">
              {datesLocked && (trip.start_date || provisionalStart) ? (
                <KrewHighlight tone="sage" className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground font-medium">
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
                </KrewHighlight>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5 text-muted-foreground shrink-0" /> Date à définir
                </span>
              )}
            </div>

            {/* Participants : Décalés à droite et légèrement plus bas (~24px) */}
            <div className="absolute top-6 right-2 sm:right-24">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
                <Users className="size-3.5 text-muted-foreground shrink-0" />
                <span className="font-mono text-foreground font-medium">{trip.participants_count}</span> pers.
              </span>
            </div>

            {/* Budget : Décalé plus bas vers le centre/gauche (~48px) */}
            <div className="absolute top-12 left-2">
              {totalReserved != null && totalEstimated != null ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Wallet className="size-3.5 text-muted-foreground shrink-0" /> Réellement Réservé : {formatEuro(totalReserved)} / Reste estimé : {formatEuro(totalEstimated)}
                </span>
              ) : liveBudgetTotal != null && liveBudgetTotal > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Wallet className="size-3.5 text-muted-foreground shrink-0" /> ~{formatEuro(liveBudgetTotal)} / pers.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet className="size-3.5 text-muted-foreground shrink-0" /> Budget à définir
                </span>
              )}
            </div>
          </div>

          {/* LAYER 5c (z-40) : Petite Scène Graphique Loutre + Flèche de Guidage vers le bas */}
          <div className="absolute bottom-0 right-2 z-40 flex items-center gap-2 pointer-events-none">
            <Logo variant="icon" size="sm" className="size-14 sm:size-16 object-contain filter drop-shadow-xs" />
            <KrewMark type="arrow" tone="sage" size="md" className="w-14 h-8 text-sage opacity-90 transform rotate-12" />
          </div>
        </div>
      </header>

      {/* ÉTAT DU KREW — Visualisation chiffrée compacte */}
      {(availabilityExpected > 0 || progressTotal > 0) && (
        <div className="flex items-center justify-center gap-6 py-2 px-4">
          {availabilityExpected > 0 ? (
            <KrewProgressRing
              value={availabilityAnswered}
              total={availabilityExpected}
              tone="sage"
              label="Disponibilités"
            />
          ) : null}

          {availabilityExpected > 0 && progressTotal > 0 ? (
            <KrewMark type="connector" tone="sage" size="sm" className="w-8 h-4 opacity-50 hidden sm:block" />
          ) : null}

          {progressTotal > 0 ? (
            <KrewProgressRing
              value={progressAnswered}
              total={progressTotal}
              tone="plum"
              label="Préférences"
            />
          ) : null}
        </div>
      )}

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
