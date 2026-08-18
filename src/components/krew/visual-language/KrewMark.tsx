import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

export type KrewMarkType =
  | "circle"
  | "underline"
  | "arrow"
  | "sparkle"
  | "heart"
  | "check"
  | "connector"
  | "highlight";

export type KrewMarkTone = "plum" | "sage" | "ink";
export type KrewMarkSize = "sm" | "md" | "lg";

const TONES: Record<KrewMarkTone, string> = {
  plum: "text-primary",
  sage: "text-[oklch(0.709_0.034_162.8)]",
  ink: "text-foreground",
};

const SIZES: Record<KrewMarkSize, string> = {
  sm: "h-5 w-10",
  md: "h-8 w-16",
  lg: "h-12 w-24",
};

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.25,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  vectorEffect: "non-scaling-stroke",
} satisfies SVGProps<SVGPathElement>;

function MarkShape({ type, dashed = false }: { type: KrewMarkType; dashed?: boolean }) {
  switch (type) {
    case "circle":
      return <path {...STROKE} d="M48 6C72 5 91 15 94 31c3 17-14 29-42 30C25 62 7 52 6 35 5 18 23 8 48 6Z" />;
    case "underline":
      return <path {...STROKE} d="M5 39c21-3 42-1 61-3 12-1 21-4 29-2" />;
    case "arrow":
      return <><path {...STROKE} d="M7 47c20-1 39-8 55-19 8-6 16-11 26-13" /><path {...STROKE} d="M78 9c4 2 8 4 12 6-2 5-5 9-8 13" /></>;
    case "sparkle":
      return <><path {...STROKE} d="M49 9c-1 12-3 21-10 27 7 1 13 6 15 16 2-10 6-16 14-19-8-3-13-11-19-24Z" /><path {...STROKE} d="M78 14l2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" /></>;
    case "heart":
      return <path {...STROKE} d="M50 54C39 45 19 35 18 21 17 10 31 6 39 13c5 4 8 10 10 15 3-7 7-13 13-17 9-5 21 1 20 12-1 13-18 24-32 31Z" />;
    case "check":
      return <path {...STROKE} d="M15 34c9 4 15 10 21 18 12-19 28-32 49-43" />;
    case "connector":
      return <path {...STROKE} strokeDasharray={dashed ? "5 7" : undefined} d="M5 44c17-26 35-31 51-18 13 11 23 10 39-8" />;
    case "highlight":
      return <path fill="currentColor" opacity="0.2" d="M4 22C25 17 48 19 69 16c12-2 21 0 27 4l-2 25c-22-2-44 2-65 1-10 0-18-2-25-5V22Z" />;
  }
}

export function KrewMark({
  type,
  tone = "plum",
  size = "md",
  rotation = 0,
  decorative = true,
  dashed = false,
  className,
}: {
  type: KrewMarkType;
  tone?: KrewMarkTone;
  size?: KrewMarkSize;
  rotation?: -4 | -2 | 0 | 2 | 4;
  decorative?: boolean;
  dashed?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 64"
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
      className={cn("shrink-0 overflow-visible", TONES[tone], SIZES[size], className)}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <MarkShape type={type} dashed={dashed} />
    </svg>
  );
}
