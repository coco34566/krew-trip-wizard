import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  buildGetYourGuideBooking,
  enrichGroupItineraryWithGetYourGuide,
  isGetYourGuideProductUrl,
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

  // 1. URL GYG exacte produit → exact_product + partner_id
  it("1. URL GYG exacte produit -> exact_product + partner_id", () => {
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

  // URL GYG générique/destination -> type: search
  it("URL GYG search/destination générique -> type: search", () => {
    const slot: ActivitySlot = {
      moment: "Après-midi",
      type: "activite",
      category: "culture",
      label: "Découverte de Paris",
      activityMode: "bookable",
      url: "https://www.getyourguide.fr/paris-l16/",
    };

    const booking = buildGetYourGuideBooking(slot, "Paris");
    expect(booking).not.toBeNull();
    expect(booking?.type).toBe("search");
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

  // 4. Rudas Gyógyfürdő és Uszoda + Budapest -> requête basée sur ce nom précis et pas le searchIntent générique
  it("Rudas Gyógyfürdő és Uszoda + Budapest -> requete basée sur le nom exact du slot", () => {
    const slot: ActivitySlot = {
      moment: "Après-midi",
      type: "activite",
      category: "detente",
      label: "Rudas Gyógyfürdő és Uszoda",
      searchIntent: "thermes historiques et espace spa relaxant à Budapest",
      activityMode: "bookable",
    };

    const booking = buildGetYourGuideBooking(slot, "Budapest");
    expect(booking).not.toBeNull();
    expect(booking?.type).toBe("search");
    expect(booking?.url).toContain("q=Rudas%20Gy%C3%B3gyf%C3%BCrd%C5%91%20%C3%A9s%20Uszoda%20Budapest");
    expect(booking?.url).not.toContain("thermes%20historiques");
  });

  // 5. G1 Gokart Center -> même comportement basé sur le nom
  it("G1 Gokart Center -> requete basée sur le nom exact", () => {
    const slot: ActivitySlot = {
      moment: "Après-midi",
      type: "activite",
      category: "sport_outdoor",
      label: "G1 Gokart Center",
      searchIntent: "session de karting indoor à Budapest",
      activityMode: "bookable",
    };

    const booking = buildGetYourGuideBooking(slot, "Budapest");
    expect(booking).not.toBeNull();
    expect(booking?.type).toBe("search");
    expect(booking?.url).toContain("q=G1%20Gokart%20Center%20Budapest");
    expect(booking?.url).not.toContain("karting%20indoor");
  });

  // 6. Fallback vers suggestedPlace si label absent/vide
  it("fallback vers suggestedPlace si label est absent", () => {
    const slot: ActivitySlot = {
      moment: "Matin",
      type: "activite",
      category: "culture",
      label: "",
      suggestedPlace: "Szechenyi Baths",
      searchIntent: "bains thermaux a budapest",
      activityMode: "bookable",
    };

    const booking = buildGetYourGuideBooking(slot, "Budapest");
    expect(booking).not.toBeNull();
    expect(booking?.url).toContain("q=Szechenyi%20Baths%20Budapest");
  });

  // 7. Fallback vers searchIntent seulement si label et suggestedPlace absents
  it("fallback vers searchIntent seulement en dernier recours", () => {
    const slot: ActivitySlot = {
      moment: "Matin",
      type: "activite",
      category: "culture",
      label: "",
      suggestedPlace: null,
      searchIntent: "croisiere sur le danube",
      activityMode: "bookable",
    };

    const booking = buildGetYourGuideBooking(slot, "Budapest");
    expect(booking).not.toBeNull();
    expect(booking?.url).toContain("q=croisiere%20sur%20le%20danube%20Budapest");
  });

  // 8. Destination non dupliquée si déjà présente dans le nom/query
  it("destination non dupliquée si deja présente dans la requête", () => {
    const slot: ActivitySlot = {
      moment: "Après-midi",
      type: "activite",
      category: "detente",
      label: "Thermes Rudas Budapest",
      activityMode: "bookable",
    };

    const booking = buildGetYourGuideBooking(slot, "Budapest");
    expect(booking).not.toBeNull();
    expect(booking?.url).toContain("q=Thermes%20Rudas%20Budapest");
    expect(booking?.url).not.toContain("Budapest%20Budapest");
  });

  // 9. Exclusions : marché libre, shopping, promenade, parc, exploration autonome
  it("marché libre / shopping / promenade / parc / exploration autonome -> aucun booking GYG", () => {
    const slotMarche: ActivitySlot = {
      moment: "Matin",
      type: "activite",
      category: "shopping",
      label: "Fény utcai piac",
      searchIntent: "marché couvert populaire de Budapest",
      activityMode: "bookable",
    };

    const slotShopping: ActivitySlot = {
      moment: "Après-midi",
      type: "activite",
      category: "shopping",
      label: "Shopping rue Váci",
      activityMode: "bookable",
    };

    const slotPromenade: ActivitySlot = {
      moment: "Matin",
      type: "activite",
      category: "temps_libre",
      label: "Promenade libre le long du Danube",
      activityMode: "bookable",
    };

    const slotParc: ActivitySlot = {
      moment: "Après-midi",
      type: "activite",
      category: "detente",
      label: "Détente au parc de la ville",
      activityMode: "bookable",
    };

    expect(buildGetYourGuideBooking(slotMarche, "Budapest")).toBeNull();
    expect(buildGetYourGuideBooking(slotShopping, "Budapest")).toBeNull();
    expect(buildGetYourGuideBooking(slotPromenade, "Budapest")).toBeNull();
    expect(buildGetYourGuideBooking(slotParc, "Budapest")).toBeNull();
  });

  // 10. Vraie activité bookable -> booking GYG autorisé
  it("vraie activité bookable -> booking GYG autorisé", () => {
    const slotVisite: ActivitySlot = {
      moment: "Matin",
      type: "activite",
      category: "culture",
      label: "Visite guidée du Parlement de Budapest",
      activityMode: "bookable",
    };

    const slotDegustation: ActivitySlot = {
      moment: "Après-midi",
      type: "activite",
      category: "local_experience",
      label: "Dégustation de vins hongrois",
      activityMode: "bookable",
    };

    const slotExcursion: ActivitySlot = {
      moment: "Matin",
      type: "activite",
      category: "sport_outdoor",
      label: "Excursion en bateau à la Boucle du Danube",
      activityMode: "bookable",
    };

    expect(buildGetYourGuideBooking(slotVisite, "Budapest")).not.toBeNull();
    expect(buildGetYourGuideBooking(slotDegustation, "Budapest")).not.toBeNull();
    expect(buildGetYourGuideBooking(slotExcursion, "Budapest")).not.toBeNull();
  });

  // Targeted tests for activityMode absent scenarios
  describe("Slots without activityMode (activityMode absent)", () => {
    it("1. Budapest River Cruise (type: activite, category: local_experience, venueFamily: local_experience) sans activityMode -> booking GYG généré", () => {
      const slotBudapestCruise: ActivitySlot = {
        moment: "Soir",
        type: "activite",
        category: "local_experience",
        venueFamily: "local_experience",
        label: "Budapest River Cruise",
        searchIntent: "croisiere sur le danube avec verre de bienvenue",
      };

      const booking = buildGetYourGuideBooking(slotBudapestCruise, "Budapest");
      expect(booking).not.toBeNull();
      expect(booking?.provider).toBe("getyourguide");
      expect(booking?.type).toBe("search");
      expect(booking?.url).toContain("partner_id=test_affiliate_123");
      expect(booking?.url).toContain("q=Budapest%20River%20Cruise");
    });

    it("2. Une vraie expérience local_experience sans activityMode -> booking GYG", () => {
      const slot: ActivitySlot = {
        moment: "Après-midi",
        type: "activite",
        category: "local_experience",
        label: "Atelier poterie traditionnelle",
      };

      const booking = buildGetYourGuideBooking(slot, "Lisbonne");
      expect(booking).not.toBeNull();
      expect(booking?.type).toBe("search");
    });

    it("3. Une croisière sans activityMode -> booking GYG", () => {
      const slot: ActivitySlot = {
        moment: "Matin",
        type: "activite",
        category: "detente",
        venueFamily: "spa_wellness",
        label: "Croisière promenade sur la Seine",
      };

      const booking = buildGetYourGuideBooking(slot, "Paris");
      expect(booking).not.toBeNull();
      expect(booking?.type).toBe("search");
    });

    it("4. Dégustation / atelier / excursion clairement réservable sans activityMode -> booking GYG", () => {
      const slotDegustation: ActivitySlot = {
        moment: "Après-midi",
        type: "activite",
        category: "local_experience",
        label: "Dégustation de tapas & vin",
      };

      const slotAtelier: ActivitySlot = {
        moment: "Matin",
        type: "activite",
        category: "culture",
        label: "Atelier cours de cuisine paëlla",
      };

      const slotExcursion: ActivitySlot = {
        moment: "Matin",
        type: "activite",
        category: "sport_outdoor",
        venueFamily: "sport",
        label: "Excursion en buggy dans les dunes",
      };

      expect(buildGetYourGuideBooking(slotDegustation, "Séville")).not.toBeNull();
      expect(buildGetYourGuideBooking(slotAtelier, "Valence")).not.toBeNull();
      expect(buildGetYourGuideBooking(slotExcursion, "Fuerteventura")).not.toBeNull();
    });

    it("5. Restaurant sans activityMode -> aucun booking", () => {
      const slotResto: ActivitySlot = {
        moment: "Midi",
        type: "resto",
        category: "repas",
        label: "Déjeuner au bistrot du port",
      };

      expect(buildGetYourGuideBooking(slotResto, "Marseille")).toBeNull();
    });

    it("6. Bar sans activityMode -> aucun booking", () => {
      const slotBar: ActivitySlot = {
        moment: "Soir",
        type: "bar",
        category: "soiree",
        label: "Cocktails en terrasse",
      };

      expect(buildGetYourGuideBooking(slotBar, "Nice")).toBeNull();
    });

    it("7. Marché/shopping libre sans activityMode -> aucun booking", () => {
      const slotShopping: ActivitySlot = {
        moment: "Après-midi",
        type: "activite",
        category: "shopping",
        label: "Shopping au centre commercial",
      };

      const slotMarche: ActivitySlot = {
        moment: "Matin",
        type: "activite",
        category: "culture",
        label: "Marché aux puces",
        searchIntent: "promenade marché aux puces libre",
      };

      expect(buildGetYourGuideBooking(slotShopping, "Milan")).toBeNull();
      expect(buildGetYourGuideBooking(slotMarche, "Paris")).toBeNull();
    });

    it("8. free_exploration -> aucun booking même si le label pourrait sembler réservable", () => {
      const slotFree: ActivitySlot = {
        moment: "Après-midi",
        type: "activite",
        category: "local_experience",
        label: "Visite guidée croisière sur le Danube",
        activityMode: "free_exploration",
      };

      expect(buildGetYourGuideBooking(slotFree, "Budapest")).toBeNull();
    });

    it("9. self_guided_group -> aucun booking", () => {
      const slotSelfGuided: ActivitySlot = {
        moment: "Soir",
        type: "activite",
        category: "jeu_groupe",
        label: "Grand quiz de la mariée au logement",
        activityMode: "self_guided_group",
      };

      expect(buildGetYourGuideBooking(slotSelfGuided, "Lyon")).toBeNull();
    });
  });

  // Activité category: "soiree" mais type: "activite" → booking GYG autorisé
  it("Activité category: 'soiree' mais type: 'activite' -> booking GYG autorisé", () => {
    const slotSoiree: ActivitySlot = {
      moment: "Soir",
      type: "activite",
      category: "soiree",
      label: "Spectacle au cabaret & croisière nocturne",
      searchIntent: "spectacle cabaret paris",
      activityMode: "bookable",
    };

    const booking = buildGetYourGuideBooking(slotSoiree, "Paris");
    expect(booking).not.toBeNull();
    expect(booking?.type).toBe("search");
    expect(booking?.provider).toBe("getyourguide");
  });

  // 11. restaurant / bar → booking = null
  it("restaurant et bar -> booking = null", () => {
    const slotRestoType: ActivitySlot = {
      moment: "Midi",
      type: "resto",
      category: "repas",
      label: "Déjeuner au bistrot",
      activityMode: "bookable",
    };

    const slotBarType: ActivitySlot = {
      moment: "Soir",
      type: "bar",
      category: "soiree",
      label: "Apéro au rooftop",
      activityMode: "bookable",
    };

    expect(buildGetYourGuideBooking(slotRestoType, "Paris")).toBeNull();
    expect(buildGetYourGuideBooking(slotBarType, "Barcelone")).toBeNull();
  });

  // 12. free_exploration et self_guided_group → booking = null
  it("free_exploration et self_guided_group -> booking = null", () => {
    const slotFree: ActivitySlot = {
      moment: "Après-midi",
      type: "activite",
      category: "culture",
      label: "Promenade dans le quartier historique",
      activityMode: "free_exploration",
    };

    const slotSelfGuided: ActivitySlot = {
      moment: "Soir",
      type: "libre",
      category: "jeu_groupe",
      label: "Blind test au logement",
      activityMode: "self_guided_group",
    };

    expect(buildGetYourGuideBooking(slotFree, "Lisbonne")).toBeNull();
    expect(buildGetYourGuideBooking(slotSelfGuided, "Bordeaux")).toBeNull();
  });

  // 13. variable GYG_AFFILIATE_ID absente → booking = null
  it("variable GYG_AFFILIATE_ID absente -> booking = null", () => {
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

  // Helper detection product url tests
  it("isGetYourGuideProductUrl détecte correctement les fiches produit", () => {
    expect(isGetYourGuideProductUrl("https://www.getyourguide.fr/paris-l16/visite-guidee-t12345/")).toBe(true);
    expect(isGetYourGuideProductUrl("https://www.getyourguide.com/rome-l33/colosseum-tour-tc42/")).toBe(true);
    expect(isGetYourGuideProductUrl("https://www.getyourguide.fr/paris-l16/")).toBe(false);
    expect(isGetYourGuideProductUrl("https://www.getyourguide.fr/s/?q=paris")).toBe(false);
  });

  // 14. test d’invariance critique
  it("test d’invariance critique : suppression de booking redonne l’objet initial strictly identical", () => {
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
              moment: "Soir",
              type: "activite",
              category: "soiree",
              label: "Croisière nocturne avec concert",
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
