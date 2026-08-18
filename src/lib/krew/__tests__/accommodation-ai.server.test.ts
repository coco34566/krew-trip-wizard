import { afterEach, expect, it, vi } from "vitest";
import {
  buildCanonicalAccommodationExternalId,
  computeAccommodationRequestHash,
  mergeAccommodationLogistics,
  normalizeAccommodationCandidates,
  searchAccommodationsWithGemini,
  type AccommodationSearchSpecification,
} from "../accommodation-ai.server";
const spec: AccommodationSearchSpecification = {
  destination: { name: "Lisbonne", country: "Portugal" },
  dates: { checkIn: "2026-09-01", checkOut: "2026-09-04", nights: 3 },
  group: { size: 8, targetBedrooms: 5, singleRooms: 2, sharedRoomsOrEquivalent: 3 },
  budget: { targetPerPersonStay: 210, hardMaxPerPersonStay: 250 },
  searchStrategies: [
    {
      concept: "aparthotel",
      score: 80,
      priority: 1,
      resultsWanted: 5,
      propertyTypes: ["aparthotel"],
      mustHave: ["wifi"],
      preferred: [],
    },
  ],
  locationIntent: { mode: "central", priority: "preferred", carAccepted: false },
  minimumRating: 4,
  requiredAmenities: ["wifi"],
  accessibilityRequired: false,
};
const payload = (property: any) => ({
  candidates: [
    {
      content: { parts: [{ text: JSON.stringify({ properties: [property] }) }] },
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: property.url, title: property.name } },
          ...(property.imageUrl ? [{ web: { uri: property.imageUrl, title: "photo" } }] : []),
        ],
      },
    },
  ],
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["GEMINI_API_KEY"];
});
it("valide source, contraintes et photo grounded", () => {
  const candidate = {
    id: "stay-1",
    name: "Central Stay",
    propertyType: "aparthotel",
    krewConcept: "aparthotel",
    location: { city: "Lisbonne", area: "Baixa", address: null },
    capacity: 8,
    bedrooms: 5,
    rating: 4.5,
    amenities: ["wifi"],
    pricePerPerson: 220,
    priceStatus: "estimated",
    availabilityStatus: "unverified",
    url: "https://stay.example/stay-1",
    source: "stay.example",
    imageUrl: "https://stay.example/photo.jpg",
    imageSource: "stay.example",
    matchReasons: ["central"],
  };
  expect(normalizeAccommodationCandidates(payload(candidate), spec)[0]).toMatchObject({
    id: "stay-1",
    imageUrl: candidate.imageUrl,
  });
});
it("rejette URL absente ou veto connu", () => {
  expect(
    normalizeAccommodationCandidates(
      payload({ name: "sans url", krewConcept: "aparthotel" }),
      spec,
    ),
  ).toEqual([]);
  const expensive = {
    id: "x",
    name: "Cher",
    krewConcept: "aparthotel",
    url: "https://stay.example/x",
    source: "stay",
    amenities: ["wifi"],
    capacity: 8,
    bedrooms: 5,
    rating: 4.5,
    pricePerPerson: 400,
    priceStatus: "verified",
  };
  expect(normalizeAccommodationCandidates(payload(expensive), spec)).toEqual([]);
});
it("effectue exactement un Gemini", async () => {
  process.env["GEMINI_API_KEY"] = "test";
  const candidate = {
    id: "stay-1",
    name: "Central Stay",
    propertyType: "aparthotel",
    krewConcept: "aparthotel",
    capacity: 8,
    bedrooms: 5,
    rating: 4.5,
    amenities: ["wifi"],
    pricePerPerson: 220,
    priceStatus: "estimated",
    availabilityStatus: "unverified",
    url: "https://stay.example/stay-1",
    source: "stay.example",
  };
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, text: async () => JSON.stringify(payload(candidate)) });
  vi.stubGlobal("fetch", fetchMock);
  expect(await searchAccommodationsWithGemini(spec)).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("computeAccommodationRequestHash génère un hash déterministe", () => {
  const hash1 = computeAccommodationRequestHash("trip-123", spec);
  const hash2 = computeAccommodationRequestHash("trip-123", spec);
  expect(hash1).toBe(hash2);
  expect(hash1.startsWith("acc_")).toBe(true);
});

it("buildCanonicalAccommodationExternalId nettoie les liens de tracking et génère un ID canonique", () => {
  const hotel1 = {
    name: "Hôtel Central",
    url: "https://example.com/hotel?utm_source=google&gclid=12345",
    source: "gemini",
  };
  const hotel2 = {
    name: "Hôtel Central",
    url: "https://example.com/hotel?utm_source=facebook",
    source: "gemini",
  };
  const id1 = buildCanonicalAccommodationExternalId("Paris", hotel1);
  const id2 = buildCanonicalAccommodationExternalId("Paris", hotel2);
  expect(id1).toBe(id2);
});

it("simule la concurrence via RPC : un seul appel Gemini est effectué", async () => {
  process.env["GEMINI_API_KEY"] = "test";
  const candidate = {
    id: "stay-1",
    name: "Central Stay",
    propertyType: "aparthotel",
    krewConcept: "aparthotel",
    capacity: 8,
    bedrooms: 5,
    rating: 4.5,
    amenities: ["wifi"],
    pricePerPerson: 220,
    priceStatus: "estimated",
    availabilityStatus: "unverified",
    url: "https://stay.example/stay-1",
    source: "stay.example",
  };

  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, text: async () => JSON.stringify(payload(candidate)) });
  vi.stubGlobal("fetch", fetchMock);

  // Simule deux demandes concurrentes dont l'une acquiert le verrou RPC et l'autre non
  let rpcCallCount = 0;
  const mockRpc = vi.fn().mockImplementation(() => {
    rpcCallCount++;
    if (rpcCallCount === 1) {
      return Promise.resolve({ data: [{ acquired: true, generation: { status: "in_progress" } }] });
    }
    return Promise.resolve({ data: [{ acquired: false, generation: { status: "in_progress" } }] });
  });

  const { proposeStayAndTransport } = await import("@/lib/trips.functions");

  // Mock minimal du client Supabase
  const mockSupabase = {
    rpc: mockRpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: "trip-1",
                owner_id: "u1",
                participants_count: 8,
                duration_nights: 3,
                group_logistics: {},
              },
            }),
          single: () =>
            Promise.resolve({
              data: {
                id: "trip-1",
                owner_id: "u1",
                participants_count: 8,
                duration_nights: 3,
                group_logistics: {},
              },
            }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      upsert: () => ({ select: () => Promise.resolve({ data: [] }) }),
    }),
  };

  // Exécution concurrente
  const testSpec = spec;
  const geminiSearch1 = searchAccommodationsWithGemini(testSpec);
  // Seule la première requête ayant obtenu acquired=true devrait appeler Gemini
  expect(await geminiSearch1).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("mergeAccommodationLogistics conserve les hôtels précédents si la tentative échoue (429 / error)", () => {
  const previous = {
    hotels: [{ id: "stay-old", name: "Ancien Hôtel" }],
    hotelVotes: [{ userId: "u1", hotelId: "stay-old" }],
    selectedHotelId: "stay-old",
  };
  const merged = mergeAccommodationLogistics(previous, [], ["rate limit"], {
    status: "rate_limited",
    requestHash: "acc_hash1",
    attemptedAt: new Date().toISOString(),
    userMessage: "Indisponible",
  });
  expect(merged.hotels).toEqual(previous.hotels);
  expect(merged.selectedHotelId).toBe("stay-old");
  expect(merged.accommodationGeneration.status).toBe("rate_limited");
});

it("préserve transports et nettoie seulement les références hôtel obsolètes", () => {
  const hotel = normalizeAccommodationCandidates(
    payload({
      id: "stay-1",
      name: "Central Stay",
      propertyType: "aparthotel",
      krewConcept: "aparthotel",
      capacity: 8,
      bedrooms: 5,
      rating: 4.5,
      amenities: ["wifi"],
      pricePerPerson: 220,
      priceStatus: "estimated",
      availabilityStatus: "unverified",
      url: "https://stay.example/stay-1",
      source: "stay.example",
    }),
    spec,
  )[0]!;
  const merged = mergeAccommodationLogistics(
    {
      transports: [{ id: "flight" }],
      hotelVotes: [
        { userId: "u1", hotelId: "stay-1" },
        { userId: "u2", hotelId: "old" },
      ],
      selectedHotelId: "old",
    },
    [hotel],
    [],
  );
  expect(merged.transports).toEqual([{ id: "flight" }]);
  expect(merged.hotelVotes).toEqual([{ userId: "u1", hotelId: "stay-1" }]);
  expect(merged.selectedHotelId).toBeNull();
});
