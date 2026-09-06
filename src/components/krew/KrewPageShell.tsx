import { type ComponentPropsWithoutRef, type ElementType } from "react";

import { cn } from "@/lib/utils";

export type KrewPageShellSize = "form" | "standard" | "wide" | "site";

type KrewPageShellProps<T extends ElementType = "main"> = {
  as?: T;
  size?: KrewPageShellSize;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "size">;

/**
 * Semantic product page container.
 *
 * The shell owns width and horizontal page padding only. Vertical rhythm remains
 * with each surface until its family is explicitly migrated and visually checked.
 */
export function KrewPageShell<T extends ElementType = "main">({
  as,
  size = "standard",
  className,
  ...props
}: KrewPageShellProps<T>) {
  const Component = as ?? "main";

  return (
    <Component
      data-krew-page-shell
      data-krew-page-size={size}
      className={cn("krew-page-shell", className)}
      {...props}
    />
  );
}
