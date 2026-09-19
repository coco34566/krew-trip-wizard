import type { AnchorHTMLAttributes, ReactNode } from "react";

import { safeExternalUrl } from "@/lib/safe-url";

type SafeExternalLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: unknown;
  children: ReactNode;
};

export function SafeExternalLink({ href, children, ...props }: SafeExternalLinkProps) {
  const safeHref = safeExternalUrl(href);
  if (!safeHref) return null;
  return <a {...props} href={safeHref}>{children}</a>;
}
