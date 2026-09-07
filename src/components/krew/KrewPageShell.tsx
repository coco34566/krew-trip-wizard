import { type ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

export type KrewPageShellSize = "form" | "standard" | "wide" | "site";
export type KrewPageShellGutter = "default" | "compact" | "form" | "wide";

type KrewPageShellProps = ComponentPropsWithoutRef<"main"> & {
  size?: KrewPageShellSize;
  gutter?: KrewPageShellGutter;
};

/**
 * Semantic product page container.
 *
 * The shell owns width and horizontal page padding only. Vertical rhythm remains
 * with each surface until its family is explicitly migrated and visually checked.
 */
export function KrewPageShell({
  size = "standard",
  gutter = "default",
  className,
  ...props
}: KrewPageShellProps) {
  return (
    <main
      data-krew-page-shell
      data-krew-page-size={size}
      data-krew-page-gutter={gutter}
      className={cn("krew-page-shell", className)}
      {...props}
    />
  );
}
