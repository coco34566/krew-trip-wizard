import { describe, expect, it } from "vitest";
import {
  buildTransportDashboardSummary,
  groupTransportPicks,
  transportShareKey,
  transportTaskLabel,
} from "../transport-groups";

describe("transport groups", () => {
  it("groups people on the same concrete train", () => {
    const base = {
      city: "Paris",
      mode: "train",
      label: "TGV 6123",
      outboundDepartureTime: "18:12",
      arrivalTime: "21:04",
    };
    const groups = groupTransportPicks([
      { ...base, participantId: "p1", displayName: "Marie" },
      { ...base, participantId: "p2", displayName: "Jules" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.members).toHaveLength(2);
  });

  it("keeps different schedules separate", () => {
    const a = transportShareKey({ city: "Paris", mode: "train", label: "TGV", outboundDepartureTime: "18:12" });
    const b = transportShareKey({ city: "Paris", mode: "train", label: "TGV", outboundDepartureTime: "20:12" });
    expect(a).not.toBe(b);
  });

  it("tracks remaining car seats", () => {
    const groups = groupTransportPicks([
      {
        participantId: "driver",
        displayName: "Clara",
        city: "Paris",
        mode: "voiture",
        label: "Voiture de Clara",
        sharedGroupId: "car:driver",
        isDriver: true,
        passengerCapacity: 3,
      },
      {
        participantId: "p2",
        displayName: "Antoine",
        city: "Paris",
        mode: "voiture",
        label: "Voiture de Clara",
        sharedGroupId: "car:driver",
        driverParticipantId: "driver",
      },
    ]);
    expect(groups[0]?.seatsLeft).toBe(2);
  });

  it("counts participant ids and preserves missing people", () => {
    const summary = buildTransportDashboardSummary({
      participants: [
        { id: "p1", user_id: "u1", display_name: "A" },
        { id: "p2", user_id: "u2", display_name: "B" },
      ],
      picks: [{ participantId: "p1", userId: "u1", city: "Paris", mode: "train", label: "TGV" }],
    });
    expect(summary.organized).toBe(1);
    expect(summary.missing.map((p) => p.id)).toEqual(["p2"]);
  });

  it("derives the transport task from state", () => {
    expect(transportTaskLabel(null)).toBe("Choisir mon transport");
    expect(transportTaskLabel({ mode: "train", status: "sélectionné" })).toBe("Réserver mon transport");
    expect(transportTaskLabel({ mode: "train", status: "réservé" })).toBeNull();
    expect(
      transportTaskLabel({ mode: "voiture", driverParticipantId: "p1", driverDisplayName: "Clara" }),
    ).toBe("Confirmer ma place avec Clara");
  });
});
