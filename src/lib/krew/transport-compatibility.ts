import { estimateTransportFromDistance } from "@/integrations/external/transport.server";

export type CanonicalTransportMode = "flight" | "train" | "car";

export type TransportOption = {
  mode: CanonicalTransportMode;
  durationHours: number;
  pricePerPerson: number;
  source: "api" | "estimate";
  connections?: number;
  label: string;
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function normalizeTransportModes(modes: string[] | undefined | null): CanonicalTransportMode[] {
  const raw = (modes && modes.length ? modes : ["peu importe"]).map(norm);
  if (raw.some((m) => m.includes("peu importe") || m.includes("any"))) return ["flight", "train", "car"];
  const out = new Set<CanonicalTransportMode>();
  for (const m of raw) {
    if (m.includes("avion") || m.includes("flight")) out.add("flight");
    if (m.includes("train") || m.includes("rail")) out.add("train");
    if (m.includes("voiture") || m.includes("car") || m.includes("route")) out.add("car");
  }
  return [...out];
}

export function estimateOptionsByMode(distanceKm: number, modes: string[] | undefined | null): TransportOption[] {
  const canonical = normalizeTransportModes(modes);
  return canonical.map((mode) => {
    if (mode === "flight") {
      return { mode, durationHours: Math.max(2, distanceKm / 720 + 1.6), pricePerPerson: estimateTransportFromDistance(distanceKm), source: "estimate", connections: distanceKm > 1800 ? 1 : 0, label: "Vol estimé porte-à-porte" };
    }
    if (mode === "train") {
      return { mode, durationHours: Math.max(0.5, distanceKm / 185 + 0.5), pricePerPerson: Math.max(35, distanceKm * 0.13), source: "estimate", connections: distanceKm > 750 ? 1 : 0, label: "Train estimé" };
    }
    return { mode, durationHours: Math.max(0.5, distanceKm / 82 + 0.25), pricePerPerson: Math.max(25, distanceKm * 0.11), source: "estimate", connections: 0, label: "Voiture estimée" };
  });
}

export function isTransportCompatible(options: TransportOption[], maxHours: number | null | undefined): boolean {
  if (!maxHours || maxHours <= 0) return true;
  return options.some((o) => o.durationHours <= maxHours);
}

export function bestTransportOption(options: TransportOption[], maxHours?: number | null): TransportOption | null {
  const compatible = maxHours && maxHours > 0 ? options.filter((o) => o.durationHours <= maxHours) : options;
  const pool = compatible.length ? compatible : options;
  return [...pool].sort((a, b) => a.durationHours - b.durationHours || a.pricePerPerson - b.pricePerPerson)[0] ?? null;
}
