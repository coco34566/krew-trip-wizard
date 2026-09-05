import { Fragment, useEffect, useRef, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ManualDestinationFallback } from "@/components/krew/ManualDestinationFallback";
import { KrewMark } from "@/components/krew/visual-language";
import { cn } from "@/lib/utils";

type StatefulStatus = "idle" | "loading" | "success" | "error";

type KrewStatefulButtonProps = Omit<ComponentProps<typeof Button>, "onClick" | "children"> & {
  idleLabel: string;
  loadingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  onAction: () => void | Promise<unknown>;
  resetAfterMs?: number;
};

/**
 * KREW action feedback for short, deterministic actions (copy, save, export...).
 * It deliberately reuses the shared Button primitive: this is state feedback,
 * not a second button design system.
 */
export function KrewStatefulButton({
  idleLabel,
  loadingLabel = "Un instant…",
  successLabel = "C’est fait",
  errorLabel = "Réessayer",
  onAction,
  resetAfterMs = 1800,
  className,
  disabled,
  ...props
}: KrewStatefulButtonProps) {
  const [status, setStatus] = useState<StatefulStatus>("idle");
  const [manualDestinationTripId, setManualDestinationTripId] = useState<string | null>(null);
  const [destinationSection, setDestinationSection] = useState<HTMLElement | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionLabels = useRef({ loadingLabel, successLabel, errorLabel });

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  useEffect(() => {
    const isDestinationGenerationAction =
      idleLabel === "Voir d’autres propositions" || idleLabel === "Voir les destinations";
    if (!isDestinationGenerationAction || typeof window === "undefined") {
      setManualDestinationTripId(null);
      setDestinationSection(null);
      return;
    }
    const match = window.location.pathname.match(/^\/trips\/([^/]+)/);
    setManualDestinationTripId(match?.[1] ?? null);
    setDestinationSection(document.getElementById("hub-destination"));
  }, [idleLabel]);

  async function run() {
    if (status === "loading" || status === "success" || disabled) return;
    if (resetTimer.current) clearTimeout(resetTimer.current);

    actionLabels.current = { loadingLabel, successLabel, errorLabel };
    setStatus("loading");
    try {
      await onAction();
      setStatus("success");
    } catch {
      setStatus("error");
    }
    resetTimer.current = setTimeout(() => setStatus("idle"), resetAfterMs);
  }

  return (
    <Fragment>
      <Button
        {...props}
        type={props.type ?? "button"}
        disabled={status === "loading" || (Boolean(disabled) && status !== "success")}
        aria-busy={status === "loading"}
        aria-disabled={status === "success" || undefined}
        data-stateful-status={status}
        onClick={run}
        className={cn(
          "overflow-hidden transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98] motion-reduce:transition-none",
          status === "success" && "border-sage/50 bg-sage/15 text-primary hover:bg-sage/15",
          status === "error" && "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/5",
          className,
        )}
      >
        <span className="inline-flex items-center justify-center gap-2">
          {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
          {status === "success" ? <KrewMark type="check" tone="sage" size="sm" className="size-4" /> : null}
          <span>
            {status === "loading"
              ? actionLabels.current.loadingLabel
              : status === "success"
                ? actionLabels.current.successLabel
                : status === "error"
                  ? actionLabels.current.errorLabel
                  : idleLabel}
          </span>
        </span>
      </Button>
      {manualDestinationTripId && destinationSection
        ? createPortal(
            <ManualDestinationFallback tripId={manualDestinationTripId} />,
            destinationSection,
          )
        : null}
    </Fragment>
  );
}
