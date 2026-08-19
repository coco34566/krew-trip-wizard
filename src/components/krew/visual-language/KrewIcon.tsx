import { cn } from "@/lib/utils";

export type KrewIconName =
  | "invite"
  | "availability"
  | "preferences"
  | "profile"
  | "destination"
  | "accommodation"
  | "transport"
  | "planning"
  | "tasks"
  | "packing"
  | "budget";

export type KrewIconTone = "plum" | "sage" | "ink";
export type KrewIconSize = "sm" | "md" | "lg";

const TONES: Record<KrewIconTone, string> = {
  plum: "text-primary",
  sage: "text-secondary",
  ink: "text-foreground",
};

const SIZES: Record<KrewIconSize, string> = {
  sm: "size-5",
  md: "size-7",
  lg: "size-10",
};

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  vectorEffect: "non-scaling-stroke" as const,
};

function IconShape({ name }: { name: KrewIconName }) {
  switch (name) {
    case "invite":
      return (
        <>
          <path {...common} d="M9.3 11.1c1.8 0 3.1-1.4 3.1-3.2 0-1.7-1.3-3-3.1-3-1.7 0-3 1.3-3 3 0 1.8 1.3 3.2 3 3.2Z" />
          <path {...common} d="M3.8 19c.3-3.3 2.1-5 5.5-5 2.3 0 3.9.8 4.8 2.5" />
          <path {...common} d="M17.5 10v7M14 13.5h7" />
        </>
      );
    case "availability":
      return (
        <>
          <path {...common} d="M5 6.8h14v12H5z" />
          <path {...common} d="M8 4.5v4M16 4.5v4M5.2 10.2h13.6" />
          <path {...common} d="m8.2 14 1.8 1.8 4-4" />
        </>
      );
    case "preferences":
      return (
        <>
          <path {...common} d="M5 7h14M5 12h14M5 17h14" />
          <circle cx="9" cy="7" r="1.6" fill="currentColor" />
          <circle cx="15" cy="12" r="1.6" fill="currentColor" />
          <circle cx="11" cy="17" r="1.6" fill="currentColor" />
        </>
      );
    case "profile":
      return (
        <>
          <path {...common} d="M5.2 8.7c2.1-2.1 4.2-3.2 6.8-3.2 2.7 0 4.8 1.1 6.8 3.2M6.4 15.4c1.7 2 3.6 3.1 5.6 3.1 2.1 0 4-1 5.6-3.1" />
          <path {...common} d="M8.5 10.7c1 1.1 2.2 1.7 3.5 1.7 1.4 0 2.6-.6 3.5-1.7" />
          <circle cx="12" cy="12.3" r="1.25" fill="currentColor" />
        </>
      );
    case "destination":
      return (
        <>
          <path {...common} d="M12 20c3.8-4.1 5.7-7.2 5.7-9.7A5.7 5.7 0 0 0 12 4.6a5.7 5.7 0 0 0-5.7 5.7C6.3 12.8 8.2 15.9 12 20Z" />
          <path {...common} d="M9.6 10.3c.7-1.3 1.8-2 3.2-1.9 1 .1 1.8.6 2.3 1.4" />
        </>
      );
    case "accommodation":
      return (
        <>
          <path {...common} d="M4.8 11.1 12 5l7.2 6.1v8H4.8z" />
          <path {...common} d="M9 19v-5.5h6V19M7.2 9.4V5.9" />
        </>
      );
    case "transport":
      return (
        <>
          <path {...common} d="M4.5 16.7c3.3-5.7 7-8.4 11.2-8.2 1.5.1 2.8.5 3.8 1.2" />
          <path {...common} d="m16.9 6.7 2.8 3-3.4 2.2" />
          <circle cx="5" cy="17" r="1.5" fill="currentColor" />
          <circle cx="19" cy="9.8" r="1.5" fill="currentColor" />
        </>
      );
    case "planning":
      return (
        <>
          <path {...common} d="M6 5.5h12v13H6zM9 4v3M15 4v3" />
          <path {...common} d="M9 10h6M9 13.5h4.2M9 17h6" />
          <circle cx="7.5" cy="10" r=".7" fill="currentColor" />
          <circle cx="7.5" cy="13.5" r=".7" fill="currentColor" />
          <circle cx="7.5" cy="17" r=".7" fill="currentColor" />
        </>
      );
    case "tasks":
      return (
        <>
          <path {...common} d="M10 6h9M10 12h9M10 18h9" />
          <path {...common} d="m4.8 6 1.4 1.4L8.5 5M4.8 12l1.4 1.4L8.5 11M4.8 18l1.4 1.4L8.5 17" />
        </>
      );
    case "packing":
      return (
        <>
          <path {...common} d="M7 8h10l1.2 11H5.8z" />
          <path {...common} d="M9.2 8V6.4c0-1.4 1-2.4 2.8-2.4s2.8 1 2.8 2.4V8" />
          <path {...common} d="M9.2 12.2c.7.7 1.6 1.1 2.8 1.1s2.1-.4 2.8-1.1" />
        </>
      );
    case "budget":
      return (
        <>
          <path {...common} d="M5 8.2h14v9.6H5z" />
          <path {...common} d="M7.5 8.2V6h9v2.2" />
          <path {...common} d="M8 13h3.1M15.8 11.1v3.8" />
          <circle cx="15.8" cy="13" r="2.2" {...common} />
        </>
      );
  }
}

export function KrewIcon({
  name,
  tone = "plum",
  size = "md",
  decorative = true,
  className,
}: {
  name: KrewIconName;
  tone?: KrewIconTone;
  size?: KrewIconSize;
  decorative?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
      className={cn("shrink-0 overflow-visible", TONES[tone], SIZES[size], className)}
    >
      <IconShape name={name} />
    </svg>
  );
}
