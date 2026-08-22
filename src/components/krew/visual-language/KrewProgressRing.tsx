import { cn } from "@/lib/utils";

type KrewProgressRingProps = {
  value: number;
  total: number;
  size?: "sm" | "md";
  tone?: "sage" | "plum";
  label?: string;
  className?: string;
};

/**
 * Visualisation chiffrée compacte (SVG pur) pour la progression des données du groupe.
 * Format Space Mono accessible sans dépendances.
 */
export function KrewProgressRing({
  value,
  total,
  size = "md",
  tone = "sage",
  label,
  className,
}: KrewProgressRingProps) {
  if (total <= 0) return null;

  const pct = Math.min(1, Math.max(0, value / total));
  const dimension = size === "sm" ? 52 : 64;
  const strokeWidth = size === "sm" ? 4 : 5;
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - pct);

  const toneColor = tone === "sage" ? "text-sage" : "text-primary";

  return (
    <div
      role="img"
      aria-label={label ? `${label} : ${value} sur ${total}` : `${value} sur ${total}`}
      className={cn("inline-flex flex-col items-center shrink-0", className)}
    >
      <div className="relative flex items-center justify-center">
        <svg
          width={dimension}
          height={dimension}
          viewBox={`0 0 ${dimension} ${dimension}`}
          className="transform -rotate-90"
        >
          {/* Anneau de fond léger */}
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            className="stroke-surface-strong/60"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Arc de progression coloré */}
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            className={cn("transition-all duration-500 ease-out", toneColor)}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <span className="absolute font-mono text-xs font-bold text-foreground">
          {value}/{total}
        </span>
      </div>
      {label ? (
        <span className="mt-1 font-sans text-[11px] font-medium text-muted-foreground truncate max-w-[80px] text-center">
          {label}
        </span>
      ) : null}
    </div>
  );
}
