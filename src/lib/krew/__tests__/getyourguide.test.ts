import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  buildGetYourGuideBooking,
  enrichGroupItineraryWithGetYourGuide,
} from "@/lib/krew/getyourguide.server";
import type { ActivitySlot, GroupItinerary } from "@/lib/krew/activity-ai.server";

describe("GetYourGuide Enrichment Server Engine", () => {
  const originalEnv = process.env["GYG_AFFILIATE_ID"];

  beforeEach(() => {
    process.env["GYG_AFFILIATE_ID"] = "test_affiliate_123";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env["GYG_AFFILIATE_ID"] = originalEnv;
    } else {
      delete process.env["GYG_AFFILIATE_ID"];
    }
  });

  // 1. URL GYG exacte sans paramètres → ajout du partner_id
  it("1. URL GYG exacte sans paramètres -> ajout du partner_id", () => {
    const slot: ActivitySlot = {
      moment: "Matin",
      type: "activite",
      category: "culture",
      label: "Visite guidée du musée",
      activityMode: "bookable",
      url: "https://www.getyourguide.fr/paris-l16/visite-guidee-t12345/",
    };

    const booking = buildGetYourGuideBooking(slot, "Paris");
    expect(booking).not.toBeNull();
    expect(booking?.type).toBe("exact_product");
    expect(booking?.provider).toBe("getyourguide");
    expect(booking?.affiliate).toBe(true);
    expect(booking?.url).toContain("partner_id=test_affiliate_123");
  });

  // 2. URL GYG exacte avec paramètres existants → paramètres conservés + partner_id
  it("2. URL GYG exacte avec paramètres existants -> paramètres conservés + partner_id", () => {
    const slot: ActivitySlot = {
      moment: "Après-midi",
      type: "activite",
      category: "culture",
      label: "Tour en bateau",
      activityMode: "bookable",
      url: "https://www.getyourguide.fr/paris-l16/tour-en-bateau-t9999/?lang=fr&currency=EUR",
    };

    const booking = buildGetYourGuideBooking(slot, "Paris");
    expect(booking).not.toBeNull();
    expect(booking?.type).toBe("exact_product");
    expect(booking?.url).toContain("lang=fr");
    expect(booking?.url).toContain("currency=EUR");
    expect(booking?.url).toContain("partner_id=test_affiliate_123");
  });

  // 3. URL GYG avec ancien partner_id → remplacement par la valeur de GYG_AFFILIATE_ID
  it("3. URL GYG avec ancien partner_id -> remplacement par la valeur de GYG_AFFILIATE_ID", () => {
    const slot: ActivitySlot = {
      moment: "Soir",
      type: "activite",
      category: "culture",
      label: "Spectacle du soir",
      activityMode: "bookable",
      url: "https://www.getyourguide.fr/paris-l16/spectacle-t5555/?partner_id=old_partner_999",
    };

    const booking = buildGetYourGuideBooking(slot, "Paris");
    expect(booking).not.toBeNull();
    expect(booking?.type).toBe("exact_product");
    expect(booking?.url).not.toContain("old_partner_999");
    expect(booking?.url).toContain("partner_id=test_affiliate_123");
  });

  // 4. activité bookable non-GYG → création d’un lien de recherche GYG
  it("4. activité bookable non-GYG -> création d’un lien de recherche GYG", () => {
    const slot: ActivitySlot = {
      moment: "Matin",
      type: "activite",
      category: "sport_outdoor",
      label: "Kayak sur le lac",
      searchIntent: "kayak sur le lac annecy",
      activityMode: "bookable",
      url: "https://www.annecy-kayak.com",
    };

    const booking = buildGetYourGuideBooking(slot, "Annecy");
    expect(booking).not.toBeNull();
    expect(booking?.type).toBe("search");
    expect(booking?.provider).toBe("getyourguide");
    expect(booking?.affiliate).toBe(true);
    expect(booking?.url).toContain("https://www.getyourguide.fr/s/?q=");
    expect(booking?.url).toContain("partner_id=test_affiliate_123");
    expect(booking?.url).toContain("kayak");
  });

  // 5. restaurant → booking = null
  it("5. restaurant -> booking = null", () => {
    const slotRestoType: ActivitySlot = {
      moment: "Midi",
      type: "resto",
      category: "repas",
      label: "Déjeuner au bistrot",
      activityMode: "bookable",
    };

    const slotRestoCat: ActivitySlot = {
      moment: "Soir",
      type: "activite",
      category: "repas",
      label: "Dîner gastronomique",
      venueFamily: "restaurant",
      activityMode: "bookable",
    };

    expect(buildGetYourGuideBooking(slotRestoType, "Paris")).toBeNull();
    expect(buildGetYourGuideBooking(slotRestoCat, "Paris")).toBeNull();
  });

  // 6. bar → booking = null
  it("6. bar -> booking = null", () => {
    const slotBarType: ActivitySlot = {
      moment: "Soir",
      type: "bar",
      category: "soiree",
      label: "Apéro au rooftop",
      venueFamily: "bar_pub",
      activityMode: "bookable",
    };

    expect(buildGetYourGuideBooking(slotBarType, "Barcelone")).toBeNull();
  });

  // 7. free_exploration → booking = null
  it("7. free_exploration -> booking = null", () => {
    const slotFree: ActivitySlot = {
      moment: "Après-midi",
      type: "activite",
      category: "culture",
      label: "Promenade dans le quartier historique",
      activityMode: "free_exploration",
    };

    expect(buildGetYourGuideBooking(slotFree, "Lisbonne")).toBeNull();
  });

  // 8. self_guided_group → booking = null
  it("8. self_guided_group -> booking = null", () => {
    const slotSelfGuided: ActivitySlot = {
      moment: "Soir",
      type: "libre",
      category: "jeu_groupe",
      label: "Blind test au logement",
      activityMode: "self_guided_group",
    };

    expect(buildGetYourGuideBooking(slotSelfGuided, "Bordeaux")).toBeNull();
  });

  // 9. variable GYG_AFFILIATE_ID absente → booking = null
  it("9. variable GYG_AFFILIATE_ID absente -> booking = null", () => {
    delete process.env["GYG_AFFILIATE_ID"];

    const slot: ActivitySlot = {
      moment: "Matin",
      type: "activite",
      category: "culture",
      label: "Visite guidée",
      activityMode: "bookable",
    };

    expect(buildGetYourGuideBooking(slot, "Lyon")).toBeNull();
  });

  // 10. test d’invariance critique
  it("10. test d’invariance critique : suppression de booking redonne l’objet initial strictly identical", () => {
    const originalItinerary: GroupItinerary = {
      destination: "Annecy",
      nights: 2,
      source: "ai",
      provider: "krew_geoapify",
      generatedAt: "2026-08-23T10:00:00.000Z",
      days: [
        {
          day: 1,
          date: "2026-09-01",
          slots: [
            {
              moment: "Matin",
              type: "activite",
              category: "sport_outdoor",
              label: "Paddle sur le lac",
              detail: "Superbe moment sur l'eau",
              activityMode: "bookable",
              searchIntent: "paddle sur le lac d'annecy",
            },
            {
              moment: "Midi",
              type: "resto",
              category: "repas",
              label: "Déjeuner savoyard",
              activityMode: "bookable",
            },
            {
              moment: "Après-midi",
              type: "libre",
              category: "temps_libre",
              label: "Flânerie libre dans la vieille ville",
              activityMode: "free_exploration",
            },
          ],
        },
      ],
    };

    const enriched = enrichGroupItineraryWithGetYourGuide(originalItinerary);

    // Deep clone enriched and remove `booking` key from all slots
    const stripped = JSON.parse(JSON.stringify(enriched));
    for (const day of stripped.days) {
      for (const slot of day.slots) {
        delete slot.booking;
      }
    }

    expect(stripped).toEqual(originalItinerary);
  });
});
