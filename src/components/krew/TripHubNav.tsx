import { Link } from "@tanstack/react-router";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripStep } from "@/lib/krew/availability";

const STEP_ROUTE: Record<string, string> = {
  availability: "/trips/$tripId/availability",
  questionnaire: "/trips/$tripId/questionnaire",
  invite: "/trips/$tripId/invite",
  star: "/trips/$tripId/star",
};

export function TripHubNav({
  tripId,
  steps,
  onInviteClick,
}: {
  tripId: string;
  steps: TripStep[];
  onInviteClick?: () => void;
}) {
  return (
    <nav className="flex flex-wrap gap-2">
      {steps.map((step, i) => {
        const isSoon = step.status === "soon";
        const isDone = step.status === "done";
        const isActive = step.status === "active";
        const content = (
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition-colors",
              isDone && "border-lagoon/40 bg-lagoon/10 text-foreground",
              isActive && "border-primary bg-primary/10 text-foreground shadow-glow",
              step.status === "todo" && "border-border bg-surface/40 text-muted-foreground",
              isSoon && "border-dashed border-border text-muted-foreground opacity-70",
            )}
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-background/80 text-[10px] font-semibold">
              {isDone ? <Check className="size-3" /> : isSoon ? <Lock className="size-3" /> : i + 1}
            </span>
            <span>
              <span className="font-medium">{step.label}</span>
              <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">
                · {step.description}
              </span>
            </span>
          </span>
        );

        if (step.id === "invite") {
          if (onInviteClick) {
            return (
              <button
                key={step.id}
                type="button"
                onClick={onInviteClick}
                className="cursor-pointer border-0 bg-transparent p-0 no-underline"
              >
                {content}
              </button>
            );
          }
          return (
            <a key={step.id} href="#invite-section" className="no-underline">
              {content}
            </a>
          );
        }

        if (step.id === "destination") {
          return (
            <a key={step.id} href="#hub-destination" className="no-underline">
              {content}
            </a>
          );
        }

        if (isSoon) {
          return <span key={step.id}>{content}</span>;
        }

        const routeTo = STEP_ROUTE[step.id];
        if (routeTo) {
          return (
            <Link
              key={step.id}
              to={routeTo as any}
              params={{ tripId }}
              className="no-underline"
            >
              {content}
            </Link>
          );
        }

        return <span key={step.id}>{content}</span>;
      })}
    </nav>
  );
}

export function ComingSoonGrid() {
  const items = [
    "Planning du séjour",
    "Hébergements",
    "Activités réservées",
    "Dépenses communes",
    "Répartition des chambres",
    "Check-list",
    "Documents & billets",
    "Sondages",
    "Chat de groupe",
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((label) => (
        <div
          key={label}
          className="rounded-2xl border border-dashed border-border bg-surface/30 px-4 py-5 text-sm text-muted-foreground"
        >
          <span className="font-medium text-foreground/80">{label}</span>
          <span className="mt-1 block text-xs">À venir</span>
        </div>
      ))}
    </div>
  );
}
