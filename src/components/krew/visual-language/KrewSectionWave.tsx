import { cn } from "@/lib/utils";

type KrewSectionWaveProps = {
  position?: "top" | "bottom";
  tone?: "sage" | "plum";
  className?: string;
};

/**
 * Bordure de surface organique en forme de vague.
 * Sert de transition supérieure ou inférieure pour une grande zone colorée.
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
        viewBox="0 0 1200 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "w-full h-8 sm:h-12 block",
          tone === "sage" ? "text-sage/20" : "text-primary/12",
        )}
        preserveAspectRatio="none"
      >
        {isTop ? (
          <>
            {/* Remplissage vers le bas pour joindre la surface sous la vague */}
            <path
              d="M0,22 C200,42 450,2 700,28 C920,44 1080,10 1200,20 L1200,44 L0,44 Z"
              fill="currentColor"
            />
            {/* Tracé fluide d'accent sur la courbe */}
            <path
              d="M0,22 C200,42 450,2 700,28 C920,44 1080,10 1200,20"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="opacity-50"
            />
          </>
        ) : (
          <>
            {/* Remplissage vers le haut pour refermer la surface au-dessus */}
            <path
              d="M0,22 C200,2 450,42 700,16 C920,0 1080,34 1200,24 L1200,0 L0,0 Z"
              fill="currentColor"
            />
            {/* Tracé fluide d'accent sur la courbe */}
            <path
              d="M0,22 C200,2 450,42 700,16 C920,0 1080,34 1200,24"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="opacity-50"
            />
          </>
        )}
      </svg>
    </div>
  );
}
