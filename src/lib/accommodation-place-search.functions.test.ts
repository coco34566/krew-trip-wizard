import { describe, expect, it } from "vitest";

import { searchAccommodationPlaces } from "./accommodation-place-search.functions";

describe("searchAccommodationPlaces", () => {
  it("exports a server function for accommodation autocomplete", () => {
    expect(searchAccommodationPlaces).toBeTruthy();
  });
});
