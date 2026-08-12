import { describe, expect, it } from "vitest";
import { estimateOptionsByMode, isTransportCompatible, normalizeTransportModes } from "../krew/transport-compatibility";

describe("transport compatibility by accepted mode", () => {
  it("keeps a destination when at least one accepted mode is under max hours", () => {
    const options = estimateOptionsByMode(500, ["train", "voiture"]);
    expect(options.map((o) => o.mode)).toEqual(["train", "car"]);
    expect(isTransportCompatible(options, 4)).toBe(true);
  });

  it("rejects a destination when no accepted mode is under max hours", () => {
    const options = estimateOptionsByMode(1200, ["train", "voiture"]);
    expect(isTransportCompatible(options, 4)).toBe(false);
  });

  it("expands peu importe to flight, train and car", () => {
    expect(normalizeTransportModes(["peu importe"])).toEqual(["flight", "train", "car"]);
  });
});
