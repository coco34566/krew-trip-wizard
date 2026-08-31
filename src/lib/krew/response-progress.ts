export type ResponseProgressParticipant = {
  user_id?: string | null;
  status?: unknown;
};

export type ResponseProgressInput = {
  ownerId: string;
  coOrganizerId?: string | null;
  starUserId?: string | null;
  starMode?: "secret" | "participant" | null;
  participants: ResponseProgressParticipant[];
  preferenceUserIds: Array<string | null | undefined>;
  availabilityUserIds: Array<string | null | undefined>;
  secretStarHasPreferences?: boolean;
  secretStarHasAvailability?: boolean;
};

export type ResponseProgress = {
  expectedUserIds: string[];
  preferencesExpected: number;
  preferencesAnswered: number;
  preferencesMissing: number;
  availabilityExpected: number;
  availabilityAnswered: number;
  availabilityMissing: number;
  secretStarExpected: boolean;
};

export function isInactiveResponseParticipant(status: unknown) {
  return status === "absent" || status === "refuse";
}

export function hasSecretStarPreferences(starPrefs: any): boolean {
  if (!starPrefs) return false;
  return Boolean(
    (Array.isArray(starPrefs.wanted_activities) && starPrefs.wanted_activities.length > 0) ||
      (Array.isArray(starPrefs.deal_breakers) && starPrefs.deal_breakers.length > 0) ||
      (Array.isArray(starPrefs.ambiances) && starPrefs.ambiances.length > 0) ||
      starPrefs.notes ||
      starPrefs.desired_destination ||
      (Array.isArray(starPrefs.excluded_destinations) && starPrefs.excluded_destinations.length > 0) ||
      starPrefs.wanted_env_type ||
      starPrefs.local_mobility ||
      starPrefs.accommodation_role,
  );
}

export function hasSecretStarAvailability(starPrefs: any): boolean {
  if (!starPrefs) return false;
  return Boolean(
    (Array.isArray(starPrefs.available_dates) && starPrefs.available_dates.length > 0) ||
      (Array.isArray(starPrefs.blocked_dates) && starPrefs.blocked_dates.length > 0),
  );
}

export function deriveResponseProgress(input: ResponseProgressInput): ResponseProgress {
  const inactiveUserIds = new Set(
    input.participants
      .filter((participant) => isInactiveResponseParticipant(participant.status))
      .map((participant) => participant.user_id)
      .filter((id): id is string => Boolean(id)),
  );

  const expectedUserIds = new Set<string>();
  if (input.ownerId && !inactiveUserIds.has(input.ownerId)) expectedUserIds.add(input.ownerId);

  for (const participant of input.participants) {
    if (!participant.user_id || isInactiveResponseParticipant(participant.status)) continue;
    expectedUserIds.add(participant.user_id);
  }

  if (input.coOrganizerId && !inactiveUserIds.has(input.coOrganizerId)) {
    expectedUserIds.add(input.coOrganizerId);
  }

  const secretStarExpected = input.starMode === "secret";
  if (secretStarExpected && input.starUserId) {
    expectedUserIds.delete(input.starUserId);
  } else if (
    input.starMode === "participant" &&
    input.starUserId &&
    !inactiveUserIds.has(input.starUserId)
  ) {
    expectedUserIds.add(input.starUserId);
  }

  const preferenceAnswers = new Set(
    input.preferenceUserIds.filter((id): id is string => Boolean(id) && expectedUserIds.has(id as string)),
  );
  const availabilityAnswers = new Set(
    input.availabilityUserIds.filter((id): id is string => Boolean(id) && expectedUserIds.has(id as string)),
  );

  const secretStarCount = secretStarExpected ? 1 : 0;
  const preferencesExpected = expectedUserIds.size + secretStarCount;
  const availabilityExpected = expectedUserIds.size + secretStarCount;
  const preferencesAnswered =
    preferenceAnswers.size + (secretStarExpected && input.secretStarHasPreferences ? 1 : 0);
  const availabilityAnswered =
    availabilityAnswers.size + (secretStarExpected && input.secretStarHasAvailability ? 1 : 0);

  return {
    expectedUserIds: [...expectedUserIds],
    preferencesExpected,
    preferencesAnswered,
    preferencesMissing: Math.max(preferencesExpected - preferencesAnswered, 0),
    availabilityExpected,
    availabilityAnswered,
    availabilityMissing: Math.max(availabilityExpected - availabilityAnswered, 0),
    secretStarExpected,
  };
}
