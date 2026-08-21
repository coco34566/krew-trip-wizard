import { cn } from "@/lib/utils";

type KrewSectionWaveProps = {
  tone?: "sage" | "plum";
  className?: string;
};

/**
 * Transition visuelle organique entre deux grandes sections.
 * Décorative uniquement.
 */
export function KrewSectionWave({ tone = "sage", className }: KrewSectionWaveProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("w-full overflow-hidden pointer-events-none py-2", className)}
    >
      <svg
        viewBox="0 0 1200 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "w-full h-6 sm:h-9",
          tone === "sage" ? "text-sage/25" : "text-primary/15",
        )}
        preserveAspectRatio="none"
      >
        <path
          d="M0,18 C150,32 350,4 600,20 C850,36 1050,8 1200,22 L1200,36 L0,36 Z"
          fill="currentColor"
        />
        <path
          d="M0,18 C150,32 350,4 600,20 C850,36 1050,8 1200,22"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="opacity-60"
        />
      </svg>
    </div>
  );
}
