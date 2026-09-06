import { type ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

export type KrewPageShellSize = "form" | "standard" | "wide" | "site";

type KrewPageShellProps = ComponentPropsWithoutRef<"main"> & {
  size?: KrewPageShellSize;
};

/**
 * Semantic product page container.
 *
 * The shell owns width and horizontal page padding only. Vertical rhythm remains
 * with each surface until its family is explicitly migrated and visually checked.
 */
export function KrewPageShell({
  size = "standard",
  className,
  ...props
}: KrewPageShellProps) {
  return (
    <main
      data-krew-page-shell
      data-krew-page-size={size}
      className={cn("krew-page-shell", className)}
      {...props}
    />
  );
}
