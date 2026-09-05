import { describe, expect, it } from "vitest";

import { searchAccommodationPlaces } from "./accommodation-place-search.functions";

describe("accommodation autocomplete search", () => {
  it("is exposed as a server function", () => {
    expect(searchAccommodationPlaces).toBeDefined();
  });
});
