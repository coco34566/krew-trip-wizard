import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { KrewJourneyStatusPanel } from "@/components/krew/KrewJourneyStatusPanel";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { Button } from "@/components/ui/button";

type JourneyThinkingContext = Parameters<typeof KrewThinkingState>[0]["context"];

type KrewJourneyLoadingStateProps = {
  context?: JourneyThinkingContext;
  message?: string;
  maxWidthClassName?: string;
};

type KrewJourneyErrorStateProps = {
  tripId: string;
  title: string;
  description: string;
  onRetry: () => void;
  retrying?: boolean;
  maxWidthClassName?: string;
  returnLabel?: "Retour au parcours" | "Retour au voyage";
};

const DEFAULT_WIDTH = "max-w-5xl";

export function KrewJourneyLoadingState({
  context = "generic",
  message,
  maxWidthClassName = DEFAULT_WIDTH,
}: KrewJourneyLoadingStateProps) {
  return (
    <main
      data-krew-journey-loading
      className={`mx-auto w-full ${maxWidthClassName} px-5 py-8 sm:px-7 sm:py-10 lg:px-8`}
    >
      <KrewThinkingState context={context} customMessage={message} delayMs={0} />
    </main>
  );
}

export function KrewJourneyErrorState({
  tripId,
  title,
  description,
  onRetry,
  retrying = false,
  maxWidthClassName = DEFAULT_WIDTH,
  returnLabel = "Retour au parcours",
}: KrewJourneyErrorStateProps) {
  return (
    <main
      data-krew-journey-error
      className={`mx-auto w-full ${maxWidthClassName} space-y-8 px-5 py-8 sm:px-7 sm:py-10 lg:px-8`}
    >
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        search={{ view: "voyage" }}
        className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" /> {returnLabel}
      </Link>

      <KrewJourneyStatusPanel
        title={title}
        icon="attention"
        tone="info"
        role="alert"
        action={
          <Button
            type="button"
            size="sm"
            onClick={onRetry}
            disabled={retrying}
            aria-busy={retrying}
          >
            {retrying ? "Chargement…" : "Réessayer"}
          </Button>
        }
      >
        <p>{description}</p>
      </KrewJourneyStatusPanel>
    </main>
  );
}
