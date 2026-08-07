/**
 * Génération d'itinéraire via Lovable AI (prompt structuré + scoring).
 * - Planning complet : resto / activités / bars logiques jour par jour
 * - Régénération d'un créneau isolé
 * Chaque slot peut porter une URL (site, Google Maps, réservation)
 */

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
};

type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

function getLlmConfig(): LlmConfig | null {
  if (process.env.LOVABLE_API_KEY) {
    return {
      apiKey: process.env.LOVABLE_API_KEY,
      baseUrl: (process.env.LOVABLE_AI_BASE_URL || "https://ai.gateway.lovable.dev/v1").replace(
        /\/$/,
        "",
      ),
      model:
        process.env.LLM_DISCOVERY_MODEL ||
        process.env.LOVABLE_AI_MODEL ||
        "google/gemini-2.5-flash",
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      apiKey: process.env.GROQ_API_KEY,
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.LLM_DISCOVERY_MODEL || "llama-3.1-8b-instant",
    };
  }
  if (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY) {
    return {
      apiKey: (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY) as string,
      baseUrl: (process.env.LLM_RATIONALE_BASE_URL || "https://api.openai.com/v1").replace(
        /\/$/,
        "",
      ),
      model: process.env.LLM_DISCOVERY_MODEL || "gpt-4o-mini",
    };
  }
  if (process.env.XAI_API_KEY) {
    return {
      apiKey: process.env.XAI_API_KEY,
      baseUrl: "https://api.x.ai/v1",
      model: process.env.LLM_DISCOVERY_MODEL || "grok-2-latest",
    };
  }
  return null;
}

const SYSTEM_FULL = `Tu es Krew, expert en organisation de séjours de groupe (EVG, EVJF, week-end amis).
Tu construis un planning JOUR PAR JOUR réaliste et agréable pour la destination choisie.

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"days":[{"day":1,"slots":[{"moment":"Matin|Midi|Après-midi|Soir","time":"13:00","type":"resto|activite|bar|transport|libre","label":"nom concret","detail":"pourquoi / quartier / pour qui","priceHint":25,"url":"https://..."}]}]}

Règles métier :
1. Logique temporelle : jour 1 = arrivée + installation ; dernier jour = matin plus léger + départ possible.
2. Alternance saine : ne pas enchaîner 3 restos ; chaque jour typique = 1 resto midi OU soir + 1 activité + 1 bar/soirée si le rythme le permet.
3. Ancrage SCORING : priorise les ambiances, catégories d'activités et envies star fournies dans le contexte JSON. Si "match" / "star" / "acts" sont présents, au moins 60% des créneaux doivent y coller.
4. Noms CONCRETS (pas "restaurant local") : vrais styles ou lieux plausibles pour la ville (ex. "Tapas au Born", "Boat party Port Vell").
5. url : quand possible, un lien utile (Google Maps recherche du lieu+ville, site officiel, TripAdvisor, ou page réservation). Format https:// uniquement. Si inconnu, omets le champ.
6. priceHint = estimation € / personne pour ce créneau, cohérente avec le budget global.
7. Respecte contraintes alimentaires (diet) pour les restos.
8. Rythme : chill = 2–3 slots/jour ; normal = 3–4 ; intense = 4–5.
9. Langue des labels/details : français.
10. Pas de texte hors JSON.`;

const SYSTEM_SLOT = `Tu proposes UNE alternative pour un créneau d'itinéraire de groupe.
JSON uniquement, sans markdown :
{"moment":"Midi|Après-midi|Soir","time":"15:00","type":"resto|activite|bar|libre","label":"...","detail":"...","priceHint":0,"url":"https://..."}
Doit être concret pour la ville, différent de l'existant, aligné sur les envies (vibe/acts/star).
url = lien utile si possible (Maps / site).`;

function mapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function compactCtx(input: ActivityAiInput): Record<string, unknown> {
  const o: Record<string, unknown> = {
    city: input.destination.slice(0, 48),
    nights: input.nights,
    n: input.participants,
    budget: Math.round(input.budgetPerPerson),
  };
  if (input.country) o.country = String(input.country).slice(0, 30);
  if (input.startDate) o.from = input.startDate;
  if (input.endDate) o.to = input.endDate;
  if (input.eventType) o.event = String(input.eventType).slice(0, 24);
  if (input.ambiances?.length) o.vibe = input.ambiances.slice(0, 5);
  if (input.activityCategories?.length) o.acts = input.activityCategories.slice(0, 8);
  if (input.starWanted?.length) o.star = input.starWanted.slice(0, 5);
  if (input.dietaryConstraints?.length) o.diet = input.dietaryConstraints.slice(0, 4);
  if (input.travelPace) o.pace = input.travelPace;
  if (input.matchReasons?.length) o.match = input.matchReasons.slice(0, 6);
  if (input.destinationScore != null) o.score = Math.round(Number(input.destinationScore));
  if (input.scoredActivityLabels?.length) o.seedActs = input.scoredActivityLabels.slice(0, 8);
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

function normalizeSlot(raw: any, city: string): ActivitySlot | null {
  if (!raw || typeof raw !== "object") return null;
  const label = String(raw.label || raw.name || "").trim();
  if (!label) return null;
  const type = String(raw.type || "activite").toLowerCase() as ActivitySlotType;
  const allowed: ActivitySlotType[] = ["resto", "activite", "bar", "transport", "libre"];
  const t = allowed.includes(type) ? type : "activite";
  let url: string | null = null;
  if (typeof raw.url === "string" && raw.url.startsWith("http")) {
    url = raw.url.slice(0, 300);
  } else if (t === "resto" || t === "activite" || t === "bar") {
    url = mapsUrl(`${label} ${city}`);
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

  return {
    moment: String(raw.moment || "Après-midi").slice(0, 24),
    type: t,
    label: label.slice(0, 80),
    detail: raw.detail ? String(raw.detail).slice(0, 160) : undefined,
    priceHint: Number.isFinite(price) ? Math.round(price!) : undefined,
    time,
    url,
  };
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
  })}. Contexte: ${JSON.stringify(ctx)}. Propose une alternative.`;

  try {
    const raw = await chatJson(cfg, SYSTEM_SLOT, user, 280);
    const parsed = extractJson(raw) as any;
    const slot = normalizeSlot(parsed, input.destination);
    if (!slot) return { slot: fallback, usedLlm: false, error: "llm_empty_parse" };
    if (!slot.moment) slot.moment = existing.moment;
    return { slot, usedLlm: true };
  } catch (e) {
    return { slot: fallback, usedLlm: false, error: String(e).slice(0, 160) };
  }
}
