/**
 * Opens WhatsApp with a prefilled message without navigating away from Krew or leaving a blank tab in Safari iOS.
 */
export function openWhatsAppShare(text: string): void {
  if (typeof window === "undefined") return;

  const encodedText = encodeURIComponent(text);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    // Create an invisible iframe to launch whatsapp:// scheme without navigating top window or opening blank tabs
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = `whatsapp://send?text=${encodedText}`;
    document.body.appendChild(iframe);

    // Clean up iframe node after delay
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1500);
  } else {
    // Desktop: use wa.me in a new window/tab
    window.open(`https://wa.me/?text=${encodedText}`, "_blank", "noopener,noreferrer");
  }
}
