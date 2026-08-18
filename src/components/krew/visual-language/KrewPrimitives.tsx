import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KrewMark, type KrewMarkTone } from "./KrewMark";

export function KrewAnnotation({
  children,
  tone = "plum",
  mark = "arrow",
  editorial = false,
  className,
}: {
  children: ReactNode;
  tone?: KrewMarkTone;
  mark?: "arrow" | "sparkle" | "heart" | "check";
  editorial?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-foreground", editorial && "font-display text-base", className)}>
      <KrewMark type={mark} tone={tone} size="sm" rotation={-2} />
      <span>{children}</span>
    </span>
  );
}

export function KrewHighlight({ children, tone = "sage", className }: { children: ReactNode; tone?: KrewMarkTone; className?: string }) {
  return (
    <span className={cn("relative inline-block px-1", className)}>
      <KrewMark type="highlight" tone={tone} size="lg" className="absolute inset-x-0 bottom-[-0.35rem] -z-0 h-[1.8em] w-full" />
      <span className="relative z-10 text-foreground">{children}</span>
    </span>
  );
}

export function KrewConnector({ tone = "plum", dashed = false, className }: { tone?: KrewMarkTone; dashed?: boolean; className?: string }) {
  return <KrewMark type="connector" tone={tone} size="lg" dashed={dashed} className={className} />;
}

export function KrewPhotoOverlay({
  src,
  alt,
  children,
  className,
}: {
  src?: string;
  alt: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("relative isolate overflow-hidden rounded-xl bg-surface", className)}>
      {src ? (
        <img src={src} alt={alt} className="aspect-[4/3] h-full w-full object-cover" />
      ) : (
        <div role="img" aria-label={alt} className="aspect-[4/3] w-full bg-surface-strong" />
      )}
      {children ? <div className="pointer-events-none absolute inset-0">{children}</div> : null}
    </figure>
  );
}
