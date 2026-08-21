/* eslint-disable @typescript-eslint/no-explicit-any -- provider JSON is validated at boundary */
import {
  isSafeActivityUrl,
  type ActivityCandidate,
} from "@/lib/krew/activity-discovery.server";
import type { StayProfileId } from "@/lib/krew/stay-profiles";
import { reportServerError } from "@/lib/server-error-reporting.server";
import {
  type GeoapifyPlace,
  type PlaceRequirements,
  convertIntentToPlaceRequirements,
  buildPoolKey,
  searchGeoapifyPlaces,
  fetchPlaceDetails,
  rankGeoapifyCandidates,
  selectGeoapifyCandidate,
  mergeUniquePlacesById,
} from "@/lib/krew/geoapify.server";

export type ActivitySlotType = "resto" | "activite" | "bar" | "transport" | "libre";
export type ActivityCategory =
  | "repas"
  | "sport_outdoor"
  | "detente"
  | "moment_maison"
  | "jeu_groupe"
  | "evenement"
  | "transport"
  | "temps_libre"
  | "culture"
  | "soiree"
  | "shopping"
  | "local_experience";

export type ActivitySlot = {
  moment: string;
  type: ActivitySlotType;
  category?: ActivityCategory | undefined;
  tags?: string[] | undefined;
  label: string;
  detail?: string | undefined;
  venueFamily?: string | undefined;
  searchIntent?: string | undefined;
  locationContext?: "lodging" | "external" | "flexible" | undefined;
  dietaryCheckRequired?: boolean | undefined;
  priceHint?: number | undefined;
  time?: string | null | undefined;
  endTime?: string | null | undefined;
  durationMinutes?: number | null | undefined;
  url?: string | null | undefined;
  candidateId?: string | null | undefined;
  verified?: boolean | undefined;
  source?: string | null | undefined;
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
  openingHoursVerified?: boolean | undefined;
};

export type ItineraryDayPlan = { day: number; date?: string | null; slots: ActivitySlot[] };
export type SkeletonSlotKind = "internal" | "place_required";

export type KrewSkeletonSlot = {
  id: string;
  day: number;
  moment: "Matin" | "Midi" | "Après-midi" | "Soir";
  time: string;
  endTime: string;
  durationMinutes: number;
  kind: SkeletonSlotKind;
  type: ActivitySlotType;
  category: ActivityCategory;
  label: string;
  detail?: string | undefined;
  importance: "high" | "medium" | "low";
  flexibility: "rigid" | "flexible";
  venueFamily?: string | undefined;
  searchIntent?: string | undefined;
  locationContext?: "lodging" | "external" | "flexible" | undefined;
  dietaryCheckRequired?: boolean | undefined;
  candidateId?: string | null | undefined;
  url?: string | null | undefined;
  verified?: boolean | undefined;
  source?: string | null | undefined;
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
};

export type KrewSkeletonDay = {
  day: number;
  date?: string | null | undefined;
  slots: KrewSkeletonSlot[];
};

export type GeminiBackupSlot = {
  id: string;
  day: number;
  forSlot: string;
  kind: SkeletonSlotKind;
  momentType: string;
  label: string;
  detail: string;
  time: string;
  durationMinutes: number;
  locationContext: "lodging" | "external" | "flexible";
  canonicalVenueFamily?: string | null;
  searchIntent?: string | null;
  suggestedPlace?: string | null;
};

export type KrewSkeleton = {
  destination: string;
  nights: number;
  days: KrewSkeletonDay[];
  backups?: GeminiBackupSlot[] | undefined;
};

export type PlanningTelemetry = {
  geminiCalls: number;
  geoapifyPlacesCalls: number;
  geoapifyDetailsCalls: number;
  poolHits: number;
  poolMisses: number;
  candidatesRejectedOpeningHours: number;
  candidatesRejectedGeography: number;
  candidatesRejectedRequirements: number;
};

export type GroupItinerary = {
  destination: string;
  nights: number;
  days: ItineraryDayPlan[];
  backups?: GeminiBackupSlot[] | undefined;
  source: "ai" | "local";
  provider?: "gemini" | "aimlapi" | "local" | "krew_geoapify";
  generatedAt: string;
  discovery?: {
    candidateCount: number;
    shortlistedCount: number;
    cached: boolean;
    verifiedAt: string | null;
  };
  candidates?: ActivityCandidate[];
  placePools?: Record<string, any[]> | undefined;
  usedCandidateIds?: string[] | undefined;
  skeleton?: KrewSkeleton | undefined;
  telemetry?: PlanningTelemetry | undefined;
};

export type GroupPlanningContext = {
  trip: {
    destination: string;
    dates: {
      startDate: string | null;
      endDate: string | null;
    };
    nights: number;
    participantCount: number;
    eventType: string | null;
    validatedTripProfiles: string[];
  };
  group: {
    activityPreferences: Record<string, { frequency: number; count?: number }>;
    ambiancePreferences: Record<string, { frequency: number; count?: number }>;
    travelPace: string;
    groupAgeRange: string | null;
    preferredTimeSlots: string[];
    wantedEnvTypes: string[];
    groupAccommodationRole: string;
    localMobility: string | null;
    dietaryConstraints: string[];
    accessibility: boolean;
    dealBreakers: string[];
    usefulUserNotes: string[];
  };
  star: {
    starWantedActivities: string[];
    starWantedEnvType: string | null;
    starDealBreakers: string[];
    otherStarSignals?: Record<string, any>;
  };
  krewSignals: {
    destinationScore: number | null;
    matchReasons: string[];
    scoredActivityLabels: string[];
    validatedTripProfiles: string[];
  };
  planning: {
    dayWindows: DayWindow[];
    mandatoryNeeds: MandatoryNeed[];
    maxActivitiesPerDay: number;
    verifiedLodgingAmenities: string[];
    lockedElements: any[];
  };
};

export function buildGroupPlanningContext(
  input: ActivityAiInput,
  brief: PlanningBrief,
): GroupPlanningContext {
  const activityPrefs: Record<string, { frequency: number }> = {};
  for (const [cat, freq] of Object.entries(brief.preferenceSignals.activityCategoryFrequencies || {})) {
    activityPrefs[cat] = { frequency: freq };
  }

  const ambiancePrefs: Record<string, { frequency: number }> = {};
  for (const [amb, freq] of Object.entries(brief.preferenceSignals.ambianceFrequencies || {})) {
    ambiancePrefs[amb] = { frequency: freq };
  }

  return {
    trip: {
      destination: brief.destination,
      dates: {
        startDate: brief.startDate,
        endDate: brief.endDate,
      },
      nights: brief.nights,
      participantCount: brief.participants,
      eventType: brief.eventType,
      validatedTripProfiles: brief.validatedTripProfiles,
    },
    group: {
      activityPreferences: activityPrefs,
      ambiancePreferences: ambiancePrefs,
      travelPace: brief.planningRules.travelPace,
      groupAgeRange: input.groupAgeRange ?? null,
      preferredTimeSlots: brief.preferredTimeSlots,
      wantedEnvTypes: input.wantedEnvTypes ?? [],
      groupAccommodationRole: brief.planningRules.accommodationRole,
      localMobility: brief.localMobility,
      dietaryConstraints: input.dietaryConstraints ?? [],
      accessibility: brief.accessibilityRequired,
      dealBreakers: brief.dealBreakers.ambiances,
      usefulUserNotes: brief.usefulUserNotes,
    },
    star: {
      starWantedActivities: input.starWanted ?? [],
      starWantedEnvType: input.starWantedEnvType ?? null,
      starDealBreakers: brief.dealBreakers.starExclusions,
    },
    krewSignals: {
      destinationScore: input.destinationScore ?? null,
      matchReasons: input.matchReasons ?? [],
      scoredActivityLabels: input.scoredActivityLabels ?? [],
      validatedTripProfiles: brief.validatedTripProfiles,
    },
    planning: {
      dayWindows: brief.dayWindows,
      mandatoryNeeds: brief.mandatoryNeeds,
      maxActivitiesPerDay: brief.planningRules.maxActivitiesPerDay,
      verifiedLodgingAmenities: brief.verifiedLodgingAmenities,
      lockedElements: [],
    },
  };
}

export type TransportPickSummary = {
  city: string;
  mode: string;
  outboundDeparture?: string | null;
  arrival?: string | null;
  departure?: string | null;
  returnArrival?: string | null;
  durationHours?: number | null;
};

export type ActivityAiInput = {
  destination: string;
  country?: string | null | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  nights: number;
  participants: number;
  budgetPerPerson: number;
  eventType?: string | null | undefined;
  tripProfile?: string | null | undefined;
  ambiances: string[];
  activityCategories: string[];
  starWanted?: string[] | undefined;
  dietaryConstraints?: string[] | undefined;
  accessibilityRequired?: boolean | undefined;
  travelPace?: string | null | undefined;
  preferredTimeSlots?: string[] | undefined;
  matchReasons?: string[] | undefined;
  destinationScore?: number | null | undefined;
  scoredActivityLabels?: string[] | undefined;
  latestGroupArrival?: string | null | undefined;
  earliestGroupDeparture?: string | null | undefined;
  latestReturnHome?: string | null | undefined;
  earliestOutboundDeparture?: string | null | undefined;
  transportDurationHours?: number | null | undefined;
  transferMarginMinutes?: number | null | undefined;
  transportPicksSummary?: TransportPickSummary[] | undefined;
  individualPreferences?: any[] | undefined;
  groupAgeRange?: string | null | undefined;
  groupAccommodationRole?: string | null | undefined;
  starWantedEnvType?: string | null | undefined;
  wantedEnvTypes?: string[] | undefined;
  forceDiscoveryRefresh?: boolean | undefined;

  // Enriched signals
  activityCategoryFrequencies?: Record<string, number> | undefined;
  ambianceFrequencies?: Record<string, number> | undefined;
  dealBreakerAmbiances?: string[] | undefined;
  starDealBreakers?: string[] | undefined;
  validatedTripProfiles?: StayProfileId[] | undefined;
  verifiedLodgingAmenities?: string[] | undefined;
  localMobility?: string | null | undefined;
};

export type CanonicalVenueFamily =
  | "restaurant"
  | "cafe"
  | "bar_pub"
  | "culture"
  | "sport"
  | "spa_wellness"
  | "shopping"
  | "local_experience";

export const CANONICAL_VENUE_FAMILIES: CanonicalVenueFamily[] = [
  "restaurant",
  "cafe",
  "bar_pub",
  "culture",
  "sport",
  "spa_wellness",
  "shopping",
  "local_experience",
];

export const ALLOWED_MOMENT_TYPES = [
  "repas",
  "evenement",
  "sport_outdoor",
  "detente",
  "culture",
  "soiree",
  "shopping",
  "local_experience",
  "moment_maison",
  "temps_libre",
];

export type MandatoryNeedType = "meal" | "event_signature" | "lodging_rest";

export type MandatoryNeed = {
  id: string;
  type: MandatoryNeedType;
  subType?: "breakfast" | "lunch" | "dinner" | "evjf" | "evg" | "anniversaire" | "event" | "rest";
  targetDay: number;
  timeWindow?: { start: string; end: string };
  durationMinutes: number;
  label: string;
};

export type DayWindow = {
  day: number;
  date: string | null;
  availableFrom: string | null; // HH:mm or null if unknown
  availableUntil: string | null; // HH:mm or null if unknown
  isArrivalDay: boolean;
  isDepartureDay: boolean;
};

export type PlanningBrief = {
  destination: string;
  country?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  nights: number;
  participants: number;
  eventType?: string | null;
  validatedTripProfiles: StayProfileId[];
  dayWindows: DayWindow[];
  mandatoryNeeds: MandatoryNeed[];
  preferenceSignals: {
    activityCategoryFrequencies: Record<string, number>;
    ambianceFrequencies: Record<string, number>;
  };
  dealBreakers: {
    ambiances: string[];
    starExclusions: string[];
  };
  usefulUserNotes: string[];
  verifiedLodgingAmenities: string[];
  localMobility: string | null; // null if unknown
  preferredTimeSlots: string[];
  accessibilityRequired: boolean;
  planningRules: {
    travelPace: string;
    maxActivitiesPerDay: number;
    accommodationRole: string;
  };
};

export type PlanningWindowResult = {
  arrivalReady: string | null; // HH:mm
  arrivalDayOffset: number; // e.g. 0 if same day, 1 if next day
  arrivalReadyDate: string | null; // ISO YYYY-MM-DD
  latestDestinationDeparture: string | null; // HH:mm
  departureDayOffset: number; // e.g. 0 if last day, -1 etc.
  departureDate: string | null; // ISO YYYY-MM-DD
};

const GEMINI_MODEL = process.env["GEMINI_MODEL"] || "gemini-3.6-flash";
const HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const GEMINI_CONTRACTUAL_PROMPT_TEMPLATE = `Tu es le concepteur de planning de KREW.

KREW aide des groupes à organiser leurs voyages. Ta mission n'est pas de remplir mécaniquement un calendrier : tu dois comprendre le groupe et concevoir un programme réaliste, vivant, cohérent et personnalisé qui donne l'impression d'avoir été pensé spécialement pour lui.

Tu reçois un GROUP_PLANNING_CONTEXT structuré contenant les informations réellement connues par KREW.

## 1. TA MISSION

À partir de ce contexte :

1. comprends le groupe, son événement, ses envies dominantes, son rythme et ses contraintes ;
2. analyse les signaux de matching déjà calculés par KREW ;
3. envisage silencieusement plusieurs idées pertinentes pour CE séjour ;
4. sélectionne la meilleure combinaison plutôt que d'empiler toutes les possibilités ;
5. compose un programme cohérent sur l'ensemble du séjour ;
6. prépare également quelques alternatives pertinentes pour les moments principaux ;
7. explique brièvement chaque proposition dans son champ \`detail\`.

Ne renvoie jamais ton raisonnement intermédiaire.

Retourne uniquement le JSON final demandé.

KREW calcule ses propres scores et agrégations.
Tu ne dois pas les recalculer.
Tu dois les interpréter pour concevoir le meilleur séjour possible.

## 2. UTILISE RÉELLEMENT LES DONNÉES DU GROUPE

Analyse toutes les informations présentes lorsqu'elles existent :

- destination ;
- dates et durée ;
- nombre de participants ;
- type de voyage ou événement ;
- profils de séjour validés ;
- préférences d'activités et leur niveau d'adhésion ;
- préférences d'ambiance et leur niveau d'adhésion ;
- rythme ;
- tranche d'âge ;
- créneaux préférés ;
- environnement recherché ;
- rôle du logement ;
- mobilité locale ;
- contraintes alimentaires ;
- accessibilité ;
- exclusions et deal-breakers ;
- informations pertinentes concernant la Star ;
- destinationScore ;
- matchReasons ;
- idées d'activités déjà scorées par KREW ;
- fenêtres disponibles de chaque journée ;
- mandatoryNeeds ;
- équipements du logement uniquement lorsqu'ils sont indiqués comme vérifiés ;
- éléments déjà décidés ou verrouillés.

Une donnée absente ne doit jamais être inventée.

Les préférences ayant la plus forte adhésion doivent généralement avoir davantage d'influence.

Une préférence minoritaire peut être intégrée lorsqu'elle complète naturellement le séjour.

Les contraintes alimentaires sont principalement une information d'organisation. Ne rejette pas une bonne idée de restaurant simplement parce que tu ne peux pas vérifier toi-même son offre alimentaire.

## 3. CE QU'EST UN EXCELLENT PLANNING KREW

Construis le séjour comme un ensemble.

Recherche :
- variété ;
- cohérence ;
- progression ;
- moments mémorables ;
- équilibre entre moments forts et respiration ;
- adéquation avec le groupe ;
- réalisme temporel ;
- réalisme géographique ;
- plaisir collectif.

Évite :
- une succession mécanique d'activités ;
- plusieurs expériences quasi identiques ;
- un planning rempli artificiellement minute par minute ;
- une journée entière presque vide sans raison ;
- les répétitions inutiles ;
- une checklist de toutes les préférences ;
- un programme générique qui pourrait convenir à n'importe quel groupe.

Une journée complète doit normalement avoir suffisamment de matière pour constituer une vraie journée.

Selon le contexte, elle peut par exemple comporter :
- petit-déjeuner ou brunch ;
- une activité ou expérience ;
- déjeuner ;
- une seconde activité, découverte, détente ou temps libre ;
- dîner ;
- éventuellement une soirée.

CE N'EST PAS UNE CHECKLIST.

Adapte toujours la densité :
- au rythme du groupe ;
- au temps disponible ;
- à maxActivitiesPerDay ;
- au type de séjour.

Une journée complète avec uniquement "petit-déjeuner + dîner" est insuffisante sauf justification forte dans le contexte.

Pour une demi-journée, privilégie généralement un moment principal et les moments sociaux/repas pertinents.

Pour une soirée d'arrivée, installation, apéro, jeu, dîner, moment au logement ou sortie peuvent être plus pertinents qu'une activité lourde.

Pour une dernière journée, privilégie des moments simples et réalistes avant la fin de la fenêtre disponible.

## 4. EXPLORE PLUSIEURS POSSIBILITÉS AVANT DE CHOISIR

Avant de composer le planning final, envisage silencieusement plusieurs possibilités.

Pour un séjour disposant de suffisamment de temps, considère typiquement 6 à 12 idées candidates pertinentes avant de sélectionner les meilleures.

Ne renvoie pas cette réflexion.

Les exemples suivants servent uniquement à élargir ton champ de réflexion.

GASTRONOMIE :
- petit-déjeuner ;
- brunch ;
- spécialités locales ;
- déjeuner ;
- pique-nique ;
- restaurant convivial ;
- dîner gastronomique ;
- dégustation ;
- food tour ;
- marché ;
- atelier cuisine ;
- repas au logement.

EXPÉRIENCES :
- atelier cocktail ;
- atelier culinaire ;
- dégustation ;
- visite de producteur ;
- artisanat ;
- escape game ;
- séance photo ;
- activité insolite ;
- expérience typique de la destination.

SPORT / OUTDOOR :
- randonnée ;
- vélo ;
- paddle ;
- kayak ;
- bateau ;
- canyoning ;
- rafting ;
- accrobranche ;
- ski ;
- activité nautique ;
- balade nature ;
- activité sportive encadrée.

DÉTENTE :
- spa ;
- massage ;
- thermes ;
- plage ;
- piscine ;
- hammam ;
- moment au bord de l'eau ;
- temps calme au logement.

CULTURE / DÉCOUVERTE :
- musée ;
- château ;
- monument ;
- patrimoine ;
- vieille ville ;
- quartier emblématique ;
- exposition ;
- visite guidée ;
- balade architecturale.

SOIRÉE :
- apéro ;
- bar à cocktails ;
- rooftop ;
- pub ;
- bar dansant ;
- concert ;
- spectacle ;
- club ;
- soirée au logement.

MOMENTS DE GROUPE / ÉVÉNEMENT :
- jeu ;
- défis ;
- blind test ;
- surprise ;
- séance photo ;
- moment consacré à la Star ;
- apéro préparé ensemble ;
- activité liée à l'événement.

SHOPPING / FLÂNERIE :
- marché ;
- boutiques locales ;
- créateurs ;
- quartier commerçant ;
- promenade libre.

RESPIRATION :
- repos ;
- temps libre ;
- préparation avant une soirée ;
- douche/changement ;
- temps au logement ;
- balade sans programme précis.

Cette liste n'est PAS exhaustive.

Tu peux proposer une meilleure idée absente de cette liste.

Ne cherche jamais à utiliser toutes les catégories.

## 5. TRADUIS INTELLIGEMMENT LES PRÉFÉRENCES

Les catégories KREW sont des intentions utilisateur.

Interprète notamment :

gastronomie
→ repas, dégustation, food tour, marché, atelier culinaire, expérience locale.

experiences / insolite
→ local_experience, atelier, activité originale, découverte locale.

sport
→ sport_outdoor.

soirees
→ soiree.

culture
→ culture.

detente
→ detente.

shopping
→ shopping.

jeu / moment collectif
→ evenement ou moment_maison selon le contexte.

Ne reproduis pas aveuglément le vocabulaire du questionnaire dans les enums techniques.

## 6. LE TYPE DE VOYAGE COMPTE

Le type de voyage doit influencer la composition.

Un EVJF, EVG, anniversaire, week-end entre amis ou autre séjour ne doivent pas recevoir automatiquement le même programme à préférences égales.

Pour un événement comme EVJF/EVG :
- crée des occasions d'être ensemble ;
- exploite les moments, jeux ou surprises pertinents ;
- cherche éventuellement un ou deux moments mémorables ;
- adapte la soirée au groupe ;
- évite les clichés systématiques.

Si le logement est un élément central du séjour :
- exploite-le davantage lorsque ses équipements sont réellement vérifiés.

S'il sert principalement de base :
- privilégie davantage la destination et les expériences extérieures.

## 7. MANDATORY NEEDS

Les mandatoryNeeds doivent être respectés.

MAIS :

LES MANDATORY NEEDS SONT LE MINIMUM À GARANTIR.
ILS NE CONSTITUENT PAS À EUX SEULS UN PLANNING SUFFISANT.

Le cœur du programme doit venir de ton analyse :
- du groupe ;
- de ses préférences ;
- de l'événement ;
- de la destination ;
- des signaux KREW ;
- du temps disponible.

## 8. TU PEUX PROPOSER DES IDÉES PRÉCISES

Tu as le droit de proposer :
- une activité précise ;
- une expérience précise ;
- un site touristique connu ;
- un monument ;
- un musée ;
- un quartier ;
- un établissement ou opérateur réel que tu connais si cela améliore réellement la recommandation.

Exemples :
- "Paddle sur le lac d'Annecy"
- "Balade à vélo autour du lac"
- "Visite du Château d'Annecy"
- "Atelier cocktail"
- "Spa et massage"
- "Apéro au coucher du soleil"

Cependant :

UNE SUGGESTION N'EST PAS UNE DONNÉE VÉRIFIÉE.

Sans information vérifiée fournie par KREW, ne présente jamais comme certain :
- disponibilité ;
- horaires d'ouverture ;
- prix ;
- réservation ;
- note ;
- accessibilité ;
- capacité d'accueil ;
- régime alimentaire accepté ;
- distance exacte ;
- durée de trajet exacte.

KREW vérifiera ensuite les éléments externes lorsque nécessaire.

Ne refuse pas une bonne idée uniquement parce qu'elle devra être vérifiée.

## 9. CONTRAINTES TEMPORELLES

Respecte strictement :
- dayWindows ;
- mandatoryNeeds ;
- dealBreakers ;
- maxActivitiesPerDay ;
- accessibilité lorsqu'elle constitue une contrainte ;
- éléments verrouillés.

Chaque slot doit :
- commencer après availableFrom ;
- finir avant availableUntil ;
- ne pas chevaucher un autre slot ;
- être placé à un horaire réaliste ;
- laisser une transition raisonnable lorsque nécessaire.

Ne propose jamais :
- dîner le matin ;
- petit-déjeuner le soir ;
- activité avant le début de la journée disponible ;
- activité après la fin disponible.

## COHÉRENCE GÉOGRAPHIQUE

Compose chaque journée comme un parcours géographiquement cohérent.

Évite les allers-retours inutiles et les activités très éloignées les unes des autres.

Adapte la distance acceptable à la mobilité du groupe :

- en environnement urbain ou lorsque le groupe se déplace principalement à pied / transports en commun, privilégie fortement des moments proches les uns des autres ;
- si le groupe dispose réellement d'une voiture, une excursion plus éloignée peut être pertinente ;
- en contexte outdoor ou rural, accepte davantage de distance uniquement lorsqu'elle est justifiée par une expérience importante du séjour.

Une activité exceptionnelle peut justifier un déplacement plus long.
Plusieurs longs déplacements successifs dans une même journée ne sont pas acceptables.

Lorsque tu proposes un \`suggestedPlace\`, tiens compte de cette cohérence géographique.

Ne suppose jamais que le groupe dispose d'une voiture si cette information n'est pas présente dans GROUP_PLANNING_CONTEXT.

## 10. INTERNAL OU PLACE_REQUIRED

Utilise \`internal\` lorsqu'aucun établissement/prestataire externe précis n'est nécessaire.

Exemples :
- jeu au logement ;
- apéro maison ;
- préparation ;
- surprise ;
- repos ;
- temps libre ;
- moment au logement.

Utilise \`place_required\` lorsqu'un lieu, site, établissement ou prestataire doit ensuite être identifié ou vérifié.

Exemples :
- restaurant ;
- brunch ;
- bar ;
- musée ;
- spa ;
- activité sportive ;
- atelier ;
- expérience locale.

Pour \`place_required\`, fournis un \`searchIntent\` précis permettant à KREW de matérialiser ou vérifier l'idée.

## 11. LABEL ET DETAIL

Chaque nouveau slot doit contenir :

\`label\`
→ intitulé court, clair et attractif.

\`detail\`
→ UNE courte phrase utilisateur expliquant le moment ou pourquoi il convient au groupe.

Évite :
"Une activité parfaite pour votre groupe."

Préfère :
"Un moment sur le lac qui combine votre envie de bouger et de profiter du décor sans monopoliser toute la journée."

Le detail est destiné directement aux utilisateurs KREW.

Ne mentionne jamais :
- Gemini ;
- intelligence artificielle ;
- scoring ;
- algorithme ;
- Geoapify ;
- provider ;
- données techniques.

Si KREW fournit déjà un label/detail à préserver pour un élément existant, ne le réécris pas.

## 12. VOCABULAIRE AUTORISÉ

\`momentType\` doit être exactement l'une de ces valeurs :

[
  "repas",
  "evenement",
  "sport_outdoor",
  "detente",
  "culture",
  "soiree",
  "shopping",
  "local_experience",
  "moment_maison",
  "temps_libre"
]

\`canonicalVenueFamily\` doit être null ou exactement l'une de ces valeurs :

[
  "restaurant",
  "cafe",
  "bar_pub",
  "culture",
  "sport",
  "spa_wellness",
  "shopping",
  "local_experience"
]

N'invente aucune autre valeur.

## 13. SEARCH INTENT ET SUGGESTED PLACE

Pour chaque \`place_required\` :

\`searchIntent\`
→ décrit précisément l'expérience/lieu à rechercher ou vérifier.

Exemples :
"brunch convivial et généreux pour un groupe EVJF dans le centre d'Annecy"

"activité paddle adaptée à un groupe sur le lac d'Annecy"

Si tu connais une proposition précise pertinente :

\`suggestedPlace\`
→ nom suggéré.

Cette valeur est une SUGGESTION À VÉRIFIER PAR KREW.

N'invente pas de suggestedPlace simplement pour remplir le champ.

## 14. BACKUPS

Dans CE MÊME appel, prépare également des alternatives pour les moments principaux lorsque cela apporte réellement de la valeur.

Maximum :
2 backups par moment principal.

Un backup doit être une VRAIE alternative, pas une reformulation de la même idée.

Exemple :

principal :
paddle

bons backups :
- vélo autour du lac ;
- canyoning adapté au groupe.

mauvais backup :
- autre séance de paddle.

Les backups doivent rester cohérents avec :
- le groupe ;
- la journée ;
- le créneau ;
- les préférences ;
- les contraintes ;
- maxActivitiesPerDay.

Les backups ne sont pas automatiquement affichés.
KREW les conserve pour pouvoir proposer une alternative ultérieure sans refaire immédiatement appel à toi.

## 15. FORMAT DE SORTIE

Retourne UNIQUEMENT un JSON valide.

Structure exacte :

{
  "days": [
    {
      "day": 1,
      "slots": [
        {
          "id": "string",
          "kind": "internal | place_required",
          "momentType": "string",
          "label": "string",
          "detail": "string",
          "time": "HH:mm",
          "durationMinutes": 90,
          "locationContext": "lodging | external | flexible",
          "canonicalVenueFamily": "string | null",
          "searchIntent": "string | null",
          "suggestedPlace": "string | null"
        }
      ]
    }
  ],
  "backups": [
    {
      "id": "string",
      "day": 1,
      "forSlot": "id du slot principal",
      "kind": "internal | place_required",
      "momentType": "string",
      "label": "string",
      "detail": "string",
      "time": "HH:mm",
      "durationMinutes": 90,
      "locationContext": "lodging | external | flexible",
      "canonicalVenueFamily": "string | null",
      "searchIntent": "string | null",
      "suggestedPlace": "string | null"
    }
  ]
}

Règles :
- aucun texte hors JSON ;
- aucun markdown ;
- aucun commentaire ;
- day obligatoire ;
- slots obligatoire ;
- id obligatoire ;
- kind obligatoire ;
- momentType obligatoire ;
- label obligatoire ;
- detail obligatoire ;
- time obligatoire au format HH:mm ;
- durationMinutes obligatoire.

Pour \`internal\` :
- canonicalVenueFamily = null ;
- searchIntent = null ;
- suggestedPlace = null sauf cas réellement justifié.

Pour \`place_required\` :
- canonicalVenueFamily obligatoire ;
- searchIntent obligatoire ;
- suggestedPlace facultatif.

Les \`id\` doivent être uniques dans cette réponse.

## 16. CONTRÔLE FINAL

Avant de répondre, vérifie silencieusement :

1. Ai-je réellement utilisé les données spécifiques de ce groupe ?
2. Le programme serait-il différent pour un autre groupe dans la même destination ?
3. Les préférences dominantes apparaissent-elles réellement ?
4. Ai-je envisagé plusieurs possibilités avant de choisir ?
5. Chaque journée utilise-t-elle intelligemment le temps disponible ?
6. Une journée complète est-elle anormalement vide ?
7. Le programme est-il au contraire trop chargé ?
8. Les moments sont-ils suffisamment variés ?
9. Les horaires sont-ils réalistes ?
10. Tous les mandatoryNeeds sont-ils présents ?
11. Tous les deal-breakers sont-ils respectés ?
12. Ai-je présenté une suggestion non vérifiée comme un fait ?
13. Tous les enums sont-ils strictement autorisés ?
14. Chaque place_required possède-t-il un searchIntent exploitable ?
15. Chaque nouveau slot possède-t-il un detail utile ?
16. Les backups sont-ils de vraies alternatives ?
17. Le séjour contient-il un ou deux moments mémorables lorsque le contexte s'y prête ?
18. Le résultat ressemble-t-il réellement à un séjour conçu pour CE groupe ?

Si le programme paraît générique ou trop pauvre, améliore-le avant de produire le JSON.

GROUP_PLANNING_CONTEXT :

{{GROUP_PLANNING_CONTEXT_JSON}}`;

const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const toMinutes = (time?: string | null) =>
  time && HHMM.test(time.slice(0, 5))
    ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
    : null;

export const fromMinutes = (minutes: number) =>
  `${String(Math.floor((((minutes % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}:${String((((minutes % 1440) + 1440) % 1440) % 60).padStart(2, "0")}`;

export function aggregateMajorityTimePreference(
  values: (string | null | undefined)[],
): string | null {
  const minutes = values
    .map((value) => toMinutes(value))
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);
  if (!minutes.length) return null;
  return fromMinutes(minutes[Math.floor((minutes.length - 1) / 2)]!);
}

export function haversineDistanceKm(
  a: { latitude?: number | null | undefined; longitude?: number | null | undefined },
  b: { latitude?: number | null | undefined; longitude?: number | null | undefined },
): number | null {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null)
    return null;
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function geographyPolicy(input: ActivityAiInput) {
  const profiles = (input.validatedTripProfiles ?? [input.tripProfile]).filter(
    (x): x is StayProfileId => Boolean(x) && typeof x === "string",
  );

  const textSignals = norm(
    [
      ...input.ambiances,
      ...(input.wantedEnvTypes ?? []),
      ...(input.activityCategories ?? []),
      input.groupAccommodationRole,
    ].join(" "),
  );

  if (
    profiles.includes("house_together") ||
    input.groupAccommodationRole === "centerpiece" ||
    /maison|villa|cocoon|gite/.test(textSignals)
  ) {
    return { maxKm: 8, profile: "home" as const };
  }

  const mobility = norm(input.localMobility);
  if (/voiture|car|driving|permis/.test(mobility)) {
    return { maxKm: 30, profile: "regional" as const };
  }

  if (
    profiles.includes("regional_explorer") ||
    profiles.includes("charm_escape")
  ) {
    return { maxKm: 30, profile: "regional" as const };
  }

  if (
    profiles.includes("outdoor_active") ||
    profiles.includes("nature_disconnect") ||
    /nature|sport|outdoor|aventure|montagne|lac|rando|canyon|kayak/.test(textSignals)
  ) {
    return { maxKm: 30, profile: "outdoor" as const };
  }

  return { maxKm: 10, profile: "city" as const };
}

export function transferMinutes(distanceKm: number | null): number {
  if (distanceKm == null) return 20;
  if (distanceKm <= 2) return 15;
  if (distanceKm <= 8) return 30;
  if (distanceKm <= 20) return 45;
  return 75;
}

const weekdays: Record<string, number> = {
  dimanche: 0,
  sunday: 0,
  lundi: 1,
  monday: 1,
  mardi: 2,
  tuesday: 2,
  mercredi: 3,
  wednesday: 3,
  jeudi: 4,
  thursday: 4,
  vendredi: 5,
  friday: 5,
  samedi: 6,
  saturday: 6,
};

export function openingStatus(
  candidate: ActivityCandidate,
  date: string | null | undefined,
  time: string | null | undefined,
  durationMinutes = 90,
): "open" | "closed" | "unknown" {
  if (!candidate.openingHours?.length || !date || toMinutes(time) == null) return "unknown";
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const line = candidate.openingHours.find((entry) =>
    Object.entries(weekdays).some(([name, day]) => day === weekday && norm(entry).includes(name)),
  );
  if (!line) return "unknown";
  if (/ferme|closed/.test(norm(line))) return "closed";
  const ranges = [
    ...line.matchAll(
      /([01]?\d|2[0-3])[:h]([0-5]\d)\s*(?:-|–|—|a|to)\s*([01]?\d|2[0-3])[:h]([0-5]\d)/gi,
    ),
  ];
  if (!ranges.length) return "unknown";
  const start = toMinutes(time)!;
  const end = start + durationMinutes;
  return ranges.some((range) => {
    const open = Number(range[1]) * 60 + Number(range[2]);
    let close = Number(range[3]) * 60 + Number(range[4]);
    if (close <= open) close += 1440;
    return start >= open && end <= close;
  })
    ? "open"
    : "closed";
}

/**
  * Calculate Planning Window with Date + Time semantics across midnight transitions.
  * NO decision dependency on transportPicksSummary[0]!
  * Unknown arrival/departure returns null, never transformed to fictive hours!
  */
export function calculatePlanningWindow(input: ActivityAiInput): PlanningWindowResult {
  const margin = Math.max(0, input.transferMarginMinutes ?? 75);

  const explicitArrival = toMinutes(input.latestGroupArrival);

  let arrivalTotalMinutes: number | null = null;
  if (explicitArrival != null) {
    arrivalTotalMinutes = explicitArrival + margin;
  } else {
    // Official product fallback when no explicit destination arrival time is known: First day planifiable from 18:30
    arrivalTotalMinutes = toMinutes("18:30")!;
  }

  let arrivalReady: string = "18:30";
  let arrivalDayOffset = 0;
  let arrivalReadyDate: string | null = null;

  if (arrivalTotalMinutes != null) {
    arrivalDayOffset = Math.floor(arrivalTotalMinutes / 1440);
    const timeMins = ((arrivalTotalMinutes % 1440) + 1440) % 1440;
    arrivalReady = fromMinutes(timeMins);
    if (input.startDate) {
      arrivalReadyDate = addDays(input.startDate, arrivalDayOffset);
    }
  }

  const explicitDeparture = toMinutes(input.earliestGroupDeparture);

  let departureTotalMinutes: number | null = null;
  if (explicitDeparture != null) {
    departureTotalMinutes = explicitDeparture;
  } else {
    // Official product fallback when no explicit destination departure time is known: Last day planifiable until 16:30
    departureTotalMinutes = toMinutes("16:30")!;
  }

  let latestDestinationDeparture: string = "16:30";
  let departureDayOffset = 0;
  let departureDate: string | null = null;

  if (departureTotalMinutes != null) {
    departureDayOffset = Math.floor(departureTotalMinutes / 1440);
    const timeMins = ((departureTotalMinutes % 1440) + 1440) % 1440;
    latestDestinationDeparture = fromMinutes(timeMins);
    const lastDayIdx = Math.max(1, input.nights || 1);
    if (input.startDate) {
      departureDate = addDays(input.startDate, lastDayIdx + departureDayOffset);
    }
  }

  return {
    arrivalReady,
    arrivalDayOffset,
    arrivalReadyDate,
    latestDestinationDeparture,
    departureDayOffset,
    departureDate,
  };
}

/**
  * Build PlanningBrief deterministically from KREW input data.
  * Unknown arrival/departure boundaries stay null!
  */
export function buildPlanningBrief(input: ActivityAiInput): PlanningBrief {
  const nights = input.nights ?? 1;
  const daysCount = Math.max(1, nights + 1);
  const window = calculatePlanningWindow(input);

  const dayWindows: DayWindow[] = [];
  for (let d = 1; d <= daysCount; d++) {
    const isArrivalDay = d === 1;
    const isDepartureDay = d === daysCount;
    const date = input.startDate ? addDays(input.startDate, d - 1) : null;

    let availableFrom: string | null = isArrivalDay ? window.arrivalReady : "08:00";
    let availableUntil: string | null = isDepartureDay ? window.latestDestinationDeparture : "23:59";

    if (window.arrivalDayOffset > 0) {
      if (d <= window.arrivalDayOffset) {
        availableFrom = null;
        availableUntil = null;
      } else if (d === window.arrivalDayOffset + 1) {
        availableFrom = window.arrivalReady;
      }
    }

    dayWindows.push({
      day: d,
      date,
      availableFrom,
      availableUntil,
      isArrivalDay,
      isDepartureDay,
    });
  }

  // Calculate mandatoryNeeds only when known bounds explicitly prove intersection!
  const mandatoryNeeds: MandatoryNeed[] = [];
  let needIdCount = 1;

  const timeSlotPrefs = (input.preferredTimeSlots || []).map(norm);
  const wantsLateMorning = timeSlotPrefs.some((s) => s.includes("matin_tard") || s.includes("grasse") || s === "matin_tardif");
  const wantsLateNight = timeSlotPrefs.some((s) => s.includes("tard_soir") || s.includes("nuit") || s.includes("soiree_tardive"));

  for (const dw of dayWindows) {
    if (dw.availableFrom === null || dw.availableUntil === null) continue;

    const startMin = toMinutes(dw.availableFrom)!;
    const endMin = toMinutes(dw.availableUntil)!;

    // Breakfast (07:30 - 10:30): created ONLY if both bounds known & intersects breakfast with enough time
    if (startMin <= 9 * 60 + 30 && endMin >= 8 * 60 + 15 && (endMin - Math.max(startMin, 7 * 60 + 30)) >= 30) {
      mandatoryNeeds.push({
        id: `need_${needIdCount++}`,
        type: "meal",
        subType: "breakfast",
        targetDay: dw.day,
        timeWindow: { start: wantsLateMorning ? "09:30" : "08:30", end: "10:30" },
        durationMinutes: 45,
        label: "Petit-déjeuner local",
      });
    }

    // Lunch (11:30 - 14:30): created ONLY if both bounds known & intersects lunch with enough time
    if (startMin <= 13 * 60 + 30 && endMin >= 12 * 60 + 15 && (endMin - Math.max(startMin, 11 * 60 + 30)) >= 45) {
      mandatoryNeeds.push({
        id: `need_${needIdCount++}`,
        type: "meal",
        subType: "lunch",
        targetDay: dw.day,
        timeWindow: { start: "11:30", end: "14:30" },
        durationMinutes: 90,
        label: "Déjeuner de groupe",
      });
    }

    // Dinner (18:30 - 22:30): created ONLY if both bounds known & intersects dinner with enough time
    if (startMin <= 21 * 60 && endMin >= 19 * 60 + 30 && (endMin - Math.max(startMin, 18 * 60 + 30)) >= 60) {
      mandatoryNeeds.push({
        id: `need_${needIdCount++}`,
        type: "meal",
        subType: "dinner",
        targetDay: dw.day,
        timeWindow: { start: wantsLateNight ? "20:30" : "20:00", end: "22:30" },
        durationMinutes: 120,
        label: "Dîner convivial de groupe",
      });
    }
  }

  // Event signature: deterministically choose best available dayWindow where BOTH boundaries are known and allow >= 60 min
  const eventNorm = norm(input.eventType);
  if (eventNorm.includes("evjf") || eventNorm.includes("evg") || eventNorm.includes("anniversaire") || eventNorm.includes("evenement")) {
    // Helper to calculate total known minutes for a DayWindow
    const getWindowDetails = (dw: DayWindow) => {
      if (dw.availableFrom === null || dw.availableUntil === null) return null;
      const startMin = toMinutes(dw.availableFrom)!;
      const endMin = toMinutes(dw.availableUntil)!;
      if (endMin - startMin < 60) return null;
      return { startMin, endMin, totalMinutes: endMin - startMin };
    };

    // Priority 1: Evening window (intersection with 18:00 - 23:30 >= 60 min)
    let targetDayWindow = dayWindows.find((dw) => {
      const details = getWindowDetails(dw);
      if (!details) return false;
      const overlapStart = Math.max(details.startMin, 18 * 60);
      const overlapEnd = Math.min(details.endMin, 23 * 60 + 30);
      return overlapEnd - overlapStart >= 60;
    });

    // Priority 2: Late afternoon window (intersection with 16:00 - 19:30 >= 60 min)
    if (!targetDayWindow) {
      targetDayWindow = dayWindows.find((dw) => {
        const details = getWindowDetails(dw);
        if (!details) return false;
        const overlapStart = Math.max(details.startMin, 16 * 60);
        const overlapEnd = Math.min(details.endMin, 19 * 60 + 30);
        return overlapEnd - overlapStart >= 60;
      });
    }

    // Priority 3: Any other known window >= 60 min
    if (!targetDayWindow) {
      targetDayWindow = dayWindows.find((dw) => getWindowDetails(dw) !== null);
    }

    if (targetDayWindow) {
      const subType = eventNorm.includes("evjf") ? "evjf" : eventNorm.includes("evg") ? "evg" : "anniversaire";
      const label = subType === "evjf" ? "Jeu de la mariée" : subType === "evg" ? "Défis du marié" : "Surprise anniversaire";
      mandatoryNeeds.push({
        id: `need_${needIdCount++}`,
        type: "event_signature",
        subType,
        targetDay: targetDayWindow.day,
        timeWindow: {
          start: targetDayWindow.availableFrom!,
          end: targetDayWindow.availableUntil!,
        },
        durationMinutes: 90,
        label,
      });
    }
  }

  // Lodging rest if centerpiece
  const lodgRole = input.groupAccommodationRole || "part_of_stay";
  if (lodgRole === "centerpiece") {
    const targetDw = dayWindows.find((dw) => dw.day === 2) || dayWindows[0];
    if (targetDw && targetDw.availableFrom !== null) {
      mandatoryNeeds.push({
        id: `need_${needIdCount++}`,
        type: "lodging_rest",
        subType: "rest",
        targetDay: targetDw.day,
        timeWindow: { start: "14:00", end: "18:00" },
        durationMinutes: 90,
        label: "Temps fort & détente au logement",
      });
    }
  }

  // Preference frequencies
  const activityCategoryFrequencies =
    input.activityCategoryFrequencies ??
    (input.activityCategories ?? []).reduce((acc, cat) => {
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const ambianceFrequencies =
    input.ambianceFrequencies ??
    (input.ambiances ?? []).reduce((acc, amb) => {
      acc[amb] = (acc[amb] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  // Compact user notes
  const usefulUserNotes: string[] = [];
  const seenNotes = new Set<string>();
  for (const pref of input.individualPreferences ?? []) {
    for (const raw of [pref?.freeText, pref?.mobilityNotes]) {
      const text = String(raw || "").trim();
      if (!text || text.includes("@") || text.length < 3) continue;
      const clean = text.slice(0, 150);
      if (!seenNotes.has(clean)) {
        seenNotes.add(clean);
        usefulUserNotes.push(clean);
      }
    }
  }

  const paceRaw = norm(input.travelPace);
  const travelPace = paceRaw.includes("leger")
    ? "leger"
    : paceRaw.includes("intense")
      ? "intense"
      : "equilibre";

  const maxActivitiesPerDay = travelPace === "leger" ? 1 : travelPace === "intense" ? 3 : 2;

  const validatedTripProfiles: StayProfileId[] =
    input.validatedTripProfiles?.length
      ? input.validatedTripProfiles
      : [input.tripProfile].filter((x): x is StayProfileId => Boolean(x));

  return {
    destination: input.destination,
    country: input.country ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    nights,
    participants: input.participants,
    eventType: input.eventType ?? null,
    validatedTripProfiles,
    dayWindows,
    mandatoryNeeds,
    preferenceSignals: {
      activityCategoryFrequencies,
      ambianceFrequencies,
    },
    dealBreakers: {
      ambiances: input.dealBreakerAmbiances ?? [],
      starExclusions: input.starDealBreakers ?? [],
    },
    usefulUserNotes,
    verifiedLodgingAmenities: input.verifiedLodgingAmenities ?? [],
    localMobility: input.localMobility ?? null,
    preferredTimeSlots: input.preferredTimeSlots ?? [],
    accessibilityRequired: input.accessibilityRequired === true,
    planningRules: {
      travelPace,
      maxActivitiesPerDay,
      accommodationRole: lodgRole,
    },
  };
}

/**
  * Dynamically finds an available free gap in a dayWindow between existing slots.
  * NO hardcoded constants or fixed schedules!
  */
export function findAvailableGap(options: {
  dayWindow: DayWindow;
  existingSlots: KrewSkeletonSlot[] | ActivitySlot[];
  preferredWindow?: { start: string; end: string } | undefined;
  durationMinutes: number;
}): { start: string; end: string } | null {
  const { dayWindow, existingSlots, preferredWindow, durationMinutes } = options;

  if (dayWindow.availableFrom === null && dayWindow.availableUntil === null) {
    return null; // Day completely unavailable
  }

  if (preferredWindow) {
    const prefStart = toMinutes(preferredWindow.start)!;
    const prefEnd = toMinutes(preferredWindow.end)!;

    if (prefStart < 12 * 60 && dayWindow.availableFrom === null) return null;
    if (prefEnd > 18 * 60 && dayWindow.availableUntil === null) return null;
  }

  const dwStart = dayWindow.availableFrom !== null ? toMinutes(dayWindow.availableFrom)! : null;
  const dwEnd = dayWindow.availableUntil !== null ? toMinutes(dayWindow.availableUntil)! : null;

  if (dwStart === null || dwEnd === null) {
    return null; // Boundary is unknown on arrival/departure day
  }

  let prefStart = preferredWindow ? toMinutes(preferredWindow.start)! : dwStart;
  let prefEnd = preferredWindow ? toMinutes(preferredWindow.end)! : dwEnd;

  prefStart = Math.max(dwStart, prefStart);
  prefEnd = Math.min(dwEnd, prefEnd);

  if (prefEnd - prefStart < durationMinutes) return null;

  const occupied = existingSlots
    .map((s) => {
      const st = toMinutes(s.time);
      const et = toMinutes(s.endTime);
      return st != null && et != null ? { start: st, end: et } : null;
    })
    .filter((v): v is { start: number; end: number } => v != null)
    .sort((a, b) => a.start - b.start);

  let candidateStart = prefStart;
  while (candidateStart + durationMinutes <= prefEnd) {
    const candidateEnd = candidateStart + durationMinutes;
    const overlap = occupied.some((occ) => Math.max(occ.start, candidateStart) < Math.min(occ.end, candidateEnd));
    if (!overlap) {
      return { start: fromMinutes(candidateStart), end: fromMinutes(candidateEnd) };
    }
    candidateStart += 15;
  }

  return null;
}

/**
  * Minimal Fallback from PlanningBrief when Gemini is unavailable.
  * Uses ONLY dayWindows, mandatoryNeeds, travelPace, accommodationRole via findAvailableGap.
  * 0 Gemini calls, no fixed rigid schedule.
  */
export function buildMinimalFallbackFromBrief(brief: PlanningBrief): KrewSkeleton {
  const days: KrewSkeletonDay[] = [];
  let slotIdCounter = 1;

  for (const dw of brief.dayWindows) {
    const slots: KrewSkeletonSlot[] = [];
    if (dw.availableFrom === null && dw.availableUntil === null) {
      days.push({ day: dw.day, date: dw.date, slots: [] });
      continue;
    }

    const dayNeeds = brief.mandatoryNeeds.filter((n) => n.targetDay === dw.day);

    for (const need of dayNeeds) {
      const gap = findAvailableGap({
        dayWindow: dw,
        existingSlots: slots,
        preferredWindow: need.timeWindow,
        durationMinutes: need.durationMinutes,
      });

      if (!gap) continue;

      const isInternal =
        need.type === "event_signature" ||
        need.type === "lodging_rest" ||
        (need.subType === "breakfast" && (brief.planningRules.accommodationRole === "centerpiece" || dw.day % 2 === 0));

      const stMin = toMinutes(gap.start)!;

      slots.push({
        id: `slot_${slotIdCounter++}`,
        day: dw.day,
        moment: stMin < 720 ? "Matin" : stMin < 1080 ? "Après-midi" : "Soir",
        time: gap.start,
        endTime: gap.end,
        durationMinutes: need.durationMinutes,
        kind: isInternal ? "internal" : "place_required",
        type: need.type === "meal" ? "resto" : "libre",
        category: need.type === "meal" ? "repas" : need.type === "event_signature" ? (need.subType === "evjf" || need.subType === "evg" ? "jeu_groupe" : "evenement") : "moment_maison",
        label: need.label,
        importance: "high",
        flexibility: "flexible",
        locationContext: isInternal ? "lodging" : "external",
        venueFamily: isInternal ? undefined : need.subType === "breakfast" ? "cafe" : need.type === "meal" ? "restaurant" : "culture",
        searchIntent: isInternal ? undefined : `${need.label} à ${brief.destination}`,
      });
    }

    const maxActs = brief.planningRules.maxActivitiesPerDay;
    const isHomeProfile =
      brief.validatedTripProfiles.includes("house_together") ||
      brief.planningRules.accommodationRole === "centerpiece";

    const categories = Object.keys(brief.preferenceSignals.activityCategoryFrequencies || {}).map(norm);
    const wantsSport =
      brief.validatedTripProfiles.includes("outdoor_active") ||
      /sport|outdoor|montagne|rando|kayak|randonnee/.test(categories.join(" "));

    if (isHomeProfile) {
      if (dw.day === 1) {
        const gap = findAvailableGap({
          dayWindow: dw,
          existingSlots: slots,
          preferredWindow: { start: "18:00", end: "20:00" },
          durationMinutes: 90,
        });
        if (gap) {
          slots.push({
            id: `slot_${slotIdCounter++}`,
            day: dw.day,
            moment: "Soir",
            time: gap.start,
            endTime: gap.end,
            durationMinutes: 90,
            kind: "internal",
            type: "libre",
            category: "moment_maison",
            label: "Apéro & installation au logement",
            importance: "medium",
            flexibility: "flexible",
            locationContext: "lodging",
          });
        }
      } else if (!dw.isDepartureDay) {
        const gap = findAvailableGap({
          dayWindow: dw,
          existingSlots: slots,
          preferredWindow: { start: "15:00", end: "18:00" },
          durationMinutes: 120,
        });
        if (gap) {
          slots.push({
            id: `slot_${slotIdCounter++}`,
            day: dw.day,
            moment: "Après-midi",
            time: gap.start,
            endTime: gap.end,
            durationMinutes: 120,
            kind: "internal",
            type: "libre",
            category: "moment_maison",
            label: "Jeux collectifs ou temps libre au logement",
            importance: "medium",
            flexibility: "flexible",
            locationContext: "lodging",
          });
        }
      } else if (dw.isDepartureDay) {
        const gap = findAvailableGap({
          dayWindow: dw,
          existingSlots: slots,
          preferredWindow: { start: "10:00", end: "12:00" },
          durationMinutes: 90,
        });
        if (gap) {
          slots.push({
            id: `slot_${slotIdCounter++}`,
            day: dw.day,
            moment: "Matin",
            time: gap.start,
            endTime: gap.end,
            durationMinutes: 90,
            kind: "internal",
            type: "libre",
            category: "moment_maison",
            label: "Matinée cocooning & rangement au logement",
            importance: "low",
            flexibility: "flexible",
            locationContext: "lodging",
          });
        }
      }
    }

    if (!dw.isDepartureDay && !isHomeProfile && maxActs >= 1) {
      const gap = findAvailableGap({
        dayWindow: dw,
        existingSlots: slots,
        preferredWindow: { start: "14:00", end: "18:00" },
        durationMinutes: 120,
      });

      if (gap) {
        slots.push({
          id: `slot_${slotIdCounter++}`,
          day: dw.day,
          moment: "Après-midi",
          time: gap.start,
          endTime: gap.end,
          durationMinutes: 120,
          kind: "place_required",
          type: "activite",
          category: wantsSport ? "sport_outdoor" : "culture",
          label: wantsSport ? "Activité outdoor & aventure" : `Découverte culturelle de ${brief.destination}`,
          importance: "high",
          flexibility: "flexible",
          locationContext: "external",
          venueFamily: wantsSport ? "sport" : "culture",
          searchIntent: wantsSport ? `activité outdoor groupe à ${brief.destination}` : `visite culturelle groupe à ${brief.destination}`,
        });
      }
    }

    if (!dw.isDepartureDay && !isHomeProfile && maxActs >= 3) {
      const gapM = findAvailableGap({
        dayWindow: dw,
        existingSlots: slots,
        preferredWindow: { start: "10:00", end: "12:00" },
        durationMinutes: 90,
      });

      if (gapM) {
        slots.push({
          id: `slot_${slotIdCounter++}`,
          day: dw.day,
          moment: "Matin",
          time: gapM.start,
          endTime: gapM.end,
          durationMinutes: 90,
          kind: "place_required",
          type: "activite",
          category: wantsSport ? "sport_outdoor" : "culture",
          label: wantsSport ? "Session sportive matinale" : `Visite matinale à ${brief.destination}`,
          importance: "medium",
          flexibility: "flexible",
          locationContext: "external",
          venueFamily: wantsSport ? "sport" : "culture",
          searchIntent: wantsSport ? `session sportive outdoor à ${brief.destination}` : `visite incontournable à ${brief.destination}`,
        });
      }
    }

    slots.sort((a, b) => (toMinutes(a.time) ?? 0) - (toMinutes(b.time) ?? 0));
    days.push({ day: dw.day, date: dw.date, slots });
  }

  return {
    destination: brief.destination,
    nights: brief.nights,
    days,
  };
}

/**
  * Helper to build legacy KrewSkeleton.
  */
export function buildKrewSkeleton(input: ActivityAiInput): KrewSkeleton {
  const brief = buildPlanningBrief(input);
  return buildMinimalFallbackFromBrief(brief);
}

/**
  * Ensure mandatoryNeeds post-Gemini.
  * Checks specific meal subtypes (breakfast satisfied only by breakfast/brunch, lunch by lunch/brunch, dinner by dinner).
  * Repairs missing mandatory needs deterministically without 2nd Gemini call!
  */
export function ensureMandatoryNeeds(skeleton: KrewSkeleton, brief: PlanningBrief): KrewSkeleton {
  const updatedDays: KrewSkeletonDay[] = [];
  let slotIdCounter = 900;

  for (const dw of brief.dayWindows) {
    const dayObj = skeleton.days.find((d) => d.day === dw.day);
    const currentSlots: KrewSkeletonSlot[] = dayObj ? [...dayObj.slots] : [];
    const dayNeeds = brief.mandatoryNeeds.filter((n) => n.targetDay === dw.day);

    for (const need of dayNeeds) {
      const satisfied = currentSlots.some((s) => {
        if (need.type === "meal") {
          const isMealSlot = s.category === "repas" || s.type === "resto";
          if (!isMealSlot) return false;
          const sStart = toMinutes(s.time);
          if (sStart == null) return false;

          if (need.subType === "breakfast") {
            return sStart < 11 * 60 + 30 || norm(s.label).includes("breakfast") || norm(s.label).includes("brunch");
          }
          if (need.subType === "lunch") {
            return (sStart >= 11 * 60 + 30 && sStart < 15 * 60 + 30) || norm(s.label).includes("dejeuner") || norm(s.label).includes("brunch");
          }
          if (need.subType === "dinner") {
            return sStart >= 18 * 60 || norm(s.label).includes("diner") || norm(s.label).includes("souper");
          }
          return true;
        }
        if (need.type === "event_signature") {
          return (s.category === "evenement" || s.category === "jeu_groupe") && s.time != null;
        }
        if (need.type === "lodging_rest") {
          return (s.category === "moment_maison" || s.locationContext === "lodging") && s.time != null;
        }
        return false;
      });

      if (!satisfied) {
        const gap = findAvailableGap({
          dayWindow: dw,
          existingSlots: currentSlots,
          preferredWindow: need.timeWindow,
          durationMinutes: need.durationMinutes,
        });

        if (gap) {
          const isInternal =
            need.type === "event_signature" ||
            need.type === "lodging_rest" ||
            (need.subType === "breakfast" && (brief.planningRules.accommodationRole === "centerpiece" || dw.day % 2 === 0));

          const stMin = toMinutes(gap.start)!;

          currentSlots.push({
            id: `slot_repair_${slotIdCounter++}`,
            day: dw.day,
            moment: stMin < 720 ? "Matin" : stMin < 1080 ? "Après-midi" : "Soir",
            time: gap.start,
            endTime: gap.end,
            durationMinutes: need.durationMinutes,
            kind: isInternal ? "internal" : "place_required",
            type: need.type === "meal" ? "resto" : "libre",
            category: need.type === "meal" ? "repas" : need.type === "event_signature" ? "jeu_groupe" : "moment_maison",
            label: need.label,
            importance: "high",
            flexibility: "flexible",
            locationContext: isInternal ? "lodging" : "external",
            venueFamily: isInternal ? undefined : need.subType === "breakfast" ? "cafe" : need.type === "meal" ? "restaurant" : "culture",
            searchIntent: isInternal ? undefined : `${need.label} à ${brief.destination}`,
          });
        }
      }
    }

    currentSlots.sort((a, b) => (toMinutes(a.time) ?? 0) - (toMinutes(b.time) ?? 0));
    updatedDays.push({
      day: dw.day,
      date: dw.date,
      slots: currentSlots,
    });
  }

  return {
    ...skeleton,
    destination: brief.destination,
    nights: brief.nights,
    days: updatedDays,
  };
}

/**
  * Apply maxActivitiesPerDay ceiling post-Gemini with smart category diversity selection.
  */
export function applyMaxActivitiesPerDay(skeleton: KrewSkeleton, brief: PlanningBrief): KrewSkeleton {
  const maxActs = brief.planningRules.maxActivitiesPerDay;

  const updatedDays: KrewSkeletonDay[] = skeleton.days.map((day) => {
    const mainActs = day.slots.filter(
      (s) =>
        s.kind === "place_required" &&
        s.category !== "repas" &&
        s.type !== "resto" &&
        s.type !== "transport",
    );

    if (mainActs.length <= maxActs) return day;

    const prefFreqs = brief.preferenceSignals.activityCategoryFrequencies || {};

    const rankedActs = mainActs.slice().sort((a, b) => {
      const freqA = prefFreqs[a.category] || 0;
      const freqB = prefFreqs[b.category] || 0;
      if (freqA !== freqB) return freqB - freqA;
      return (toMinutes(a.time) ?? 0) - (toMinutes(b.time) ?? 0);
    });

    const keptSet = new Set<string>();
    const seenCategories = new Set<string>();

    for (const act of rankedActs) {
      if (keptSet.size >= maxActs) break;
      if (!seenCategories.has(act.category) || keptSet.size < maxActs) {
        keptSet.add(act.id);
        seenCategories.add(act.category);
      }
    }

    const prunedSlots = day.slots.filter((s) => {
      const isMain =
        s.kind === "place_required" &&
        s.category !== "repas" &&
        s.type !== "resto" &&
        s.type !== "transport";
      if (!isMain) return true;
      return keptSet.has(s.id);
    });

    return {
      ...day,
      slots: prunedSlots,
    };
  });

  return {
    ...skeleton,
    days: updatedDays,
  };
}

/**
  * Compose planning with Gemini using PlanningBrief contract.
  * Exactly 0 or 1 Gemini call maximum.
  */
export async function geminiEnrichSkeleton(
  skeleton: KrewSkeleton,
  input: ActivityAiInput,
): Promise<{ enrichedSkeleton: KrewSkeleton; usedLlm: boolean; geminiCalled?: boolean; error?: string }> {
  const key = process.env["GEMINI_API_KEY"];
  const brief = buildPlanningBrief(input);

  if (!key) {
    return {
      enrichedSkeleton: buildMinimalFallbackFromBrief(brief),
      usedLlm: false,
      geminiCalled: false,
      error: "no_gemini_key",
    };
  }

  const groupPlanningContext = buildGroupPlanningContext(input, brief);
  const prompt = GEMINI_CONTRACTUAL_PROMPT_TEMPLATE.replace(
    "{{GROUP_PLANNING_CONTEXT_JSON}}",
    JSON.stringify(groupPlanningContext, null, 2),
  );

  const responseSchema = {
    type: "OBJECT",
    properties: {
      days: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            day: { type: "INTEGER" },
            slots: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "STRING" },
                  kind: { type: "STRING", enum: ["internal", "place_required"] },
                  momentType: { type: "STRING", enum: ALLOWED_MOMENT_TYPES },
                  label: { type: "STRING" },
                  detail: { type: "STRING" },
                  time: { type: "STRING" },
                  durationMinutes: { type: "INTEGER" },
                  locationContext: { type: "STRING", enum: ["lodging", "external", "flexible"] },
                  canonicalVenueFamily: { type: "STRING", enum: CANONICAL_VENUE_FAMILIES, nullable: true },
                  searchIntent: { type: "STRING", nullable: true },
                  suggestedPlace: { type: "STRING", nullable: true },
                },
                required: ["id", "kind", "momentType", "label", "detail", "time", "durationMinutes"],
              },
            },
          },
          required: ["day", "slots"],
        },
      },
      backups: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING" },
            day: { type: "INTEGER" },
            forSlot: { type: "STRING" },
            kind: { type: "STRING", enum: ["internal", "place_required"] },
            momentType: { type: "STRING", enum: ALLOWED_MOMENT_TYPES },
            label: { type: "STRING" },
            detail: { type: "STRING" },
            time: { type: "STRING" },
            durationMinutes: { type: "INTEGER" },
            locationContext: { type: "STRING", enum: ["lodging", "external", "flexible"] },
            canonicalVenueFamily: { type: "STRING", enum: CANONICAL_VENUE_FAMILIES, nullable: true },
            searchIntent: { type: "STRING", nullable: true },
            suggestedPlace: { type: "STRING", nullable: true },
          },
          required: ["id", "day", "forSlot", "kind", "momentType", "label", "detail", "time", "durationMinutes"],
        },
      },
    },
    required: ["days", "backups"],
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: "application/json",
            responseSchema,
          },
        }),
      },
    );

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`gemini_enrich_http_${response.status}:${text.slice(0, 160)}`);
    }

    const payload = JSON.parse(text);
    const rawText = (payload?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
    const rawParsed = parseJson(rawText);

    const normalizedParsed = normalizeGeminiParsedResponse(rawParsed);

    if (!normalizedParsed || !Array.isArray(normalizedParsed.days) || normalizedParsed.days.length === 0) {
      throw new Error("gemini_invalid_response_format");
    }

    const isDirectMatch = rawParsed && typeof rawParsed === "object" && Array.isArray(rawParsed.days);
    const telemetryStatus = isDirectMatch ? "accepted_direct" : "accepted_normalized";

    const enrichedDays: KrewSkeletonDay[] = [];
    let slotIdCounter = 1;

    for (const rawDay of normalizedParsed.days) {
      const dayNum = Number(rawDay.day);
      const dw = brief.dayWindows.find((w) => w.day === dayNum);
      if (!dw || dayNum === 99) continue;

      const slots: KrewSkeletonSlot[] = [];
      for (const rawSlot of rawDay.slots ?? []) {
        if (!rawSlot || typeof rawSlot !== "object") continue;

        // Strict kind validation
        let kind: SkeletonSlotKind | null = null;
        if (rawSlot.kind === "internal") kind = "internal";
        else if (rawSlot.kind === "place_required") kind = "place_required";
        else {
          const mNorm = norm(rawSlot.momentType || rawSlot.category);
          if (["moment_maison", "jeu_groupe", "evenement", "lodging", "free_time"].includes(mNorm)) {
            kind = "internal";
          } else if (["repas", "culture", "sport_outdoor", "detente", "soiree", "shopping", "local_experience"].includes(mNorm)) {
            kind = "place_required";
          } else {
            continue; // Reject slot if kind is unresolvable
          }
        }

        // Strict momentType validation (NO "culture" default!)
        let momentType = norm(rawSlot.momentType || rawSlot.category);
        if (momentType === "sport") momentType = "sport_outdoor";

        if (!ALLOWED_MOMENT_TYPES.includes(momentType)) {
          if (rawSlot.label && norm(rawSlot.label).includes("diner")) momentType = "repas";
          else continue; // Reject slot if momentType unresolvable
        }

        // Strict canonicalVenueFamily validation (NO "restaurant" default!)
        let venueFamily = norm(rawSlot.canonicalVenueFamily || rawSlot.venueFamily);
        if (!CANONICAL_VENUE_FAMILIES.includes(venueFamily as any)) {
          if (momentType === "repas") {
            venueFamily = rawSlot.moment === "Matin" ? "cafe" : "restaurant";
          } else if (momentType === "soiree") {
            venueFamily = "bar_pub";
          } else if (momentType === "sport_outdoor") {
            venueFamily = "sport";
          } else if (momentType === "detente") {
            venueFamily = "spa_wellness";
          } else if (momentType === "culture") {
            venueFamily = "culture";
          } else if (momentType === "shopping") {
            venueFamily = "shopping";
          } else {
            venueFamily = "local_experience";
          }
        }

        // startTime validation without fake constants!
        let time = typeof rawSlot.time === "string" && HHMM.test(rawSlot.time.slice(0, 5)) ? rawSlot.time.slice(0, 5) : null;
        const durationMinutes = Number.isFinite(Number(rawSlot.durationMinutes))
          ? Math.max(15, Math.min(360, Number(rawSlot.durationMinutes)))
          : 90;

        if (!time) {
          const gap = findAvailableGap({
            dayWindow: dw,
            existingSlots: slots,
            durationMinutes,
          });
          if (gap) {
            time = gap.start;
          } else {
            continue; // Reject slot if no gap available
          }
        }

        const startMin = toMinutes(time)!;
        const endMin = startMin + durationMinutes;

        const availStart = dw.availableFrom !== null ? toMinutes(dw.availableFrom)! : null;
        const availEnd = dw.availableUntil !== null ? toMinutes(dw.availableUntil)! : null;

        if (availStart !== null && startMin < availStart) continue;
        if (availEnd !== null && endMin > availEnd) continue;

        const locCtx: "lodging" | "external" | "flexible" =
          rawSlot.locationContext === "lodging" || rawSlot.locationContext === "external" || rawSlot.locationContext === "flexible"
            ? rawSlot.locationContext
            : momentType === "moment_maison"
              ? "lodging"
              : kind === "internal"
                ? "flexible"
                : "external";

        slots.push({
          id: `slot_${slotIdCounter++}`,
          day: dw.day,
          moment: startMin < 720 ? "Matin" : startMin < 1080 ? "Après-midi" : "Soir",
          time: time!,
          endTime: fromMinutes(toMinutes(time)! + durationMinutes),
          durationMinutes,
          kind,
          type: momentType === "repas" ? "resto" : momentType === "soiree" ? "bar" : kind === "internal" ? "libre" : "activite",
          category: momentType as ActivityCategory,
          label: String(rawSlot.label || "Activité").slice(0, 100),
          detail: rawSlot.detail ? String(rawSlot.detail).slice(0, 220) : undefined,
          importance: "medium",
          flexibility: "flexible",
          locationContext: locCtx,
          venueFamily: kind === "place_required" ? venueFamily : undefined,
          searchIntent: kind === "place_required" ? String(rawSlot.searchIntent || rawSlot.label || "").slice(0, 200) : undefined,
        });
      }

      slots.sort((a, b) => (toMinutes(a.time) ?? 0) - (toMinutes(b.time) ?? 0));
      enrichedDays.push({ day: dw.day, date: dw.date, slots });
    }

    const mergedDaysMap = new Map<number, KrewSkeletonDay>();
    for (const d of enrichedDays) {
      if (mergedDaysMap.has(d.day)) {
        const existing = mergedDaysMap.get(d.day)!;
        existing.slots = [...existing.slots, ...d.slots].sort((a, b) => (toMinutes(a.time) ?? 0) - (toMinutes(b.time) ?? 0));
      } else {
        mergedDaysMap.set(d.day, d);
      }
    }

    let finalSkeleton: KrewSkeleton = {
      destination: brief.destination,
      nights: brief.nights,
      days: Array.from(mergedDaysMap.values()).sort((a, b) => a.day - b.day),
      backups: normalizedParsed.backups,
    };

    finalSkeleton = ensureMandatoryNeeds(finalSkeleton, brief);
    finalSkeleton = applyMaxActivitiesPerDay(finalSkeleton, brief);

    console.info("gemini-composition-telemetry", {
      status: telemetryStatus,
      daysCount: finalSkeleton.days.length,
      backupsCount: finalSkeleton.backups?.length ?? 0,
      destination: input.destination,
    });

    return {
      enrichedSkeleton: finalSkeleton,
      usedLlm: true,
      geminiCalled: true,
    };
  } catch (error) {
    console.warn("gemini-composition-telemetry", {
      status: "rejected_fallback",
      error: String(error),
      destination: input.destination,
    });

    reportServerError(error, {
      provider: "gemini",
      model: GEMINI_MODEL,
      kind: "activity-brief-composition",
      fallback: "brief_local",
      destination: input.destination,
    });

    return {
      enrichedSkeleton: buildMinimalFallbackFromBrief(brief),
      usedLlm: false,
      geminiCalled: true,
      error: String(error).slice(0, 180),
    };
  }
}

export function adjustItineraryTransferTimes(
  days: ItineraryDayPlan[],
  input: ActivityAiInput,
): ItineraryDayPlan[] {
  const expectedDays = Math.max(1, input.nights + 1);
  const window = calculatePlanningWindow(input);

  return days
    .filter((day) => day.day >= 1 && day.day <= expectedDays)
    .map((day) => {
      let previousEnd = -1;
      let previousCoords: { latitude?: number | null; longitude?: number | null } | null = null;
      const slots: ActivitySlot[] = [];

      let dayArrivalMin: number | null = null;
      if (window.arrivalDayOffset > 0) {
        if (day.day <= window.arrivalDayOffset) {
          return { ...day, slots: [] };
        }
        if (day.day === window.arrivalDayOffset + 1 && window.arrivalReady) {
          dayArrivalMin = toMinutes(window.arrivalReady);
        }
      } else if (day.day === 1 && window.arrivalReady) {
        dayArrivalMin = toMinutes(window.arrivalReady);
      }

      let dayDepartureMin: number | null = null;
      if (day.day === expectedDays && window.latestDestinationDeparture) {
        dayDepartureMin = toMinutes(window.latestDestinationDeparture);
      }

      for (const slot of day.slots) {
        let start = toMinutes(slot.time);
        if (start == null) {
          slots.push(slot);
          continue;
        }

        const duration = slot.durationMinutes ?? 90;

        const hasCoords =
          previousCoords?.latitude != null &&
          previousCoords?.longitude != null &&
          slot.latitude != null &&
          slot.longitude != null;

        const distance = hasCoords && previousCoords ? haversineDistanceKm(previousCoords, slot) : null;
        const requiredTransfer = previousEnd >= 0 && distance != null ? transferMinutes(distance) : 0;
        const minStart = previousEnd >= 0 ? previousEnd + requiredTransfer : start;

        if (start < minStart) {
          start = minStart;
        }

        const end = start + duration;

        if (dayArrivalMin != null && start < dayArrivalMin) continue;
        if (dayDepartureMin != null && end > dayDepartureMin) continue;

        const updatedSlot: ActivitySlot = {
          ...slot,
          time: fromMinutes(start),
          endTime: fromMinutes(end),
          durationMinutes: duration,
        };

        previousEnd = end;
        if (slot.latitude != null && slot.longitude != null) {
          previousCoords = { latitude: slot.latitude, longitude: slot.longitude };
        }

        slots.push(updatedSlot);
      }

      return {
        ...day,
        slots,
      };
    });
}

function categoryFor(raw: any): ActivityCategory {
  const value = norm(`${raw.category} ${raw.type} ${raw.label}`);
  if (/sport|outdoor|kayak|randon|velo|canyon/.test(value)) return "sport_outdoor";
  if (/maison|logement|villa|barbecue|blind test|jeu/.test(value))
    return /jeu|blind/.test(value) ? "jeu_groupe" : "moment_maison";
  if (/surprise|anniversaire|evg|evjf|signature/.test(value)) return "evenement";
  if (/resto|repas|brunch|diner|déjeuner/.test(value)) return "repas";
  if (/bar|club|soir/.test(value)) return "soiree";
  if (/spa|detente|détente/.test(value)) return "detente";
  if (/transport|arrivee|arrivée|depart|départ/.test(value)) return "transport";
  if (/shopping|boutique|marché/.test(value)) return "shopping";
  if (/libre/.test(value)) return "temps_libre";
  return "culture";
}

function normalizeSlot(
  raw: any,
  input: ActivityAiInput,
  candidates: ActivityCandidate[],
): ActivitySlot | null {
  if (!raw || typeof raw !== "object" || !String(raw.label ?? "").trim()) return null;
  const candidate = candidates.find(
    (item) => item.id === raw.candidateId || norm(item.name) === norm(raw.label),
  );
  const requestedType = norm(raw.type);
  const type: ActivitySlotType = ["resto", "activite", "bar", "transport", "libre"].includes(
    requestedType,
  )
    ? (requestedType as ActivitySlotType)
    : "activite";
  const internal =
    raw.internal === true ||
    raw.source === "krew" ||
    raw.source === "transport" ||
    ["transport", "libre", "moment_maison", "jeu_groupe", "evenement", "temps_libre"].includes(
      String(raw.category),
    );
  if ((!candidate || candidate.verified !== true) && !internal) return null;
  const time =
    typeof raw.time === "string" && HHMM.test(raw.time.slice(0, 5)) ? raw.time.slice(0, 5) : null;
  const durationMinutes = Number.isFinite(Number(raw.durationMinutes))
    ? Math.max(15, Math.min(480, Number(raw.durationMinutes)))
    : (candidate?.durationMinutes ?? 90);

  const category = categoryFor(raw);
  const locCtx: "lodging" | "external" | "flexible" =
    raw.locationContext === "lodging" || raw.locationContext === "external" || raw.locationContext === "flexible"
      ? raw.locationContext
      : category === "moment_maison"
        ? "lodging"
        : internal
          ? "flexible"
          : "external";

  return {
    moment: String(raw.moment ?? "Après-midi").slice(0, 24),
    type,
    category,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 8) : candidate?.tags,
    label: String(raw.label).trim().slice(0, 100),
    detail: raw.detail ? String(raw.detail).slice(0, 220) : (candidate?.description ?? undefined),
    ...(candidate?.priceHint != null ? { priceHint: candidate.priceHint } : {}),
    time,
    endTime: time ? fromMinutes(toMinutes(time)! + durationMinutes) : null,
    durationMinutes,
    locationContext: locCtx,
    dietaryCheckRequired: Array.isArray(input.dietaryConstraints) && input.dietaryConstraints.length > 0 && (category === "repas" || type === "resto"),
    url: candidate ? candidate.sourceUrl : (raw.url || null),
    candidateId: candidate?.id ?? raw.candidateId ?? null,
    verified: candidate?.verified === true || raw.verified === true,
    source: candidate?.source ?? (internal ? "krew" : null),
    latitude: candidate?.latitude ?? raw.latitude ?? null,
    longitude: candidate?.longitude ?? raw.longitude ?? null,
  };
}

export function validateItinerary(
  days: ItineraryDayPlan[],
  input: ActivityAiInput,
  candidates: ActivityCandidate[],
): ItineraryDayPlan[] {
  const expectedDays = Math.max(1, input.nights + 1);
  const window = calculatePlanningWindow(input);

  let rejectedOpeningHours = 0;
  let rejectedGeography = 0;

  const result = days
    .filter((day) => day.day >= 1 && day.day <= expectedDays)
    .map((day) => {
      let previousEnd = -1;
      let previousExternal: ActivitySlot | null = null;

      let dayArrivalMin: number | null = null;
      if (window.arrivalDayOffset > 0) {
        if (day.day <= window.arrivalDayOffset) {
          return { day: day.day, date: input.startDate ? addDays(input.startDate, day.day - 1) : null, slots: [] };
        }
        if (day.day === window.arrivalDayOffset + 1 && window.arrivalReady) {
          dayArrivalMin = toMinutes(window.arrivalReady);
        }
      } else if (day.day === 1 && window.arrivalReady) {
        dayArrivalMin = toMinutes(window.arrivalReady);
      }

      let dayDepartureMin: number | null = null;
      if (day.day === expectedDays && window.latestDestinationDeparture) {
        dayDepartureMin = toMinutes(window.latestDestinationDeparture);
      }

      const slots = day.slots
        .map((raw) => normalizeSlot(raw, input, candidates))
        .filter((slot): slot is ActivitySlot => Boolean(slot))
        .sort((a, b) => (toMinutes(a.time) ?? 9999) - (toMinutes(b.time) ?? 9999))
        .filter((slot) => {
          const start = toMinutes(slot.time);
          if (start == null) return slot.type === "transport" || slot.type === "libre";
          const end = start + (slot.durationMinutes ?? 90);

          if (dayArrivalMin != null && start < dayArrivalMin) return false;
          if (dayDepartureMin != null && end > dayDepartureMin) return false;

          const candidate = slot.candidateId
            ? candidates.find((item) => item.id === slot.candidateId)
            : undefined;

          if (candidate) {
            const status = openingStatus(
              candidate,
              input.startDate ? addDays(input.startDate, day.day - 1) : day.date,
              slot.time,
              slot.durationMinutes ?? 90,
            );
            slot.openingHoursVerified = status === "open";
            if (status === "closed") {
              rejectedOpeningHours++;
              return false;
            }
          }

          const distance = previousExternal ? haversineDistanceKm(previousExternal, slot) : null;
          const policy = geographyPolicy(input);

          if (distance != null && distance > policy.maxKm) {
            rejectedGeography++;
            return false;
          }

          const requiredTransfer = previousEnd >= 0 && distance != null ? transferMinutes(distance) : 0;
          if (start < previousEnd + requiredTransfer) {
            if (distance != null) rejectedGeography++;
            return false;
          }

          previousEnd = end;
          if (candidate) previousExternal = slot;
          return !slot.url || isSafeActivityUrl(slot.url);
        });

      return {
        day: day.day,
        date: input.startDate ? addDays(input.startDate, day.day - 1) : null,
        slots,
      };
    });

  console.info("activity-validation", {
    rejectedOpeningHours,
    rejectedGeography,
    dayCount: result.length,
    profile: geographyPolicy(input).profile,
  });

  return result;
}

export function buildLocalItinerary(
  input: ActivityAiInput,
  candidates: ActivityCandidate[],
): GroupItinerary {
  const brief = buildPlanningBrief(input);
  const skeleton = buildMinimalFallbackFromBrief(brief);

  const daysPlans: ItineraryDayPlan[] = skeleton.days.map((d) => ({
    day: d.day,
    date: d.date ?? null,
    slots: d.slots.map((s) => ({
      moment: s.moment,
      time: s.time,
      endTime: s.endTime,
      durationMinutes: s.durationMinutes,
      type: s.type,
      category: s.category,
      label: s.label,
      detail: s.detail,
      locationContext: s.locationContext,
      verified: false,
      source: "krew",
      url: null,
    })),
  }));

  return {
    destination: input.destination,
    nights: input.nights,
    days: daysPlans,
    source: "local",
    provider: "local",
    generatedAt: new Date().toISOString(),
  };
}

function parseJson(raw: string): any {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw.trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt object boundary extraction if JSON was surrounded by markdown or commentary
    const startObj = cleaned.indexOf("{");
    const endObj = cleaned.lastIndexOf("}");
    if (startObj >= 0 && endObj > startObj) {
      try {
        return JSON.parse(cleaned.slice(startObj, endObj + 1));
      } catch {
        // Continue to array check
      }
    }
    const startArr = cleaned.indexOf("[");
    const endArr = cleaned.lastIndexOf("]");
    if (startArr >= 0 && endArr > startArr) {
      try {
        return JSON.parse(cleaned.slice(startArr, endArr + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Deterministically normalizes structural variations in Gemini's parsed output.
 * Does not invent missing content or weaken business constraints.
 */
export function normalizeGeminiParsedResponse(rawParsed: any): { days: any[]; backups?: GeminiBackupSlot[] } | null {
  if (!rawParsed) return null;

  let rawDays: any[] | null = null;
  let rawBackups: any[] | null = null;

  if (Array.isArray(rawParsed)) {
    rawDays = rawParsed;
  } else if (typeof rawParsed === "object") {
    if (Array.isArray(rawParsed.days)) rawDays = rawParsed.days;
    else if (Array.isArray(rawParsed.jours)) rawDays = rawParsed.jours;
    else if (Array.isArray(rawParsed.itinerary)) rawDays = rawParsed.itinerary;
    else if (Array.isArray(rawParsed.planning)) rawDays = rawParsed.planning;
    else if (Array.isArray(rawParsed.schedule)) rawDays = rawParsed.schedule;
    else if (rawParsed.data && Array.isArray(rawParsed.data.days)) rawDays = rawParsed.data.days;
    else if (rawParsed.data && Array.isArray(rawParsed.data)) rawDays = rawParsed.data;

    if (Array.isArray(rawParsed.backups)) rawBackups = rawParsed.backups;
    else if (Array.isArray(rawParsed.alternatives)) rawBackups = rawParsed.alternatives;
    else if (rawParsed.data && Array.isArray(rawParsed.data.backups)) rawBackups = rawParsed.data.backups;
  }

  if (!rawDays || !Array.isArray(rawDays) || rawDays.length === 0) {
    return null;
  }

  const normalizedDays: any[] = [];

  for (let idx = 0; idx < rawDays.length; idx++) {
    const rawDay = rawDays[idx];
    if (!rawDay || typeof rawDay !== "object") continue;

    const rawDayVal = rawDay.day ?? rawDay.jour ?? rawDay.dayNumber;
    if (rawDayVal == null) continue;

    const dayNumber = Number(rawDayVal);
    if (!Number.isFinite(dayNumber) || dayNumber <= 0) continue;

    let rawSlots: any[] | null = null;
    if (Array.isArray(rawDay.slots)) rawSlots = rawDay.slots;
    else if (Array.isArray(rawDay.creneaux)) rawSlots = rawDay.creneaux;
    else if (Array.isArray(rawDay.activities)) rawSlots = rawDay.activities;
    else if (Array.isArray(rawDay.activites)) rawSlots = rawDay.activites;
    else if (Array.isArray(rawDay.items)) rawSlots = rawDay.items;
    else if (Array.isArray(rawDay.events)) rawSlots = rawDay.events;

    if (!rawSlots || !Array.isArray(rawSlots)) continue;

    const normalizedSlots: any[] = [];
    for (const slot of rawSlots) {
      if (!slot || typeof slot !== "object") continue;

      const normalizedSlot = {
        id: String(slot.id || `slot_parsed_${idx}_${normalizedSlots.length}`),
        kind: slot.kind ?? slot.type_kind,
        momentType: slot.momentType ?? slot.category ?? slot.type ?? slot.moment_type,
        canonicalVenueFamily: slot.canonicalVenueFamily ?? slot.venueFamily ?? slot.venue_family,
        label: slot.label ?? slot.title ?? slot.name ?? slot.intitule,
        detail: slot.detail ?? slot.description ?? slot.details,
        time: slot.time ?? slot.startTime ?? slot.start_time ?? slot.heure,
        durationMinutes: slot.durationMinutes ?? slot.duration ?? slot.duration_minutes,
        locationContext: slot.locationContext ?? slot.location_context ?? slot.context,
        searchIntent: slot.searchIntent ?? slot.search_intent ?? slot.intent,
        suggestedPlace: slot.suggestedPlace ?? slot.suggested_place ?? slot.place,
      };

      normalizedSlots.push(normalizedSlot);
    }

    normalizedDays.push({
      day: dayNumber,
      date: rawDay.date ?? null,
      slots: normalizedSlots,
    });
  }

  const normalizedBackups: GeminiBackupSlot[] = [];
  if (Array.isArray(rawBackups)) {
    for (const bk of rawBackups) {
      if (!bk || typeof bk !== "object" || !bk.id || !bk.label) continue;
      const bKind: SkeletonSlotKind = bk.kind === "internal" ? "internal" : "place_required";
      const rawMoment = norm(bk.momentType || bk.category || bk.moment_type);

      let resolvedMomentType: string | null = null;
      if (ALLOWED_MOMENT_TYPES.includes(rawMoment)) {
        resolvedMomentType = rawMoment;
      } else if (rawMoment === "sport") {
        resolvedMomentType = "sport_outdoor";
      } else if (rawMoment === "gastronomie") {
        resolvedMomentType = "repas";
      } else if (["experiences", "experience", "insolite"].includes(rawMoment)) {
        resolvedMomentType = "local_experience";
      } else if (rawMoment === "soirees") {
        resolvedMomentType = "soiree";
      }

      if (!resolvedMomentType) {
        continue; // Ignore backup if no allowed moment type can be determined
      }

      const bLocCtx: "lodging" | "external" | "flexible" =
        bk.locationContext === "lodging" || bk.locationContext === "external" || bk.locationContext === "flexible"
          ? bk.locationContext
          : bKind === "internal" ? "flexible" : "external";

      normalizedBackups.push({
        id: String(bk.id),
        day: Number(bk.day) || 1,
        forSlot: String(bk.forSlot || bk.for_slot || ""),
        kind: bKind,
        momentType: resolvedMomentType,
        label: String(bk.label).slice(0, 100),
        detail: String(bk.detail || bk.description || "").slice(0, 220),
        time: typeof bk.time === "string" && HHMM.test(bk.time.slice(0, 5)) ? bk.time.slice(0, 5) : "14:00",
        durationMinutes: Number.isFinite(Number(bk.durationMinutes)) ? Number(bk.durationMinutes) : 90,
        locationContext: bLocCtx,
        canonicalVenueFamily: bk.canonicalVenueFamily ? String(bk.canonicalVenueFamily) : null,
        searchIntent: bk.searchIntent ? String(bk.searchIntent) : null,
        suggestedPlace: bk.suggestedPlace ? String(bk.suggestedPlace) : null,
      });
    }
  }

  return normalizedDays.length > 0
    ? { days: normalizedDays, ...(normalizedBackups.length > 0 ? { backups: normalizedBackups } : {}) }
    : null;
}

export async function generateItineraryWithAi(
  input: ActivityAiInput,
  seedLabels: string[] = [],
): Promise<{ itinerary: GroupItinerary; usedLlm: boolean; error?: string }> {
  const brief = buildPlanningBrief(input);
  const skeleton = buildKrewSkeleton(input);
  const enrichResult = await geminiEnrichSkeleton(skeleton, input);

  const itinerary: GroupItinerary = {
    destination: input.destination,
    nights: input.nights,
    days: enrichResult.enrichedSkeleton.days.map((d) => ({
      day: d.day,
      date: d.date ?? null,
      slots: d.slots.map((s) => ({
        moment: s.moment,
        time: s.time,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        type: s.type,
        category: s.category,
        label: s.label,
        detail: s.detail,
        venueFamily: s.venueFamily,
        searchIntent: s.searchIntent,
        locationContext: s.locationContext,
        verified: false,
        source: "krew",
        url: null,
      })),
    })),
    backups: enrichResult.enrichedSkeleton.backups,
    source: "ai",
    provider: "gemini",
    generatedAt: new Date().toISOString(),
    skeleton: enrichResult.enrichedSkeleton,
  };

  return {
    itinerary,
    usedLlm: enrichResult.usedLlm,
    ...(enrichResult.error ? { error: enrichResult.error } : {}),
  };
}

/**
  * Regenerates a single slot.
  * Exactly 0 Gemini calls for "another proposition"!
  * Reuses existing persisted candidates/pools or performs 1 targeted Geoapify search.
  */
export async function regenerateSlotWithAi(
  input: ActivityAiInput,
  existing: ActivitySlot,
  day: number,
  avoid: string[] = [],
  candidates: ActivityCandidate[] = [],
  placePools: Record<string, any[]> = {},
  usedCandidateIds: string[] = [],
  refCoords?: { latitude: number; longitude: number } | null,
): Promise<{ slot: ActivitySlot; usedLlm: false; updatedPools?: Record<string, any[]>; updatedUsedIds?: string[]; error?: string }> {
  const usedSet = new Set(usedCandidateIds);
  const avoidNorms = avoid.map(norm);

  const req = convertIntentToPlaceRequirements(
    existing.venueFamily || "local_experience",
    existing.category || "culture",
    existing.searchIntent || existing.label,
    input.dietaryConstraints,
    Boolean(input.accessibilityRequired),
    input.individualPreferences?.map((p: any) => p?.mobilityNotes).filter(Boolean) || [],
  );

  const poolKey = buildPoolKey(req);
  let pool = placePools[poolKey] || [];
  let updatedPools = { ...placePools };

  let selectedPlace = await selectGeoapifyCandidate({
    candidates: pool,
    req,
    usedCandidateIdsSet: usedSet,
    avoidList: avoid,
    refCoords,
    maxKm: 50,
    time: existing.time,
    durationMinutes: existing.durationMinutes ?? 90,
    accessibilityRequired: Boolean(input.accessibilityRequired),
  });

  // If pool exhausted, perform 1 targeted Geoapify search (0 Gemini calls)
  if (!selectedPlace && refCoords?.latitude != null && refCoords?.longitude != null) {
    const newPlaces = await searchGeoapifyPlaces({
      categories: req.categories,
      latitude: refCoords.latitude,
      longitude: refCoords.longitude,
      radiusMeters: 15000,
      limit: 15,
      conditions: req.accessibility || [],
    });

    if (newPlaces.length > 0) {
      const merged = mergeUniquePlacesById(pool, newPlaces);
      updatedPools[poolKey] = merged;
      selectedPlace = await selectGeoapifyCandidate({
        candidates: merged,
        req,
        usedCandidateIdsSet: usedSet,
        avoidList: avoid,
        refCoords,
        maxKm: 50,
        time: existing.time,
        durationMinutes: existing.durationMinutes ?? 90,
        accessibilityRequired: Boolean(input.accessibilityRequired),
      });
    }
  }

  if (selectedPlace) {
    usedSet.add(selectedPlace.id);
    return {
      slot: {
        ...existing,
        label: selectedPlace.name,
        detail: selectedPlace.address || existing.detail || "Alternative sélectionnée par KREW",
        candidateId: selectedPlace.id,
        category: existing.category,
        url: selectedPlace.website || null,
        verified: true,
        source: "geoapify",
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
      },
      usedLlm: false,
      updatedPools,
      updatedUsedIds: Array.from(usedSet),
    };
  }

  // Candidates array fallback
  const candidateAlt = candidates.find(
    (c) => !avoidNorms.includes(norm(c.name)) && !usedSet.has(c.id),
  );

  if (candidateAlt) {
    usedSet.add(candidateAlt.id);
    return {
      slot: {
        ...existing,
        label: candidateAlt.name,
        candidateId: candidateAlt.id,
        category: (candidateAlt.category as ActivityCategory) ?? existing.category,
        url: candidateAlt.sourceUrl,
        verified: true,
        source: candidateAlt.source,
        latitude: candidateAlt.latitude,
        longitude: candidateAlt.longitude,
      },
      usedLlm: false,
      updatedUsedIds: Array.from(usedSet),
    };
  }

  return {
    slot: {
      ...existing,
      label: `${existing.label} — lieu à choisir`,
      detail: "Choix de l'alternative à préciser",
      url: null,
      candidateId: null,
      verified: false,
      source: "krew",
    },
    usedLlm: false,
    error: "no_candidate",
  };
}
