import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/krew/Logo";

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

const MESSAGES: Record<KrewThinkingContext, string> = {
  destinations: "KREW cherche les meilleures idées pour votre groupe…",
  accommodations: "KREW cherche où poser vos valises…",
  transport: "KREW cherche les meilleurs moyens d’y aller…",
  planning: "KREW prépare votre programme…",
  generic: "KREW prépare la meilleure réponse pour votre groupe…",
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
    return null;
  }

  const displayMessage = customMessage || MESSAGES[context] || MESSAGES.generic;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center text-center mx-auto py-10 px-6 gap-4 max-w-md transition-opacity duration-300 ease-in-out",
        className
      )}
    >
      {/* Official KREW Otter Mark with gentle CSS dance/sway animation */}
      <div className="relative flex items-center justify-center">
        <Logo
          variant="icon"
          size="md"
          className="h-12 w-auto transition-transform motion-reduce:animate-none motion-reduce:transform-none"
          style={{
            animation: "krewOtterDance 1.8s ease-in-out infinite",
          }}
        />

        <style>{`
          @keyframes krewOtterDance {
            0%, 100% {
              transform: rotate(-4deg) translateY(0px);
            }
            50% {
              transform: rotate(4deg) translateY(-3px);
            }
          }
          @keyframes krewDotPulse {
            0%, 20% {
              opacity: 0.2;
            }
            50% {
              opacity: 1;
            }
            80%, 100% {
              opacity: 0.2;
            }
          }
        `}</style>
      </div>

      {/* Message with 3 discrete animated dots */}
      <div className="flex flex-col items-center gap-1.5">
        <p className="font-sans text-sm sm:text-base font-medium text-foreground tracking-tight">
          {displayMessage}
        </p>

        {/* 3 discrete animated dots */}
        <div className="flex items-center justify-center gap-1 text-primary motion-reduce:hidden" aria-hidden="true">
          <span
            className="size-1.5 rounded-full bg-primary inline-block"
            style={{ animation: "krewDotPulse 1.4s infinite 0s" }}
          />
          <span
            className="size-1.5 rounded-full bg-primary inline-block"
            style={{ animation: "krewDotPulse 1.4s infinite 0.2s" }}
          />
          <span
            className="size-1.5 rounded-full bg-primary inline-block"
            style={{ animation: "krewDotPulse 1.4s infinite 0.4s" }}
          />
        </div>
      </div>
    </div>
  );
}
