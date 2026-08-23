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

    // 2. Explicitly exclude restaurants, bars, brunchs, repas, free_exploration, self_guided_group
    if (
      slot.type === "resto" ||
      slot.type === "bar" ||
      slot.category === "repas" ||
      slot.category === "soiree" ||
      slot.venueFamily === "restaurant" ||
      slot.venueFamily === "cafe" ||
      slot.venueFamily === "bar_pub"
    ) {
      return null;
    }

    const normText = norm(`${slot.label ?? ""} ${slot.category ?? ""} ${slot.searchIntent ?? ""}`);
    if (/\b(restaurant|restaurants|bar|bars|brunch|brunchs|repas|diner|diners|dejeuner|dejeuners)\b/i.test(normText)) {
      return null;
    }

    // CAS A: URL GetYourGuide exacte existante
    const existingGygUrl =
      (slot.url && isGetYourGuideUrl(slot.url) ? slot.url : null) ||
      (slot.suggestedUrl && isGetYourGuideUrl(slot.suggestedUrl) ? slot.suggestedUrl : null);

    if (existingGygUrl) {
      try {
        const u = new URL(existingGygUrl);
        u.searchParams.set("partner_id", affiliateId.trim());
        return {
          provider: "getyourguide",
          url: u.toString(),
          type: "exact_product",
          affiliate: true,
        };
      } catch {
        // Fallback to query param string manipulation if URL parsing fails
        const sep = existingGygUrl.includes("?") ? "&" : "?";
        return {
          provider: "getyourguide",
          url: `${existingGygUrl}${sep}partner_id=${encodeURIComponent(affiliateId.trim())}`,
          type: "exact_product",
          affiliate: true,
        };
      }
    }

    // CAS B: Pas d'URL GetYourGuide exacte -> Lien de recherche
    let queryBase = "";
    if (slot.searchIntent && slot.searchIntent.trim()) {
      queryBase = slot.searchIntent.trim();
    } else if (slot.suggestedPlace && slot.suggestedPlace.trim()) {
      const place = slot.suggestedPlace.trim();
      const label = (slot.label || "").trim();
      if (label && norm(place) !== norm(label)) {
        queryBase = `${place} ${label}`;
      } else {
        queryBase = place;
      }
    } else if (slot.label && slot.label.trim()) {
      queryBase = slot.label.trim();
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
