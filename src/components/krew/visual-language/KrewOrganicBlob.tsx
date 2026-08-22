import { cn } from "@/lib/utils";

type KrewOrganicBlobProps = {
  tone?: "sage" | "plum";
  variant?: "soft" | "sweep";
  className?: string;
};

/**
 * Surface SVG organique propriétaire KREW (soft = fond arriere, sweep = prune central).
 */
export function KrewOrganicBlob({
  tone = "sage",
  variant = "soft",
  className,
}: KrewOrganicBlobProps) {
  const isSoft = variant === "soft";

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none select-none overflow-visible shrink-0", className)}
    >
      <svg
        viewBox={isSoft ? "0 0 600 400" : "0 0 600 300"}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "w-full h-full block",
          tone === "sage" ? "text-sage/30" : "text-primary",
        )}
        preserveAspectRatio="none"
      >
        {isSoft ? (
          /* Variant soft : grande forme arrière-plan douce */
          <path
            d="M80,40 C200,-10 440,20 540,110 C620,190 580,330 460,380 C320,430 140,370 50,290 C-30,200 -10,80 80,40 Z"
            fill="currentColor"
          />
        ) : (
          /* Variant sweep : forme dynamique prune chevauchant la photo */
          <path
            d="M30,50 C160,10 420,-5 560,60 C620,110 590,220 510,270 C390,320 180,290 60,250 C-20,210 -10,100 30,50 Z"
            fill="currentColor"
          />
        )}
      </svg>
    </div>
  );
}
