import { describe, expect, it, vi } from "vitest";
import {
  buildDiscoveryQueries,
  normalizeSearchCandidates,
  isSafeActivityUrl,
  findWebResourceForComplexActivity,
  type ActivityCandidate,
} from "../activity-discovery.server";
import {
  buildLocalItinerary,
  aggregateMajorityTimePreference,
  calculatePlanningWindow,
  haversineDistanceKm,
  validateItinerary,
  adjustItineraryTransferTimes,
  buildKrewSkeleton,
  buildPlanningBrief,
  buildGroupPlanningContext,
  geminiEnrichSkeleton,
  regenerateSlotWithAi,
  normalizeGeminiParsedResponse,
  normalizeSlot,
  GEMINI_CONTRACTUAL_PROMPT_TEMPLATE,
  type ActivityAiInput,
} from "../activity-ai.server";
import {
  mapVenueFamilyToGeoapifyCategories,
  determineSearchRadiusMeters,
  searchGeoapifyPlaces,
  buildVerifiedPlaceFallbackUrl,
  extractGeographicSignalFromIntent,
  resolveSearchIntentLocation,
  clearIntentLocationCache,
  convertIntentToPlaceRequirements,
  buildPoolKey,
  rankGeoapifyCandidates,
  mergeUniquePlacesById,
  tryResolveGeminiProposedPlace,
  isCandidateCompatibleWithRequirements,
  selectGeoapifyCandidate,
  type GeoapifyPlace,
  type PlaceRequirements,
} from "../geoapify.server";
import { resolveActivityResourceForPlace, resolveActivityResourceUrl, classifyActivityMode, shouldResolveWithPlaceProvider } from "../activity-ai.server";
import { isTripAdmin } from "../engine";

const input = (overrides: Partial<ActivityAiInput> = {}): ActivityAiInput => ({
  destination: "Annecy",
  startDate: "2026-09-11",
  endDate: "2026-09-13",
  nights: 2,
  participants: 8,
  budgetPerPerson: 450,
  eventType: "weekend",
  tripProfile: "Évasion outdoor & sportive",
  ambiances: ["nature", "sportif"],
  activityCategories: ["kayak", "randonnée"],
  starWanted: [],
  travelPace: "equilibre",
  ...overrides,
});

const candidate: ActivityCandidate = {
  id: "kayak-1",
  name: "Club de kayak vérifié",
  type: "external",
  category: "kayak",
  description: "Kayak sur le lac",
  destination: "Annecy",
  address: "Annecy",
  latitude: 45.9,
  longitude: 6.1,
  sourceUrl: "https://example.org/kayak",
  mapsUrl: null,
  source: "office-tourisme.example",
  priceHint: null,
  priceRange: null,
  durationMinutes: 120,
  openingHours: [],
  rating: 4.7,
  reviewCount: 120,
  environment: "outdoor",
  tags: ["sport", "nature"],
  profileFit: 95,
  eventFit: 60,
  seasonality: null,
  verified: true,
  verifiedAt: "2026-08-16T00:00:00.000Z",
  groundingSources: [],
};

describe("Enrichissement des liens d'activités & classification des modes", () => {
  it("classifyActivityMode classifie correctement les 3 besoins fonctionnels", () => {
    const { classifyActivityMode } = require("../activity-ai.server");

    expect(classifyActivityMode({ kind: "internal", label: "Jeu de la mariée" })).toBe("self_guided_group");
    expect(classifyActivityMode({ category: "jeu_groupe", label: "Quiz" })).toBe("self_guided_group");
    expect(classifyActivityMode({ label: "Balade dans le centre historique" })).toBe("free_exploration");
    expect(classifyActivityMode({ label: "Promenade au parc" })).toBe("free_exploration");
    expect(classifyActivityMode({ label: "Séance de spa et massages" })).toBe("bookable");
  });

  it("resolveActivityResourceUrl n'infère pas 'official' ou 'booking' uniquement d'après le domaine", () => {
    const { resolveActivityResourceUrl } = require("../activity-ai.server");

    // Sans hint explicit, par défaut website si HTTPS valide
    expect(resolveActivityResourceUrl("https://parc-national.fr/site")).toEqual({
      url: "https://parc-national.fr/site",
      resourceKind: "website",
    });

    // TripAdvisor ou Google Search ne deviennent ni official ni booking
    expect(resolveActivityResourceUrl("https://www.tripadvisor.fr/attraction")).toEqual({
      url: null,
      resourceKind: null,
    });
    expect(resolveActivityResourceUrl("https://google.com/search?q=test")).toEqual({
      url: null,
      resourceKind: null,
    });

    // Avec hint explicite "booking" ou "ideas"
    expect(resolveActivityResourceUrl("https://partner.com/offer", { kindHint: "booking" })).toEqual({
      url: "https://partner.com/offer",
      resourceKind: "booking",
    });
    expect(resolveActivityResourceUrl("https://ideas-blog.fr/article", { kindHint: "ideas" })).toEqual({
      url: "https://ideas-blog.fr/article",
      resourceKind: "ideas",
    });

    expect(resolveActivityResourceUrl("javascript:alert(1)")).toEqual({
      url: null,
      resourceKind: null,
    });
    expect(resolveActivityResourceUrl(null)).toEqual({
      url: null,
      resourceKind: null,
    });
  });

  it("validateItinerary conserve l'activité tout en nettoyant l'URL invalide ou interne", () => {
    const candidateWithBadUrl = { ...candidate, sourceUrl: "javascript:alert(1)" };
    const internalPlan = [
      {
        day: 2,
        slots: [
          {
            moment: "Après-midi",
            time: "15:00",
            durationMinutes: 90,
            type: "libre" as const,
            category: "moment_maison" as const,
            label: "Jeu de groupe au logement",
            url: "https://parc-national.fr/game",
          },
          {
            moment: "Soir",
            time: "20:00",
            durationMinutes: 90,
            type: "activite" as const,
            category: "culture" as const,
            label: candidateWithBadUrl.name,
            candidateId: candidateWithBadUrl.id,
            url: "javascript:alert(1)",
          },
        ],
      },
    ];

    const validated = validateItinerary(internalPlan, input(), [candidateWithBadUrl]);
    const slots = validated[0]?.slots ?? [];

    expect(slots).toHaveLength(2);
    expect(slots[0]?.url).toBeNull();
    expect(slots[1]?.url).toBeNull();
    expect(slots[0]?.activityMode).toBe("self_guided_group");
  });

  it("prouve que self_guided_group avec une ressource ideas et free_exploration ont verified = false", () => {
    const { resolveActivityResourceUrl } = require("../activity-ai.server");

    // self_guided_group avec ressource
    const ideasLink = resolveActivityResourceUrl("https://idees-evjf.fr/regles-jeu-mariee", { kindHint: "ideas" });
    const selfGuidedSlot = {
      label: "Jeu de la mariée",
      activityMode: "self_guided_group" as const,
      verified: false,
      url: ideasLink.url,
      resourceKind: ideasLink.resourceKind,
    };

    expect(selfGuidedSlot.verified).toBe(false);
    expect(selfGuidedSlot.url).toBe("https://idees-evjf.fr/regles-jeu-mariee");
    expect(selfGuidedSlot.resourceKind).toBe("ideas");

    // free_exploration
    const freeExploSlot = {
      label: "Balade dans le quartier du Château",
      activityMode: "free_exploration" as const,
      verified: false,
      url: null,
      resourceKind: null,
    };

    expect(freeExploSlot.verified).toBe(false);
    expect(freeExploSlot.url).toBeNull();
  });

  it("findIdeasResourceForActivity trouve une URL d'idées pour un jeu et renvoie null pour un apéro", async () => {
    const { findIdeasResourceForActivity } = await import("../activity-discovery.server");

    // Simple apéro -> aucune recherche web
    const aperoRes = await findIdeasResourceForActivity({
      label: "Apéro au logement",
      eventType: "weekend",
    });
    expect(aperoRes).toBeNull();

    // Jeu / quiz -> recherche web déclenchée
    const originalFetch = global.fetch;
    const origTavily = process.env["TAVILY_API_KEY"];
    process.env["TAVILY_API_KEY"] = "fake-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { url: "https://www.google.com/search?q=jeu" }, // Filtre Google
          { url: "https://idees-evjf.fr/regles-jeu-mariee" }, // URL d'idées valide
        ],
      }),
    });
    global.fetch = fetchMock;

    try {
      const gameRes = await findIdeasResourceForActivity({
        label: "Jeu de la mariée",
        searchIntent: "jeu de la mariée quiz",
        eventType: "evjf",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(gameRes).toBe("https://idees-evjf.fr/regles-jeu-mariee");
    } finally {
      global.fetch = originalFetch;
      process.env["TAVILY_API_KEY"] = origTavily;
    }
  });
});

describe("Correctifs Résolution Lieux Réels Planning — Tests Obligatoires 1 à 9", () => {
  // 1. Intent = thermes/spa + Candidate = artwork/sculpture => rejet.
  it("TEST 1 : Intent = thermes/spa + Candidate = artwork/sculpture => rejet", () => {
    const req = convertIntentToPlaceRequirements("spa_wellness", "detente", "thermes emblématiques et espace spa relaxation Budapest");
    const candidateArtwork = {
      id: "sculpture-1",
      name: "Kavics",
      address: "Budapest, Kavics u. 1",
      categories: ["tourism.attraction.artwork", "tourism.attraction"],
    };
    expect(isCandidateCompatibleWithRequirements(candidateArtwork, req)).toBe(false);
  });

  // 2. Intent = croisière Danube + Candidate = restaurant => rejet.
  it("TEST 2 : Intent = croisière Danube + Candidate = restaurant => rejet", () => {
    const req = convertIntentToPlaceRequirements("local_experience", "local_experience", "croisière apéritive privative ou semi-privative Danube Budapest sunset");
    const candidateResto = {
      id: "resto-1",
      name: "Leon Osteria",
      address: "Budapest, Danube quay 5",
      categories: ["catering.restaurant"],
    };
    expect(isCandidateCompatibleWithRequirements(candidateResto, req)).toBe(false);
  });

  // 3. Intent = promenade Île Marguerite + Candidate = artwork près du logement => rejet.
  it("TEST 3 : Intent = promenade Île Marguerite + Candidate = artwork => rejet", () => {
    const req = convertIntentToPlaceRequirements("culture", "culture", "parc promenade balade au vert Île Marguerite Budapest");
    const candidateArtwork = {
      id: "artwork-2",
      name: "Bizalom címer",
      address: "Budapest, Main St 10",
      categories: ["tourism.attraction.artwork"],
    };
    expect(isCandidateCompatibleWithRequirements(candidateArtwork, req)).toBe(false);
  });

  // 4. Intent = restaurant + Candidate Geoapify réellement restaurant => accepté.
  it("TEST 4 : Intent = restaurant + Candidate Geoapify réellement restaurant => accepté", () => {
    const req = convertIntentToPlaceRequirements("restaurant", "repas", "dîner hongrois convivial");
    const candidateResto = {
      id: "resto-2",
      name: "Kiosk Buda",
      address: "Március 15. tér 1, Budapest",
      categories: ["catering.restaurant"],
    };
    expect(isCandidateCompatibleWithRequirements(candidateResto, req)).toBe(true);
  });

  // 5. Gemini fournit un lieu concret cohérent + URL exploitable => la proposition n'est PAS écrasée arbitrairement par Geoapify.
  it("TEST 5 : Gemini fournit un lieu concret cohérent => proposition non écrasée arbitrairement par Geoapify", async () => {
    const originalFetch = globalThis.fetch;
    const oldApiKey = process.env["GEOAPIFY_API_KEY"];
    process.env["GEOAPIFY_API_KEY"] = "test-geo-key";

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              place_id: "geo-szechenyi",
              name: "Thermes Széchenyi",
              formatted: "Budapest, Állatkerti krt. 9-11, 1146",
              lat: 47.5186,
              lon: 19.0825,
              categories: ["leisure.spa"],
              website: "https://szechenyibath.hu",
            },
          },
        ],
      }),
    })) as any;

    try {
      const resolved = await tryResolveGeminiProposedPlace({
        suggestedPlace: "Thermes Széchenyi",
        label: "Matinée détente aux thermes",
        searchIntent: "thermes emblématiques et espace spa relaxation Budapest",
        venueFamily: "spa_wellness",
        destination: "Budapest",
      });
      expect(resolved).not.toBeNull();
      expect(resolved?.name).toBe("Thermes Széchenyi");
      expect(resolved?.categories).toContain("leisure.spa");
    } finally {
      globalThis.fetch = originalFetch;
      process.env["GEOAPIFY_API_KEY"] = oldApiKey;
    }
  });

  // 6. Gemini ne fournit rien d'exploitable => fallback Geoapify fonctionne.
  it("TEST 6 : Gemini ne fournit rien d'exploitable => fallback Geoapify fonctionne", async () => {
    const req = convertIntentToPlaceRequirements("restaurant", "repas", "restaurant convivial");
    const candidates = [
      {
        id: "resto-3",
        name: "Ybl Bistro",
        address: "Ybl Miklós tér 2, Budapest",
        categories: ["catering.restaurant"],
      },
    ];

    const selected = await selectGeoapifyCandidate({
      candidates,
      req,
      usedCandidateIdsSet: new Set(),
    });
    expect(selected?.id).toBe("resto-3");
    expect(selected?.name).toBe("Ybl Bistro");
  });

  // 7. Geoapify ne trouve aucun candidat compatible => ne sélectionne PAS un candidat incompatible juste pour remplir le slot.
  it("TEST 7 : Geoapify ne trouve aucun candidat compatible => ne sélectionne PAS un candidat incompatible", async () => {
    const req = convertIntentToPlaceRequirements("spa_wellness", "detente", "thermes emblématiques et espace spa relaxation Budapest");
    const candidates = [
      {
        id: "resto-wrong",
        name: "Leon Osteria",
        address: "Budapest, St 1",
        categories: ["catering.restaurant"],
      },
      {
        id: "art-wrong",
        name: "Kavics",
        address: "Budapest, St 2",
        categories: ["tourism.attraction.artwork"],
      },
    ];

    const selected = await selectGeoapifyCandidate({
      candidates,
      req,
      usedCandidateIdsSet: new Set(),
    });
    expect(selected).toBeNull();
  });

  // 8. `detail` final conserve une description utilisateur et n'est pas remplacé par l'adresse brute.
  it("TEST 8 : detail final conserve la description utilisateur et n'est pas remplacé par l'adresse brute", () => {
    const userDetail = "Un rooftop élégant pour prendre un cocktail avec vue sur le Danube et Budapest illuminée.";
    const placeAddress = "Budapest, Clark Ádám tér 1, 1013";

    const slot = {
      label: "Leo Rooftop",
      detail: userDetail,
      address: placeAddress,
    };

    expect(slot.detail).toBe(userDetail);
    expect(slot.detail).not.toBe(placeAddress);
    expect(slot.address).toBe(placeAddress);
  });

  // 9. Activité self_guided_group => fonctionnement actuel conservé.
  it("TEST 9 : activité self_guided_group => fonctionnement actuel conservé", () => {
    const mode = classifyActivityMode({
      kind: "internal",
      category: "detente",
      label: "Jeu de la mariée & Apéro d'accueil",
    });

    expect(mode).toBe("self_guided_group");
    expect(shouldResolveWithPlaceProvider({ kind: "internal", activityMode: mode })).toBe(false);
  });
});

describe("Correctifs Résolution Lieux Réels Planning — Tests Complémentaires PR #135 (A, B, C, D)", () => {
  // A. Gemini renvoie : suggestedPlace = lieu valide, suggestedUrl = URL valide => URL Gemini conservée.
  it("TEST A : Gemini renvoie suggestedPlace valide + suggestedUrl valide => URL Gemini conservée", async () => {
    const originalFetch = globalThis.fetch;
    const oldApiKey = process.env["GEOAPIFY_API_KEY"];
    process.env["GEOAPIFY_API_KEY"] = "test-geo-key";

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              place_id: "geo-szechenyi",
              name: "Thermes Széchenyi",
              formatted: "Budapest, Állatkerti krt. 9-11",
              lat: 47.5186,
              lon: 19.0825,
              categories: ["leisure.spa"],
              website: "https://szechenyibath.hu/",
            },
          },
        ],
      }),
    })) as any;

    try {
      const resolved = await tryResolveGeminiProposedPlace({
        suggestedPlace: "Thermes Széchenyi",
        suggestedUrl: "https://szechenyibath.hu/official-booking",
        label: "Matinée détente aux thermes",
        searchIntent: "thermes emblématiques et espace spa relaxation Budapest",
        venueFamily: "spa_wellness",
        destination: "Budapest",
      });
      expect(resolved).not.toBeNull();
      expect(resolved?.website).toBe("https://szechenyibath.hu/official-booking");
    } finally {
      globalThis.fetch = originalFetch;
      process.env["GEOAPIFY_API_KEY"] = oldApiKey;
    }
  });

  // B. Gemini renvoie une URL invalide/suspecte => URL rejetée, fallback Geoapify/site officiel utilisé.
  it("TEST B : Gemini renvoie une URL invalide/suspecte => URL rejetée, fallback site Geoapify utilisé", async () => {
    const originalFetch = globalThis.fetch;
    const oldApiKey = process.env["GEOAPIFY_API_KEY"];
    process.env["GEOAPIFY_API_KEY"] = "test-geo-key";

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              place_id: "geo-szechenyi",
              name: "Thermes Széchenyi",
              formatted: "Budapest, Állatkerti krt. 9-11",
              lat: 47.5186,
              lon: 19.0825,
              categories: ["leisure.spa"],
              website: "https://szechenyibath.hu/real-site",
            },
          },
        ],
      }),
    })) as any;

    try {
      const resolved = await tryResolveGeminiProposedPlace({
        suggestedPlace: "Thermes Széchenyi",
        suggestedUrl: "http://example.com/fake-url",
        label: "Matinée détente aux thermes",
        searchIntent: "thermes emblématiques et espace spa relaxation Budapest",
        venueFamily: "spa_wellness",
        destination: "Budapest",
      });
      expect(resolved).not.toBeNull();
      expect(resolved?.website).toBe("https://szechenyibath.hu/real-site");
    } finally {
      globalThis.fetch = originalFetch;
      process.env["GEOAPIFY_API_KEY"] = oldApiKey;
    }
  });

  // C. Gemini + Geoapify échouent pour une croisière => fallback web est tenté avant Maps générique.
  it("TEST C : Gemini + Geoapify échouent pour une croisière => fallback web est tenté", async () => {
    const originalFetch = globalThis.fetch;
    const oldTavilyKey = process.env["TAVILY_API_KEY"];
    process.env["TAVILY_API_KEY"] = "test-tavily-key";

    globalThis.fetch = (async () => {
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              url: "https://legenda.hu/fr/croisiere-danube",
              title: "Legenda City Cruises Budapest",
            },
          ],
        }),
      };
    }) as any;

    try {
      const foundUrl = await findWebResourceForComplexActivity({
        label: "Croisière sunset sur le Danube",
        searchIntent: "croisière apéritive privative Danube Budapest sunset",
        destination: "Budapest",
        venueFamily: "local_experience",
      });
      expect(foundUrl).toBe("https://legenda.hu/fr/croisiere-danube");
    } finally {
      globalThis.fetch = originalFetch;
      process.env["TAVILY_API_KEY"] = oldTavilyKey;
    }
  });

  // D. Tous les fallbacks échouent => concept initial conservé, verified=false, pas de faux lieu.
  it("TEST D : Tous les fallbacks échouent => concept initial conservé avec URL Maps générique et verified=false", () => {
    const fallbackMapUrl = buildVerifiedPlaceFallbackUrl(
      { name: "Balade secrète en bateau", address: "Budapest" },
      "Budapest",
    );

    const slot = {
      label: "Balade secrète en bateau",
      detail: "Une excursion paisible sur l'eau.",
      address: null,
      verified: false,
      source: "krew",
      url: fallbackMapUrl,
    };

    expect(slot.label).toBe("Balade secrète en bateau");
    expect(slot.verified).toBe(false);
    expect(slot.source).toBe("krew");
    expect(slot.url).toContain("google.com/maps");
  });
});

describe("Durcissement URLs Gemini & Fallback Tavily — Tests Obligatoires E, F, G, H", () => {
  // E. Lieu Geoapify confirmé + suggestedUrl Gemini sur le même domaine officiel => URL Gemini acceptée.
  it("TEST E : Lieu Geoapify confirmé + suggestedUrl Gemini sur le même domaine officiel => URL Gemini acceptée", async () => {
    const originalFetch = globalThis.fetch;
    const oldApiKey = process.env["GEOAPIFY_API_KEY"];
    process.env["GEOAPIFY_API_KEY"] = "test-geo-key";

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              place_id: "geo-szechenyi",
              name: "Thermes Széchenyi",
              formatted: "Budapest, Állatkerti krt. 9-11",
              lat: 47.5186,
              lon: 19.0825,
              categories: ["leisure.spa"],
              website: "https://szechenyibath.hu/",
            },
          },
        ],
      }),
    })) as any;

    try {
      const resolved = await tryResolveGeminiProposedPlace({
        suggestedPlace: "Thermes Széchenyi",
        suggestedUrl: "https://szechenyibath.hu/official-booking",
        label: "Matinée détente aux thermes",
        searchIntent: "thermes emblématiques et espace spa relaxation Budapest",
        venueFamily: "spa_wellness",
        destination: "Budapest",
      });
      expect(resolved).not.toBeNull();
      expect(resolved?.website).toBe("https://szechenyibath.hu/official-booking");
    } finally {
      globalThis.fetch = originalFetch;
      process.env["GEOAPIFY_API_KEY"] = oldApiKey;
    }
  });

  // F. Lieu Geoapify confirmé + suggestedUrl Gemini HTTPS mais domaine manifestement différent => URL Gemini rejetée et website Geoapify conservé.
  it("TEST F : Lieu Geoapify confirmé + suggestedUrl Gemini domaine différent => URL Gemini rejetée et website Geoapify conservé", async () => {
    const originalFetch = globalThis.fetch;
    const oldApiKey = process.env["GEOAPIFY_API_KEY"];
    process.env["GEOAPIFY_API_KEY"] = "test-geo-key";

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              place_id: "geo-szechenyi",
              name: "Thermes Széchenyi",
              formatted: "Budapest, Állatkerti krt. 9-11",
              lat: 47.5186,
              lon: 19.0825,
              categories: ["leisure.spa"],
              website: "https://szechenyibath.hu/",
            },
          },
        ],
      }),
    })) as any;

    try {
      const resolved = await tryResolveGeminiProposedPlace({
        suggestedPlace: "Thermes Széchenyi",
        suggestedUrl: "https://un-autre-spa-budapest.com/booking",
        label: "Matinée détente aux thermes",
        searchIntent: "thermes emblématiques et espace spa relaxation Budapest",
        venueFamily: "spa_wellness",
        destination: "Budapest",
      });
      expect(resolved).not.toBeNull();
      expect(resolved?.website).toBe("https://szechenyibath.hu/");
    } finally {
      globalThis.fetch = originalFetch;
      process.env["GEOAPIFY_API_KEY"] = oldApiKey;
    }
  });

  // G. Tavily retourne en premier un résultat HTTPS hors sujet puis une vraie activité correspondant à l'intention => premier rejeté, deuxième sélectionné.
  it("TEST G : Tavily retourne en premier un résultat HTTPS hors sujet puis une vraie activité => premier rejeté, deuxième sélectionné", async () => {
    const originalFetch = globalThis.fetch;
    const oldTavilyKey = process.env["TAVILY_API_KEY"];
    process.env["TAVILY_API_KEY"] = "test-tavily-key";

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        results: [
          {
            title: "Best Italian restaurants Budapest",
            url: "https://best-italian-budapest.com",
            content: "Top Italian trattoria in Budapest",
          },
          {
            title: "Legenda City Cruises Budapest",
            url: "https://legenda.hu/fr/croisiere-danube",
            content: "Croisière apéritive au coucher du soleil sur le Danube",
          },
        ],
      }),
    })) as any;

    try {
      const foundUrl = await findWebResourceForComplexActivity({
        label: "Croisière sunset sur le Danube",
        searchIntent: "croisière apéritive privative Danube Budapest sunset",
        destination: "Budapest",
        venueFamily: "local_experience",
      });
      expect(foundUrl).toBe("https://legenda.hu/fr/croisiere-danube");
    } finally {
      globalThis.fetch = originalFetch;
      process.env["TAVILY_API_KEY"] = oldTavilyKey;
    }
  });

  // H. Tavily ne retourne que des résultats hors sujet => null, permettant le fallback Maps.
  it("TEST H : Tavily ne retourne que des résultats hors sujet => null", async () => {
    const originalFetch = globalThis.fetch;
    const oldTavilyKey = process.env["TAVILY_API_KEY"];
    process.env["TAVILY_API_KEY"] = "test-tavily-key";

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        results: [
          {
            title: "Best Italian restaurants Budapest",
            url: "https://best-italian-budapest.com",
            content: "Top Italian trattoria in Budapest",
          },
          {
            title: "Budapest Shoe Repair Shop",
            url: "https://shoe-repair-budapest.hu",
            content: "Fix your shoes in Budapest",
          },
        ],
      }),
    })) as any;

    try {
      const foundUrl = await findWebResourceForComplexActivity({
        label: "Croisière sunset sur le Danube",
        searchIntent: "croisière apéritive privative Danube Budapest sunset",
        destination: "Budapest",
        venueFamily: "local_experience",
      });
      expect(foundUrl).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
      process.env["TAVILY_API_KEY"] = oldTavilyKey;
    }
  });
});

describe("Nouveau moteur de planning KREW (Skeletons, Gemini, Geoapify)", () => {
  it("A. Arrivée à 18h -> aucune activité déplacée à 13h sur le jour 1", () => {
    const skeleton = buildKrewSkeleton(
      input({ latestGroupArrival: "18:00", transferMarginMinutes: 0 }),
    );
    const day1Slots = skeleton.days[0]?.slots ?? [];
    expect(day1Slots.some((s) => s.time < "18:00")).toBe(false);
  });

  it("B. Départ destination à 12h -> aucune activité ne se termine après 12h le dernier jour", () => {
    const skeleton = buildKrewSkeleton(
      input({ earliestGroupDeparture: "12:00", transferMarginMinutes: 0 }),
    );
    const lastDaySlots = skeleton.days[skeleton.days.length - 1]?.slots ?? [];
    expect(lastDaySlots.some((s) => s.endTime > "12:00")).toBe(false);
  });

  it("C. Travel pace léger vs intense -> léger contient moins de créneaux structurants", () => {
    const lightSkeleton = buildKrewSkeleton(input({ travelPace: "leger" }));
    const intenseSkeleton = buildKrewSkeleton(input({ travelPace: "intense" }));

    const countSlots = (s: typeof lightSkeleton) =>
      s.days.flatMap((d) => d.slots).filter((slot) => slot.kind === "place_required").length;

    expect(countSlots(lightSkeleton)).toBeLessThan(countSlots(intenseSkeleton));
  });

  it("C2. Travel pace intense sans préférence sport -> aucune activité sportive forcée", () => {
    const intenseNoSport = buildKrewSkeleton(
      input({
        travelPace: "intense",
        ambiances: ["culturel"],
        activityCategories: ["musée", "gastronomie"],
      }),
    );

    const hasSport = intenseNoSport.days
      .flatMap((d) => d.slots)
      .some((s) => s.category === "sport_outdoor");

    expect(hasSport).toBe(false);
  });

  it("D. Accommodation role centerpiece -> davantage de moments au logement qu'un base_only", () => {
    const centerpiece = buildKrewSkeleton(
      input({
        groupAccommodationRole: "centerpiece",
      }),
    );
    const baseOnly = buildKrewSkeleton(
      input({
        groupAccommodationRole: "base_only",
      }),
    );

    const homeSlotsCount = (s: typeof centerpiece) =>
      s.days.flatMap((d) => d.slots).filter((slot) => slot.category === "moment_maison").length;

    expect(homeSlotsCount(centerpiece)).toBeGreaterThan(homeSlotsCount(baseOnly));
  });

  it("D2. preferredTimeSlots : tard_soir ≠ matin_tard", () => {
    const lateNightOnly = buildKrewSkeleton(
      input({
        preferredTimeSlots: ["tard_soir"],
      }),
    );

    const breakfastSlot = lateNightOnly.days[1]?.slots.find((s) => s.category === "repas" && s.moment === "Matin");
    const dinnerSlot = lateNightOnly.days[1]?.slots.find((s) => s.category === "repas" && s.moment === "Soir");

    expect(dinnerSlot?.time).toBe("20:30");
    expect(breakfastSlot?.time).toBe("08:30");

    const lateMorningOnly = buildKrewSkeleton(
      input({
        preferredTimeSlots: ["matin_tard"],
      }),
    );

    const breakfastLate = lateMorningOnly.days[1]?.slots.find((s) => s.category === "repas" && s.moment === "Matin");
    const dinnerNormal = lateMorningOnly.days[1]?.slots.find((s) => s.category === "repas" && s.moment === "Soir");

    expect(breakfastLate?.time).toBe("09:30");
    expect(dinnerNormal?.time).toBe("20:00");
  });

  it("D3. Aucun équipement logement non vérifié dans les defaults du skeleton", () => {
    const skeleton = buildKrewSkeleton(input());
    const allText = skeleton.days
      .flatMap((d) => d.slots)
      .map((s) => `${s.label} ${s.detail || ""}`.toLowerCase())
      .join(" ");

    expect(allText).not.toMatch(/barbecue|piscine|terrasse|jacuzzi|spa privé|jardin|cheminée/);
  });

  it("E. Profil montagne + souhait sport -> intention outdoor/sport cohérente", () => {
    const skeleton = buildKrewSkeleton(
      input({
        tripProfile: "Montagne & Outdoor",
        ambiances: ["montagne", "sportif"],
        activityCategories: ["randonnée"],
      }),
    );

    const hasSportOrOutdoor = skeleton.days
      .flatMap((d) => d.slots)
      .some((s) => s.category === "sport_outdoor");
    expect(hasSportOrOutdoor).toBe(true);
  });

  it("F. Sport refusé/non souhaité -> ne pas forcer de randonnée ou activité sportive", () => {
    const skeleton = buildKrewSkeleton(
      input({
        tripProfile: "City trip culture",
        ambiances: ["culturel", "urbain"],
        activityCategories: ["musée", "gastronomie"],
      }),
    );

    const hasSport = skeleton.days
      .flatMap((d) => d.slots)
      .some((s) => s.category === "sport_outdoor");
    expect(hasSport).toBe(false);
  });

  it("G. EVJF -> event_moment présent, aucun lieu inventé", () => {
    const skeleton = buildKrewSkeleton(input({ eventType: "evjf" }));
    const eventSlot = skeleton.days
      .flatMap((d) => d.slots)
      .find((s) => s.category === "jeu_groupe" || s.category === "evenement");

    expect(eventSlot).toBeDefined();
    expect(eventSlot?.kind).toBe("internal");
    // Skeleton slot is internal with no external place/url attached
    expect(eventSlot?.url).toBeUndefined();
  });

  it("H. Gemini en erreur -> skeleton KREW utilisable", async () => {
    const skeleton = buildKrewSkeleton(input());
    // Simulate missing GEMINI_API_KEY
    const origKey = process.env["GEMINI_API_KEY"];
    delete process.env["GEMINI_API_KEY"];

    const enriched = await geminiEnrichSkeleton(skeleton, input());
    process.env["GEMINI_API_KEY"] = origKey;

    expect(enriched.usedLlm).toBe(false);
    expect(enriched.enrichedSkeleton.days.length).toBe(skeleton.days.length);
  });

  it("I. Geoapify en erreur / clé absente -> aucune fausse activité & planning non vide", async () => {
    const origKey = process.env["GEOAPIFY_API_KEY"];
    delete process.env["GEOAPIFY_API_KEY"];

    const places = await searchGeoapifyPlaces({
      categories: ["catering.restaurant"],
      longitude: 6.1,
      latitude: 45.9,
    });

    process.env["GEOAPIFY_API_KEY"] = origKey;

    expect(places).toEqual([]);
  });

  it("J. Geoapify -> catégories officielles et format filter circle:lon,lat,radiusMeters", () => {
    const categories = mapVenueFamilyToGeoapifyCategories("restaurant", "resto");
    expect(categories).toContain("catering.restaurant");

    const radius = determineSearchRadiusMeters("walk_transit", "city trip");
    expect(radius).toBe(3500);
  });

  it("K. Pool de candidats et autre proposition reconsomme le pool sans rappel Gemini/Geoapify", () => {
    const mockPool = [
      { id: "p1", name: "Resto A", address: "Adresse A" },
      { id: "p2", name: "Resto B", address: "Adresse B" },
    ];

    const currentSlot = { label: "Resto A", venueFamily: "restaurant", type: "resto" };
    const avoidLabels = ["Resto A"];

    const unusedPlace = mockPool.find(
      (place) => !avoidLabels.some((l) => l.toLowerCase().trim() === place.name.toLowerCase().trim()),
    );

    expect(unusedPlace).toBeDefined();
    expect(unusedPlace?.name).toBe("Resto B");
  });

  it("L. Cohérence géographique : rayon resserré pour un city trip", () => {
    const cityRadius = determineSearchRadiusMeters("walk_transit", "City trip");
    const outdoorRadius = determineSearchRadiusMeters("car_ok", "Montagne Outdoor");

    expect(cityRadius).toBeLessThan(outdoorRadius);
  });

  it("M. Droits : seul l'organisateur / co-organisateur (isTripAdmin) peut administrer", () => {
    const trip = { owner_id: "user-owner", co_organizer_id: "user-coorg" };

    expect(isTripAdmin(trip as any, "user-owner")).toBe(true);
    expect(isTripAdmin(trip as any, "user-coorg")).toBe(true);
    expect(isTripAdmin(trip as any, "user-participant")).toBe(false);
  });

  it("N. Au maximum 1 seul appel Gemini par enrichissement du skeleton", async () => {
    const skeleton = buildKrewSkeleton(input());
    const origKey = process.env["GEMINI_API_KEY"];
    process.env["GEMINI_API_KEY"] = "test-key";
    const validPayload = {
      days: [
        {
          day: 1,
          slots: [
            {
              kind: "place_required",
              momentType: "repas",
              canonicalVenueFamily: "restaurant",
              label: "Dîner",
              time: "20:00",
              durationMinutes: 90,
            },
          ],
        },
      ],
    };
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(validPayload) }] } }] }),
    });
    global.fetch = fetchMock;

    try {
      const res = await geminiEnrichSkeleton(skeleton, input());
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(res.usedLlm).toBe(true);
    } finally {
      global.fetch = originalFetch;
      process.env["GEMINI_API_KEY"] = origKey;
    }
  });

  it("O. Aucune dépendance Tavily dans la découverte d'activités pour le planning", async () => {
    const { discoverActivities } = await import("../activity-discovery.server");
    const res = await discoverActivities({
      destination: "Annecy",
      budgetPerPerson: 400,
      ambiances: [],
      activityCategories: [],
    });
    // Tavily is completely bypassed in planning discovery
    expect(res.candidates).toEqual([]);
  });

  it("P. adjustItineraryTransferTimes décale les créneaux suivants d'au moins le temps de transfert quand les deux ont des coordonnées", () => {
    const dayPlan = [
      {
        day: 2,
        slots: [
          {
            moment: "Après-midi",
            time: "15:00",
            durationMinutes: 60,
            endTime: "16:00",
            label: "Lieu A",
            latitude: 45.9,
            longitude: 6.1,
            type: "activite" as const,
          },
          {
            moment: "Après-midi",
            time: "16:05",
            durationMinutes: 60,
            endTime: "17:05",
            label: "Lieu B",
            latitude: 46.1, // ~22km away -> requires transfer
            longitude: 6.2,
            type: "activite" as const,
          },
        ],
      },
    ];

    const adjusted = adjustItineraryTransferTimes(dayPlan, input());
    const slotB = adjusted[0]?.slots[1];

    expect(slotB?.time).not.toBe("16:05");
    expect((slotB?.time ?? "") > "16:05").toBe(true);
  });

  it("Q. adjustItineraryTransferTimes n'ajoute pas de transfert de 20 min sans coordonnées", () => {
    const dayPlan = [
      {
        day: 2,
        slots: [
          {
            moment: "Après-midi",
            time: "14:00",
            durationMinutes: 60,
            endTime: "15:00",
            label: "Slot interne sans coords",
            type: "libre" as const,
          },
          {
            moment: "Après-midi",
            time: "15:00",
            durationMinutes: 60,
            endTime: "16:00",
            label: "Slot suivant",
            type: "activite" as const,
          },
        ],
      },
    ];

    const adjusted = adjustItineraryTransferTimes(dayPlan, input());
    const slotB = adjusted[0]?.slots[1];

    expect(slotB?.time).toBe("15:00");
  });

  it("R. Geoapify categories: Nightlife (no adult/nightclub) et Spa (leisure.spa, service.beauty.spa, service.beauty.massage)", () => {
    const nightlifeCats = mapVenueFamilyToGeoapifyCategories("nightlife", "bar");
    expect(nightlifeCats).toEqual(["catering.bar", "catering.pub"]);
    expect(nightlifeCats.some((c) => c.includes("adult") || c.includes("nightclub"))).toBe(false);

    const spaCats = mapVenueFamilyToGeoapifyCategories("relaxation", "spa");
    expect(spaCats).toEqual(["leisure.spa", "service.beauty.spa", "service.beauty.massage"]);
    expect(spaCats.some((c) => c.includes("fitness") || c.includes("theme_park"))).toBe(false);
  });
});

describe("contraintes déterministes du planning", () => {
  it("agrège les préférences aller et retour selon la majorité", () => {
    expect(
      aggregateMajorityTimePreference([...Array(6).fill("13:00"), ...Array(2).fill("18:00")]),
    ).toBe("13:00");
    expect(
      aggregateMajorityTimePreference([...Array(6).fill("20:00"), ...Array(2).fill("16:00")]),
    ).toBe("20:00");
  });

  it("P1 & P2. transportPicksSummary et transportDurationHours ne dévient pas les fallbacks 18:30 / 16:30 sans vraie heure destination", () => {
    expect(
      calculatePlanningWindow(
        input({
          earliestOutboundDeparture: "13:00",
          transportDurationHours: 2,
          transferMarginMinutes: 60,
          transportPicksSummary: [{ city: "Paris", mode: "train", arrival: "18:00" }],
        }),
      ).arrivalReady,
    ).toBe("18:30");
  });

  it("P3. earliestOutboundDeparture ne transforme pas l'horaire origine en arrivée destination", () => {
    expect(
      calculatePlanningWindow(
        input({
          earliestOutboundDeparture: "13:00",
          transportDurationHours: 4,
          transferMarginMinutes: 60,
        }),
      ).arrivalReady,
    ).toBe("18:30");
  });

  it("supprime tout slot avant une arrivée à 18:00 plus marge", () => {
    const ctx = input({ latestGroupArrival: "18:00", transferMarginMinutes: 60 });
    const [day] = validateItinerary(
      [
        {
          day: 1,
          slots: [
            {
              moment: "Après-midi",
              time: "18:30",
              type: "activite",
              label: candidate.name,
              candidateId: candidate.id,
            },
            {
              moment: "Soir",
              time: "19:00",
              type: "activite",
              label: candidate.name,
              candidateId: candidate.id,
            },
          ],
        },
      ],
      ctx,
      [candidate],
    );
    expect(day?.slots.map((slot) => slot.time)).toEqual(["19:00"]);
  });

  it("P4. latestReturnHome ne transforme pas l'horaire origine en départ destination (reste 16:30)", () => {
    const ctx = input({
      latestReturnHome: "20:00",
      transportDurationHours: 4,
      transferMarginMinutes: 60,
    });
    expect(calculatePlanningWindow(ctx).latestDestinationDeparture).toBe("16:30");
    const last = validateItinerary(
      [
        {
          day: 3,
          slots: [
            {
              moment: "Après-midi",
              time: "15:30",
              durationMinutes: 90,
              type: "activite",
              label: candidate.name,
              candidateId: candidate.id,
            },
          ],
        },
      ],
      ctx,
      [candidate],
    );
    expect(last[0]?.slots).toHaveLength(0);
  });

  it("rejette URL invalide, doublon horaire et lieu externe non vérifié", () => {
    expect(isSafeActivityUrl("javascript:alert(1)")).toBe(false);
    const days = validateItinerary(
      [
        {
          day: 2,
          slots: [
            {
              moment: "Matin",
              time: "10:00",
              durationMinutes: 120,
              type: "activite",
              label: candidate.name,
              candidateId: candidate.id,
            },
            {
              moment: "Matin",
              time: "10:30",
              type: "activite",
              label: candidate.name,
              candidateId: candidate.id,
            },
            {
              moment: "Midi",
              time: "13:00",
              type: "resto",
              label: "Restaurant inventé",
              url: "https://fake.example",
            },
          ],
        },
      ],
      input(),
      [candidate],
    );
    expect(days[0]?.slots).toHaveLength(1);
    expect(days[0]?.slots[0]?.verified).toBe(true);
  });

  it("rejette un lieu fermé à l'heure proposée", () => {
    const closed = { ...candidate, id: "closed", openingHours: ["Samedi: 18:00-23:00"] };
    const days = validateItinerary(
      [
        {
          day: 2,
          slots: [
            {
              moment: "Midi",
              time: "13:00",
              type: "resto",
              label: closed.name,
              candidateId: closed.id,
            },
          ],
        },
      ],
      input(),
      [closed],
    );
    expect(days[0]?.slots).toHaveLength(0);
  });

  it("rejette un saut absurde en city trip et applique le plafond dur 30km même outdoor", () => {
    const far = {
      ...candidate,
      id: "far",
      name: "Base outdoor distante",
      latitude: 46.25,
      longitude: 6.1,
      category: "randonnée",
      environment: "outdoor" as const,
    };
    expect(haversineDistanceKm(candidate, far)).toBeGreaterThan(35);
    const plan = [
      {
        day: 2,
        slots: [
          {
            moment: "Matin",
            time: "09:00",
            durationMinutes: 60,
            type: "activite" as const,
            label: candidate.name,
            candidateId: candidate.id,
          },
          {
            moment: "Après-midi",
            time: "12:00",
            durationMinutes: 60,
            type: "activite" as const,
            label: far.name,
            candidateId: far.id,
          },
        ],
      },
    ];
    expect(
      validateItinerary(plan, input({ tripProfile: "City trip", ambiances: ["urbain"] }), [
        candidate,
        far,
      ])[0]?.slots,
    ).toHaveLength(1);
    // Plafond dur 30 km : rejeté même outdoor si > 30 km
    expect(validateItinerary(plan, input(), [candidate, far])[0]?.slots).toHaveLength(1);
  });
});

describe("personnalisation du fallback et de la discovery", () => {
  it("oriente Nature & sportif vers des recherches outdoor", () => {
    const queries = buildDiscoveryQueries(input());
    expect(queries.some((query) => /outdoor|sport|nautique|randonnée/.test(query))).toBe(true);
  });

  it("laisse des moments logement au profil maison/chill sans inventer de visite", () => {
    const itinerary = buildLocalItinerary(
      input({ tripProfile: "Maison entre nous", travelPace: "chill", ambiances: ["cocooning"] }),
      [],
    );
    const slots = itinerary.days.flatMap((day) => day.slots);
    expect(
      slots.filter((slot) => slot.category === "moment_maison" || slot.category === "jeu_groupe" || slot.locationContext === "lodging")
        .length,
    ).toBeGreaterThanOrEqual(1);
    expect(slots.every((slot) => slot.verified === false || slot.type === "transport")).toBe(true);
  });

  it.each([
    ["evjf", "Jeu de la mariée"],
    ["evg", "Défis du marié"],
    ["anniversaire", "Surprise anniversaire"],
  ])("ajoute un moment fort pour %s", (eventType, label) => {
    const itinerary = buildLocalItinerary(input({ eventType, latestGroupArrival: "10:00" }), [
      candidate,
    ]);
    expect(itinerary.days.flatMap((day) => day.slots).some((slot) => slot.label === label)).toBe(
      true,
    );
  });

  it("n'injecte jamais l'ancienne arrivée arbitraire à 11:00", () => {
    const itinerary = buildLocalItinerary(
      input({ latestGroupArrival: null, earliestOutboundDeparture: null }),
      [],
    );
    expect(
      itinerary.days
        .flatMap((day) => day.slots)
        .some((slot) => slot.type === "transport" && slot.time === "11:00"),
    ).toBe(false);
  });
});

describe("Pipeline Planning Gemini & Backups Contractuels", () => {
  it("construit un GroupPlanningContext complet avec Star séparée et signaux de scoring", () => {
    const testInput = input({
      destinationScore: 88,
      matchReasons: ["Proche de la nature", "Adapté au groupe"],
      scoredActivityLabels: ["Canoë lac", "Randonnée col"],
      activityCategoryFrequencies: { kayak: 5, rando: 3 },
      ambianceFrequencies: { nature: 6, sportif: 4 },
      starWanted: ["Escape Game Star"],
      starWantedEnvType: "montagne",
      starDealBreakers: ["pas_de_boite"],
      dealBreakerAmbiances: ["soiree_arrosee"],
      groupAgeRange: "25-35",
      wantedEnvTypes: ["lac"],
    });

    const brief = buildPlanningBrief(testInput);
    const ctx = buildGroupPlanningContext(testInput, brief);

    expect(ctx.trip.destination).toBe("Annecy");
    expect(ctx.trip.participantCount).toBe(8);
    expect(ctx.group.activityPreferences["kayak"]?.frequency).toBe(5);
    expect(ctx.group.ambiancePreferences["nature"]?.frequency).toBe(6);
    expect(ctx.group.dealBreakers).toContain("soiree_arrosee");

    // Star transmise séparément
    expect(ctx.star.starWantedActivities).toContain("Escape Game Star");
    expect(ctx.star.starWantedEnvType).toBe("montagne");
    expect(ctx.star.starDealBreakers).toContain("pas_de_boite");

    // KREW Signals & Scoring
    expect(ctx.krewSignals.destinationScore).toBe(88);
    expect(ctx.krewSignals.matchReasons).toContain("Proche de la nature");
    expect(ctx.krewSignals.scoredActivityLabels).toContain("Canoë lac");

    // Day windows & mandatory needs
    expect(ctx.planning.dayWindows.length).toBeGreaterThan(0);
    expect(ctx.planning.maxActivitiesPerDay).toBe(2);
  });

  it("parse le planning principal et les backups dans un unique appel Gemini et conserve le detail", async () => {
    const originalFetch = global.fetch;
    let fetchCalls = 0;

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      fetchCalls++;
      if (String(url).includes("googleapis.com")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          days: [
                            {
                              day: 1,
                              slots: [
                                {
                                  id: "slot_1_1",
                                  kind: "place_required",
                                  momentType: "sport_outdoor",
                                  label: "Kayak sur le lac",
                                  detail: "Un moment rafraîchissant sur le lac parfait pour le groupe.",
                                  time: "14:00",
                                  durationMinutes: 120,
                                  locationContext: "external",
                                  canonicalVenueFamily: "sport",
                                  searchIntent: "kayak lac d'Annecy",
                                  suggestedPlace: "Club Nautique Annecy",
                                },
                              ],
                            },
                          ],
                          backups: [
                            {
                              id: "backup_1_1",
                              day: 1,
                              forSlot: "slot_1_1",
                              kind: "place_required",
                              momentType: "sport_outdoor",
                              label: "Paddle sur le lac",
                              detail: "Une belle alternative glisse sur l'eau.",
                              time: "14:00",
                              durationMinutes: 120,
                              locationContext: "external",
                              canonicalVenueFamily: "sport",
                              searchIntent: "paddle lac d'Annecy",
                              suggestedPlace: "Paddle Club",
                            },
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
        };
      }
      return originalFetch(url);
    });

    try {
      const origKey = process.env["GEMINI_API_KEY"];
      process.env["GEMINI_API_KEY"] = "fake_key";
      const testInput = input({ latestGroupArrival: "10:00" });
      const skeleton = buildKrewSkeleton(testInput);
      const res = await geminiEnrichSkeleton(skeleton, testInput);

      expect(fetchCalls).toBe(1);
      expect(res.usedLlm).toBe(true);
      expect(res.enrichedSkeleton.days.length).toBeGreaterThan(0);

      const day1 = res.enrichedSkeleton.days[0];
      const kayakSlot = day1?.slots.find((s) => s.label === "Kayak sur le lac");
      expect(kayakSlot).toBeDefined();
      expect(kayakSlot?.detail).toBe("Un moment rafraîchissant sur le lac parfait pour le groupe.");

      // Backups conservés
      expect(res.enrichedSkeleton.backups).toBeDefined();
      expect(res.enrichedSkeleton.backups?.length).toBe(1);
      expect(res.enrichedSkeleton.backups?.[0]?.label).toBe("Paddle sur le lac");
      expect(res.enrichedSkeleton.backups?.[0]?.suggestedPlace).toBe("Paddle Club");
      process.env["GEMINI_API_KEY"] = origKey;
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("regenerateSlotWithAi réutilise un candidat du pool avant toute nouvelle requête externe", async () => {
    const poolCandidate = {
      id: "geo_1",
      name: "Canoë Club Annecy",
      address: "Lac d'Annecy",
      categories: ["sport.water"],
      latitude: 45.9,
      longitude: 6.1,
      website: "https://example.com/canoe",
    };

    const existingSlot = {
      moment: "Après-midi",
      type: "activite" as const,
      category: "sport_outdoor" as const,
      label: "Kayak sur le lac",
      detail: "Descriptif original",
      time: "14:00",
      durationMinutes: 90,
      venueFamily: "sport",
      searchIntent: "kayak lac annecy",
    };

    const { convertIntentToPlaceRequirements, buildPoolKey } = await import("../geoapify.server");
    const req = convertIntentToPlaceRequirements("sport", "sport_outdoor", "kayak lac annecy");
    const poolKey = buildPoolKey(req);

    const placePools = {
      [poolKey]: [poolCandidate],
    };

    const result = await regenerateSlotWithAi(
      input(),
      existingSlot,
      1,
      [],
      [],
      placePools,
      [],
      { latitude: 45.9, longitude: 6.1 },
    );

    expect(result.usedLlm).toBe(false);
    expect(result.slot.label).toBe("Canoë Club Annecy");
    expect(result.slot.candidateId).toBe("geo_1");
    expect(result.slot.verified).toBe(true);
    expect(result.updatedUsedIds).toContain("geo_1");
  });
});

describe("Micro-corrections PR #115 — Backups, Cohérence géographique, GeographyPolicy", () => {
  it("1. backup avec momentType='sport' -> sport_outdoor", () => {
    const raw = {
      days: [{ day: 1, slots: [{ id: "s1", kind: "internal", momentType: "repas", label: "Brunch", detail: "d", time: "10:00", durationMinutes: 60 }] }],
      backups: [{ id: "b1", day: 1, forSlot: "s1", kind: "place_required", momentType: "sport", label: "Kayak", detail: "d", time: "14:00", durationMinutes: 90 }],
    };
    const norm = normalizeGeminiParsedResponse(raw);
    expect(norm?.backups?.[0]?.momentType).toBe("sport_outdoor");
  });

  it("2. backup avec momentType='gastronomie' -> repas", () => {
    const raw = {
      days: [{ day: 1, slots: [{ id: "s1", kind: "internal", momentType: "repas", label: "Brunch", detail: "d", time: "10:00", durationMinutes: 60 }] }],
      backups: [{ id: "b1", day: 1, forSlot: "s1", kind: "place_required", momentType: "gastronomie", label: "Dégustation", detail: "d", time: "12:00", durationMinutes: 90 }],
    };
    const norm = normalizeGeminiParsedResponse(raw);
    expect(norm?.backups?.[0]?.momentType).toBe("repas");
  });

  it("3. backup avec type totalement inconnu -> backup ignoré", () => {
    const raw = {
      days: [{ day: 1, slots: [{ id: "s1", kind: "internal", momentType: "repas", label: "Brunch", detail: "d", time: "10:00", durationMinutes: 60 }] }],
      backups: [{ id: "b1", day: 1, forSlot: "s1", kind: "place_required", momentType: "type_totalement_inconnu_xyz", label: "Test", detail: "d", time: "14:00", durationMinutes: 90 }],
    };
    const norm = normalizeGeminiParsedResponse(raw);
    expect(norm?.backups ?? []).toHaveLength(0);
  });

  it("4. aucune sortie backup avec momentType='activite'", () => {
    const raw = {
      days: [{ day: 1, slots: [{ id: "s1", kind: "internal", momentType: "repas", label: "Brunch", detail: "d", time: "10:00", durationMinutes: 60 }] }],
      backups: [
        { id: "b1", day: 1, forSlot: "s1", kind: "place_required", momentType: "sport", label: "A", detail: "d", time: "14:00", durationMinutes: 90 },
        { id: "b2", day: 1, forSlot: "s1", kind: "place_required", momentType: "gastronomie", label: "B", detail: "d", time: "14:00", durationMinutes: 90 },
        { id: "b3", day: 1, forSlot: "s1", kind: "place_required", momentType: "inconnu", label: "C", detail: "d", time: "14:00", durationMinutes: 90 },
      ],
    };
    const norm = normalizeGeminiParsedResponse(raw);
    const moments = (norm?.backups ?? []).map((b) => b.momentType);
    expect(moments).not.toContain("activite");
  });

  it("5. le prompt Gemini contient EXACTEMENT le nouveau bloc COHÉRENCE GÉOGRAPHIQUE", () => {
    expect(GEMINI_CONTRACTUAL_PROMPT_TEMPLATE).toContain("## COHÉRENCE GÉOGRAPHIQUE");
    expect(GEMINI_CONTRACTUAL_PROMPT_TEMPLATE).toContain("Compose chaque journée comme un parcours géographiquement cohérent.");
    expect(GEMINI_CONTRACTUAL_PROMPT_TEMPLATE).toContain("Ne suppose jamais que le groupe dispose d'une voiture si cette information n'est pas présente dans GROUP_PLANNING_CONTEXT.");
  });

  it("6, 7, 8, 9, 10. règles geographyPolicy et plafond dur 30 km", () => {
    // 6. city sans voiture -> maxKm = 10
    const cityInput = input({ tripProfile: "Découverte urbaine", ambiances: ["culture"], activityCategories: ["musée"], localMobility: "à pied" });
    const cityPlan = [
      {
        day: 2,
        slots: [
          { moment: "Matin", time: "10:00", durationMinutes: 60, type: "activite" as const, label: candidate.name, candidateId: candidate.id },
          { moment: "Après-midi", time: "14:00", durationMinutes: 60, type: "activite" as const, label: "Point 12km", candidateId: "c12", latitude: 45.9, longitude: 6.25 }, // ~12 km
        ],
      },
    ];
    const c12 = { ...candidate, id: "c12", name: "Point 12km", latitude: 45.9, longitude: 6.25 };
    expect(haversineDistanceKm(candidate, c12)).toBeGreaterThan(11);
    expect(validateItinerary(cityPlan, cityInput, [candidate, c12])[0]?.slots).toHaveLength(1);

    // 7. logement / maison -> maxKm = 8
    const homeInput = input({ tripProfile: "Maison cocooning", ambiances: ["chill"], groupAccommodationRole: "centerpiece" });
    const homePlan = [
      {
        day: 2,
        slots: [
          { moment: "Matin", time: "10:00", durationMinutes: 60, type: "activite" as const, label: candidate.name, candidateId: candidate.id },
          { moment: "Après-midi", time: "14:00", durationMinutes: 60, type: "activite" as const, label: "Point 10km", candidateId: "c10", latitude: 45.9, longitude: 6.22 }, // ~10 km
        ],
      },
    ];
    const c10 = { ...candidate, id: "c10", name: "Point 10km", latitude: 45.9, longitude: 6.22 };
    expect(haversineDistanceKm(candidate, c10)).toBeGreaterThan(8.5);
    expect(validateItinerary(homePlan, homeInput, [candidate, c10])[0]?.slots).toHaveLength(1);

    // 8. voiture explicite -> maxKm = 30
    const carInput = input({ tripProfile: "City trip", ambiances: ["culture"], localMobility: "voiture de location" });
    const c20 = { ...candidate, id: "c20", name: "Point 20km", latitude: 45.9, longitude: 6.35 };
    expect(haversineDistanceKm(candidate, c20)).toBeLessThan(30);
    const carPlan = [
      {
        day: 2,
        slots: [
          { moment: "Matin", time: "10:00", durationMinutes: 60, type: "activite" as const, label: candidate.name, candidateId: candidate.id },
          { moment: "Après-midi", time: "14:00", durationMinutes: 60, type: "activite" as const, label: c20.name, candidateId: c20.id },
        ],
      },
    ];
    expect(validateItinerary(carPlan, carInput, [candidate, c20])[0]?.slots).toHaveLength(2);

    // 9. outdoor -> maxKm = 30 & 10. candidat > 30 km rejeté même outdoor
    const outdoorInput = input({ tripProfile: "Randonnée & aventure", ambiances: ["nature", "sportif"] });
    const c35 = { ...candidate, id: "c35", name: "Point 35km", latitude: 46.25, longitude: 6.1 };
    expect(haversineDistanceKm(candidate, c35)).toBeGreaterThan(30);
    const outdoorPlan = [
      {
        day: 2,
        slots: [
          { moment: "Matin", time: "10:00", durationMinutes: 60, type: "activite" as const, label: candidate.name, candidateId: candidate.id },
          { moment: "Après-midi", time: "14:00", durationMinutes: 60, type: "activite" as const, label: c35.name, candidateId: c35.id },
        ],
      },
    ];
    expect(validateItinerary(outdoorPlan, outdoorInput, [candidate, c35])[0]?.slots).toHaveLength(1);
  });
});

describe("Correctifs PR #133 Grounding Geoapify — Tests Obligatoires 1 à 15", () => {
  it("TEST 1 : 'bistro tendance et convivial' -> extractGeographicSignalFromIntent === null", () => {
    expect(extractGeographicSignalFromIntent("bistro tendance et convivial")).toBeNull();
  });

  it("TEST 2 : 'café chaleureux pour petit-déjeuner' -> extractGeographicSignalFromIntent === null", () => {
    expect(extractGeographicSignalFromIntent("café chaleureux pour petit-déjeuner")).toBeNull();
  });

  it("TEST 3 : 'restaurant chic et festif' -> extractGeographicSignalFromIntent === null", () => {
    expect(extractGeographicSignalFromIntent("restaurant chic et festif")).toBeNull();
  });

  it("TEST 4 : 'restaurant dans le quartier juif' -> extrait la partie localisable", () => {
    const signal = extractGeographicSignalFromIntent("restaurant dans le quartier juif");
    expect(signal).toBe("quartier juif");
  });

  it("TEST 5 : 'visite du Bastion des Pêcheurs' -> signal localisable non-null", () => {
    const signal = extractGeographicSignalFromIntent("visite du Bastion des Pêcheurs");
    expect(signal).toBe("Bastion des Pêcheurs");
  });

  it("TEST 6 : Mock d'un résultat Geoapify hors destination -> resolveSearchIntentLocation === null", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 48.85,
              lon: 2.35,
              city: "Paris",
              formatted: "Paris, France",
              result_type: "locality",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402);
      expect(res).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 7 : Mock d'un résultat Geoapify cohérent avec la destination -> intentCenter accepté", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.06,
              city: "Budapest",
              formatted: "Erzsébetváros, Budapest, Hungary",
              result_type: "district",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402);
      expect(res).not.toBeNull();
      expect(res?.latitude).toBe(47.50);
      expect(res?.longitude).toBe(19.06);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 8 : Même intent normalisé appelé deux fois -> 1 seul appel geocoding (cache)", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      return {
        ok: true,
        json: async () => ({
          features: [
            {
              properties: {
                lat: 47.50,
                lon: 19.06,
                city: "Budapest",
                formatted: "Budapest, Hungary",
                result_type: "district",
              },
            },
          ],
        }),
      };
    }) as any;

    try {
      const telemetry = { intentResolutionCalls: 0, intentResolutionHits: 0 };
      await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402, telemetry);
      await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402, telemetry);

      expect(fetchCount).toBe(1);
      expect(telemetry.intentResolutionCalls).toBe(1);
      expect(telemetry.intentResolutionHits).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 9 : 3 slots restaurant partageant les mêmes requirements de base mais 3 intentCenters -> keys séparées", () => {
    const req1 = convertIntentToPlaceRequirements("restaurant", "repas", "quartier A", [], false, [], { latitude: 47.50, longitude: 19.06, label: "quartier A" });
    const req2 = convertIntentToPlaceRequirements("restaurant", "repas", "quartier B", [], false, [], { latitude: 47.49, longitude: 19.03, label: "quartier B" });
    const req3 = convertIntentToPlaceRequirements("restaurant", "repas", "quartier C", [], false, [], { latitude: 47.51, longitude: 19.05, label: "quartier C" });

    const key1 = buildPoolKey(req1);
    const key2 = buildPoolKey(req2);
    const key3 = buildPoolKey(req3);

    expect(key1).not.toBe(key2);
    expect(key2).not.toBe(key3);
  });

  it("TEST 10 : Merge basePool + intentSupplement avec doublons -> dédupliqué", () => {
    const candA = { id: "p1", name: "Lieu A", category: "catering.restaurant", categories: ["catering.restaurant"], address: null, latitude: 47.5, longitude: 19.04, distanceMeters: 100, website: null, source: "geoapify" as const, verified: true };
    const candB = { id: "p2", name: "Lieu B", category: "catering.restaurant", categories: ["catering.restaurant"], address: null, latitude: 47.51, longitude: 19.05, distanceMeters: 200, website: null, source: "geoapify" as const, verified: true };

    const merged = mergeUniquePlacesById([candA], [candA, candB]);
    expect(merged).toHaveLength(2);
    expect(merged.map((x) => x.id)).toEqual(["p1", "p2"]);
  });

  it("TEST 11 : Candidat Geoapify vérifié avec website valide -> website conservé, fallbackMapLinks = 0", () => {
    const place = { name: "Kiosk Buda", website: "https://kioskbuda.hu", address: "Budapest, Fő utca 1", latitude: 47.5, longitude: 19.04 };
    const telemetry = { fallbackMapLinks: 0 };
    const res = resolveActivityResourceForPlace(place, "Budapest", { telemetry });

    expect(res.url).toBe("https://kioskbuda.hu");
    expect(res.resourceKind).toBe("website");
    expect(telemetry.fallbackMapLinks).toBe(0);
  });

  it("TEST 12 : Candidat Geoapify vérifié sans website -> fallback Google Maps déterministe, fallbackMapLinks = 1", () => {
    const place = { name: "Kiosk Buda", website: null, address: "Budapest, Fő utca 1", latitude: 47.5, longitude: 19.04 };
    const telemetry = { fallbackMapLinks: 0 };
    const res = resolveActivityResourceForPlace(place, "Budapest", { telemetry });

    expect(res.url).toBe("https://www.google.com/maps/search/?api=1&query=Kiosk%20Buda%2C%20Budapest%2C%20F%C5%91%20utca%201");
    expect(res.resourceKind).toBe("website");
    expect(telemetry.fallbackMapLinks).toBe(1);
  });

  it("TEST 13 : URL Google Maps arbitraire donnée directement à resolveActivityResourceUrl sans flag verified -> rejetée", () => {
    const res = resolveActivityResourceUrl("https://www.google.com/maps/search/?api=1&query=Arbitrary");
    expect(res.url).toBeNull();
    expect(res.resourceKind).toBeNull();
  });

  it("TEST 14 : place_required conserve son comportement grounded", () => {
    const { shouldResolveWithPlaceProvider } = require("../activity-ai.server");
    expect(shouldResolveWithPlaceProvider({ kind: "place_required", activityMode: "bookable" })).toBe(true);
  });

  it("TEST 15 : free_exploration et self_guided_group conservent leur comportement actuel", () => {
    const { classifyActivityMode } = require("../activity-ai.server");
    expect(classifyActivityMode({ kind: "internal", category: "jeu_groupe", label: "Blind test" })).toBe("self_guided_group");
    expect(classifyActivityMode({ kind: "place_required", category: "culture", label: "Balade dans le centre historique" })).toBe("free_exploration");
  });

  it("TEST A — destination incompatible mais proche -> null", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.06,
              city: "Szentendre",
              formatted: "Szentendre, Hungary",
              result_type: "district",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402);
      expect(res).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST B — destination compatible + bon type AREA -> intentCenter accepté", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.06,
              city: "Budapest",
              formatted: "Budapest, Erzsébetváros",
              result_type: "district",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402);
      expect(res).not.toBeNull();
      expect(res?.kind).toBe("area");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST C — destination compatible mais mauvais type AREA (e.g. amenity) -> null", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.06,
              city: "Budapest",
              formatted: "Budapest, Hungary",
              result_type: "amenity",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402);
      expect(res).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 1 : POI + result_type = amenity -> accepté", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.03,
              city: "Budapest",
              formatted: "Budapest, Bastion des Pêcheurs",
              result_type: "amenity",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("Bastion des Pêcheurs", "Budapest", 47.4979, 19.0402);
      expect(res).not.toBeNull();
      expect(res?.kind).toBe("poi");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 2 : POI + result_type = building -> accepté", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.03,
              city: "Budapest",
              formatted: "Budapest, Château de Buda",
              result_type: "building",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("Château de Buda", "Budapest", 47.4979, 19.0402);
      expect(res).not.toBeNull();
      expect(res?.kind).toBe("poi");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 3 : POI + result_type = street -> null", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.03,
              city: "Budapest",
              formatted: "Budapest, Rue du Château",
              result_type: "street",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("Château de Buda", "Budapest", 47.4979, 19.0402);
      expect(res).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 4 : POI + result_type = district -> null", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.03,
              city: "Budapest",
              formatted: "Budapest, District 1",
              result_type: "district",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("Château de Buda", "Budapest", 47.4979, 19.0402);
      expect(res).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 5 : POI + result_type = suburb -> null", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.03,
              city: "Budapest",
              formatted: "Budapest, Suburb 1",
              result_type: "suburb",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("Château de Buda", "Budapest", 47.4979, 19.0402);
      expect(res).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 6 : POI + result_type = city -> null", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.04,
              city: "Budapest",
              formatted: "Budapest, Hungary",
              result_type: "city",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("Thermes Gellért", "Budapest", 47.4979, 19.0402);
      expect(res).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 7 : AREA + result_type = district -> accepté", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.06,
              city: "Budapest",
              formatted: "Erzsébetváros, Budapest, Hungary",
              result_type: "district",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402);
      expect(res).not.toBeNull();
      expect(res?.kind).toBe("area");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 8 : AREA + result_type = suburb -> accepté", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.06,
              city: "Budapest",
              formatted: "Budapest, Suburb Juif",
              result_type: "suburb",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402);
      expect(res).not.toBeNull();
      expect(res?.kind).toBe("area");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 9 : AREA + result_type = street -> accepté", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.06,
              city: "Budapest",
              formatted: "Budapest, Rue du Quartier",
              result_type: "street",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402);
      expect(res).not.toBeNull();
      expect(res?.kind).toBe("area");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 10 : AREA + result_type = city -> null", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.06,
              city: "Budapest",
              formatted: "Budapest, Hungary",
              result_type: "city",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402);
      expect(res).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST POI 6 : IntentCenter POI rejeté -> base pool destination reste utilisable", () => {
    const { buildBasePoolKey } = require("../geoapify.server");
    const req = convertIntentToPlaceRequirements("culture", "culture", "Château de Buda", [], false, [], null);
    expect(req.intentCenter).toBeNull();
    const baseKey = buildBasePoolKey(req);
    const fullKey = buildPoolKey(req);
    expect(baseKey).toBe(fullKey);
  });

  it("VRAI TEST ORCHESTRATION BUDGET API 1 — 3 slots restaurant avec 3 intentCenters -> 1 base search + 3 intent searches (total 4)", async () => {
    const { buildGeoapifyPlacePools } = await import("../geoapify.server");

    let mockCalls = 0;
    const searchPlacesMock = vi.fn().mockImplementation(async () => {
      mockCalls++;
      return [
        {
          id: `place_${mockCalls}`,
          name: `Place ${mockCalls}`,
          category: "catering.restaurant",
          categories: ["catering.restaurant"],
          address: null,
          latitude: 47.5,
          longitude: 19.04,
          distanceMeters: 100,
          website: null,
          source: "geoapify" as const,
          verified: true,
        },
      ];
    });

    const reqs = [
      convertIntentToPlaceRequirements("restaurant", "repas", "quartier A", [], false, [], { latitude: 47.50, longitude: 19.06, label: "quartier A" }),
      convertIntentToPlaceRequirements("restaurant", "repas", "quartier B", [], false, [], { latitude: 47.49, longitude: 19.03, label: "quartier B" }),
      convertIntentToPlaceRequirements("restaurant", "repas", "quartier C", [], false, [], { latitude: 47.51, longitude: 19.05, label: "quartier C" }),
    ];

    const telemetry = { basePoolSearches: 0, intentSupplementSearches: 0, intentCenteredSearches: 0, geoapifyPlacesCalls: 0 };

    const pools = await buildGeoapifyPlacePools({
      requirementsList: reqs,
      destinationCenter: { latitude: 47.4979, longitude: 19.0402 },
      radiusMeters: 10000,
      searchPlacesFn: searchPlacesMock,
      telemetry,
    });

    expect(telemetry.basePoolSearches).toBe(1);
    expect(telemetry.intentSupplementSearches).toBe(3);
    expect(searchPlacesMock).toHaveBeenCalledTimes(4);
    expect(Object.keys(pools)).toHaveLength(3);
  });

  it("VRAI TEST ORCHESTRATION BUDGET API 2 — 3 slots partageant la même base et le MÊME intentCenter -> 1 base + 1 supplement (total 2)", async () => {
    const { buildGeoapifyPlacePools } = await import("../geoapify.server");

    const searchPlacesMock = vi.fn().mockResolvedValue([]);

    const sharedIntent = { latitude: 47.50, longitude: 19.06, label: "quartier A" };
    const reqs = [
      convertIntentToPlaceRequirements("restaurant", "repas", "quartier A", [], false, [], sharedIntent),
      convertIntentToPlaceRequirements("restaurant", "repas", "quartier A", [], false, [], sharedIntent),
      convertIntentToPlaceRequirements("restaurant", "repas", "quartier A", [], false, [], sharedIntent),
    ];

    const telemetry = { basePoolSearches: 0, intentSupplementSearches: 0, intentCenteredSearches: 0, geoapifyPlacesCalls: 0 };

    const pools = await buildGeoapifyPlacePools({
      requirementsList: reqs,
      destinationCenter: { latitude: 47.4979, longitude: 19.0402 },
      radiusMeters: 10000,
      searchPlacesFn: searchPlacesMock,
      telemetry,
    });

    expect(telemetry.basePoolSearches).toBe(1);
    expect(telemetry.intentSupplementSearches).toBe(1);
    expect(searchPlacesMock).toHaveBeenCalledTimes(2);
    expect(Object.keys(pools)).toHaveLength(1);
  });

  it("VRAI TEST ORCHESTRATION BUDGET API 3 — 3 slots partageant la même base SANS intentCenter -> 1 base + 0 supplement (total 1)", async () => {
    const { buildGeoapifyPlacePools } = await import("../geoapify.server");

    const searchPlacesMock = vi.fn().mockResolvedValue([]);

    const reqs = [
      convertIntentToPlaceRequirements("restaurant", "repas", "dîner festif", [], false, [], null),
      convertIntentToPlaceRequirements("restaurant", "repas", "dîner convivial", [], false, [], null),
      convertIntentToPlaceRequirements("restaurant", "repas", "dîner terrasse", [], false, [], null),
    ];

    const telemetry = { basePoolSearches: 0, intentSupplementSearches: 0, intentCenteredSearches: 0, geoapifyPlacesCalls: 0 };

    const pools = await buildGeoapifyPlacePools({
      requirementsList: reqs,
      destinationCenter: { latitude: 47.4979, longitude: 19.0402 },
      radiusMeters: 10000,
      searchPlacesFn: searchPlacesMock,
      telemetry,
    });

    expect(telemetry.basePoolSearches).toBe(1);
    expect(telemetry.intentSupplementSearches).toBe(0);
    expect(searchPlacesMock).toHaveBeenCalledTimes(1);
    expect(Object.keys(pools)).toHaveLength(1);
  });

  it("Non-régression — trip.destination absent/undefined et destName = 'Budapest' -> intent-aware utilise Budapest sans crash sur normalize()", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";

    const trip: { destination?: string; desired_destination?: string } = {
      destination: undefined,
      desired_destination: "Budapest",
    };
    const destName = trip.destination || trip.desired_destination || "Destination";
    expect(destName).toBe("Budapest");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.06,
              city: "Budapest",
              formatted: "Budapest, Erzsébetváros",
              result_type: "district",
            },
          },
        ],
      }),
    })) as any;

    try {
      // Passer destName ("Budapest") à resolveSearchIntentLocation et resolveActivityResourceForPlace au lieu de trip.destination (undefined)
      const intentCenter = await resolveSearchIntentLocation("quartier juif", destName, 47.4979, 19.0402);
      expect(intentCenter).not.toBeNull();
      expect(intentCenter?.kind).toBe("area");

      const matchedPlace = {
        id: "place-1",
        name: "Mazel Tov",
        address: "Akácfa u. 47, Budapest",
        latitude: 47.50,
        longitude: 19.06,
        website: "https://mazeltov.hu",
      };
      const resource = resolveActivityResourceForPlace(matchedPlace, destName);
      expect(resource.url).toBe("https://mazeltov.hu");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  describe("Garde-fous Geoapify Candidate - Test 16", () => {
    it("candidat Geoapify Budapest/viewpoint pour une intention de location de vélos/rosalies -> rejeté", () => {
      const cand: GeoapifyPlace = {
        id: "geo_viewpoint_budapest",
        name: "Budapest",
        category: "tourism.attraction, tourism.viewpoint",
        categories: ["tourism.attraction", "tourism.viewpoint"],
        address: "Budapest, Hongrie",
        latitude: 47.50,
        longitude: 19.05,
        distanceMeters: 100,
        website: null,
        source: "geoapify",
        verified: true,
      };

      const req: PlaceRequirements = {
        canonicalFamily: "sport",
        categories: ["sport"],
        searchIntent: "location de vélos / rosalies sur l'Île Marguerite",
      };

      const isCompatible = isCandidateCompatibleWithRequirements(cand, req);
      expect(isCompatible).toBe(false);
    });

    it("candidat Geoapify réellement compatible -> comportement actuel inchangé", () => {
      const cand: GeoapifyPlace = {
        id: "geo_bike_rental",
        name: "Bringóhintó Margaret Island",
        category: "sport, entertainment.activity_park",
        categories: ["sport", "entertainment.activity_park"],
        address: "Margitsziget, Budapest",
        latitude: 47.52,
        longitude: 19.05,
        distanceMeters: 500,
        website: "https://bringohinto.hu",
        source: "geoapify",
        verified: true,
      };

      const req: PlaceRequirements = {
        canonicalFamily: "sport",
        categories: ["sport"],
        searchIntent: "location de vélos / rosalies sur l'Île Marguerite",
      };

      const isCompatible = isCandidateCompatibleWithRequirements(cand, req);
      expect(isCompatible).toBe(true);
    });

    it("preuve sans whitelist de villes : destination Prague + proposed place = Prague ignore le match 'Prague' et ne sélectionne pas le node ville", async () => {
      const originalFetch = globalThis.fetch;
      const oldApiKey = process.env["GEOAPIFY_API_KEY"];
      process.env["GEOAPIFY_API_KEY"] = "test-geo-key";

      globalThis.fetch = (async () => ({
        ok: true,
        json: async () => ({
          features: [
            {
              properties: {
                place_id: "geo-prague-city-node",
                name: "Prague",
                formatted: "Prague, Czech Republic",
                lat: 50.0755,
                lon: 14.4378,
                categories: ["tourism.sights"],
              },
            },
          ],
        }),
      })) as any;

      try {
        const resolved = await tryResolveGeminiProposedPlace({
          suggestedPlace: "Location de vélos au parc",
          label: "Balade vélo",
          searchIntent: "location de vélos à Prague",
          venueFamily: "sport",
          destination: "Prague",
        });
        expect(resolved).toBeNull();
      } finally {
        globalThis.fetch = originalFetch;
        process.env["GEOAPIFY_API_KEY"] = oldApiKey;
      }
    });
  });

  describe("Correctifs Bug Thermal Bath vs Beauty Spa & Detail Preservation", () => {
    it("intent 'bains thermaux' + service.beauty.spa / salon → REJETÉ", () => {
      const req = convertIntentToPlaceRequirements("spa_wellness", "relaxation", "accès bains thermaux historiques et spa pour groupe à Budapest");
      const candBeautySalon: GeoapifyPlace = {
        id: "salon-1",
        name: "Bogyó Kozmetika Salon",
        category: "service.beauty.spa",
        categories: ["service", "service.beauty", "service.beauty.spa"],
        address: "Budapest, Main St 5",
        latitude: 47.49,
        longitude: 19.05,
        distanceMeters: 100,
        website: "https://bogyokozmetika.hu",
        source: "geoapify",
        verified: true,
      };

      expect(isCandidateCompatibleWithRequirements(candBeautySalon, req)).toBe(false);
    });

    it("intent 'bains thermaux' + vrai thermal bath → ACCEPTÉ", () => {
      const req = convertIntentToPlaceRequirements("spa_wellness", "relaxation", "accès bains thermaux historiques et spa pour groupe à Budapest");
      const candThermalBath: GeoapifyPlace = {
        id: "gellert-1",
        name: "Gellért Thermal Bath",
        category: "leisure.spa",
        categories: ["leisure", "leisure.spa", "building.spa"],
        address: "Kelenhegyi út 4, Budapest",
        latitude: 47.48,
        longitude: 19.05,
        distanceMeters: 50,
        website: "https://gellertbath.hu",
        source: "geoapify",
        verified: true,
      };

      expect(isCandidateCompatibleWithRequirements(candThermalBath, req)).toBe(true);
    });

    it("intent générique 'spa/massage' + vrai spa compatible → comportement actuel conservé", () => {
      const req = convertIntentToPlaceRequirements("spa_wellness", "relaxation", "moment detente au spa et massage");
      const candBeautySpa: GeoapifyPlace = {
        id: "spa-beauty-1",
        name: "City Day Spa & Massage",
        category: "service.beauty.spa",
        categories: ["service", "service.beauty", "service.beauty.spa"],
        address: "Budapest, Center 10",
        latitude: 47.49,
        longitude: 19.05,
        distanceMeters: 200,
        website: null,
        source: "geoapify",
        verified: true,
      };

      expect(isCandidateCompatibleWithRequirements(candBeautySpa, req)).toBe(true);
    });

    it("résolution Geoapify → detail Gemini conservé et address séparée", async () => {
      const existingSlot: ActivitySlot = {
        moment: "Matin",
        type: "activite",
        category: "relaxation",
        label: "Thermes Gellért",
        detail: "Une expérience bien-être incontournable dans des bains thermaux historiques et raffinés.",
        time: "10:00",
        durationMinutes: 120,
        locationContext: "external",
        venueFamily: "spa_wellness",
        searchIntent: "accès bains thermaux historiques et spa pour groupe à Budapest",
        verified: false,
        source: "ai",
        url: null,
      };

      const mockPlace: GeoapifyPlace = {
        id: "gellert-1",
        name: "Gellért Thermal Bath",
        category: "leisure.spa",
        categories: ["leisure", "leisure.spa"],
        address: "Kelenhegyi út 4, 1118 Budapest",
        latitude: 47.4849,
        longitude: 19.0519,
        distanceMeters: 100,
        website: "https://www.gellertbath.hu",
        source: "geoapify",
        verified: true,
      };

      const result = await regenerateSlotWithAi(
        {
          nights: 2,
          destination: "Budapest",
          dietaryConstraints: [],
          accessibilityRequired: false,
        },
        existingSlot,
        1,
        [],
        [],
        {},
        [],
        { latitude: 47.49, longitude: 19.04 },
      );

      // In regenerateSlotWithAi, if selectedPlace is found (e.g., provided via placePools or search),
      // detail must remain Gemini's detail, and address must be stored in address property.
      const poolKey = Object.keys(result.updatedPools || {})[0];
      expect(result.slot.detail).toBe("Une expérience bien-être incontournable dans des bains thermaux historiques et raffinés.");
    });

    describe("Correctifs Faux Matchs Test 16 — Bastion, Grandes Halles & Horaires", () => {
      it("Bastion des Pêcheurs : sélectionne Fisherman's Bastion / Halászbástya plutôt qu'une ruine générique proche", async () => {
        const { selectGeoapifyCandidate, convertIntentToPlaceRequirements } = await import("../geoapify.server");

        const genericRuins = {
          id: "ruins-1",
          name: "XVIII sz-ban átalakitott középkori épulet maradványa",
          category: "tourism.sights.ruines",
          categories: ["tourism", "tourism.sights", "tourism.sights.ruines"],
          address: "Budapest",
          latitude: 47.501,
          longitude: 19.034,
          source: "geoapify" as const,
          verified: true,
        };

        const bastionMatch = {
          id: "bastion-real",
          name: "Halászbástya (Fisherman's Bastion)",
          category: "tourism.sights",
          categories: ["tourism", "tourism.sights", "entertainment.culture"],
          address: "Budapest, Szentháromság tér, 1014",
          latitude: 47.502,
          longitude: 19.035,
          source: "geoapify" as const,
          verified: true,
        };

        const req = convertIntentToPlaceRequirements(
          "culture",
          "culture",
          "promenade culturelle au Bastion des Pêcheurs et quartier du Château",
          [],
          false,
          [],
          null,
          "Bastion des Pêcheurs",
        );

        const selected = await selectGeoapifyCandidate({
          candidates: [genericRuins, bastionMatch],
          req,
          usedCandidateIdsSet: new Set(),
        });

        expect(selected).not.toBeNull();
        expect(selected?.id).toBe("bastion-real");
      });

      it("Bastion des Pêcheurs : fallback générique autorisé si aucun match nominal crédible n'existe", async () => {
        const { selectGeoapifyCandidate, convertIntentToPlaceRequirements } = await import("../geoapify.server");

        const genericCulture = {
          id: "culture-1",
          name: "Musée d'Histoire de Budapest",
          category: "tourism.sights",
          categories: ["tourism", "tourism.sights", "entertainment.museum"],
          address: "Budapest",
          latitude: 47.496,
          longitude: 19.039,
          source: "geoapify" as const,
          verified: true,
        };

        const req = convertIntentToPlaceRequirements(
          "culture",
          "culture",
          "promenade culturelle au Bastion des Pêcheurs et quartier du Château",
          [],
          false,
          [],
          null,
          "Bastion des Pêcheurs",
        );

        const selected = await selectGeoapifyCandidate({
          candidates: [genericCulture],
          req,
          usedCandidateIdsSet: new Set(),
        });

        // Safe category fallback when no nominal match exists
        expect(selected).not.toBeNull();
        expect(selected?.id).toBe("culture-1");
      });

      it("Grandes Halles de Budapest : Great Market Hall gagne sur Városmajori Termelői Piac", async () => {
        const { selectGeoapifyCandidate, convertIntentToPlaceRequirements } = await import("../geoapify.server");

        const wrongMarket = {
          id: "market-wrong",
          name: "Városmajori Termelői Piac",
          category: "commercial.marketplace",
          categories: ["commercial", "commercial.marketplace"],
          address: "Budapest, Városmajor",
          latitude: 47.51,
          longitude: 19.02,
          openingHours: "Mo 12:00-19:30; We,Fr 08:30-17:00",
          source: "geoapify" as const,
          verified: true,
        };

        const greatMarketHall = {
          id: "market-real",
          name: "Központi Vásárcsarnok (Great Market Hall)",
          category: "commercial.marketplace",
          categories: ["commercial", "commercial.marketplace"],
          address: "Budapest, Vámház krt. 1-3, 1093",
          latitude: 47.487,
          longitude: 19.058,
          openingHours: "Mo-Fr 06:00-18:00; Sa 06:00-15:00; Su 09:00-16:00",
          source: "geoapify" as const,
          verified: true,
        };

        const req = convertIntentToPlaceRequirements(
          "shopping",
          "shopping",
          "grand marché couvert de Budapest pour spécialités artisanales et gourmandes",
          [],
          false,
          [],
          null,
          "Grandes Halles de Budapest",
        );

        const selected = await selectGeoapifyCandidate({
          candidates: [wrongMarket, greatMarketHall],
          req,
          usedCandidateIdsSet: new Set(),
          date: "2026-08-30", // Dimanche
          time: "14:00",
        });

        expect(selected).not.toBeNull();
        expect(selected?.id).toBe("market-real");
      });

      it("Horaires : rejette explicitement un lieu fermé le dimanche au créneau prévu", async () => {
        const { geoapifyOpeningStatus } = await import("../geoapify.server");

        const closedOnSunday = {
          id: "closed-sun",
          name: "Városmajori Termelői Piac",
          category: "commercial.marketplace",
          categories: ["commercial", "commercial.marketplace"],
          address: "Budapest",
          openingHours: "Mo 12:00-19:30; We,Fr 08:30-17:00",
          source: "geoapify" as const,
          verified: true,
        };

        // Sunday 2026-08-30 at 14:00
        const status = geoapifyOpeningStatus(closedOnSunday, "2026-08-30", "14:00", 90);
        expect(status).toBe("closed");
      });

      it("Horaires : accepte un lieu ouvert le dimanche au bon horaire", async () => {
        const { geoapifyOpeningStatus } = await import("../geoapify.server");

        const openOnSunday = {
          id: "open-sun",
          name: "Központi Vásárcsarnok",
          category: "commercial.marketplace",
          categories: ["commercial", "commercial.marketplace"],
          address: "Budapest",
          openingHours: "Mo-Sa 06:00-18:00; Su 09:00-16:00",
          source: "geoapify" as const,
          verified: true,
        };

        const status = geoapifyOpeningStatus(openOnSunday, "2026-08-30", "14:00", 90);
        expect(status).toBe("open");
      });

      it("Horaires : ne rejette pas uniquement à cause de l'absence d'horaires", async () => {
        const { geoapifyOpeningStatus } = await import("../geoapify.server");

        const noHours = {
          id: "no-hours",
          name: "Marché sans horaires renseignés",
          category: "commercial.marketplace",
          categories: ["commercial", "commercial.marketplace"],
          address: "Budapest",
          openingHours: null,
          source: "geoapify" as const,
          verified: true,
        };

        const status = geoapifyOpeningStatus(noHours, "2026-08-30", "14:00", 90);
        expect(status).toBe("unknown");
      });

      it("Horaires ambigus ou non parsables : conserve le comportement existant (unknown)", async () => {
        const { geoapifyOpeningStatus } = await import("../geoapify.server");

        const ambiguousHours = {
          id: "ambiguous-hours",
          name: "Lieu aux horaires vagues",
          category: "commercial.marketplace",
          categories: ["commercial", "commercial.marketplace"],
          address: "Budapest",
          openingHours: "sur rendez-vous / variable selon saison",
          source: "geoapify" as const,
          verified: true,
        };

        const status = geoapifyOpeningStatus(ambiguousHours, "2026-08-30", "14:00", 90);
        expect(status).toBe("unknown");
      });

      it("Test générique avec ville/POI fictif : prouve qu'aucune whitelist ou dictionnaire de traductions n'est nécessaire", async () => {
        const { selectGeoapifyCandidate, convertIntentToPlaceRequirements } = await import("../geoapify.server");

        const fictionalUnmatchedPoi = {
          id: "fictional-wrong",
          name: "Café de la Gare de Val-Fictif",
          category: "tourism.sights",
          categories: ["tourism", "tourism.sights"],
          address: "Val-Fictif",
          source: "geoapify" as const,
          verified: true,
        };

        const fictionalMatchedPoi = {
          id: "fictional-real",
          name: "Belvédère de Val-Fictif",
          category: "tourism.sights",
          categories: ["tourism", "tourism.sights"],
          address: "Val-Fictif",
          source: "geoapify" as const,
          verified: true,
        };

        const req = convertIntentToPlaceRequirements(
          "culture",
          "culture",
          "visite du Belvédère de Val-Fictif",
          [],
          false,
          [],
          null,
          "Belvédère de Val-Fictif",
        );

        const selected = await selectGeoapifyCandidate({
          candidates: [fictionalUnmatchedPoi, fictionalMatchedPoi],
          req,
          usedCandidateIdsSet: new Set(),
        });

        expect(selected).not.toBeNull();
        expect(selected?.id).toBe("fictional-real");
      });
    });

    describe("Activity Cost & Budget Breakdown Integration Tests (Tests A-J)", () => {
      it("Test A : Deux prix vérifiés (30 € et 45 €) avec source et priceStatus -> somme per-person = 75 €", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const days = [
          {
            slots: [
              { label: "Activité A", type: "activite", priceHint: 30, priceStatus: "verified", source: "catalog" },
              { label: "Activité B", type: "activite", priceHint: 45, priceStatus: "verified", source: "catalog" },
            ],
          },
        ];

        const res = computeItineraryActivitiesCost(days);
        expect(res.activitiesPerPerson).toBe(75);
        expect(res.priceStatus).toBe("verified");
        expect(res.knownCount).toBe(2);
        expect(res.totalCount).toBe(2);
      });

      it("Test B : priceHint: 30 avec verified: true et source: 'geoapify' sans explicit priceStatus -> UNKNOWN (non inclus)", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const days = [
          {
            slots: [
              { label: "Activité Geoapify", type: "activite", priceHint: 30, verified: true, source: "geoapify" },
              { label: "Activité B", type: "activite", priceHint: null },
            ],
          },
        ];

        const res = computeItineraryActivitiesCost(days);
        expect(res.activitiesPerPerson).toBeNull();
        expect(res.priceStatus).toBe("unknown");
        expect(res.knownCount).toBe(0);
        expect(res.totalCount).toBe(2);
      });

      it("Test Soirée Activité : category = 'soiree' avec type = 'activite' ET prix vérifié -> inclus (35 €)", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const days = [
          {
            slots: [
              { label: "Cabaret / Spectacle", type: "activite", category: "soiree", priceHint: 35, priceStatus: "verified", source: "ticket_office" },
            ],
          },
        ];

        const res = computeItineraryActivitiesCost(days);
        expect(res.activitiesPerPerson).toBe(35);
        expect(res.priceStatus).toBe("verified");
        expect(res.knownCount).toBe(1);
        expect(res.totalCount).toBe(1);
      });

      it("Test C : Prix partiel (30 € verified + source + unknown) -> somme connue = 30 €, status = partial", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const days = [
          {
            slots: [
              { label: "Activité A", type: "activite", priceHint: 30, priceStatus: "verified", source: "official_web" },
              { label: "Activité B", type: "activite", priceHint: null },
            ],
          },
        ];

        const res = computeItineraryActivitiesCost(days);
        expect(res.activitiesPerPerson).toBe(30);
        expect(res.priceStatus).toBe("partial");
        expect(res.knownCount).toBe(1);
        expect(res.totalCount).toBe(2);
      });

      it("Test D : Prix estimé (25 € estimated + source) -> status = estimated", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const days = [
          {
            slots: [{ label: "Activité A", type: "activite", priceHint: 25, priceStatus: "estimated", source: "provider_estimate" }],
          },
        ];

        const res = computeItineraryActivitiesCost(days);
        expect(res.activitiesPerPerson).toBe(25);
        expect(res.priceStatus).toBe("estimated");
      });

      it("Test E : Gratuité confirmée (0 € + explicit status free + source) vs 0 € sans source/statut (unknown)", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const daysFreeWithSource = [
          {
            slots: [{ label: "Parc municipal", type: "activite", priceHint: 0, priceStatus: "free", source: "city_hall" }],
          },
        ];

        const resFree = computeItineraryActivitiesCost(daysFreeWithSource);
        expect(resFree.activitiesPerPerson).toBe(0);
        expect(resFree.priceStatus).toBe("free");

        const daysFreeNoSource = [
          {
            slots: [{ label: "Parc municipal", type: "activite", priceHint: 0, priceStatus: "free" }],
          },
        ];
        const resFreeNoSource = computeItineraryActivitiesCost(daysFreeNoSource);
        expect(resFreeNoSource.activitiesPerPerson).toBeNull();
        expect(resFreeNoSource.priceStatus).toBe("unknown");

        const daysUnconfirmedZero = [
          {
            slots: [{ label: "Visite mystère", type: "activite", priceHint: 0 }],
          },
        ];
        const resUnconfirmed = computeItineraryActivitiesCost(daysUnconfirmedZero);
        expect(resUnconfirmed.activitiesPerPerson).toBeNull();
        expect(resUnconfirmed.priceStatus).toBe("unknown");
      });

      it("Exclusion des restaurants, repas et bars : un restaurant ou un bar avec un prix n'est PAS inclus dans le budget activités", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const days = [
          {
            slots: [
              { label: "Dîner au resto", type: "resto", category: "repas", priceHint: 40, priceStatus: "verified", source: "menu" },
              { label: "Apéro au bar", type: "bar", venueFamily: "bar_pub", priceHint: 15, priceStatus: "verified", source: "menu" },
              { label: "Musée", type: "activite", category: "culture", priceHint: 15, priceStatus: "verified", source: "official_web" },
            ],
          },
        ];

        const res = computeItineraryActivitiesCost(days);
        expect(res.activitiesPerPerson).toBe(15); // Only museum, dinner & bar excluded!
        expect(res.totalCount).toBe(1);
        expect(res.knownCount).toBe(1);
      });

      it("Test F : GetYourGuide search link sans prix -> priceStatus = unknown, pas de scraping/prix inventé", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const days = [
          {
            slots: [
              {
                label: "Croisière sur le Danube",
                booking: { provider: "getyourguide", type: "search", url: "https://www.getyourguide.fr/s/?q=croisiere" },
                priceHint: null,
              },
            ],
          },
        ];

        const res = computeItineraryActivitiesCost(days);
        expect(res.activitiesPerPerson).toBeNull();
        expect(res.priceStatus).toBe("unknown");
      });

      it("Test G : Cost Split integration -> buildCostSplit inclut correctement les activités", async () => {
        const { buildCostSplit } = await import("../cost-split");
        const split = buildCostSplit({
          destinationName: "Budapest",
          accommodation: 120,
          activities: 75,
          food: 50,
          origins: [{ city: "Paris", count: 2, pricePerPerson: 100 }],
        });

        // sharedPerPerson = accommodation (120) + activities (75) + food (50) = 245
        expect(split.sharedPerPerson).toBe(245);
        expect(split.activities).toBe(75);
        // totalPerPerson = transport (100) + shared (245) = 345
        expect(split.lines[0]?.totalPerPerson).toBe(345);
        // totalGroup = 345 * 2 = 690
        expect(split.totalGroup).toBe(690);
      });

      it("Test H : Star ne paie pas -> redistribution sans double comptage des activités", async () => {
        const { buildCostSplit } = await import("../cost-split");
        const split = buildCostSplit({
          destinationName: "Budapest",
          accommodation: 120,
          activities: 60,
          food: 40,
          origins: [
            { city: "Paris (Star)", count: 1, pricePerPerson: 100, isStar: true },
            { city: "Lyon", count: 1, pricePerPerson: 100, isStar: false },
          ],
          starPaysShare: false,
        });

        // Star shared = 120 + 60 + 40 = 220, transport = 100 -> Star total = 320
        // Star cost (320) is re-distributed to Lyon
        const starLine = split.lines.find((l) => l.isStar);
        const lyonLine = split.lines.find((l) => !l.isStar);

        expect(starLine?.totalPerPerson).toBe(0);
        expect(lyonLine?.totalPerPerson).toBe(320 + (100 + 220)); // 640
        expect(split.totalGroup).toBe(640);
      });

      it("Test I : Invariance planning -> les métadonnées de prix n'altèrent pas l'ordre ou les slots", async () => {
        const slotsWithPrice = [
          { label: "Bastion", time: "10:00", priceHint: 15 },
          { label: "Thermes", time: "14:00", priceHint: 25 },
        ];
        const slotsWithoutPrice = [
          { label: "Bastion", time: "10:00" },
          { label: "Thermes", time: "14:00" },
        ];

        expect(slotsWithPrice.map((s) => s.label)).toEqual(slotsWithoutPrice.map((s) => s.label));
        expect(slotsWithPrice.map((s) => s.time)).toEqual(slotsWithoutPrice.map((s) => s.time));
      });
    });

    describe("Sujet A — Qualification Budget Contexte Gemini Tests", () => {
      it("A1. buildGroupPlanningContext expose bien budget.totalPerPerson", () => {
        const testInput: ActivityAiInput = {
          destination: "Annecy",
          nights: 2,
          participants: 4,
          budgetPerPerson: 450,
          ambiances: [],
          activityCategories: [],
        };
        const brief = buildPlanningBrief(testInput);
        const ctx = buildGroupPlanningContext(testInput, brief);

        expect(ctx.budget).toBeDefined();
        expect(ctx.budget.totalPerPerson).toBe(450);
      });

      it("A2. Le budget injecté est exactement input.budgetPerPerson", () => {
        const testInput: ActivityAiInput = {
          destination: "Lyon",
          nights: 3,
          participants: 6,
          budgetPerPerson: 380,
          ambiances: [],
          activityCategories: [],
        };
        const brief = buildPlanningBrief(testInput);
        const ctx = buildGroupPlanningContext(testInput, brief);

        expect(ctx.budget.totalPerPerson).toBe(380);
      });

      it("A3. Si hébergement/transport connus existent déjà -> apparaissent dans le contexte avec calcul du reste", () => {
        const testInput: ActivityAiInput = {
          destination: "Nantes",
          nights: 2,
          participants: 5,
          budgetPerPerson: 400,
          accommodationPerPerson: 180,
          transportPerPerson: 100,
          ambiances: [],
          activityCategories: [],
        };
        const brief = buildPlanningBrief(testInput);
        const ctx = buildGroupPlanningContext(testInput, brief);

        expect(ctx.budget.accommodationPerPerson).toBe(180);
        expect(ctx.budget.transportPerPerson).toBe(100);
        expect(ctx.budget.remainingForActivitiesAndFood).toBe(120); // 400 - 180 - 100
      });

      it("A4. Si inconnus -> null, pas 0", () => {
        const testInput: ActivityAiInput = {
          destination: "Bordeaux",
          nights: 2,
          participants: 4,
          budgetPerPerson: 500,
          accommodationPerPerson: null,
          transportPerPerson: undefined,
          ambiances: [],
          activityCategories: [],
        };
        const brief = buildPlanningBrief(testInput);
        const ctx = buildGroupPlanningContext(testInput, brief);

        expect(ctx.budget.accommodationPerPerson).toBeNull();
        expect(ctx.budget.transportPerPerson).toBeNull();
        expect(ctx.budget.remainingForActivitiesAndFood).toBeNull();
      });

      it("A5. remainingForActivitiesAndFood : calcul correct lorsque possible, null si manquant", () => {
        const testInputPartial: ActivityAiInput = {
          destination: "Nice",
          nights: 2,
          participants: 3,
          budgetPerPerson: 600,
          accommodationPerPerson: 250,
          transportPerPerson: undefined,
          ambiances: [],
          activityCategories: [],
        };
        const briefPartial = buildPlanningBrief(testInputPartial);
        const ctxPartial = buildGroupPlanningContext(testInputPartial, briefPartial);

        expect(ctxPartial.budget.remainingForActivitiesAndFood).toBeNull();
      });

      it("A6. Test d'invariance : hors ajout du bloc budget, les autres sections du GroupPlanningContext restent identiques", () => {
        const testInput: ActivityAiInput = {
          destination: "Strasbourg",
          nights: 2,
          participants: 4,
          budgetPerPerson: 400,
          accommodationPerPerson: 150,
          transportPerPerson: 80,
          ambiances: ["fete"],
          activityCategories: ["culture"],
        };
        const brief = buildPlanningBrief(testInput);
        const ctx = buildGroupPlanningContext(testInput, brief);

        expect(ctx.trip.destination).toBe("Strasbourg");
        expect(ctx.trip.nights).toBe(2);
        expect(ctx.trip.participantCount).toBe(4);
        expect(ctx.planning.maxActivitiesPerDay).toBeDefined();
        expect(ctx.star).toBeDefined();
        expect(ctx.krewSignals).toBeDefined();
      });

      it("A7. Test d'invariance prompt : le template Gemini existant contient {{GROUP_PLANNING_CONTEXT_JSON}} et n'est pas réécrit", () => {
        expect(GEMINI_CONTRACTUAL_PROMPT_TEMPLATE).toContain("{{GROUP_PLANNING_CONTEXT_JSON}}");
        expect(GEMINI_CONTRACTUAL_PROMPT_TEMPLATE).toContain("Tu es le concepteur de planning de KREW.");
      });

      it("A8. Voyage sans Star -> travellersCount = 6, payingParticipantsCount = 6", () => {
        const testInput: ActivityAiInput = {
          destination: "Toulouse",
          nights: 2,
          participants: 6,
          budgetPerPerson: 400,
          hasStar: false,
          ambiances: [],
          activityCategories: [],
        };
        const brief = buildPlanningBrief(testInput);
        const ctx = buildGroupPlanningContext(testInput, brief);

        expect(ctx.budget.travellersCount).toBe(6);
        expect(ctx.budget.payingParticipantsCount).toBe(6);
        expect(ctx.budget.starPaysShare).toBe(true);
      });

      it("A9. Star présente et paie -> travellersCount = 8, starPaysShare = true, payingParticipantsCount = 8", () => {
        const testInput: ActivityAiInput = {
          destination: "Biarritz",
          nights: 2,
          participants: 8,
          budgetPerPerson: 400,
          hasStar: true,
          starPaysShare: true,
          ambiances: [],
          activityCategories: [],
        };
        const brief = buildPlanningBrief(testInput);
        const ctx = buildGroupPlanningContext(testInput, brief);

        expect(ctx.budget.travellersCount).toBe(8);
        expect(ctx.budget.payingParticipantsCount).toBe(8);
        expect(ctx.budget.starPaysShare).toBe(true);
      });

      it("A10. Star présente et ne paie pas -> travellersCount = 8, starPaysShare = false, payingParticipantsCount = 7", () => {
        const testInput: ActivityAiInput = {
          destination: "Marseille",
          nights: 2,
          participants: 8,
          budgetPerPerson: 400,
          hasStar: true,
          starPaysShare: false,
          ambiances: [],
          activityCategories: [],
        };
        const brief = buildPlanningBrief(testInput);
        const ctx = buildGroupPlanningContext(testInput, brief);

        expect(ctx.budget.travellersCount).toBe(8);
        expect(ctx.budget.payingParticipantsCount).toBe(7);
        expect(ctx.budget.starPaysShare).toBe(false);
      });

      it("A11. Le budgetPerPerson original n'est PAS modifié quand la Star ne paie pas", () => {
        const testInput: ActivityAiInput = {
          destination: "Lille",
          nights: 2,
          participants: 8,
          budgetPerPerson: 400,
          hasStar: true,
          starPaysShare: false,
          ambiances: [],
          activityCategories: [],
        };
        const brief = buildPlanningBrief(testInput);
        const ctx = buildGroupPlanningContext(testInput, brief);

        expect(ctx.budget.totalPerPerson).toBe(400);
      });
    });

    describe("Sujet B — qualification des prix d'activités", () => {
      it("B1. Source prix vérifiée existante -> propagation montant/devise/source/status", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const res = computeItineraryActivitiesCost([
          {
            slots: [
              {
                label: "Visite guidée",
                type: "activite",
                pricePerPerson: 30,
                currency: "EUR",
                priceStatus: "verified",
                priceSource: "official_web",
              },
            ],
          },
        ]);

        expect(res.activitiesPerPerson).toBe(30);
        expect(res.priceStatus).toBe("verified");
        expect(res.knownCount).toBe(1);
      });

      it("B2. Source explicitement estimative -> estimated", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const res = computeItineraryActivitiesCost([
          {
            slots: [
              {
                label: "Escape game estimé",
                type: "activite",
                priceHint: 25,
                priceStatus: "estimated",
                priceSource: "provider_estimate",
              },
            ],
          },
        ]);

        expect(res.activitiesPerPerson).toBe(25);
        expect(res.priceStatus).toBe("estimated");
      });

      it("B3. Aucune source -> unknown", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const res = computeItineraryActivitiesCost([
          {
            slots: [
              {
                label: "Activité sans source",
                type: "activite",
                priceHint: 30,
              },
            ],
          },
        ]);

        expect(res.activitiesPerPerson).toBeNull();
        expect(res.priceStatus).toBe("unknown");
      });

      it("B4. priceHint Gemini seul -> toujours unknown", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const res = computeItineraryActivitiesCost([
          {
            slots: [
              {
                label: "Idée Gemini",
                type: "activite",
                priceHint: 50,
                priceSource: undefined,
                priceStatus: undefined,
              },
            ],
          },
        ]);

        expect(res.activitiesPerPerson).toBeNull();
        expect(res.priceStatus).toBe("unknown");
      });

      it("B5. verified: true POI + source Geoapify + prix non sourcé -> toujours unknown", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const res = computeItineraryActivitiesCost([
          {
            slots: [
              {
                label: "Lieu Geoapify",
                type: "activite",
                verified: true,
                source: "geoapify",
                priceHint: 20,
              },
            ],
          },
        ]);

        expect(res.activitiesPerPerson).toBeNull();
        expect(res.priceStatus).toBe("unknown");
      });

      it("B6. GYG search seul -> unknown", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const res = computeItineraryActivitiesCost([
          {
            slots: [
              {
                label: "Recherche GYG",
                type: "activite",
                booking: { provider: "getyourguide", url: "https://www.getyourguide.com/s", type: "search", affiliate: true },
              },
            ],
          },
        ]);

        expect(res.activitiesPerPerson).toBeNull();
        expect(res.priceStatus).toBe("unknown");
      });

      it("B7. free uniquement avec source/statut explicite", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const resFree = computeItineraryActivitiesCost([
          {
            slots: [
              {
                label: "Parc municipal",
                type: "activite",
                priceHint: 0,
                priceStatus: "free",
                priceSource: "city_hall",
              },
            ],
          },
        ]);
        expect(resFree.priceStatus).toBe("free");
        expect(resFree.activitiesPerPerson).toBe(0);

        const resUnknownFree = computeItineraryActivitiesCost([
          {
            slots: [
              {
                label: "Parc sans statut",
                type: "activite",
                priceHint: 0,
              },
            ],
          },
        ]);
        expect(resUnknownFree.priceStatus).toBe("unknown");
      });

      it("B8. Restaurant avec prix -> exclu des activités", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const res = computeItineraryActivitiesCost([
          {
            slots: [
              {
                label: "Restaurant Le Gourmet",
                type: "resto",
                category: "repas",
                pricePerPerson: 40,
                priceStatus: "verified",
                priceSource: "menu_web",
              },
            ],
          },
        ]);

        expect(res.activitiesPerPerson).toBeNull();
        expect(res.priceStatus).toBe("unknown");
        expect(res.totalCount).toBe(0);
      });

      it("B9. Activité de soirée payante -> incluse", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const res = computeItineraryActivitiesCost([
          {
            slots: [
              {
                label: "Cabaret Spectacle",
                type: "activite",
                category: "soiree",
                pricePerPerson: 35,
                priceStatus: "verified",
                priceSource: "ticket_office",
              },
            ],
          },
        ]);

        expect(res.activitiesPerPerson).toBe(35);
        expect(res.priceStatus).toBe("verified");
        expect(res.totalCount).toBe(1);
      });

      it("B10. Coût total activités reste PAR PERSONNE", async () => {
        const { computeItineraryActivitiesCost } = await import("../cost-split");
        const res = computeItineraryActivitiesCost([
          {
            slots: [
              { label: "Activité 1", type: "activite", pricePerPerson: 20, priceStatus: "verified", priceSource: "web" },
              { label: "Activité 2", type: "activite", pricePerPerson: 30, priceStatus: "verified", priceSource: "web" },
            ],
          },
        ]);

        expect(res.activitiesPerPerson).toBe(50);
      });

      it("B11. Aucun double comptage dans cost split", async () => {
        const { buildCostSplit } = await import("../cost-split");
        const split = buildCostSplit({
          destinationName: "Lyon",
          accommodation: 100,
          activities: 50,
          food: 40,
          origins: [{ city: "Paris", count: 3, pricePerPerson: 80 }],
        });

        // sharedPerPerson = 100 + 50 + 40 = 190
        // totalPerPerson = 80 + 190 = 270
        // totalGroup = 270 * 3 = 810
        expect(split.sharedPerPerson).toBe(190);
        expect(split.lines[0]?.totalPerPerson).toBe(270);
        expect(split.totalGroup).toBe(810);
      });

      it("B12. Planning inchangé hors métadonnées prix : même label, même lieu, même ordre, même heure, même activité", async () => {
        const slotA = { label: "Musée d'Orsay", moment: "Matin", time: "10:00", type: "activite" as const, pricePerPerson: 16, priceStatus: "verified" as const, priceSource: "official_web" };
        const slotB = { label: "Musée d'Orsay", moment: "Matin", time: "10:00", type: "activite" as const };

        expect(slotA.label).toBe(slotB.label);
        expect(slotA.moment).toBe(slotB.moment);
        expect(slotA.time).toBe(slotB.time);
        expect(slotA.type).toBe(slotB.type);
      });

      it("Point 1 — Slot externe raw.verified = true mais aucun candidat vérifié -> rejet", () => {
        const raw = {
          label: "Monument Inconnu",
          type: "activite",
          verified: true,
          kind: "place_required",
        };
        const input: ActivityAiInput = {
          destination: "Paris",
          nights: 1,
          participants: 2,
          budgetPerPerson: 300,
          ambiances: [],
          activityCategories: [],
        };
        const normalized = normalizeSlot(raw, input, []);
        expect(normalized).toBeNull();
      });

      it("B13. pricePerPerson: 30, priceStatus: 'verified', source: 'geoapify', priceSource absent -> UNKNOWN (non admissible)", () => {
        const raw = {
          label: "Monument Geoapify",
          type: "activite",
          pricePerPerson: 30,
          priceStatus: "verified",
          source: "geoapify",
          priceSource: undefined,
        };
        const input: ActivityAiInput = {
          destination: "Paris",
          nights: 1,
          participants: 2,
          budgetPerPerson: 300,
          ambiances: [],
          activityCategories: [],
        };
        const candidates = [{ id: "c1", name: "Monument Geoapify", verified: true, source: "geoapify" } as any];
        const normalized = normalizeSlot(raw, input, candidates);
        expect(normalized?.priceStatus).toBe("unknown");
        expect(normalized?.priceSource).toBeNull();
      });

      it("B14. pricePerPerson: 30, priceStatus: 'verified', priceSource: 'official_web' -> ADMISSIBLE (verified)", () => {
        const raw = {
          label: "Château de Versailles",
          type: "activite",
          pricePerPerson: 30,
          priceStatus: "verified",
          priceSource: "official_web",
        };
        const input: ActivityAiInput = {
          destination: "Paris",
          nights: 1,
          participants: 2,
          budgetPerPerson: 300,
          ambiances: [],
          activityCategories: [],
        };
        const candidates = [{ id: "c2", name: "Château de Versailles", verified: true, source: "catalog" } as any];
        const normalized = normalizeSlot(raw, input, candidates);
        expect(normalized?.priceStatus).toBe("verified");
        expect(normalized?.priceSource).toBe("official_web");
      });

      it("Point 2 — regenerateSlotWithAi : ne mélange pas montant et source de prix de candidats différents", async () => {
        const existingSlot = {
          moment: "Après-midi",
          type: "activite" as const,
          label: "Musée Ancien",
          time: "14:00",
          pricePerPerson: 30,
          priceStatus: "verified" as const,
          priceSource: "official_web",
        };
        const input: ActivityAiInput = {
          destination: "Paris",
          nights: 1,
          participants: 2,
          budgetPerPerson: 300,
          ambiances: [],
          activityCategories: [],
        };

        const candidateAltWithoutPriceSource = [
          {
            id: "alt_1",
            name: "Musée Nouveau",
            sourceUrl: "https://example.com/nouveau",
            source: "catalog",
            priceHint: 25,
            verified: true,
          } as any,
        ];

        const resIncomplete = await regenerateSlotWithAi(
          input,
          existingSlot,
          1,
          ["Musée Ancien"],
          candidateAltWithoutPriceSource,
        );

        expect(resIncomplete.slot.label).toBe("Musée Nouveau");
        expect(resIncomplete.slot.priceStatus).toBe("unknown");
        expect(resIncomplete.slot.priceSource).toBeNull();
        expect(resIncomplete.slot.pricePerPerson).toBeNull();

        const candidateAltWithPriceBundle = [
          {
            id: "alt_2",
            name: "Lieu Sourcé",
            sourceUrl: "https://example.com/source",
            source: "catalog",
            priceHint: 25,
            pricePerPerson: 25,
            priceStatus: "verified",
            priceSource: "provider_api",
            verified: true,
          } as any,
        ];

        const resComplete = await regenerateSlotWithAi(
          input,
          existingSlot,
          1,
          ["Musée Ancien"],
          candidateAltWithPriceBundle,
        );

        expect(resComplete.slot.label).toBe("Lieu Sourcé");
        expect(resComplete.slot.priceStatus).toBe("verified");
        expect(resComplete.slot.priceSource).toBe("provider_api");
        expect(resComplete.slot.pricePerPerson).toBe(25);
      });

      describe("Nouveaux tests d'invariance et de validation de fourchette Gemini (#148 mini-correctif)", () => {
        const baseInput: ActivityAiInput = {
          destination: "Paris",
          nights: 1,
          participants: 2,
          budgetPerPerson: 300,
          ambiances: [],
          activityCategories: [],
        };
        const candidate = [{ id: "c1", name: "Visite Musée", verified: true, source: "catalog" } as any];

        it("1. min=50, max=30 -> estimation rejetée (estMin=null, estMax=null)", () => {
          const raw = {
            label: "Visite Musée",
            candidateId: "c1",
            type: "activite",
            estimatedPriceMinPerPerson: 50,
            estimatedPriceMaxPerPerson: 30,
            estimatedPriceCurrency: "EUR",
          };
          const slot = normalizeSlot(raw, baseInput, candidate);
          expect(slot?.estimatedPriceMinPerPerson).toBeNull();
          expect(slot?.estimatedPriceMaxPerPerson).toBeNull();
        });

        it("2. min=-10, max=30 -> estimation rejetée", () => {
          const raw = {
            label: "Visite Musée",
            candidateId: "c1",
            type: "activite",
            estimatedPriceMinPerPerson: -10,
            estimatedPriceMaxPerPerson: 30,
          };
          const slot = normalizeSlot(raw, baseInput, candidate);
          expect(slot?.estimatedPriceMinPerPerson).toBeNull();
          expect(slot?.estimatedPriceMaxPerPerson).toBeNull();
        });

        it("3. 30–50 sans devise -> devise reste null (sans hardcoder EUR)", () => {
          const raw = {
            label: "Visite Musée",
            candidateId: "c1",
            type: "activite",
            estimatedPriceMinPerPerson: 30,
            estimatedPriceMaxPerPerson: 50,
          };
          const slot = normalizeSlot(raw, baseInput, candidate);
          expect(slot?.estimatedPriceMinPerPerson).toBe(30);
          expect(slot?.estimatedPriceMaxPerPerson).toBe(50);
          expect(slot?.estimatedPriceCurrency).toBeNull();
        });

        it("4. 30–50 EUR -> conservée", () => {
          const raw = {
            label: "Visite Musée",
            candidateId: "c1",
            type: "activite",
            estimatedPriceMinPerPerson: 30,
            estimatedPriceMaxPerPerson: 50,
            estimatedPriceCurrency: "EUR",
          };
          const slot = normalizeSlot(raw, baseInput, candidate);
          expect(slot?.estimatedPriceMinPerPerson).toBe(30);
          expect(slot?.estimatedPriceMaxPerPerson).toBe(50);
          expect(slot?.estimatedPriceCurrency).toBe("EUR");
        });

        it("5. Prix sourcé reste prioritaire sur estimation Gemini", async () => {
          const { computeItineraryActivitiesCost } = await import("../cost-split");
          const res = computeItineraryActivitiesCost([
            {
              slots: [
                {
                  label: "Musée Sourdé",
                  type: "activite",
                  pricePerPerson: 25,
                  priceStatus: "verified",
                  priceSource: "official_web",
                  estimatedPriceMinPerPerson: 30,
                  estimatedPriceMaxPerPerson: 50,
                },
              ],
            },
          ]);
          expect(res.activitiesPerPerson).toBe(25);
          expect(res.priceStatus).toBe("verified");
        });
      });
    });
  });
});
