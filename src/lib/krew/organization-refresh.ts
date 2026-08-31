export type OrganizationRefreshReason = "dates" | "destination";
export type OrganizationRefreshSection = "accommodation" | "transport" | "itinerary" | "tasks";

type JsonRecord = Record<string, unknown>;

export type OrganizationRefreshItem = {
  section: OrganizationRefreshSection;
  reasons: OrganizationRefreshReason[];
  invalidatedAt: string | null;
};

export type OrganizationRefreshState = {
  items: OrganizationRefreshItem[];
  reasons: OrganizationRefreshReason[];
  changedAt: string | null;
  destinationName: string | null;
};

const SECTION_KEYS: OrganizationRefreshSection[] = [
  "accommodation",
  "transport",
  "itinerary",
  "tasks",
];

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asReason(value: unknown): OrganizationRefreshReason | null {
  return value === "dates" || value === "destination" ? value : null;
}

export function getOrganizationRefreshState(logistics: unknown): OrganizationRefreshState | null {
  const root = asRecord(logistics);
  const refresh = asRecord(root["organizationRefresh"]);
  const rawSections = asRecord(refresh["sections"]);

  const items = SECTION_KEYS.flatMap((section) => {
    const raw = asRecord(rawSections[section]);
    if (raw["stale"] !== true) return [];

    const reasons = Array.isArray(raw["reasons"])
      ? raw["reasons"].map(asReason).filter((reason): reason is OrganizationRefreshReason => Boolean(reason))
      : [];

    return [{
      section,
      reasons: [...new Set(reasons)],
      invalidatedAt: typeof raw["invalidatedAt"] === "string" ? raw["invalidatedAt"] : null,
    }];
  });

  if (!items.length) return null;

  const reasons = [
    ...new Set(items.flatMap((item) => item.reasons)),
  ] as OrganizationRefreshReason[];

  return {
    items,
    reasons,
    changedAt: typeof refresh["changedAt"] === "string" ? refresh["changedAt"] : null,
    destinationName:
      typeof refresh["destinationName"] === "string" ? refresh["destinationName"] : null,
  };
}

export function hasOrganizationRefreshSection(
  logistics: unknown,
  section: OrganizationRefreshSection,
): boolean {
  return Boolean(
    getOrganizationRefreshState(logistics)?.items.some((item) => item.section === section),
  );
}

/**
 * Dashboard-only projection: stale data stays persisted and visible in its real section,
 * but it must not make the dashboard claim that the organization is current.
 */
export function maskStaleOrganizationDataForDashboard<T extends Record<string, unknown>>(trip: T): T {
  const logistics = asRecord(trip["group_logistics"]);
  const refresh = getOrganizationRefreshState(logistics);
  if (!refresh) return trip;

  const stale = new Set(refresh.items.map((item) => item.section));
  const maskedLogistics: JsonRecord = { ...logistics };
  const maskedTrip: JsonRecord = { ...trip };

  if (stale.has("accommodation")) {
    maskedLogistics["hotels"] = [];
    maskedLogistics["selectedHotelId"] = null;
  }
  if (stale.has("transport")) {
    maskedLogistics["transports"] = [];
  }
  if (stale.has("itinerary")) {
    maskedTrip["group_itinerary"] = null;
  }

  maskedTrip["group_logistics"] = maskedLogistics;
  return maskedTrip as T;
}
