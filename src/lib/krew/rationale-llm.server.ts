/**
 * Rationales génératives ultra-légères (tokens minimaux).
 * 1 seul appel pour les 3 propositions. Fallback = rationale template du moteur.
 *
 * Env :
 *  - OPENAI_API_KEY (ou GROQ_API_KEY / XAI_API_KEY)
 *  - LLM_RATIONALE_MODEL (défaut: gpt-4o-mini)
 *  - LLM_RATIONALE_BASE_URL (défaut: https://api.openai.com/v1)
 */

import type { Proposal } from "./engine";
import { reportServerError } from "@/lib/server-error-reporting.server";

const SYSTEM = `Tu es la couche IA contrôlée du moteur Krew. Tu ne choisis pas librement les destinations: tu compares uniquement les candidates déjà filtrées et scorées par le moteur déterministe.
Règles strictes:
- Ne modifie jamais une contrainte dure (budget veto, durée maximale, modes de transport, dates, exclusions).
- N'invente jamais prix, disponibilité, temps de trajet, météo ou caractéristique absente du payload.
- Si un conflit existe, signale-le sans masquer le score calculé.
- Réponds uniquement en JSON valide: {"items":[{"destination":"...","score":87,"match_summary":"...","key_matching_preferences":["..."],"potential_conflicts":["..."],"why_this_destination":"..."}]}
- match_summary et why_this_destination: français, tutoiement, concis.`;

type CompactItem = {
  name: string;
  score: number;
  fit?: string;
  budget?: string;
  why: string[];
};

function compactPayload(
  eventType: string | null | undefined,
  participants: number,
  proposals: Proposal[],
): { event: string; n: number; items: CompactItem[] } {
  return {
    event: (eventType || "groupe").slice(0, 24),
    n: participants,
    items: proposals.map((p) => {
      const why = (p.matchReasons ?? []).slice(0, 4).map((r) =>
        r
          .replace(/✅\s*/g, "")
          .replace(/⚠️\s*/g, "")
          .slice(0, 80),
      );
      const fit =
        p.participantsEvaluated > 0
          ? `${p.satisfiedCount}/${p.participantsEvaluated}`
          : undefined;
      const item: any = {
        name: p.destination.name,
        score: p.score,
        budget: `${p.budget.totalPerPerson}€/p`,
        constraints: {
          hardBudgetFits: p.budget.hardBudgetFits,
          transport: (p.transportOptions ?? []).map((o) => `${o.mode}:${Math.round(o.durationHours * 10) / 10}h`).slice(0, 3),
        },
        subscores: p.subScores,
        why,
      };
      if (fit !== undefined) item.fit = fit;
      return item as CompactItem;
    }),
  };
}

function getLlmConfig(): {
  apiKey: string;
  baseUrl: string;
  model: string;
} | null {
  // Lovable AI natif d'abord
  if (process.env["LOVABLE_API_KEY"]) {
    return {
      apiKey: process.env["LOVABLE_API_KEY"],
      baseUrl: (process.env["LOVABLE_AI_BASE_URL"] || "https://ai.gateway.lovable.dev/v1").replace(
        /\/$/,
        "",
      ),
      model:
        process.env["LLM_RATIONALE_MODEL"] ||
        process.env["LOVABLE_AI_MODEL"] ||
        "google/gemini-2.5-flash",
    };
  }
  const apiKey =
    process.env["OPENAI_API_KEY"] ||
    process.env["GROQ_API_KEY"] ||
    process.env["XAI_API_KEY"] ||
    process.env["LLM_API_KEY"];
  if (!apiKey) return null;
  const baseUrl = (
    process.env["LLM_RATIONALE_BASE_URL"] ||
    (process.env["GROQ_API_KEY"] ? "https://api.groq.com/openai/v1" : null) ||
    (process.env["XAI_API_KEY"] ? "https://api.x.ai/v1" : null) ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model =
    process.env["LLM_RATIONALE_MODEL"] ||
    (process.env["GROQ_API_KEY"] ? "llama-3.1-8b-instant" : null) ||
    (process.env["XAI_API_KEY"] ? "grok-2-latest" : null) ||
    "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

/**
 * Enrichit proposal.rationale via 1 call LLM groupé.
 * En cas d'absence de clé / erreur / parse fail → inchangé (fallback moteur).
 */
export async function enrichProposalsWithLlmRationales(
  proposals: Proposal[],
  meta: { eventType?: string | null; participants: number },
): Promise<{ proposals: Proposal[]; usedLlm: boolean; error?: string }> {
  if (!proposals.length) return { proposals, usedLlm: false };

  const cfg = getLlmConfig();
  if (!cfg) return { proposals, usedLlm: false };

  const payload = compactPayload(meta.eventType, meta.participants, proposals);
  const user = JSON.stringify(payload);

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        max_tokens: 220,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      reportServerError(new Error(`LLM ${res.status}: ${errText.slice(0, 120)}`), {
        provider: "openai/llm",
        kind: "rationale",
      });
      return {
        proposals,
        usedLlm: false,
        error: `LLM ${res.status}: ${errText.slice(0, 120)}`,
      };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as {
      items?: {
        name?: string;
        destination?: string;
        text?: string;
        match_summary?: string;
        why_this_destination?: string;
      }[];
    };

    const byName = new Map<string, string>();
    for (const it of parsed.items ?? []) {
      const name = (it?.destination || it?.name || "").trim();
      const text = (it?.why_this_destination || it?.match_summary || it?.text || "").trim();
      if (name && text) {
        byName.set(name.toLowerCase(), text.slice(0, 400));
      }
    }

    // Alignement aussi par index si les noms divergent légèrement
    const enriched = proposals.map((p, i) => {
      const fromName = byName.get(p.destination.name.trim().toLowerCase());
      const fromIndex = (parsed.items?.[i]?.why_this_destination || parsed.items?.[i]?.match_summary || parsed.items?.[i]?.text)?.trim();
      const text = fromName || fromIndex;
      if (!text) return p;
      return { ...p, rationale: text };
    });

    return { proposals: enriched, usedLlm: true };
  } catch (e) {
    reportServerError(e, {
      provider: "openai/llm",
      kind: "rationale",
    });
    return {
      proposals,
      usedLlm: false,
      error: String(e).slice(0, 150),
    };
  }
}
