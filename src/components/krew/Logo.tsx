import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** Affiche le tagline sous le mot-marque */
  withTagline?: boolean;
  /** Taille de l'icône (px) */
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: { img: "h-8 w-8", text: "text-lg", tag: "text-[9px]" },
  md: { img: "h-10 w-10", text: "text-xl", tag: "text-[10px]" },
  lg: { img: "h-14 w-14", text: "text-3xl", tag: "text-xs" },
} as const;

/**
 * Logo Krew — pastille points + wordmark.
 * Asset : /krew-logo.jpg (charte officielle).
 */
export function Logo({ className = "", withTagline = false, size = "md" }: LogoProps) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src="/krew-logo.jpg"
        alt="Krew"
        className={cn(s.img, "rounded-lg object-cover shadow-sm ring-1 ring-primary/30")}
      />
      <span className="flex flex-col leading-none">
        <span className={cn("font-display font-bold tracking-tight text-foreground", s.text)}>
          KREW
        </span>
        {withTagline ? (
          <span
            className={cn(
              "mt-1 font-medium uppercase tracking-[0.14em] text-muted-foreground",
              s.tag,
            )}
          >
            La team. Le plan. Le moment.
          </span>
        ) : null}
      </span>
    </span>
  );
}
