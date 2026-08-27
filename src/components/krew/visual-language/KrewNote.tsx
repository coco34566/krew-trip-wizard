import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KrewMark } from "./KrewMark";

export type KrewNoteVariant = "sticky" | "torn" | "tape" | "tape-strip" | "margin" | "label" | "photo" | "callout";
export type KrewNoteTone = "cream" | "sage" | "plum";
export type KrewNoteSize = "xs" | "sm" | "md" | "lg" | "wide";
export type KrewNoteRotation = -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4;

const tones: Record<KrewNoteTone, string> = {
  cream: "bg-[#fff8e9] text-foreground",
  sage: "bg-[#e8efeb] text-foreground",
  plum: "bg-[#f1e8ef] text-primary",
};

const sizes: Record<KrewNoteSize, string> = {
  xs: "min-w-[5.5rem] max-w-[10rem] px-3 py-2",
  sm: "min-w-[7rem] max-w-[13rem] px-3.5 py-2.5",
  md: "min-w-28 max-w-[17rem] px-4 py-3",
  lg: "min-w-[10rem] max-w-[20rem] px-5 py-4",
  wide: "min-w-[12rem] max-w-[23rem] px-5 py-3.5",
};

const tapeTone: Record<KrewNoteTone, string> = {
  cream: "bg-[#dce6df]/90",
  sage: "bg-[#d7c8d3]/72",
  plum: "bg-[#dbe5df]/86",
};

function clampRotation(rotation: KrewNoteRotation): KrewNoteRotation {
  if (rotation < -2) return -2;
  if (rotation > 2) return 2;
  return rotation;
}

function paperShape(variant: KrewNoteVariant, tone: KrewNoteTone, rotation: KrewNoteRotation) {
  if (variant === "torn") {
    return "[clip-path:polygon(1%_4%,97%_1%,99%_88%,93%_94%,85%_91%,76%_97%,65%_93%,54%_98%,43%_92%,31%_97%,20%_92%,8%_96%,2%_90%)]";
  }
  if (variant === "photo") return "rounded-[.15rem_.5rem_.3rem_.4rem]";
  if (tone === "sage") return "rounded-[.45rem_.9rem_.35rem_.7rem]";
  if (tone === "plum") return "rounded-[.8rem_.35rem_.75rem_.3rem]";
  if (rotation > 0) return "rounded-[.25rem_.65rem_.5rem_.3rem]";
  return "rounded-[.35rem_.45rem_.25rem_.7rem]";
}

function tapeGeometry(tone: KrewNoteTone, rotation: KrewNoteRotation, variant: KrewNoteVariant) {
  const side = tone === "plum" ? "left-[42%]" : tone === "sage" ? "left-[56%]" : "left-1/2";
  const width = variant === "photo" ? "w-14 sm:w-16" : rotation === 0 ? "w-12 sm:w-14" : "w-11 sm:w-[3.25rem]";
  const angle = rotation > 0 ? "rotate-[-3deg]" : rotation < 0 ? "rotate-[2deg]" : "rotate-[-2deg]";
  return cn(side, width, angle);
}

function defaultSize(variant: KrewNoteVariant, tone: KrewNoteTone, rotation: KrewNoteRotation): KrewNoteSize {
  if (variant === "tape" && tone === "sage") return "wide";
  if (variant === "torn") return "lg";
  if (tone === "plum") return "sm";
  if (tone === "cream" && rotation >= 2) return "sm";
  return "md";
}

export function KrewNote({
  children,
  variant = "sticky",
  tone = "cream",
  rotation = -1,
  size,
  className,
}: {
  children: ReactNode;
  variant?: KrewNoteVariant;
  tone?: KrewNoteTone;
  rotation?: KrewNoteRotation;
  size?: KrewNoteSize;
  className?: string;
}) {
  const safeRotation = clampRotation(rotation);

  if (variant === "margin") {
    return (
      <span className={cn("inline-block max-w-[15rem] font-handwriting text-[1.05rem] leading-[1.12] text-primary", className)} style={{ transform: `rotate(${safeRotation}deg)` }}>
        {children}
      </span>
    );
  }

  if (variant === "label") {
    return (
      <span
        className={cn(
          "inline-flex items-center px-3 py-1.5 font-handwriting text-[.95rem] leading-none",
          tones[tone],
          "rounded-[45%_55%_48%_52%/55%_45%_55%_45%]",
          className,
        )}
        style={{ transform: `rotate(${safeRotation}deg)` }}
      >
        {children}
      </span>
    );
  }

  const legacyStrip = variant === "tape" && /text-transparent|select-none/.test(className ?? "");
  const stripOnly = variant === "tape-strip" || legacyStrip;

  if (stripOnly) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-block h-[1.05rem] w-12 border-x border-white/25 bg-[#dce6df]/90 shadow-[0_2px_4px_rgba(60,35,50,.04)] sm:h-[1.15rem] sm:w-14",
          safeRotation > 0 ? "rotate-[-3deg]" : safeRotation < 0 ? "rotate-[2deg]" : "rotate-[-2deg]",
          className,
        )}
      >
        <span className="sr-only">{children}</span>
      </span>
    );
  }

  const physicalPaper = variant === "sticky" || variant === "torn" || variant === "photo" || variant === "callout" || variant === "tape";
  const shape = paperShape(variant, tone, safeRotation);
  const resolvedSize = size ?? defaultSize(variant, tone, safeRotation);

  return (
    <div
      data-krew-note="post-it"
      data-krew-note-tone={tone}
      data-krew-note-variant={variant}
      className={cn(
        "relative isolate inline-block shadow-[0_6px_16px_rgba(60,35,50,.075)]",
        tones[tone],
        sizes[resolvedSize],
        shape,
        variant === "photo" && "shadow-[0_5px_14px_rgba(60,35,50,.10)]",
        className,
      )}
      style={{ transform: `rotate(${safeRotation}deg)` }}
    >
      {physicalPaper ? (
        <span
          aria-hidden
          className={cn(
            "absolute -top-2.5 z-20 h-[1.05rem] -translate-x-1/2 border-x border-white/25 shadow-[0_2px_4px_rgba(60,35,50,.04)] sm:-top-3 sm:h-[1.15rem]",
            tapeTone[tone],
            tapeGeometry(tone, safeRotation, variant),
          )}
        />
      ) : null}
      <div className="relative z-10 font-handwriting text-[1.05rem] leading-[1.15]">{children}</div>
    </div>
  );
}

export function KrewCallout({ children, direction = "right", className }: { children: ReactNode; direction?: "left" | "right" | "down"; className?: string }) {
  const arrowType =
    direction === "down"
      ? "arrow-down"
      : direction === "left"
        ? "arrow-curved-left"
        : "arrow-curved-right";

  return <div className={cn("relative inline-flex items-center gap-1", direction === "left" && "flex-row-reverse", direction === "down" && "flex-col", className)}>
    <KrewNote variant="margin" rotation={-1}>{children}</KrewNote>
    <KrewMark type={arrowType} tone="sage" size="md" />
  </div>;
}
