export type TransportPickLike = {
  userId?: string | null;
  participantId?: string | null;
  displayName?: string | null;
  city?: string | null;
  mode?: string | null;
  modeLabel?: string | null;
  label?: string | null;
  outboundDepartureTime?: string | null;
  arrivalTime?: string | null;
  departureTime?: string | null;
  returnArrivalTime?: string | null;
  status?: string | null;
  stale?: boolean | null;
  sharedGroupId?: string | null;
  isDriver?: boolean | null;
  passengerCapacity?: number | null;
  driverParticipantId?: string | null;
  driverDisplayName?: string | null;
};

export type TransportParticipantLike = {
  id?: string | null;
  user_id?: string | null;
  display_name?: string | null;
  email?: string | null;
  departure_city?: string | null;
  status?: string | null;
  placeholder?: boolean | null;
};

export function normalizeTransportCity(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("fr-FR");
}

function slug(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function transportShareKey(input: Partial<TransportPickLike>) {
  if (input.sharedGroupId) return input.sharedGroupId;
  return [
    slug(input.city),
    slug(input.mode),
    slug(input.label),
    slug(input.outboundDepartureTime),
    slug(input.arrivalTime),
  ]
    .filter(Boolean)
    .join(":");
}

export function isCarMode(mode: unknown) {
  const value = slug(mode);
  return value.includes("voiture") || value.includes("car");
}

export function pickIdentity(pick: Partial<TransportPickLike>) {
  return pick.participantId || pick.userId || null;
}

export function groupTransportPicks(picks: TransportPickLike[]) {
  const groups = new Map<string, TransportPickLike[]>();
  for (const pick of picks.filter((item) => !item?.stale)) {
    const key = transportShareKey(pick) || `solo:${pickIdentity(pick) || Math.random()}`;
    const list = groups.get(key) ?? [];
    list.push(pick);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([id, members]) => {
    const first = members[0] ?? {};
    const driver = members.find((member) => member.isDriver);
    const capacity = Math.max(0, Number(driver?.passengerCapacity ?? 0));
    const passengerCount = driver ? Math.max(0, members.length - 1) : 0;
    return {
      id,
      city: first.city || "",
      mode: first.modeLabel || first.mode || "Transport",
      label: first.label || "",
      outboundDepartureTime: first.outboundDepartureTime || null,
      arrivalTime: first.arrivalTime || null,
      members,
      driver: driver ?? null,
      passengerCapacity: capacity,
      passengerCount,
      seatsLeft: driver ? Math.max(0, capacity - passengerCount) : null,
    };
  });
}

export function buildTransportDashboardSummary(input: {
  picks: TransportPickLike[];
  participants: TransportParticipantLike[];
  expectedCount?: number | null;
}) {
  const activeParticipants = input.participants.filter(
    (participant) => participant.status !== "absent" && participant.status !== "refuse",
  );
  const pickedIds = new Set(input.picks.filter((pick) => !pick.stale).map(pickIdentity).filter(Boolean));
  const missing = activeParticipants.filter((participant) => {
    const id = participant.id || participant.user_id;
    return id ? !pickedIds.has(id) && !pickedIds.has(participant.user_id || "") : false;
  });
  const expected = Math.max(
    Number(input.expectedCount ?? 0),
    activeParticipants.length,
    input.picks.length,
  );
  const organized = Math.min(expected, new Set(input.picks.filter((pick) => !pick.stale).map(pickIdentity).filter(Boolean)).size);
  return {
    expected,
    organized,
    missing,
    groups: groupTransportPicks(input.picks),
  };
}

export function transportTaskLabel(pick?: TransportPickLike | null) {
  if (!pick) return "Choisir mon transport";
  if (pick.stale) return "Vérifier mon transport";
  if (pick.status === "réservé") return null;
  if (pick.driverParticipantId && !pick.isDriver) {
    return `Confirmer ma place${pick.driverDisplayName ? ` avec ${pick.driverDisplayName}` : ""}`;
  }
  if (isCarMode(pick.mode)) {
    return pick.isDriver ? "Confirmer ma voiture et mes passagers" : "Confirmer mon trajet";
  }
  return "Réserver mon transport";
}
