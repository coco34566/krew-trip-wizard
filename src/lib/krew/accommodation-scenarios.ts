/**
 * Construction pure de scénarios d'hébergement pour un groupe.
 *
 * Règle produit : sans demande explicite de chambre solo, 2 personnes
 * par chambre est le défaut. Les demandes solo sont isolées, puis le reste
 * est réparti en chambres doubles.
 */

export type RoomPreference = {
  userId?: string | null;
  acceptsSharedRoom?: boolean | null;
  roomTypePreference?: string | null;
};

export type AccommodationScenarioInput = {
  participants: number;
  nights: number;
  pricePerNightPerPerson: number;
  type: string;
  capacity: number;
  roomPreferences?: RoomPreference[];
  cleaningFee?: number;
  serviceFee?: number;
  taxes?: number;
};

export type AccommodationScenario = {
  units: { kind: "solo" | "double" | "shared" | "entire"; count: number }[];
  privateRooms: number;
  sharedRooms: number;
  peoplePerRoomDefault: number;
  totalCost: number;
  pricePerPerson: number;
  explanation: string;
};

function wantsSolo(pref: RoomPreference): boolean {
  const value = String(pref.roomTypePreference ?? "").toLowerCase().trim();
  return value.includes("solo") || value.includes("single") || pref.acceptsSharedRoom === false;
}

/**
 * Construit la configuration de chambres par défaut du groupe.
 * Les participants demandant une chambre individuelle sont isolés ; les autres
 * sont regroupés par 2, sauf si le logement est un logement entier.
 */
export function buildDefaultRoomScenario(input: AccommodationScenarioInput): AccommodationScenario {
  const participants = Math.max(1, Math.floor(input.participants));
  const soloCount = Math.min(
    participants,
    (input.roomPreferences ?? []).filter(wantsSolo).length,
  );
  const remaining = Math.max(0, participants - soloCount);
  const doubleCount = Math.ceil(remaining / 2);
  const isEntire = /villa|maison|g[iî]te|chalet|appartement|entier|entire/i.test(input.type);

  const units: AccommodationScenario["units"] = [];
  if (isEntire) {
    units.push({ kind: "entire", count: 1 });
  } else {
    if (soloCount) units.push({ kind: "solo", count: soloCount });
    if (doubleCount) units.push({ kind: "double", count: doubleCount });
  }

  const base = Math.max(0, input.pricePerNightPerPerson) * participants * Math.max(1, input.nights);
  const extras = Math.max(0, input.cleaningFee ?? 0) + Math.max(0, input.serviceFee ?? 0) + Math.max(0, input.taxes ?? 0);
  const totalCost = Math.round(base + extras);

  const privateRooms = isEntire ? Math.ceil(participants / 2) : soloCount + doubleCount;
  const explanation = isEntire
    ? `Logement entier pour ${participants} personnes, avec une organisation des couchages adaptée au groupe.`
    : soloCount
      ? `${soloCount} chambre${soloCount > 1 ? "s" : ""} solo demandée${soloCount > 1 ? "s" : ""}, puis chambres doubles par défaut pour les autres.`
      : `${doubleCount} chambre${doubleCount > 1 ? "s" : ""} double${doubleCount > 1 ? "s" : ""} par défaut, soit 2 personnes par chambre autant que possible.`;

  return {
    units,
    privateRooms,
    sharedRooms: 0,
    peoplePerRoomDefault: 2,
    totalCost,
    pricePerPerson: Math.round(totalCost / participants),
    explanation,
  };
}
