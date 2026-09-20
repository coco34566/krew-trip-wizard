import { describe, expect, it } from "vitest";

import {
  cancelTrip,
  generateGroupItinerary,
  pickTransport,
  regenerateItinerarySlot,
  voteHotel,
} from "@/lib/trips.functions";
import { cancelTripOwnerOnly } from "../trip-cancel-owner.functions";
import {
  pickTransportAtomic,
  voteHotelAtomic,
} from "../trips-logistics-atomic.functions";
import {
  generateGroupItineraryResolved,
  regenerateItinerarySlotResolved,
} from "../trips-planning-resolved.functions";

describe("trips public entry", () => {
  it("exposes the hardened implementations", () => {
    expect(voteHotel).toBe(voteHotelAtomic);
    expect(pickTransport).toBe(pickTransportAtomic);
    expect(cancelTrip).toBe(cancelTripOwnerOnly);
    expect(generateGroupItinerary).toBe(generateGroupItineraryResolved);
    expect(regenerateItinerarySlot).toBe(regenerateItinerarySlotResolved);
  });
});
