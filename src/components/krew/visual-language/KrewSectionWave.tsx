import { cn } from "@/lib/utils";

type KrewSectionWaveProps = {
  position?: "top" | "bottom";
  tone?: "sage" | "plum";
  className?: string;
};

/**
 * Grande bordure de surface organique en forme de vague pour nappe colorée.
 * Position "top" : la vague ouvre la nappe en se remplissant vers le bas.
 * Position "bottom" : la vague referme la nappe en se remplissant vers le haut.
 */
export function KrewSectionWave({
  position = "top",
  tone = "sage",
  className,
}: KrewSectionWaveProps) {
  const isTop = position === "top";

  return (
    <div
      aria-hidden="true"
      className={cn("w-full overflow-hidden pointer-events-none leading-none shrink-0", className)}
    >
      <svg
        viewBox="0 0 1200 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "w-full h-10 sm:h-14 lg:h-16 block",
          tone === "sage" ? "text-sage/18" : "text-primary/12",
        )}
        preserveAspectRatio="none"
      >
        {isTop ? (
          <>
            {/* Remplissage organique vers le bas pour former la grande nappe */}
            <path
              d="M0,30 C220,58 480,2 720,38 C940,58 1080,14 1200,28 L1200,60 L0,60 Z"
              fill="currentColor"
            />
            {/* Trait d'accent fluide sur la crête supérieure */}
            <path
              d="M0,30 C220,58 480,2 720,38 C940,58 1080,14 1200,28"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="opacity-40"
            />
          </>
        ) : (
          <>
            {/* Remplissage organique vers le haut pour fermer la nappe */}
            <path
              d="M0,30 C220,2 480,58 720,22 C940,2 1080,46 1200,32 L1200,0 L0,0 Z"
              fill="currentColor"
            />
            {/* Trait d'accent fluide sur la crête inférieure */}
            <path
              d="M0,30 C220,2 480,58 720,22 C940,2 1080,46 1200,32"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="opacity-40"
            />
          </>
        )}
      </svg>
    </div>
  );
}
