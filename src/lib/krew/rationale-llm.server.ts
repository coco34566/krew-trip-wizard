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

const SYSTEM = `Tu es Krew. Reformule en français (tutoiement) pourquoi chaque destination convient au groupe.
Règles strictes:
- 2 phrases max par destination
- Uniquement les faits fournis, zéro invention de prix/dispo
- Pas de markdown, pas de liste
- Réponds JSON: {"items":[{"name":"...","text":"..."}]}`;

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
      return {
        name: p.destination.name,
        score: p.score,
        fit,
        budget: `${p.budget.totalPerPerson}€/p`,
        why,
      };
    }),
  };
}

function getLlmConfig(): {
  apiKey: string;
  baseUrl: string;
  model: string;
} | null {
  // Lovable AI natif d'abord
  if (process.env.LOVABLE_API_KEY) {
    return {
      apiKey: process.env.LOVABLE_API_KEY,
      baseUrl: (process.env.LOVABLE_AI_BASE_URL || "https://ai.gateway.lovable.dev/v1").replace(
        /\/$/,
        "",
      ),
      model:
        process.env.LLM_RATIONALE_MODEL ||
        process.env.LOVABLE_AI_MODEL ||
        "google/gemini-2.5-flash",
    };
  }
  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.XAI_API_KEY ||
    process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const baseUrl = (
    process.env.LLM_RATIONALE_BASE_URL ||
    (process.env.GROQ_API_KEY ? "https://api.groq.com/openai/v1" : null) ||
    (process.env.XAI_API_KEY ? "https://api.x.ai/v1" : null) ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model =
    process.env.LLM_RATIONALE_MODEL ||
    (process.env.GROQ_API_KEY ? "llama-3.1-8b-instant" : null) ||
    (process.env.XAI_API_KEY ? "grok-2-latest" : null) ||
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
      items?: { name?: string; text?: string }[];
    };

    const byName = new Map<string, string>();
    for (const it of parsed.items ?? []) {
      if (it?.name && it?.text) {
        byName.set(it.name.trim().toLowerCase(), String(it.text).trim().slice(0, 400));
      }
    }

    // Alignement aussi par index si les noms divergent légèrement
    const enriched = proposals.map((p, i) => {
      const fromName = byName.get(p.destination.name.trim().toLowerCase());
      const fromIndex = parsed.items?.[i]?.text?.trim();
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
