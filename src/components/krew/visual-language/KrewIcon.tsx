import type { SVGProps } from "react";
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

const TONES: Record<KrewIconTone, string> = { plum: "text-primary", sage: "text-secondary", ink: "text-foreground" };
const SIZES: Record<KrewIconSize, string> = { sm: "size-5", md: "size-7", lg: "size-10" };

const STROKE = {
  fill: "none", stroke: "currentColor", strokeWidth: 2.05, strokeLinecap: "round", strokeLinejoin: "round", vectorEffect: "non-scaling-stroke",
} satisfies SVGProps<SVGPathElement>;
const SOFT_STROKE = { ...STROKE, strokeWidth: 1.6, opacity: 0.72 } satisfies SVGProps<SVGPathElement>;
function Dot({ cx, cy, r = 1.35 }: { cx: number; cy: number; r?: number }) { return <circle cx={cx} cy={cy} r={r} fill="currentColor" />; }

function IconShape({ name }: { name: KrewIconName }) {
  switch (name) {
    case "invite": return <><path {...STROKE} d="M9.4 12.2c2.2 0 3.8-1.7 3.8-3.9 0-2.1-1.6-3.7-3.8-3.7S5.7 6.2 5.7 8.3c0 2.2 1.5 3.9 3.7 3.9Z" /><path {...STROKE} d="M3.3 21.3c.4-4 2.5-6.1 6.2-6.1 2.4 0 4.2.9 5.3 2.6" /><path {...STROKE} d="M18.9 9.3v8.1M14.8 13.4h8.1" /><path {...SOFT_STROKE} d="M17.1 7.3c1.8.1 3.2.8 4.1 2" /></>;
    case "availability": return <><path {...STROKE} d="M4.2 8.3c4.6-.3 10.6-.3 15.6 0l-.4 12.1c-4.7.4-10 .4-14.8 0L4.2 8.3Z" /><path {...STROKE} d="M8.1 5v5M15.9 4.7v5.1" /><path {...SOFT_STROKE} d="M4.5 11.6c4.4-.2 10.5-.2 15.1 0" /><path {...STROKE} d="m8.2 15.7 2.2 2.1 5.6-5.5" /></>;
    case "preferences": return <><path {...STROKE} d="M4.1 7.2h15.8M4.1 12.3h15.8M4.1 17.5h15.8" /><path {...SOFT_STROKE} d="M8.8 5.2v4M15.4 10.2v4.2M10.8 15.5v4" /><Dot cx={8.8} cy={7.2} r={1.65} /><Dot cx={15.4} cy={12.3} r={1.65} /><Dot cx={10.8} cy={17.5} r={1.65} /></>;
    case "profile": return <><path {...STROKE} d="M4.6 9c2.1-2.6 4.6-3.9 7.5-3.9 3 0 5.5 1.3 7.5 3.9" /><path {...STROKE} d="M5.4 16.1c1.9 2.5 4.1 3.8 6.7 3.8 2.5 0 4.8-1.3 6.6-3.8" /><path {...SOFT_STROKE} d="M7.8 11.2c1.2 1.6 2.7 2.4 4.4 2.4 1.6 0 3-.7 4.1-2.1" /><Dot cx={12.1} cy={13.5} r={1.55} /><path {...STROKE} d="M12.1 5.1v2.6M12.1 17.3v2.6" /></>;
    case "destination": return <><path {...STROKE} d="M12.1 21.1C8.3 17 6.1 13.7 6.1 10.7c0-3.6 2.5-6.1 6-6.1 3.6 0 5.9 2.5 5.9 6.1 0 2.9-2.1 6.2-5.9 10.4Z" /><path {...STROKE} d="M8.9 11c1.1-1.4 2.2-2 3.6-1.9 1.2.1 2.1.6 2.9 1.6" /><path {...SOFT_STROKE} d="M10.4 13.4c.8.5 1.7.7 2.6.5" /><Dot cx={15.9} cy={7.1} r={1.05} /></>;
    case "accommodation": return <><path {...STROKE} d="M4.2 12.2 12 5.5l7.8 6.7" /><path {...STROKE} d="M6.2 10.7v9.1M17.8 10.7v9.1M6.2 19.8h11.6" /><path {...STROKE} d="M10 19.8v-5.5h4.2" /></>;
    case "transport": return <><path {...STROKE} d="M3.2 15.6c.1-1.1.7-1.9 1.8-2.2l2.2-.6 2.3-3.4c.5-.8 1.2-1.2 2.2-1.2h3.1c.8 0 1.5.3 2.1.9l3.2 3.4c.5.5.8 1.2.8 1.9v2.7H3.2v-1.5Z" /><path {...SOFT_STROKE} d="M8.1 12.6h8.9M11 8.3l-.7 4.3" /><circle {...STROKE} cx="7.2" cy="17.2" r="2.1" /><circle {...STROKE} cx="17.4" cy="17.2" r="2.1" /><path {...STROKE} d="M3.5 14.2h2.1M19.2 13.1h1.4" /></>;
    case "planning": return <><path {...STROKE} d="M5 6.8c4.2-.3 9.6-.3 14 0l-.3 14c-4.2.3-9.1.3-13.4 0L5 6.8Z" /><path {...STROKE} d="M8.6 4.4v4.7M15.4 4.4v4.7" /><path {...SOFT_STROKE} d="M9.1 11.4h6.3M9.1 15h4.8M9.1 18.4h6.1" /><Dot cx={7} cy={11.4} r={0.95} /><Dot cx={7} cy={15} r={0.95} /><Dot cx={7} cy={18.4} r={0.95} /></>;
    case "tasks": return <><path {...STROKE} d="m4.1 7 1.8 1.9 3.2-3.5M4.1 13l1.8 1.9 3.2-3.5M4.1 19l1.8 1.9 3.2-3.5" /><path {...SOFT_STROKE} d="M11.4 7.1h8.4M11.4 13.1h6.2M11.4 19.1h8.4" /></>;
    case "packing": return <><path {...STROKE} d="M6.1 8.4c3.4-.5 8.1-.5 11.6 0l1 12.1c-3.9.5-9.5.5-13.4 0l.8-12.1Z" /><path {...STROKE} d="M8.8 8.2V6.6c0-1.8 1.2-3 3.3-3 2 0 3.2 1.2 3.2 3v1.6" /><path {...SOFT_STROKE} d="M8.8 13.1c.9.9 2 1.4 3.3 1.4 1.3 0 2.4-.5 3.2-1.4" /><path {...STROKE} d="M12.1 14.6v2.6" /></>;
    case "budget": return <><path {...STROKE} d="M4.6 7.3c4.2-.5 9.8-.5 14 0v11.4c-4.2.5-9.8.5-14 0V7.3Z" /><path {...STROKE} d="M13.2 10.3h6.3v5.4h-6.3c-1.5 0-2.6-1.1-2.6-2.7 0-1.6 1.1-2.7 2.6-2.7Z" /><Dot cx={16.2} cy={13} r={1.1} /><path {...SOFT_STROKE} d="M7 9.7h3.1" /></>;
  }
}

export function KrewIcon({ name, tone = "plum", size = "md", decorative = true, className }: { name: KrewIconName; tone?: KrewIconTone; size?: KrewIconSize; decorative?: boolean; className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden={decorative ? true : undefined} role={decorative ? undefined : "img"} className={cn("shrink-0 overflow-visible", TONES[tone], SIZES[size], className)}><IconShape name={name} /></svg>;
}
