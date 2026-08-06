import { Compass } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-xl font-bold ${className}`}>
      <span className="grid size-8 place-items-center rounded-xl bg-brand-gradient text-primary-foreground">
        <Compass className="size-4" />
      </span>
      Krew
    </span>
  );
}