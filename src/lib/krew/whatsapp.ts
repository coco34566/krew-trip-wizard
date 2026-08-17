export function buildWhatsAppUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function shareOnWhatsApp(text: string): void {
  window.location.assign(buildWhatsAppUrl(text));
}

export function buildTripStatusWhatsApp(input: {
  tripName: string;
  tripUrl: string;
  statusLines: string[];
  actions: { name: string; action: string }[];
}): string {
  if (!input.actions.length) {
    return `Tout est à jour pour « ${input.tripName} » ✈️\n\nLe groupe est à jour pour le moment. La suite de l’organisation est disponible sur KREW :\n👉 ${input.tripUrl}`;
  }
  return [
    `Petit point KREW pour « ${input.tripName} » ✈️`,
    "",
    ...input.statusLines,
    ...(input.statusLines.length ? [""] : []),
    "Il reste quelques petites choses à faire :",
    ...input.actions.map(({ name, action }) => `• ${name} : ${action}`),
    "",
    `👉 ${input.tripUrl}`,
  ].join("\n");
}
