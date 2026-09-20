import { estimateOptionsByMode, normalizeTransportModes } from "./transport-compatibility";
import { normalizeCityKey } from "./deep-links";
import type { TransportPlausibility } from "./destination-ai.server";

export type ParticipantTravelConstraint = {
  userId?: string | null;
  displayName?: string | null;
  departureCity?: string | null;
  transportModes?: string[] | null;
  maxTravelHours?: number | null;
};

export type CandidateTransportInfo = {
  plausibleModes: string[];
  plausibility: TransportPlausibility;
};

export type ParticipantTravelRejection = {
  reason: string;
  participant: ParticipantTravelConstraint;
};

function explicitlyRefusesFlight(modes: string[] | null | undefined): boolean {
  if (!modes?.length) return false;
  const normalized = normalizeTransportModes(modes);
  const rawAny = modes.some((mode) => normalizeCityKey(mode).includes("peu importe") || normalizeCityKey(mode).includes("any"));
  return !rawAny && !normalized.includes("flight");
}

export function hasDeclaredTravelConstraint(preference: ParticipantTravelConstraint): boolean {
  return Boolean(
    (preference.maxTravelHours != null && Number(preference.maxTravelHours) > 0) ||
      explicitlyRefusesFlight(preference.transportModes),
  );
}

function modeIntersection(
  plausibleModes: string[],
  acceptedModes: string[] | null | undefined,
): string[] {
  const plausible = normalizeTransportModes(plausibleModes);
  if (!acceptedModes?.length) return plausible;
  const accepted = normalizeTransportModes(acceptedModes);
  const acceptsAny = acceptedModes.some((mode) => {
    const normalized = normalizeCityKey(mode);
    return normalized.includes("peu importe") || normalized.includes("any");
  });
  if (acceptsAny) return plausible;
  return plausible.filter((mode) => accepted.includes(mode));
}

export function evaluateParticipantTravelConstraint(input: {
  participant: ParticipantTravelConstraint;
  distanceKm: number;
  candidateTransport?: CandidateTransportInfo | null;
}): ParticipantTravelRejection | null {
  const { participant, distanceKm, candidateTransport } = input;
  if (!hasDeclaredTravelConstraint(participant)) return null;
  if (!participant.departureCity?.trim()) return null;

  const label = participant.displayName?.trim() || participant.userId || "un participant";
  const city = participant.departureCity.trim();

  if (candidateTransport?.plausibility === "unlikely") {
    return {
      participant,
      reason: `inatteignable pour ${label} depuis ${city} (trajet jugé peu plausible)`,
    };
  }

  const refusesFlight = explicitlyRefusesFlight(participant.transportModes);
  const plausibleModes = candidateTransport?.plausibleModes ?? [];

  if (
    refusesFlight &&
    plausibleModes.length > 0 &&
    normalizeTransportModes(plausibleModes).every((mode) => mode === "flight")
  ) {
    return {
      participant,
      reason: `inatteignable pour ${label} depuis ${city} (avion refusé)`,
    };
  }

  if (participant.maxTravelHours != null && Number(participant.maxTravelHours) > 0) {
    const modesToEvaluate = plausibleModes.length
      ? modeIntersection(plausibleModes, participant.transportModes)
      : participant.transportModes?.length
        ? normalizeTransportModes(participant.transportModes)
        : ["flight", "train", "car"];

    if (!modesToEvaluate.length) {
      return {
        participant,
        reason: `inatteignable pour ${label} depuis ${city} (aucun mode accepté plausible)`,
      };
    }

    const options = estimateOptionsByMode(distanceKm, modesToEvaluate);
    const reachable = options.some(
      (option) => option.durationHours <= Number(participant.maxTravelHours),
    );
    if (!reachable) {
      return {
        participant,
        reason: `inatteignable pour ${label} depuis ${city} (plus de ${Number(participant.maxTravelHours)} h)`,
      };
    }
  }

  return null;
}

export function findCandidateTransportForOrigin(
  transport: Record<string, CandidateTransportInfo> | undefined,
  city: string,
): CandidateTransportInfo | null {
  if (!transport) return null;
  const key = normalizeCityKey(city);
  for (const [origin, info] of Object.entries(transport)) {
    if (normalizeCityKey(origin) === key) return info;
  }
  return null;
}
