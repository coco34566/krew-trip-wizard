import { describe, expect, it } from "vitest";

import {
  SPOTIFY_PLAYLIST_CATALOG,
  buildMusicContext,
  isValidMusicTag,
  recommendSpotifyPlaylists,
  spotifyPlaylistUrl,
  type SpotifyPlaylistCatalogEntry,
} from "@/lib/krew/spotify-playlists";

describe("Spotify playlist catalog", () => {
  it("has unique internal ids and Spotify ids", () => {
    const ids = SPOTIFY_PLAYLIST_CATALOG.map((entry) => entry.id);
    const spotifyIds = SPOTIFY_PLAYLIST_CATALOG.map((entry) => entry.spotifyPlaylistId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(spotifyIds).size).toBe(spotifyIds.length);
  });

  it("has non-empty Spotify ids and valid canonical URLs", () => {
    for (const entry of SPOTIFY_PLAYLIST_CATALOG) {
      expect(entry.spotifyPlaylistId.trim()).not.toBe("");
      expect(spotifyPlaylistUrl(entry.spotifyPlaylistId)).toBe(
        `https://open.spotify.com/playlist/${entry.spotifyPlaylistId}`,
      );
    }
  });

  it("uses only declared tags", () => {
    for (const entry of SPOTIFY_PLAYLIST_CATALOG) {
      expect(entry.tags.every(isValidMusicTag)).toBe(true);
    }
  });
});

describe("Spotify playlist recommender", () => {
  it("favors road-trip playlists for a car journey", () => {
    const recommendations = recommendSpotifyPlaylists(
      buildMusicContext({ transportModes: ["voiture"] }),
    );
    expect(recommendations[0]?.name).toMatch(/Road Trip|Car/);
  });

  it("favors poolside or sunny playlists for a pool trip", () => {
    const recommendations = recommendSpotifyPlaylists(
      buildMusicContext({ selectedActivities: ["piscine"] }),
    );
    expect(recommendations.find((item) => item.slot === "setting")?.name).toMatch(
      /Poolside|Sunny/,
    );
  });

  it("favors acoustic playlists for mountain + chill", () => {
    const recommendations = recommendSpotifyPlaylists(
      buildMusicContext({ wantedEnvType: "montagne", ambiances: ["chill"] }),
    );
    expect(recommendations.find((item) => item.slot === "setting")?.name).toMatch(/Acoustic/);
  });

  it("returns a festive group playlist for a party context", () => {
    const recommendations = recommendSpotifyPlaylists(
      buildMusicContext({ ambiances: ["festif"] }),
    );
    expect(recommendations.find((item) => item.slot === "group")?.score).toBeGreaterThan(0);
  });

  it("favors house/dance for nightlife", () => {
    const recommendations = recommendSpotifyPlaylists(
      buildMusicContext({ ambiances: ["nightlife"] }),
    );
    expect(recommendations.find((item) => item.slot === "group")?.name).toMatch(/Housewerk|mint/);
  });

  it("makes Dinner with Friends relevant for dinner/apero at the accommodation", () => {
    const recommendations = recommendSpotifyPlaylists(
      buildMusicContext({
        selectedActivities: ["dîner", "apéro"],
        accommodationType: "maison",
      }),
    );
    expect(recommendations.some((item) => item.name === "Dinner with Friends")).toBe(true);
  });

  it("can favor All Out 2000s for a festive 25-35 group", () => {
    const recommendations = recommendSpotifyPlaylists(
      buildMusicContext({ ambiances: ["festif"], groupAgeRange: "25-35" }),
    );
    const group = recommendations.find((item) => item.slot === "group");
    expect(["All Out 2000s", "All Out 2010s", "Disco Forever", "mint", "Housewerk"]).toContain(
      group?.name,
    );
  });

  it("does not force a generational playlist from age alone", () => {
    const recommendations = recommendSpotifyPlaylists(
      buildMusicContext({ groupAgeRange: "25-35" }),
    );
    expect(recommendations.some((item) => /All Out/.test(item.name))).toBe(false);
  });

  it("returns stable fallbacks for weak data", () => {
    const a = recommendSpotifyPlaylists(buildMusicContext({}));
    const b = recommendSpotifyPlaylists(buildMusicContext({}));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(2);
  });

  it("never returns duplicates and caps results at three", () => {
    const recommendations = recommendSpotifyPlaylists(
      buildMusicContext({
        ambiances: ["festif", "chill", "convivial"],
        activityCategories: ["plage", "club", "brunch"],
        transportModes: ["voiture"],
      }),
    );
    expect(recommendations).toHaveLength(3);
    expect(new Set(recommendations.map((item) => item.id)).size).toBe(recommendations.length);
  });

  it("allows two results when no third active candidate exists", () => {
    const smallCatalog: SpotifyPlaylistCatalogEntry[] = SPOTIFY_PLAYLIST_CATALOG.filter((entry) =>
      ["classic-road-trip-songs", "acoustic-chill"].includes(entry.id),
    );
    const recommendations = recommendSpotifyPlaylists(buildMusicContext({}), smallCatalog);
    expect(recommendations).toHaveLength(2);
  });

  it("excludes inactive entries", () => {
    const catalog = SPOTIFY_PLAYLIST_CATALOG.map((entry) =>
      entry.id === "classic-road-trip-songs" ? { ...entry, active: false } : entry,
    );
    const recommendations = recommendSpotifyPlaylists(
      buildMusicContext({ transportModes: ["voiture"] }),
      catalog,
    );
    expect(recommendations.some((item) => item.id === "classic-road-trip-songs")).toBe(false);
  });
});
