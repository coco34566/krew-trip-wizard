import { afterEach, expect, it, vi } from "vitest";
import {
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
