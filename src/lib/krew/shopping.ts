export type ShoppingLink = { merchant: string; url: string };

/** Couche marchande séparée du moteur : aucune URL n'est inventée. */
export function resolveShoppingLink(
  itemId: string,
  links: Record<string, ShoppingLink | undefined> = {},
): ShoppingLink | null {
  const link = links[itemId];
  if (!link?.merchant || !/^https:\/\//i.test(link.url)) return null;
  return link;
}
