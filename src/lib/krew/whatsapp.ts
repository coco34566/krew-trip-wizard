export function buildWhatsAppUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function shareOnWhatsApp(text: string): void {
  window.location.assign(buildWhatsAppUrl(text));
}
