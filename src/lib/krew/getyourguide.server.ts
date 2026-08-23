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

    // 1. Must be bookable mode only
    if (slot.activityMode !== "bookable") {
      return null;
    }

    // 2. Explicitly exclude restaurants, bars, brunchs, repas, free_exploration, self_guided_group, shopping, etc.
    if (
      slot.type === "resto" ||
      slot.type === "bar" ||
      slot.category === "repas" ||
      slot.category === "shopping" ||
      slot.category === "temps_libre" ||
      slot.category === "moment_maison" ||
      slot.category === "jeu_groupe" ||
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
    let queryBase = "";
    if (slot.label && slot.label.trim()) {
      queryBase = slot.label.trim();
    } else if (slot.suggestedPlace && slot.suggestedPlace.trim()) {
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
