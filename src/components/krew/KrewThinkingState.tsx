import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type KrewThinkingContext =
  | "destinations"
  | "accommodations"
  | "transport"
  | "planning"
  | "generic";

interface KrewThinkingStateProps {
  context?: KrewThinkingContext;
  customMessage?: string;
  className?: string;
  /** Delay in ms before rendering to prevent layout flashing on fast responses (default: 600ms) */
  delayMs?: number;
}

const CONTENT: Record<
  KrewThinkingContext,
  { title: string; description: string; otterSrc: string }
> = {
  destinations: {
    title: "KREW prépare les idées qui collent au groupe",
    description: "On croise les envies, les contraintes et le budget avant de te montrer la suite.",
    otterSrc: "/brand/otter-states/destination.png",
  },
  accommodations: {
    title: "KREW cherche où poser les valises",
    description: "On garde les options qui ont du sens pour le groupe et pour le séjour.",
    otterSrc: "/brand/otter-states/accommodation.png",
  },
  transport: {
    title: "KREW prépare les trajets du groupe",
    description: "On tient compte des points de départ et des contraintes déjà renseignées.",
    otterSrc: "/brand/otter-states/transport.png",
  },
  planning: {
    title: "KREW prépare le planning",
    description: "On assemble une proposition cohérente avec les choix déjà faits par le groupe.",
    otterSrc: "/brand/otter-states/planning.png",
  },
  generic: {
    title: "KREW prépare la meilleure réponse pour le groupe",
    description: "Encore un instant, la suite arrive.",
    otterSrc: "/brand/otter-states/searching.png",
  },
};

export function KrewThinkingState({
  context = "generic",
  customMessage,
  className,
  delayMs = 600,
}: KrewThinkingStateProps) {
  const [shouldShow, setShouldShow] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) {
      setShouldShow(true);
      return;
    }

    const timer = setTimeout(() => {
      setShouldShow(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!shouldShow) {
    return <div aria-hidden="true" className={cn("mx-auto min-h-[116px] w-full max-w-[620px] sm:min-h-[132px]", className)} />;
  }

  const content = CONTENT[context] ?? CONTENT.generic;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "mx-auto grid w-full max-w-[620px] grid-cols-[minmax(0,1fr)_72px] items-center gap-4 rounded-[20px] border border-sage/20 bg-sage/[0.06] px-4 py-4 text-left sm:grid-cols-[minmax(0,1fr)_92px] sm:gap-7 sm:px-5 sm:py-5",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="font-display text-[25px] font-normal leading-[1.04] tracking-[-0.015em] text-foreground sm:text-[29px]">
          {customMessage || content.title}
        </p>
        {!customMessage ? (
          <p className="mt-2 text-[14px] leading-[1.55] text-muted-foreground sm:text-[15px]">
            {content.description}
          </p>
        ) : null}
        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          <span className="size-1.5 rounded-full bg-primary/70" />
          <span className="size-1.5 rounded-full bg-primary/45" />
          <span className="size-1.5 rounded-full bg-primary/25" />
        </div>
      </div>

      <img
        src={content.otterSrc}
        alt=""
        className="pointer-events-none h-auto w-full max-w-[72px] justify-self-end object-contain opacity-95 sm:max-w-[92px]"
      />
    </div>
  );
}
