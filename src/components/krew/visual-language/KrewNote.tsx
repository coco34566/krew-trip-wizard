import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KrewMark } from "./KrewMark";

export type KrewNoteVariant = "sticky" | "torn" | "tape" | "margin" | "label" | "photo" | "callout";
export type KrewNoteTone = "cream" | "sage" | "plum";

const tones: Record<KrewNoteTone, string> = {
  cream: "bg-[#fffaf0] text-foreground",
  sage: "bg-sage/20 text-foreground",
  plum: "bg-primary/10 text-primary",
};

export function KrewNote({ children, variant = "sticky", tone = "cream", rotation = -2, className }: {
  children: ReactNode;
  variant?: KrewNoteVariant;
  tone?: KrewNoteTone;
  rotation?: -4 | -2 | 0 | 2 | 4;
  className?: string;
}) {
  if (variant === "margin") return <span className={cn("inline-block max-w-[15rem] font-handwriting text-[1.05rem] leading-[1.12] text-primary", className)} style={{ transform: `rotate(${rotation}deg)` }}>{children}</span>;
  if (variant === "label") return <span className={cn("inline-flex items-center px-3 py-1.5 font-handwriting text-[.95rem] leading-none", tones[tone], "rounded-[45%_55%_48%_52%/55%_45%_55%_45%]", className)} style={{ transform: `rotate(${rotation}deg)` }}>{children}</span>;
  const shape = variant === "torn" ? "[clip-path:polygon(2%_3%,98%_0,96%_92%,88%_96%,78%_92%,66%_98%,55%_93%,43%_98%,31%_92%,19%_97%,4%_92%)]" : "rounded-[.2rem_.55rem_.35rem_.45rem]";
  return <div className={cn("relative inline-block min-w-28 max-w-[17rem] px-4 py-3 shadow-[0_5px_18px_rgba(60,35,50,.08)]", tones[tone], shape, variant === "photo" && "shadow-[0_3px_12px_rgba(60,35,50,.12)]", className)} style={{ transform: `rotate(${rotation}deg)` }}>
    {variant === "tape" && <span aria-hidden className="absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rotate-[-3deg] bg-sage/25" />}
    <div className="font-handwriting text-[1.05rem] leading-[1.15]">{children}</div>
  </div>;
}

export function KrewCallout({ children, direction = "right", className }: { children: ReactNode; direction?: "left" | "right" | "down"; className?: string }) {
  return <div className={cn("relative inline-flex items-center gap-1", direction === "left" && "flex-row-reverse", direction === "down" && "flex-col", className)}>
    <KrewNote variant="margin" rotation={-2}>{children}</KrewNote>
    <KrewMark type={direction === "down" ? "arrow-down" : "arrow-curved"} tone="sage" size="md" className={cn(direction === "left" && "scale-x-[-1]")} />
  </div>;
}
