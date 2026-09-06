import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { KrewJourneyStatusPanel } from "@/components/krew/KrewJourneyStatusPanel";
import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { KrewThinkingState, type KrewThinkingContext } from "@/components/krew/KrewThinkingState";
import { Button } from "@/components/ui/button";

type KrewJourneyLoadingStateProps = {
  context?: KrewThinkingContext;
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

export function KrewJourneyLoadingState({
  context = "generic",
  message,
  maxWidthClassName,
}: KrewJourneyLoadingStateProps) {
  if (maxWidthClassName) {
    return (
      <main
        data-krew-journey-loading
        className={`mx-auto w-full ${maxWidthClassName} px-5 py-8 sm:px-7 sm:py-10 lg:px-8`}
      >
        <KrewThinkingState context={context} customMessage={message} delayMs={0} />
      </main>
    );
  }

  return (
    <KrewPageShell data-krew-journey-loading size="standard" className="py-8 sm:py-10">
      <KrewThinkingState context={context} customMessage={message} delayMs={0} />
    </KrewPageShell>
  );
}

export function KrewJourneyErrorState({
  tripId,
  title,
  description,
  onRetry,
  retrying = false,
  maxWidthClassName,
  returnLabel = "Retour au parcours",
}: KrewJourneyErrorStateProps) {
  const content = (
    <>
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
    </>
  );

  if (maxWidthClassName) {
    return (
      <main
        data-krew-journey-error
        className={`mx-auto w-full ${maxWidthClassName} space-y-8 px-5 py-8 sm:px-7 sm:py-10 lg:px-8`}
      >
        {content}
      </main>
    );
  }

  return (
    <KrewPageShell data-krew-journey-error size="standard" className="space-y-8 py-8 sm:py-10">
      {content}
    </KrewPageShell>
  );
}
