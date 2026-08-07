/**
 * Génération d'itinéraire activités via Lovable AI (peu de tokens).
 * - 1 appel pour le planning complet (resto + activités + bars par jour)
 * - 1 appel ultra-court pour régénérer UN seul créneau
 */

export type ActivitySlotType = "resto" | "activite" | "bar" | "transport" | "libre";

export type ActivitySlot = {
  moment: string;
  type: ActivitySlotType;
  label: string;
  detail?: string;
  priceHint?: number;
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

const SYSTEM_FULL = `Tu es Krew, planificateur de week-end groupe.
Réponds UNIQUEMENT en JSON:
{"days":[{"day":1,"slots":[{"moment":"Matin|Midi|Après-midi|Soir","type":"resto|activite|bar|transport|libre","label":"...","detail":"...","priceHint":0}]}]}
Règles:
- Remplis chaque jour (arrivée → départ)
- Mélange resto, activité, bar selon rythme
- Labels concrets pour la destination
- priceHint €/pers optionnel
- Pas de markdown`;

const SYSTEM_SLOT = `Tu proposes UNE alternative d'activité pour un créneau.
JSON uniquement: {"moment":"...","type":"resto|activite|bar|libre","label":"...","detail":"...","priceHint":0}
Concret, adapté à la ville, différent de l'existant.`;

function compactCtx(input: ActivityAiInput): Record<string, unknown> {
  const o: Record<string, unknown> = {
    city: input.destination.slice(0, 40),
    nights: input.nights,
    n: input.participants,
    budget: Math.round(input.budgetPerPerson),
  };
  if (input.country) o.country = String(input.country).slice(0, 30);
  if (input.startDate) o.from = input.startDate;
  if (input.endDate) o.to = input.endDate;
  if (input.eventType) o.event = String(input.eventType).slice(0, 20);
  if (input.ambiances?.length) o.vibe = input.ambiances.slice(0, 4);
  if (input.activityCategories?.length) o.acts = input.activityCategories.slice(0, 6);
  if (input.starWanted?.length) o.star = input.starWanted.slice(0, 4);
  if (input.dietaryConstraints?.length) o.diet = input.dietaryConstraints.slice(0, 4);
  if (input.travelPace) o.pace = input.travelPace;
  return o;
}

async function chatJson(cfg: LlmConfig, system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.5,
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

function normalizeSlot(s: any): ActivitySlot | null {
  if (!s || typeof s !== "object") return null;
  const label = String(s.label || "").trim();
  if (!label) return null;
  const typeRaw = String(s.type || "activite").toLowerCase();
  const type: ActivitySlotType = ["resto", "activite", "bar", "transport", "libre"].includes(typeRaw)
    ? (typeRaw as ActivitySlotType)
    : "activite";
  return {
    moment: String(s.moment || "Après-midi").slice(0, 24),
    type,
    label: label.slice(0, 80),
    detail: s.detail ? String(s.detail).slice(0, 120) : undefined,
    priceHint: typeof s.priceHint === "number" ? Math.round(s.priceHint) : undefined,
  };
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Fallback local si pas d'IA */
export function buildLocalItinerary(input: ActivityAiInput, seedLabels: string[] = []): GroupItinerary {
  const daysCount = Math.max(1, input.nights + 1);
  const pace = input.travelPace || "equilibre";
  const slotsPerDay = pace === "chill" ? 2 : pace === "intense" ? 4 : 3;
  const pool = [
    ...seedLabels,
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
      });
    }
    slots.push({
      moment: "Midi",
      type: "resto",
      label: `Déjeuner local — ${input.destination}`,
      detail: input.dietaryConstraints?.length
        ? `Contraintes: ${input.dietaryConstraints.slice(0, 2).join(", ")}`
        : "Cuisine locale",
      priceHint: Math.min(35, Math.round(input.budgetPerPerson * 0.08)),
    });
    if (slotsPerDay >= 2) {
      slots.push({
        moment: "Après-midi",
        type: "activite",
        label: nextLabel(`Visite / expérience — ${input.destination}`),
        detail: "Selon envies du groupe",
        priceHint: Math.min(50, Math.round(input.budgetPerPerson * 0.12)),
      });
    }
    if (slotsPerDay >= 3) {
      slots.push({
        moment: "Soir",
        type: day === daysCount ? "resto" : "bar",
        label:
          day === daysCount
            ? `Dîner de clôture — ${input.destination}`
            : nextLabel(`Bar / soirée — ${input.destination}`),
        detail: day === daysCount ? "Ambiance groupe" : "Ambiance nocturne",
        priceHint: Math.min(40, Math.round(input.budgetPerPerson * 0.1)),
      });
    }
    if (day === daysCount) {
      slots.push({
        moment: "Fin de journée",
        type: "transport",
        label: "Retour",
        detail: "Check-out & trajet retour",
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

export async function generateItineraryWithAi(
  input: ActivityAiInput,
  seedLabels: string[] = [],
): Promise<{ itinerary: GroupItinerary; usedLlm: boolean; error?: string }> {
  const cfg = getLlmConfig();
  if (!cfg) {
    return { itinerary: buildLocalItinerary(input, seedLabels), usedLlm: false, error: "no_llm_key" };
  }
  try {
    const user = JSON.stringify({
      ...compactCtx(input),
      seeds: seedLabels.slice(0, 8),
      fill: "chaque jour: resto + activite + bar si possible",
    });
    const raw = await chatJson(cfg, SYSTEM_FULL, user, 700);
    const parsed = extractJson(raw) as { days?: any[] } | null;
    if (!parsed?.days?.length) {
      return {
        itinerary: buildLocalItinerary(input, seedLabels),
        usedLlm: false,
        error: "llm_empty_parse",
      };
    }
    const days: ItineraryDayPlan[] = parsed.days.map((d, i) => {
      const dayNum = Number(d.day) || i + 1;
      const slots = (Array.isArray(d.slots) ? d.slots : [])
        .map(normalizeSlot)
        .filter(Boolean) as ActivitySlot[];
      return {
        day: dayNum,
        date: input.startDate ? addDays(input.startDate, dayNum - 1) : null,
        slots: slots.length ? slots : buildLocalItinerary(input, seedLabels).days[i]?.slots ?? [],
      };
    });
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
      itinerary: buildLocalItinerary(input, seedLabels),
      usedLlm: false,
      error: String(e).slice(0, 160),
    };
  }
}

export async function regenerateSlotWithAi(
  input: ActivityAiInput,
  current: ActivitySlot,
  avoidLabels: string[] = [],
): Promise<{ slot: ActivitySlot; usedLlm: boolean; error?: string }> {
  const cfg = getLlmConfig();
  const fallback: ActivitySlot = {
    moment: current.moment,
    type: current.type,
    label: `${current.type === "resto" ? "Autre resto" : current.type === "bar" ? "Autre bar" : "Autre activité"} — ${input.destination}`,
    detail: "Option alternative",
    priceHint: current.priceHint,
  };
  if (!cfg) return { slot: fallback, usedLlm: false, error: "no_llm_key" };
  try {
    const user = JSON.stringify({
      city: input.destination,
      replace: { moment: current.moment, type: current.type, was: current.label },
      avoid: avoidLabels.slice(0, 6),
      vibe: input.ambiances.slice(0, 3),
      acts: input.activityCategories.slice(0, 4),
      star: (input.starWanted || []).slice(0, 3),
      diet: (input.dietaryConstraints || []).slice(0, 3),
    });
    const raw = await chatJson(cfg, SYSTEM_SLOT, user, 120);
    const parsed = extractJson(raw);
    const slot = normalizeSlot(parsed);
    if (!slot) return { slot: fallback, usedLlm: false, error: "llm_empty_parse" };
    if (!slot.moment) slot.moment = current.moment;
    if (!slot.type) slot.type = current.type;
    return { slot, usedLlm: true };
  } catch (e) {
    return { slot: fallback, usedLlm: false, error: String(e).slice(0, 160) };
  }
}
