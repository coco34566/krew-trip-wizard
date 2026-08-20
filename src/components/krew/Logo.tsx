import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** Affiche la baseline officielle dans l'asset */
  withTagline?: boolean;
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

/**
 * Logo KREW officiel.
 * Les assets de /public/brand sont la source de vérité visuelle :
 * ne pas reconstruire le wordmark, la loutre ou la baseline en CSS/texte.
 */
export function Logo({
  className = "",
  withTagline = false,
  size = "md",
  theme = "light",
}: LogoProps) {
  const variant = withTagline ? "full" : "compact";
  const src = `/brand/krew-logo-${variant}-${theme}.png`;

  return (
    <img
      src={src}
      alt="KREW"
      className={cn(SIZES[size], "w-auto object-contain shrink-0", className)}
    />
  );
}
