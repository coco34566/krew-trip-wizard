import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FALLBACK_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" role="img" aria-label="Photo de destination indisponible">
  <rect width="1200" height="800" fill="#f2efe9"/>
  <path d="M145 575c145-105 260-140 390-105s240 20 520-120" fill="none" stroke="#789b86" stroke-width="24" stroke-linecap="round" opacity=".55"/>
  <circle cx="915" cy="210" r="20" fill="#789b86" opacity=".7"/>
  <path d="M915 155v110M860 210h110" stroke="#789b86" stroke-width="14" stroke-linecap="round" opacity=".7"/>
</svg>`;

type PexelsPhoto = {
  id?: number;
  width?: number;
  height?: number;
  alt?: string | null;
  photographer?: string | null;
  photographer_url?: string | null;
  url?: string | null;
  src?: {
    landscape?: string | null;
    large2x?: string | null;
    large?: string | null;
    original?: string | null;
  } | null;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function scorePhoto(photo: PexelsPhoto, destinationName: string, country: string) {
  const width = Number(photo.width ?? 0);
  const height = Number(photo.height ?? 0);
  if (!width || !height || width <= height) return -Infinity;

  const alt = normalize(photo.alt ?? "");
  const name = normalize(destinationName);
  const normalizedCountry = normalize(country);

  let score = 0;
  score += Math.min(width / 1000, 5);
  score += Math.min(width / Math.max(height, 1), 2);
  if (name && alt.includes(name)) score += 8;
  if (normalizedCountry && alt.includes(normalizedCountry)) score += 3;

  const negativeHints = [
    "portrait",
    "person",
    "woman",
    "man ",
    "selfie",
    "food",
    "dish",
    "bedroom",
    "hotel room",
    "office",
  ];
  if (negativeHints.some((hint) => alt.includes(hint))) score -= 6;

  return score;
}

function fallbackSvg() {
  return new Response(FALLBACK_SVG, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

function findPexelsApiKey() {
  const knownNames = [
    "PIXELS_API_KEY",
    "PEXELS_API_KEY",
    "PIXEL_API_KEY",
    "PEXEL_API_KEY",
    "PIXELS_KEY",
    "PEXELS_KEY",
    "PIXEL_KEY",
    "PEXEL_KEY",
  ];

  for (const key of knownNames) {
    const value = process.env[key];
    if (value?.trim()) return value.trim();
  }

  const discovered = Object.entries(process.env).find(
    ([key, value]) => Boolean(value?.trim()) && /(pixel|pexel)/i.test(key) && /key/i.test(key),
  );
  return discovered?.[1]?.trim() || null;
}

export const Route = createFileRoute("/api/destination-photo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id")?.trim();
        if (!id) return fallbackSvg();

        const destination = await supabaseAdmin
          .from("destinations")
          .select("name, country, anchor_places, region_name, destination_type")
          .eq("id", id)
          .maybeSingle();

        if (destination.error || !destination.data?.name) return fallbackSvg();

        const apiKey = findPexelsApiKey();
        if (!apiKey) {
          console.error("[destination-photo] Pexels API key missing");
          return fallbackSvg();
        }

        const name = String(destination.data.name);
        const country = String(destination.data.country ?? "");
        const anchors = Array.isArray(destination.data.anchor_places)
          ? destination.data.anchor_places.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          : [];
        const region = typeof destination.data.region_name === "string" ? destination.data.region_name.trim() : "";
        const destinationType = String(destination.data.destination_type ?? "");

        const primaryPlace =
          destinationType === "region_territory" || destinationType === "outdoor_area"
            ? anchors[0] || region || name
            : name;
        const query = [primaryPlace, region && region !== primaryPlace ? region : "", country, "travel"]
          .filter(Boolean)
          .join(" ");

        try {
          const pexelsUrl = new URL("https://api.pexels.com/v1/search");
          pexelsUrl.searchParams.set("query", query);
          pexelsUrl.searchParams.set("orientation", "landscape");
          pexelsUrl.searchParams.set("size", "large");
          pexelsUrl.searchParams.set("per_page", "8");
          pexelsUrl.searchParams.set("locale", "fr-FR");

          const response = await fetch(pexelsUrl, {
            headers: { Authorization: apiKey },
          });

          if (!response.ok) {
            console.error("[destination-photo] Pexels error", response.status, name);
            return fallbackSvg();
          }

          const payload = (await response.json()) as { photos?: PexelsPhoto[] };
          const candidates = (payload.photos ?? [])
            .map((photo) => ({ photo, score: scorePhoto(photo, name, country) }))
            .filter((entry) => Number.isFinite(entry.score))
            .sort((a, b) => b.score - a.score);

          const selected = candidates[0]?.photo;
          const imageUrl =
            selected?.src?.large2x ||
            selected?.src?.landscape ||
            selected?.src?.large ||
            selected?.src?.original ||
            null;

          if (!imageUrl) return fallbackSvg();

          return new Response(null, {
            status: 302,
            headers: {
              Location: imageUrl,
              "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
              "X-Krew-Image-Provider": "Pexels",
              "X-Pexels-Photographer": selected.photographer ?? "",
              "X-Pexels-Photo-Page": selected.url ?? "",
              "X-Pexels-Photographer-Page": selected.photographer_url ?? "",
            },
          });
        } catch (error) {
          console.error("[destination-photo] unavailable", error);
          return fallbackSvg();
        }
      },
    },
  },
});
