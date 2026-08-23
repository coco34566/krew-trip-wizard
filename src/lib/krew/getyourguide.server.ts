import type { ActivitySlot, GroupItinerary } from "@/lib/krew/activity-ai.server";

export type GetYourGuideBooking = {
  provider: "getyourguide";
  url: string;
  type: "exact_product" | "search";
  affiliate: true;
};

const NORM_REGEX = /[\u0300-\u036f]/g;

function norm(str: unknown): string {
  return String(str ?? "")
    .normalize("NFD")
    .replace(NORM_REGEX, "")
    .toLowerCase()
    .trim();
}

/**
 * Checks if a candidate label or place string is manifestly generic relative to the destination.
 * A label is generic if it is empty, equals the destination, or brings no additional information.
 */
export function isGenericLabel(label: string | null | undefined, destination?: string | null): boolean {
  if (!label || typeof label !== "string") return true;
  const normLabel = norm(label);
  if (!normLabel || normLabel.length < 3) return true;

  if (destination) {
    const normDest = norm(destination);
    const primaryCity = normDest.split(",")[0]?.trim() ?? normDest;
    if (normLabel === normDest || normLabel === primaryCity) return true;
  }

  const genericPureLabels = new Set([
    "ville", "city", "centre-ville", "centre ville", "destination",
  ]);

  return genericPureLabels.has(normLabel);
}

function isGetYourGuideUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return u.hostname.includes("getyourguide.");
  } catch {
    return false;
  }
}

export function isGetYourGuideProductUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (!u.hostname.includes("getyourguide.")) return false;
    const path = u.pathname;
    return /-t\d+(\/|$)/i.test(path) || /-tc\d+(\/|$)/i.test(path) || /\/(activity|tour)\//i.test(path);
  } catch {
    return false;
  }
}

/**
 * Generates an optional affiliate booking object for a single activity slot.
 * Pure function: never mutates the received slot.
 * Fail-open: returns null on any error or missing configuration.
 */
export function buildGetYourGuideBooking(
  slot: ActivitySlot,
  destination?: string | null,
): GetYourGuideBooking | null {
  try {
    const affiliateId = process.env["GYG_AFFILIATE_ID"];
    if (!affiliateId || affiliateId.trim() === "") {
      return null;
    }

    // 1. Reject explicit non-bookable modes
    if (slot.activityMode === "free_exploration" || slot.activityMode === "self_guided_group") {
      return null;
    }

    // When activityMode is absent, check structured metadata for bookable experiences
    if (slot.activityMode !== "bookable") {
      const isBookableType = !slot.type || slot.type === "activite";
      const bookableCategories = [
        "local_experience",
        "culture",
        "sport_outdoor",
        "detente",
        "evenement",
        "soiree",
      ];
      const bookableVenueFamilies = [
        "local_experience",
        "culture",
        "sport",
        "spa_wellness",
      ];

      const isBookableCategory = slot.category ? bookableCategories.includes(slot.category) : false;
      const isBookableVenueFamily = slot.venueFamily ? bookableVenueFamilies.includes(slot.venueFamily) : false;

      if (!isBookableType || (!isBookableCategory && !isBookableVenueFamily)) {
        return null;
      }
    }

    // 2. Explicitly exclude restaurants, bars, brunchs, repas, shopping, transport, free exploration categories
    if (
      slot.type === "resto" ||
      slot.type === "bar" ||
      slot.type === "transport" ||
      slot.type === "libre" ||
      slot.category === "repas" ||
      slot.category === "shopping" ||
      slot.category === "temps_libre" ||
      slot.category === "moment_maison" ||
      slot.category === "jeu_groupe" ||
      slot.category === "transport" ||
      slot.venueFamily === "restaurant" ||
      slot.venueFamily === "cafe" ||
      slot.venueFamily === "bar_pub" ||
      slot.venueFamily === "shopping"
    ) {
      return null;
    }

    const normText = norm(`${slot.label ?? ""} ${slot.category ?? ""} ${slot.searchIntent ?? ""} ${slot.venueFamily ?? ""}`);

    // Exclude restaurants, bars, meals
    if (/\b(restaurant|restaurants|bar|bars|brunch|brunchs|repas|diner|diners|dejeuner|dejeuners)\b/i.test(normText)) {
      return null;
    }

    // Exclude free market, shopping, free strolls, neighborhood exploration, public parks/beaches, autonomous exploration
    if (
      /\b(marche|marché|piac|market|shopping|promenade|balade|flanerie|flânerie|quartier|parc|park|plage|beach)\b/i.test(normText)
    ) {
      const isGuidedOrBookableExperience = /\b(visite guidee|visite guidée|guided|tour|atelier|workshop|degustation|dégustation|tasting|excursion|croisiere|croisière|cruise|billet|ticket|entree|entrée|spectacle|show)\b/i.test(normText);
      if (!isGuidedOrBookableExperience) {
        return null;
      }
    }

    // CAS A: URL GetYourGuide exacte existante
    const existingGygUrl =
      (slot.url && isGetYourGuideUrl(slot.url) ? slot.url : null) ||
      (slot.suggestedUrl && isGetYourGuideUrl(slot.suggestedUrl) ? slot.suggestedUrl : null);

    if (existingGygUrl) {
      const isProduct = isGetYourGuideProductUrl(existingGygUrl);
      const bookingType = isProduct ? "exact_product" : "search";

      try {
        const u = new URL(existingGygUrl);
        u.searchParams.set("partner_id", affiliateId.trim());
        return {
          provider: "getyourguide",
          url: u.toString(),
          type: bookingType,
          affiliate: true,
        };
      } catch {
        // Fallback to query param string manipulation if URL parsing fails
        const sep = existingGygUrl.includes("?") ? "&" : "?";
        return {
          provider: "getyourguide",
          url: `${existingGygUrl}${sep}partner_id=${encodeURIComponent(affiliateId.trim())}`,
          type: bookingType,
          affiliate: true,
        };
      }
    }

    // CAS B: Pas d'URL GetYourGuide exacte -> Lien de recherche
    // Priority order: 1. slot.label -> 2. slot.suggestedPlace -> 3. slot.searchIntent
    // Safeguard: ignore labels that are generic (e.g. equal to destination or city)
    let queryBase = "";
    if (slot.label && !isGenericLabel(slot.label, destination)) {
      queryBase = slot.label.trim();
    } else if (slot.suggestedPlace && !isGenericLabel(slot.suggestedPlace, destination)) {
      queryBase = slot.suggestedPlace.trim();
    } else if (slot.searchIntent && slot.searchIntent.trim()) {
      queryBase = slot.searchIntent.trim();
    }

    if (!queryBase) {
      return null;
    }

    let finalQuery = queryBase;
    if (destination && destination.trim()) {
      const destTrim = destination.trim();
      if (!norm(finalQuery).includes(norm(destTrim))) {
        finalQuery = `${finalQuery} ${destTrim}`;
      }
    }

    const searchUrl = `https://www.getyourguide.fr/s/?q=${encodeURIComponent(finalQuery)}&partner_id=${encodeURIComponent(affiliateId.trim())}`;

    return {
      provider: "getyourguide",
      url: searchUrl,
      type: "search",
      affiliate: true,
    };
  } catch {
    return null;
  }
}

/**
 * Enriches a GroupItinerary with GetYourGuide affiliate booking links after planning is built.
 * Pure function: returns a new itinerary without mutating the input object or its slots.
 */
export function enrichGroupItineraryWithGetYourGuide(
  itinerary: GroupItinerary,
): GroupItinerary {
  try {
    if (!itinerary || !Array.isArray(itinerary.days)) {
      return itinerary;
    }

    const enrichedDays = itinerary.days.map((dayPlan) => {
      if (!dayPlan || !Array.isArray(dayPlan.slots)) {
        return dayPlan;
      }

      const enrichedSlots = dayPlan.slots.map((slot) => {
        const booking = buildGetYourGuideBooking(slot, itinerary.destination);
        return {
          ...slot,
          booking,
        };
      });

      return {
        ...dayPlan,
        slots: enrichedSlots,
      };
    });

    return {
      ...itinerary,
      days: enrichedDays,
    };
  } catch {
    return itinerary;
  }
}
