import { cn } from "@/lib/utils";

type LogoVariant = "full" | "compact" | "wordmark" | "icon";

type LogoProps = {
  className?: string;
  /** Compatibilité avec les usages existants : full si true, compact sinon. */
  withTagline?: boolean;
  /** Variante officielle du système de logo. */
  variant?: LogoVariant;
  /** Taille visuelle du logo */
  size?: "sm" | "md" | "lg";
  /** Variante pour fond clair ou prune */
  theme?: "light" | "dark";
};

const SIZES = {
  sm: "h-8",
  md: "h-10",
  lg: "h-14",
} as const;

const FILE_STEMS: Record<LogoVariant, string> = {
  full: "krew-logo-full",
  compact: "krew-logo-compact",
  wordmark: "krew-wordmark",
  icon: "krew-otter",
};

/**
 * Logo KREW officiel.
 * Les assets de /public/brand sont la source de vérité visuelle :
 * ne pas reconstruire le wordmark, la loutre ou la baseline en CSS/texte.
 */
export function Logo({
  className = "",
  withTagline = false,
  variant,
  size = "md",
  theme = "light",
}: LogoProps) {
  const resolvedVariant = variant ?? (withTagline ? "full" : "compact");
  const src = `/brand/${FILE_STEMS[resolvedVariant]}-${theme}.png`;

  return (
    <img
      src={src}
      alt="KREW"
      className={cn(SIZES[size], "w-auto object-contain shrink-0", className)}
    />
  );
}
