import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { KrewJourneyStatusPanel } from "@/components/krew/KrewJourneyStatusPanel";
import { KrewPageShell, type KrewPageShellGutter, type KrewPageShellSize } from "@/components/krew/KrewPageShell";
import { KrewThinkingState, type KrewThinkingContext } from "@/components/krew/KrewThinkingState";
import { Button } from "@/components/ui/button";

type KrewJourneyLoadingStateProps = {
  context?: KrewThinkingContext;
  message?: string;
  size?: KrewPageShellSize;
  gutter?: KrewPageShellGutter;
  /** @deprecated Prefer `size` for semantic shell ownership. */
  maxWidthClassName?: string;
};

type KrewJourneyErrorStateProps = {
  tripId: string;
  title: string;
  description: string;
  onRetry: () => void;
  retrying?: boolean;
  size?: KrewPageShellSize;
  gutter?: KrewPageShellGutter;
  /** @deprecated Prefer `size` for semantic shell ownership. */
  maxWidthClassName?: string;
  returnLabel?: "Retour au parcours" | "Retour au voyage";
};

function semanticSizeForLegacyWidth(maxWidthClassName?: string): KrewPageShellSize | undefined {
  return maxWidthClassName === "max-w-[820px]" ? "form" : undefined;
}

export function KrewJourneyLoadingState({
  context = "generic",
  message,
  size = "standard",
  gutter = "default",
  maxWidthClassName,
}: KrewJourneyLoadingStateProps) {
  const legacySemanticSize = semanticSizeForLegacyWidth(maxWidthClassName);

  if (maxWidthClassName && !legacySemanticSize) {
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
    <KrewPageShell data-krew-journey-loading size={legacySemanticSize ?? size} gutter={gutter} className="py-8 sm:py-10">
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
  size = "standard",
  gutter = "default",
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

  const legacySemanticSize = semanticSizeForLegacyWidth(maxWidthClassName);

  if (maxWidthClassName && !legacySemanticSize) {
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
    <KrewPageShell data-krew-journey-error size={legacySemanticSize ?? size} gutter={gutter} className="space-y-8 py-8 sm:py-10">
      {content}
    </KrewPageShell>
  );
}
