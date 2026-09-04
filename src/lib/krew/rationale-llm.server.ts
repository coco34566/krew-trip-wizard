/**
 * Rationales génératives ultra-légères (tokens minimaux).
 * 1 seul appel pour les 3 propositions. Fallback = rationale template du moteur,
 * repassé dans la même couche de présentation destination.
 *
 * Env :
 *  - OPENAI_API_KEY (ou AIMLAPI_API_KEY)
 *  - LLM_RATIONALE_MODEL (défaut: gpt-4o-mini)
 *  - LLM_RATIONALE_BASE_URL (défaut: https://api.openai.com/v1)
 */

import type { Proposal } from "./engine";
import { reportServerError } from "@/lib/server-error-reporting.server";

const SYSTEM = `Tu es la couche éditoriale contrôlée du moteur Krew. Tu ne choisis pas librement les destinations: tu expliques uniquement pourquoi chacune des candidates déjà filtrées et scorées convient à CE groupe.
Règles strictes:
- Ne modifie jamais une contrainte dure (budget veto, durée maximale, modes de transport, dates, exclusions).
- N'invente jamais prix, disponibilité, temps de trajet, météo ou caractéristique absente du payload.
- On est à l'étape DESTINATION : ne parle jamais d'hôtel, hébergement, logement, chambre, villa, appartement, réservation ou endroit où dormir.
- Chaque commentaire doit être propre à la destination. Interdiction des phrases passe-partout du type « destination idéale », « excellent compromis », « bon équilibre » sans élément concret propre au lieu.
- Utilise les caractéristiques du lieu, les activités, l'environnement et les sous-scores réellement fournis.
- why_this_destination = UNE phrase en français, naturelle, spécifique, 135 caractères environ maximum.
- key_matching_preferences = 1 à 3 signaux très courts, concrets et différents selon les destinations (ex: « Lac & montagne », « Bains thermaux », « Vie nocturne », « Patrimoine », « Accès simple »).
- Réponds uniquement en JSON valide: {"items":[{"destination":"...","why_this_destination":"...","key_matching_preferences":["..."],"potential_conflicts":[]}]}`;

type CompactItem = {
  name: string;
  score: number;
  fit?: string;
  budget?: string;
  why: string[];
  destination?: {
    country?: string;
    type?: string;
    region?: string;
    environment?: string[];
    anchors?: string[];
    activities?: string[];
  };
};

type LlmItem = {
  name?: string;
  destination?: string;
  text?: string;
  match_summary?: string;
  why_this_destination?: string;
  key_matching_preferences?: string[];
};

const LODGING_RE = /\b(h[oô]tel|h[eé]bergement|logement|chambre|villa|appartement|maison|r[eé]servation|dormir|nuit[eé]e?s?)\b/i;
const GENERIC_RE = /\b(destination id[eé]ale|excellent compromis|bon compromis|bon [eé]quilibre|parfait(?:e)? pour|correspond (?:bien )?aux envies)\b/i;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanDestinationCopy(value: unknown, max = 150) {
  if (typeof value !== "string") return "";
  const cleaned = normalizeWhitespace(value)
    .replace(/✅\s*/g, "")
    .replace(/⚠️\s*/g, "")
    .replace(/^[-–—•·\s]+/, "");
  if (!cleaned || LODGING_RE.test(cleaned)) return "";
  return cleaned.slice(0, max).trim();
}

function compatibility(score: number) {
  const safe = Number.isFinite(score) ? score : 0;
  const level = safe >= 85 ? 5 : safe >= 70 ? 4 : safe >= 55 ? 3 : safe >= 40 ? 2 : 1;
  const label = level === 5
    ? "Excellent choix"
    : level === 4
      ? "Très bon choix"
      : level === 3
        ? "Bon choix"
        : level === 2
          ? "Choix plus mitigé"
          : "Peu adapté";
  return {
    level,
    label,
    dots: `${"● ".repeat(level)}${"○ ".repeat(5 - level)}`.trim(),
  };
}

function compactPayload(
  eventType: string | null | undefined,
  participants: number,
  proposals: Proposal[],
): { event: string; n: number; items: CompactItem[] } {
  return {
    event: (eventType || "groupe").slice(0, 24),
    n: participants,
    items: proposals.map((p) => {
      const why = (p.matchReasons ?? [])
        .map((r) => cleanDestinationCopy(r, 80))
        .filter(Boolean)
        .slice(0, 4);
      const fit =
        p.participantsEvaluated > 0
          ? `${p.satisfiedCount}/${p.participantsEvaluated}`
          : undefined;
      const destination = p.destination as Proposal["destination"] & {
        destination_type?: string | null;
        region_name?: string | null;
        env_tags?: string[] | null;
        anchor_places?: string[] | null;
      };
      const item: CompactItem = {
        name: p.destination.name,
        score: p.score,
        budget: `${Math.round(p.budget.totalPerPerson)}€/p`,
        destination: {
          country: p.destination.country,
          type: destination.destination_type ?? undefined,
          region: destination.region_name ?? undefined,
          environment: (destination.env_tags ?? []).slice(0, 4),
          anchors: (destination.anchor_places ?? []).slice(0, 3),
          activities: (p.activities ?? []).map((a) => a.name).filter(Boolean).slice(0, 4),
        },
        why,
      };
      if (fit !== undefined) item.fit = fit;
      return item;
    }),
  };
}

function fallbackSpecificSummary(proposal: Proposal) {
  const destination = proposal.destination as Proposal["destination"] & {
    destination_type?: string | null;
    region_name?: string | null;
    env_tags?: string[] | null;
    anchor_places?: string[] | null;
  };
  const place = destination.name;
  const concrete = [
    ...(destination.env_tags ?? []),
    ...(destination.anchor_places ?? []),
    ...(proposal.activities ?? []).map((a) => a.name),
    ...(proposal.matchReasons ?? []),
  ]
    .map((value) => cleanDestinationCopy(value, 52))
    .filter(Boolean)
    .filter((value, index, values) => values.findIndex((v) => v.toLowerCase() === value.toLowerCase()) === index)
    .slice(0, 3);

  const existing = cleanDestinationCopy(proposal.rationale, 145);
  if (existing && !GENERIC_RE.test(existing)) return existing;
  if (concrete.length >= 2) return `${place} ressort pour ${concrete[0]?.toLowerCase()} et ${concrete[1]?.toLowerCase()}, deux points qui collent bien au groupe.`;
  if (concrete.length === 1) return `${place} a été retenue notamment pour ${concrete[0]?.toLowerCase()}, un vrai point fort pour ce voyage.`;
  return `${place} fait partie des options les plus compatibles avec les préférences réellement exprimées par le groupe.`;
}

function buildSignals(proposal: Proposal, llmSignals?: string[]) {
  const destination = proposal.destination as Proposal["destination"] & { env_tags?: string[] | null };
  return [
    ...(llmSignals ?? []),
    ...(proposal.matchReasons ?? []),
    ...(destination.env_tags ?? []),
    ...(proposal.activities ?? []).map((a) => a.name),
  ]
    .map((value) => cleanDestinationCopy(value, 34))
    .filter(Boolean)
    .filter((value) => !GENERIC_RE.test(value))
    .filter((value, index, values) => values.findIndex((v) => v.toLowerCase() === value.toLowerCase()) === index)
    .slice(0, 3);
}

function valueWinnerIndex(proposals: Proposal[]) {
  let winner = -1;
  let best = -Infinity;
  proposals.forEach((proposal, index) => {
    const total = Number(proposal.budget?.totalPerPerson ?? 0);
    if (!(total > 0)) return;
    const ratio = Number(proposal.score ?? 0) / total;
    if (ratio > best) {
      best = ratio;
      winner = index;
    }
  });
  return winner;
}

export function buildDestinationPresentation(
  proposal: Proposal,
  options: { generatedSummary?: string; generatedSignals?: string[]; bestValue?: boolean } = {},
) {
  const match = compatibility(proposal.score);
  const summary = cleanDestinationCopy(options.generatedSummary, 145) || fallbackSpecificSummary(proposal);
  const signals = buildSignals(proposal, options.generatedSignals);
  const parts = [
    `${match.dots} ${match.label}`,
    summary,
    ...signals,
    ...(options.bestValue ? ["Meilleur rapport qualité-prix"] : []),
  ];
  return {
    compatibilityLevel: match.level,
    compatibilityLabel: match.label,
    summary,
    signals,
    bestValue: Boolean(options.bestValue),
    // La carte actuelle affiche rationale lorsque matchReasons est vide.
    // On garde donc ici une seule ligne éditoriale compacte en attendant la prochaine extraction du composant UI.
    displayText: parts.filter(Boolean).join(" · ").slice(0, 360),
  };
}

function applyPresentation(
  proposals: Proposal[],
  llmItems: LlmItem[] = [],
) {
  const bestValueIndex = valueWinnerIndex(proposals);
  const byName = new Map<string, LlmItem>();
  for (const item of llmItems) {
    const name = (item.destination || item.name || "").trim().toLowerCase();
    if (name) byName.set(name, item);
  }

  return proposals.map((proposal, index) => {
    const item = byName.get(proposal.destination.name.trim().toLowerCase()) ?? llmItems[index];
    const presentation = buildDestinationPresentation(proposal, {
      generatedSummary: item?.why_this_destination || item?.match_summary || item?.text,
      generatedSignals: Array.isArray(item?.key_matching_preferences) ? item.key_matching_preferences : [],
      bestValue: index === bestValueIndex,
    });
    return {
      ...proposal,
      rationale: presentation.displayText,
      // Force le rendu de la rationale compacte plutôt que les anciennes pills parfois génériques.
      matchReasons: [],
    };
  });
}

function getLlmConfig(): {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: "aimlapi" | "openai";
} | null {
  const aimlapiKey = process.env["AIMLAPI_API_KEY"];
  if (aimlapiKey) {
    return {
      apiKey: aimlapiKey,
      baseUrl: (process.env["AIMLAPI_BASE_URL"] || "https://api.aimlapi.com/v1").replace(/\/$/, ""),
      model: process.env["AIMLAPI_RATIONALE_MODEL"] || process.env["AIMLAPI_MODEL"] || "google/gemini-2.5-flash",
      provider: "aimlapi",
    };
  }
  const openaiKey = process.env["OPENAI_API_KEY"] || process.env["LLM_API_KEY"];
  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseUrl: (process.env["LLM_RATIONALE_BASE_URL"] || "https://api.openai.com/v1").replace(/\/$/, ""),
      model: process.env["LLM_RATIONALE_MODEL"] || "gpt-4o-mini",
      provider: "openai",
    };
  }
  return null;
}

/**
 * Enrichit proposal.rationale via 1 call LLM groupé.
 * En cas d'absence de clé / erreur / parse fail, applique quand même la couche
 * de présentation déterministe afin de garder un wording destination propre.
 */
export async function enrichProposalsWithLlmRationales(
  proposals: Proposal[],
  meta: { eventType?: string | null; participants: number; freeNotes?: string[] },
): Promise<{ proposals: Proposal[]; usedLlm: boolean; error?: string }> {
  if (!proposals.length) return { proposals, usedLlm: false };

  const cfg = getLlmConfig();
  if (!cfg) return { proposals: applyPresentation(proposals), usedLlm: false };

  const payload = compactPayload(meta.eventType, meta.participants, proposals) as any;
  if (meta.freeNotes?.length) payload.freeNotes = meta.freeNotes;
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
        temperature: 0.25,
        max_tokens: 320,
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
        proposals: applyPresentation(proposals),
        usedLlm: false,
        error: `LLM ${res.status}: ${errText.slice(0, 120)}`,
      };
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as { items?: LlmItem[] };

    return { proposals: applyPresentation(proposals, parsed.items ?? []), usedLlm: true };
  } catch (e) {
    reportServerError(e, {
      provider: "openai/llm",
      kind: "rationale",
    });
    return {
      proposals: applyPresentation(proposals),
      usedLlm: false,
      error: String(e).slice(0, 150),
    };
  }
}
