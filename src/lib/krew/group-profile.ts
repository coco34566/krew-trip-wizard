import type { ScoringContext } from "./engine";

export type QuestionnaireSignalUse = {
  field: string;
  source: "trip_participant_preferences" | "trip_star_preferences" | "trips" | "trip_transport_time_prefs";
  hardConstraint: boolean;
  scoringFactor: boolean;
  apiQuery: boolean;
  tieBreaker: boolean;
  explanation: boolean;
  currentUse: string;
};

export const QUESTIONNAIRE_SIGNAL_MAPPING: QuestionnaireSignalUse[] = [
  { field: "budget_max + budget_priority", source: "trip_participant_preferences", hardConstraint: true, scoringFactor: true, apiQuery: true, tieBreaker: true, explanation: true, currentUse: "médiane groupe, budget minimum, veto budget et ajustement par âge" },
  { field: "transport_mode_accepted", source: "trip_participant_preferences", hardConstraint: true, scoringFactor: true, apiQuery: true, tieBreaker: true, explanation: true, currentUse: "intersection/union des modes acceptés et compatibilité par mode" },
  { field: "max_travel_duration_hours", source: "trip_participant_preferences", hardConstraint: true, scoringFactor: true, apiQuery: true, tieBreaker: true, explanation: true, currentUse: "plafond dur évalué sur chaque mode accepté, pas uniquement voiture" },
  { field: "departure_city + departure_airport_or_station", source: "trip_participant_preferences", hardConstraint: false, scoringFactor: true, apiQuery: true, tieBreaker: true, explanation: true, currentUse: "origines pondérées pour transport multi-départs" },
  { field: "ambiances + deal_breaker_ambiances", source: "trip_participant_preferences", hardConstraint: true, scoringFactor: true, apiQuery: true, tieBreaker: true, explanation: true, currentUse: "affinité, veto ambiance dominante et satisfaction individuelle" },
  { field: "activity_categories", source: "trip_participant_preferences", hardConstraint: false, scoringFactor: true, apiQuery: true, tieBreaker: true, explanation: true, currentUse: "découverte, choix activités et couverture groupe" },
  { field: "wanted_env_type", source: "trip_participant_preferences", hardConstraint: false, scoringFactor: true, apiQuery: true, tieBreaker: true, explanation: true, currentUse: "urbain/nature/mer/montagne/village via sous-score environment" },
  { field: "group_age_range", source: "trip_participant_preferences", hardConstraint: false, scoringFactor: true, apiQuery: false, tieBreaker: true, explanation: true, currentUse: "ajuste budget, activités et confort sans annuler les préférences explicites" },
  { field: "required_amenities + room_type_preference + accepts_shared_room + min_accommodation_rating", source: "trip_participant_preferences", hardConstraint: true, scoringFactor: true, apiQuery: true, tieBreaker: true, explanation: true, currentUse: "sélection/priorisation hébergement" },
  { field: "dietary_constraints + accessibility_needs + mobility_notes", source: "trip_participant_preferences", hardConstraint: true, scoringFactor: true, apiQuery: true, tieBreaker: true, explanation: true, currentUse: "dépriorisation incompatible, proximité/accessibilité et explications" },
  { field: "date_flex_days + blackout_dates + availability", source: "trip_participant_preferences", hardConstraint: true, scoringFactor: true, apiQuery: true, tieBreaker: true, explanation: true, currentUse: "fenêtre validée, saison et contraintes de dates" },
  { field: "wanted_activities + deal_breakers + wanted_env_type", source: "trip_star_preferences", hardConstraint: true, scoringFactor: true, apiQuery: true, tieBreaker: true, explanation: true, currentUse: "injecté comme préférence pondérée Star" },
];

export type GroupTravelProfile = Pick<
  ScoringContext,
  | "participants"
  | "budgetPerPerson"
  | "nights"
  | "ambiances"
  | "activityCategories"
  | "transportModes"
  | "maxTravelDurationHours"
  | "wantedEnvTypes"
  | "groupAgeRange"
  | "individualPreferences"
> & {
  hardConstraints: Record<string, unknown>;
  softPreferences: Record<string, unknown>;
  mapping: QuestionnaireSignalUse[];
};

export function buildGroupTravelProfile(ctx: ScoringContext): GroupTravelProfile {
  return {
    participants: ctx.participants,
    budgetPerPerson: ctx.budgetPerPerson,
    nights: ctx.nights,
    ambiances: ctx.ambiances,
    activityCategories: ctx.activityCategories,
    transportModes: ctx.transportModes,
    maxTravelDurationHours: ctx.maxTravelDurationHours,
    wantedEnvTypes: ctx.wantedEnvTypes,
    groupAgeRange: ctx.groupAgeRange,
    individualPreferences: ctx.individualPreferences,
    hardConstraints: {
      budgetVeto: ctx.vetoBudgetMax ?? null,
      maxTravelDurationHours: ctx.maxTravelDurationHours ?? null,
      transportModes: ctx.transportModes ?? [],
      excludedDestinations: ctx.dealBreakerDestinations ?? [],
      excludedAmbiances: ctx.dealBreakerAmbiances ?? [],
      minAccommodationRating: ctx.minAccommodationRating ?? null,
      accessibility: Boolean(ctx.needsAccessibility),
    },
    softPreferences: {
      ambiances: ctx.ambiances,
      activities: ctx.activityCategories,
      environment: ctx.wantedEnvTypes ?? [],
      accommodation: ctx.requiredAmenities ?? [],
      pace: ctx.travelPace ?? null,
      ageRange: ctx.groupAgeRange ?? null,
      star: { activities: ctx.starWantedActivities ?? [], environment: ctx.starWantedEnvType ?? null },
    },
    mapping: QUESTIONNAIRE_SIGNAL_MAPPING,
  };
}
