/**
 * Génération d'itinéraire via Lovable AI (prompt structuré + scoring).
 * - Planning complet : resto / activités / bars logiques jour par jour
 * - Régénération d'un créneau isolé
 * Chaque slot peut porter une URL (site, Google Maps, réservation)
 */

import { reportServerError } from "@/lib/server-error-reporting.server";

export type ActivitySlotType = "resto" | "activite" | "bar" | "transport" | "libre";

export type ActivitySlot = {
  moment: string;
  type: ActivitySlotType;
  label: string;
  detail?: string;
  priceHint?: number;
  /** Horaire proposé, ex. "13:00" ou "14h–16h" */
  time?: string | null;
  /** Lien utile : site officiel, Google Maps, OpenTable, etc. */
  url?: string | null;
};

export type ItineraryDayPlan = {
  day: number;
  date?: string | null;
  slots: ActivitySlot[];
};

export type GroupItinerary = {
  destination: string;
  nights: number;
  days: ItineraryDayPlan[];
  source: "ai" | "local";
  generatedAt: string;
};

export type ActivityAiInput = {
  destination: string;
  country?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  nights: number;
  participants: number;
  budgetPerPerson: number;
  eventType?: string | null;
  ambiances: string[];
  activityCategories: string[];
  starWanted?: string[];
  dietaryConstraints?: string[];
  travelPace?: string | null;
  preferredTimeSlots?: string[];
  /** Raisons de match scoring de la destination choisie */
  matchReasons?: string[];
  destinationScore?: number | null;
  /** Labels d'activités déjà scorées pour cette reco */
  scoredActivityLabels?: string[];
  /** Dernière arrivée du groupe jour 1 (HH:mm) */
  latestGroupArrival?: string | null;
  /** Premier départ retour (HH:mm) */
  earliestGroupDeparture?: string | null;
  transportPicksSummary?: {
    city: string;
    mode: string;
    arrival?: string | null;
    departure?: string | null;
  }[];
  individualPreferences?: any[];
  groupAgeRange?: string | null;
  starWantedEnvType?: string | null;
  wantedEnvTypes?: string[];
};


type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: "aimlapi" | "openai";
};

function getLlmConfig(): LlmConfig | null {
  const aimlapiKey = process.env["AIMLAPI_API_KEY"];
  if (aimlapiKey) {
    return {
      apiKey: aimlapiKey,
      baseUrl: (process.env["AIMLAPI_BASE_URL"] || "https://api.aimlapi.com/v1").replace(/\/$/, ""),
      model: process.env["AIMLAPI_MODEL"] || "google/gemini-2.5-flash",
      provider: "aimlapi",
    };
  }
  const openaiKey = process.env["OPENAI_API_KEY"] || process.env["LLM_API_KEY"];
  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseUrl: (process.env["LLM_RATIONALE_BASE_URL"] || "https://api.openai.com/v1").replace(/\/$/, ""),
      model: process.env["LLM_DISCOVERY_MODEL"] || "gpt-4o-mini",
      provider: "openai",
    };
  }
  return null;
}

const SYSTEM_FULL = `Tu es Krew, planificateur de séjour de groupe. Tu connais les prix RÉELS du marché européen 2024-2026.

Réponds UNIQUEMENT en JSON valide (pas de markdown) :
{"days":[{"day":1,"slots":[{"moment":"Matin|Midi|Après-midi|Soir","time":"13:00","type":"resto|activite|bar|transport|libre","label":"Nom précis du lieu","detail":"quartier + pour qui","priceHint":28,"currency":"EUR","url":"https://...","priceNote":"fourchette marché"}]}]}

RÈGLES PRIX (obligatoires) :
- priceHint = estimation € / personne la plus réaliste possible pour CETTE ville (pas un chiffre inventé au hasard).
- Restos : entrée de gamme 12-18 €, milieu 25-40 €, haut 50-80 € selon la ville.
- Activités payantes : musées 10-25 €, boat party / experiences 35-90 €, free walking = 0.
- Bars : 8-15 € conso moyenne.
- Cohérence avec le budget global du contexte JSON (champ "budget").
- Si le budget est serré, privilégie free / low-cost et le signale dans detail.

RÈGLES LIENS url (obligatoires pour resto|activite|bar) :
- url DOIT être un https réel et utile pour réserver ou vérifier le lieu.
- Formats acceptés UNIQUEMENT :
  1) Google Maps place search : https://www.google.com/maps/search/?api=1&query=URLENCODE(Nom+Ville)
  2) GetYourGuide search : https://www.getyourguide.fr/s/?q=URLENCODE(Nom+Ville)
  3) Site officiel du lieu si tu es certain de l'URL (domaine connu).
- INTERDIT : urls inventées, fake booking.com/hotel-id, liens cassés, "example.com".
- Si tu n'es pas sûr du site officiel → Google Maps search (toujours valide).

RÈGLES PLANNING :
1. Jour 1 = arrivée : aucun créneau d'activité avant arriveBy (si fourni). Dernier jour = plus léger ; pas d'activité après departAfter si fourni. Utilise transports[] pour coller aux horaires réels du groupe.
2. Alternance resto / activité / bar.
3. Suis match/star/acts/seedActs du contexte (≥60% des slots).
4. Noms CONCRETS existants ou très plausibles dans la ville (pas "restaurant local").
5. time obligatoire (ex. 13:00, 16:30, 21:00).
6. Cohérence géographique : propose des enchaînements d'activités logiques et proches géographiquement pour un même jour (ex: évite d'enchaîner le centre-ville de Bruxelles, puis l'Atomium à l'autre bout, puis retour au centre-ville). Optimise l'ordre et limite les trajets inutiles pour créer un planning fluide et réalisable.
7. Français uniquement. Pas de texte hors JSON.`;

const SYSTEM_SLOT = `Tu proposes UNE alternative concrète pour un créneau de séjour groupe.
JSON uniquement :
{"moment":"Midi|Après-midi|Soir","time":"15:30","type":"resto|activite|bar|libre","label":"Nom précis","detail":"...","priceHint":30,"url":"https://www.google.com/maps/search/?api=1&query=..."}

Prix réalistes €/pers pour la ville. url = Maps search ou GetYourGuide ou site officiel certain. Jamais d'URL inventée. Différent de l'existant.
Cohérence géographique : Propose un lieu proche géographiquement des autres activités prévues ce jour-là s'il y a lieu. Évite les déplacements inutiles.`;

function compactCtx(input: ActivityAiInput): Record<string, unknown> {
  const o: Record<string, unknown> = {
    "city": input.destination.slice(0, 48),
    "nights": input.nights,
    "n": input.participants,
    "budget": Math.round(input.budgetPerPerson),
  };
  if (input.country) o["country"] = String(input.country).slice(0, 30);
  if (input.startDate) o["from"] = input.startDate;
  if (input.endDate) o["to"] = input.endDate;
  if (input.eventType) o["event"] = String(input.eventType).slice(0, 24);
  if (input.ambiances?.length) o["vibe"] = input.ambiances.slice(0, 5);
  if (input.activityCategories?.length) o["acts"] = input.activityCategories.slice(0, 8);
  if (input.starWanted?.length) o["star"] = input.starWanted.slice(0, 5);
  if (input.dietaryConstraints?.length) o["diet"] = input.dietaryConstraints.slice(0, 4);
  if (input.travelPace) o["pace"] = input.travelPace;
  if (input.matchReasons?.length) o["match"] = input.matchReasons.slice(0, 6);
  if (input.destinationScore != null) o["score"] = Math.round(Number(input.destinationScore));
  if (input.scoredActivityLabels?.length) o["seedActs"] = input.scoredActivityLabels.slice(0, 8);
  if (input.latestGroupArrival) o["arriveBy"] = input.latestGroupArrival;
  if (input.earliestGroupDeparture) o["departAfter"] = input.earliestGroupDeparture;
  if (input.transportPicksSummary?.length) {
    o["transports"] = input.transportPicksSummary.slice(0, 8);
  }
  if (input.groupAgeRange) o["ageRange"] = input.groupAgeRange;
  if (input.starWantedEnvType) o["starEnv"] = input.starWantedEnvType;
  if (input.wantedEnvTypes?.length) o["envTypes"] = input.wantedEnvTypes;
  if (input.individualPreferences?.length) {
    o["individualPrefs"] = input.individualPreferences.map(p => ({
      isStar: p.isStar,
      ambiances: p.ambiances,
      activityCategories: p.activityCategories,
      budgetMax: p.budgetMax,
      wantedEnvType: p.wantedEnvType,
    }));
  }
  return o;

}

async function chatJson(
  cfg: LlmConfig,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.55,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`llm_http_${res.status}:${err.slice(0, 120)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function mapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function activitySearchUrl(label: string, city: string, type: ActivitySlotType): string {
  const prefix = type === "resto" ? "restaurant" : type === "bar" ? "bar" : "";
  return mapsUrl([prefix, label, city].filter(Boolean).join(" "));
}


function normalizeSlot(raw: any, city: string): ActivitySlot | null {
  if (!raw || typeof raw !== "object") return null;
  const label = String(raw.label || raw.name || "").trim();
  if (!label) return null;
  const type = String(raw.type || "activite").toLowerCase() as ActivitySlotType;
  const allowed: ActivitySlotType[] = ["resto", "activite", "bar", "transport", "libre"];
  const t = allowed.includes(type) ? type : "activite";
  let url: string | null = null;
  if (typeof raw.url === "string" && isSafeHttpUrl(raw.url.trim())) {
    url = raw.url.trim().slice(0, 400);
  } else if (t === "resto" || t === "activite" || t === "bar") {
    url = activitySearchUrl(label, city, t);
  }
  const price =
    raw.priceHint != null
      ? Number(raw.priceHint)
      : raw.price != null
        ? Number(raw.price)
        : undefined;
  let time: string | null = null;
  if (typeof raw.time === "string" && raw.time.trim()) {
    time = raw.time.trim().slice(0, 20);
  } else if (typeof raw.horaire === "string" && raw.horaire.trim()) {
    time = raw.horaire.trim().slice(0, 20);
  }

  const resSlot: any = {
    moment: String(raw.moment || "Après-midi").slice(0, 24),
    type: t,
    label: label.slice(0, 80),
    time,
    url,
  };
  if (raw.detail !== undefined) resSlot.detail = String(raw.detail).slice(0, 160);
  if (Number.isFinite(price)) resSlot.priceHint = Math.max(0, Math.min(250, Math.round(price!)));
  return resSlot;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildLocalItinerary(input: ActivityAiInput, seedLabels: string[]): GroupItinerary {
  const daysCount = Math.max(1, input.nights + 1);
  const pace = String(input.travelPace || "normal").toLowerCase();
  const slotsPerDay = pace === "chill" ? 2 : pace === "intense" ? 4 : 3;
  const pool = [
    ...seedLabels,
    ...(input.scoredActivityLabels || []),
    ...(input.starWanted || []),
    ...(input.activityCategories || []).map((c) => c.replace(/_/g, " ")),
  ].filter(Boolean);
  let pi = 0;
  const nextLabel = (fallback: string) => {
    if (!pool.length) return fallback;
    const l = pool[pi % pool.length]!;
    pi += 1;
    return l;
  };

  const days: ItineraryDayPlan[] = [];
  for (let day = 1; day <= daysCount; day++) {
    const date = input.startDate ? addDays(input.startDate, day - 1) : null;
    const slots: ActivitySlot[] = [];
    if (day === 1) {
      slots.push({
        moment: "Matin",
        type: "transport",
        label: `Arrivée à ${input.destination}`,
        detail: "Transfert & installation",
        time: "11:00",
        url: mapsUrl(`${input.destination} centre`),
      });
    }
    const lunchLabel = `Déjeuner — ${input.destination}`;
    slots.push({
      moment: "Midi",
      type: "resto",
      label: lunchLabel,
      detail: input.dietaryConstraints?.length
        ? `Contraintes: ${input.dietaryConstraints.slice(0, 2).join(", ")}`
        : "Cuisine locale",
      priceHint: Math.min(35, Math.round(input.budgetPerPerson * 0.08)),
      time: "13:00",
      url: mapsUrl(`restaurant ${input.destination}`),
    });
    if (slotsPerDay >= 2) {
      const lab = nextLabel(`Expérience — ${input.destination}`);
      slots.push({
        moment: "Après-midi",
        type: "activite",
        label: lab,
        detail: (input.matchReasons || []).slice(0, 1).join("") || "Selon envies du groupe",
        priceHint: Math.min(50, Math.round(input.budgetPerPerson * 0.12)),
        time: "15:30",
        url: mapsUrl(`${lab} ${input.destination}`),
      });
    }
    if (slotsPerDay >= 3) {
      const isLast = day === daysCount;
      const lab = isLast
        ? `Dîner de clôture — ${input.destination}`
        : nextLabel(`Soirée — ${input.destination}`);
      slots.push({
        moment: "Soir",
        type: isLast ? "resto" : "bar",
        label: lab,
        detail: isLast ? "Ambiance groupe" : "Ambiance nocturne",
        priceHint: Math.min(40, Math.round(input.budgetPerPerson * 0.1)),
        time: isLast ? "20:00" : "21:30",
        url: mapsUrl(`${lab}`),
      });
    }
    days.push({ day, date, slots });
  }

  return {
    destination: input.destination,
    nights: input.nights,
    days,
    source: "local",
    generatedAt: new Date().toISOString(),
  };
}

function parseDaysFromLlm(parsed: any, input: ActivityAiInput): ItineraryDayPlan[] | null {
  const rawDays = parsed?.days;
  if (!Array.isArray(rawDays) || !rawDays.length) return null;
  const days: ItineraryDayPlan[] = [];
  rawDays.forEach((d: any, idx: number) => {
    const dayNum = Number(d.day) || idx + 1;
    const date = input.startDate ? addDays(input.startDate, dayNum - 1) : null;
    const slots = (Array.isArray(d.slots) ? d.slots : [])
      .map((s: any) => normalizeSlot(s, input.destination))
      .filter(Boolean) as ActivitySlot[];
    if (slots.length) days.push({ day: dayNum, date, slots });
  });
  return days.length ? days : null;
}

export async function generateItineraryWithAi(
  input: ActivityAiInput,
  seedLabels: string[] = [],
): Promise<{ itinerary: GroupItinerary; usedLlm: boolean; error?: string }> {
  const cfg = getLlmConfig();
  const mergedSeeds = [...seedLabels, ...(input.scoredActivityLabels || [])];

  if (!cfg) {
    return { itinerary: buildLocalItinerary(input, mergedSeeds), usedLlm: false, error: "no_llm_key" };
  }

  const ctx = compactCtx({ ...input, scoredActivityLabels: mergedSeeds });
  const user = `Contexte scoring + séjour (JSON compact):\n${JSON.stringify(ctx)}\n\nGénère le planning complet pour ${input.nights + 1} jour(s) à ${input.destination}. Priorise match/star/acts/seedActs.`;

  try {
    const raw = await chatJson(cfg, SYSTEM_FULL, user, 1800);
    const parsed = extractJson(raw);
    const days = parseDaysFromLlm(parsed, input);
    if (!days) {
      reportServerError(new Error("LLM returned empty or unparseable itinerary JSON"), {
        provider: "openai/llm",
        kind: "itinerary",
        destination: input.destination,
      });
      return {
        itinerary: buildLocalItinerary(input, mergedSeeds),
        usedLlm: false,
        error: "llm_empty_parse",
      };
    }
    return {
      itinerary: {
        destination: input.destination,
        nights: input.nights,
        days,
        source: "ai",
        generatedAt: new Date().toISOString(),
      },
      usedLlm: true,
    };
  } catch (e) {
    reportServerError(e, {
      provider: "openai/llm",
      kind: "itinerary",
      destination: input.destination,
    });
    return {
      itinerary: buildLocalItinerary(input, mergedSeeds),
      usedLlm: false,
      error: String(e).slice(0, 160),
    };
  }
}

export async function regenerateSlotWithAi(
  input: ActivityAiInput,
  existing: ActivitySlot,
  day: number,
  avoid?: string[],
): Promise<{ slot: ActivitySlot; usedLlm: boolean; error?: string }> {
  const fallback: ActivitySlot = {
    ...existing,
    label: `${existing.label} (alt.)`,
    url: existing.url || mapsUrl(`${existing.label} ${input.destination}`),
  };
  const cfg = getLlmConfig();
  if (!cfg) return { slot: fallback, usedLlm: false, error: "no_llm_key" };

  const ctx = compactCtx(input);
  const user = `Ville: ${input.destination}. Jour ${day}. Créneau actuel: ${JSON.stringify({
    moment: existing.moment,
    type: existing.type,
    label: existing.label,
  })}. Contexte: ${JSON.stringify(ctx)}. Propose une alternative.${
    avoid && avoid.length > 0
      ? ` Évite absolument de proposer l'une des activités déjà prévues ce jour-là : ${avoid.join(", ")}.`
      : ""
  }`;

  try {
    const raw = await chatJson(cfg, SYSTEM_SLOT, user, 280);
    const parsed = extractJson(raw) as any;
    const slot = normalizeSlot(parsed, input.destination);
    if (!slot) {
      reportServerError(new Error("LLM returned empty or unparseable itinerary slot JSON"), {
        provider: "openai/llm",
        kind: "itinerary-slot",
        destination: input.destination,
      });
      return { slot: fallback, usedLlm: false, error: "llm_empty_parse" };
    }
    if (!slot.moment) slot.moment = existing.moment;
    return { slot, usedLlm: true };
  } catch (e) {
    reportServerError(e, {
      provider: "openai/llm",
      kind: "itinerary-slot",
      destination: input.destination,
    });
    return { slot: fallback, usedLlm: false, error: String(e).slice(0, 160) };
  }
}
