import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { KrewMark } from "@/components/krew/visual-language";
import { cn } from "@/lib/utils";

type StatefulStatus = "idle" | "loading" | "success" | "error";

type KrewStatefulButtonProps = Omit<ComponentProps<typeof Button>, "onClick" | "children"> & {
  idleLabel: string;
  successLabel?: string;
  errorLabel?: string;
  onAction: () => void | Promise<void>;
  resetAfterMs?: number;
};

export function KrewStatefulButton({
  idleLabel,
  successLabel = "C’est fait",
  errorLabel = "Réessayer",
  onAction,
  resetAfterMs = 1800,
  className,
  disabled,
  ...props
}: KrewStatefulButtonProps) {
  const [status, setStatus] = useState<StatefulStatus>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const run = async () => {
    if (status === "loading" || disabled) return;
    if (resetTimer.current) clearTimeout(resetTimer.current);

    setStatus("loading");
    try {
      await onAction();
      setStatus("success");
      resetTimer.current = setTimeout(() => setStatus("idle"), resetAfterMs);
    } catch {
      setStatus("error");
      resetTimer.current = setTimeout(() => setStatus("idle"), resetAfterMs);
    }
  };

  return (
    <Button
      {...props}
      type={props.type ?? "button"}
      disabled={disabled || status === "loading"}
      aria-busy={status === "loading"}
      data-stateful-status={status}
      onClick={run}
      className={cn(
        "min-w-[156px] overflow-hidden transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98]",
        status === "success" && "border-sage/50 bg-sage/15 text-primary hover:bg-sage/15",
        status === "error" && "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/5",
        className,
      )}
    >
      <span className="inline-flex items-center justify-center gap-2 transition-opacity duration-150">
        {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
        {status === "success" ? <KrewMark type="check" tone="sage" size="sm" className="size-4" /> : null}
        <span>
          {status === "loading" ? "Un instant…" : status === "success" ? successLabel : status === "error" ? errorLabel : idleLabel}
        </span>
      </span>
    </Button>
  );
}
