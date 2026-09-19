import type { AnchorHTMLAttributes, ReactNode } from "react";
import { safeExternalUrl } from "@/lib/safe-url";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: unknown; children: ReactNode };
export function SafeExternalLink({ href, children, target = "_blank", rel = "noopener noreferrer", ...props }: Props) {
  const safeHref = safeExternalUrl(href);
  if (!safeHref) return null;
  return <a href={safeHref} target={target} rel={rel} {...props}>{children}</a>;
}
