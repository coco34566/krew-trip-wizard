/**
 * Module de reporting des erreurs serveur pour le monitoring (Chantier 1.3)
 */

import { scrubMonitoringContext, scrubMonitoringValue, scrubString } from "@/lib/error-monitoring";

export type ServerErrorContext = {
  tripId?: string;
  provider?: string;
  kind?: string;
  [key: string]: unknown;
};

/**
 * Logge une erreur structurée au format JSON et l'envoie optionnellement à un webhook d'alerte (Slack/Discord).
 * Ne lève jamais d'erreur bloquante même si l'envoi du webhook échoue.
 */
export function reportServerError(error: unknown, context: ServerErrorContext = {}): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const safeContext = scrubMonitoringContext(context);
  const safeErrorMessage = scrubString(errorMessage);
  const safeErrorStack = scrubMonitoringValue(errorStack);

  const logPayload = {
    timestamp: new Date().toISOString(),
    level: "ERROR",
    message: safeErrorMessage,
    stack: safeErrorStack,
    context: {
      trip_id: safeContext.tripId,
      provider: safeContext.provider,
      kind: safeContext.kind,
      ...safeContext,
    },
  };

  // 1. Log structuré JSON sur stdout (niveau error)
  console.error(JSON.stringify(logPayload, null, 2));

  // 2. Notification par webhook (Slack ou Discord)
  const webhookUrl = process.env["ALERT_WEBHOOK_URL"];
  if (webhookUrl && webhookUrl.trim() !== "") {
    const summary = `🚨 *Krew Server Error Alert* 🚨\n` +
      `*Message:* ${safeErrorMessage}\n` +
      `*Kind:* ${String(safeContext.kind ?? "N/A")}\n` +
      `*Provider:* ${String(safeContext.provider ?? "N/A")}\n` +
      `*Trip ID:* ${String(safeContext.tripId ?? "N/A")}\n` +
      `*Time:* ${logPayload.timestamp}`;

    fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: summary, // Pour Slack
        content: summary, // Pour Discord
      }),
    }).catch((webhookError) => {
      console.warn("[reportServerError] Échec de l'envoi du webhook d'alerte:", scrubString(String(webhookError)));
    });
  }
}
