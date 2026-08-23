import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  KrewIcon,
  KrewMark,
  KrewNote,
  type KrewIconName,
} from "@/components/krew/visual-language";

export type TimelineStep = {
  id: string;
  title: string;
  subtitle?: string | null;
  iconName: KrewIconName;
  status: "done" | "available" | "next_action" | "upcoming";
  category?: "questionnaire" | "prepare" | "organisation";
  href?: string | null;
};

type Props = {
  tripId: string;
  tripName: string;
  steps: TimelineStep[];
  annotationText?: string | null;
};

function parseStepHref(href: string) {
  const [path, queryString] = href.split("?");
  if (!queryString) return { to: path, search: undefined };
  const search: Record<string, string> = {};
  for (const pair of queryString.split("&")) {
    const [k, v] = pair.split("=");
    if (k) search[k] = decodeURIComponent(v || "");
  }
  return { to: path, search };
}

/**
 * Calculates a hand-drawn strongly curved S-path (Bézier points) for N steps.
 * Returns SVG path string (`d`) and exact (x, y) coordinates for each step node.
 */
function computePathAndNodes(
  count: number,
  viewWidth = 420,
  rowHeight = 90,
  amplitude = 110,
) {
  const height = Math.max(320, (count - 0.5) * rowHeight + 80);
  const centerX = viewWidth / 2;

  const nodes: { x: number; y: number; side: "left" | "right" }[] = [];

  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const y = 45 + i * rowHeight;

    // Organic S-curve movement: wave goes left, right, left, right
    const wave = Math.sin(t * Math.PI * 2.6 + 0.3);
    const x = centerX + wave * amplitude;
    // Position text to the right if node is on left half, or to the left if node is on right half
    const side = x < centerX ? "right" : "left";
    nodes.push({ x, y, side });
  }

  // Build continuous cubic Bézier curve traversing all node coordinates
  let d = `M ${nodes[0]?.x ?? centerX} ${nodes[0]?.y ?? 45}`;
  for (let i = 0; i < nodes.length - 1; i++) {
    const curr = nodes[i]!;
    const next = nodes[i + 1]!;
    const midY = (curr.y + next.y) / 2;
    const cp1x = curr.x + (next.x - curr.x) * 0.15;
    const cp2x = next.x - (next.x - curr.x) * 0.15;
    d += ` C ${cp1x} ${midY}, ${cp2x} ${midY}, ${next.x} ${next.y}`;
  }

  return { height, viewWidth, nodes, d };
}

export function KrewJourneyTimeline({
  tripName,
  steps,
  annotationText,
}: Props) {
  const nextActionIdx = steps.findIndex((s) => s.status === "next_action");
  const lastDoneIdx = steps.reduce(
    (acc, s, idx) => (s.status === "done" || s.status === "next_action" ? idx : acc),
    0,
  );
  const activeProgressIdx = nextActionIdx >= 0 ? nextActionIdx : lastDoneIdx;

  const count = steps.length;
  const rowHeight = 92;
  const viewWidth = 420;
  const amplitude = 120; // Pronounced horizontal amplitude for hand-drawn feel

  const { height, nodes, d } = computePathAndNodes(
    count,
    viewWidth,
    rowHeight,
    amplitude,
  );

  return (
    <div className="w-full max-w-[620px] mx-auto px-0 py-2 space-y-4 font-sans select-none">
      {/* HEADER SECTION */}
      <header className="space-y-1 relative">
        <div className="relative inline-block">
          <h1 className="font-display text-[30px] sm:text-[36px] font-normal leading-tight text-foreground">
            Parcours du groupe
          </h1>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="md"
            className="absolute left-0 -bottom-1.5 w-[140px] pointer-events-none opacity-85"
          />
        </div>
        <p className="text-sm sm:text-base text-muted-foreground font-sans pt-1">
          L&apos;avancement du séjour pour <strong className="text-foreground font-semibold">{tripName}</strong>
        </p>
      </header>

      {/* CURVED TRAVEL PATH CONTAINER */}
      <div className="relative my-4" style={{ height: `${height}px` }}>
        {/* SVG HAND-DRAWN TRAJECTORY PATH LAYER */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
          viewBox={`0 0 ${viewWidth} ${height}`}
          preserveAspectRatio="none"
        >
          {/* Upcoming path segment (dashed) */}
          <path
            d={d}
            stroke="var(--secondary)"
            strokeWidth="2.5"
            strokeDasharray="6 6"
            strokeLinecap="round"
            fill="none"
            className="opacity-40"
          />

          {/* Completed path segment (solid thick sage stroke) */}
          {activeProgressIdx >= 0 ? (
            <path
              d={d}
              stroke="var(--secondary)"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              style={{
                strokeDasharray: 2200,
                strokeDashoffset: Math.max(
                  0,
                  2200 - (2200 * (activeProgressIdx + 0.65)) / Math.max(1, count),
                ),
                transition: "stroke-dashoffset 0.6s ease-in-out",
              }}
            />
          ) : null}
        </svg>

        {/* NODES & TITLES LAYER PLACED DIRECTLY ON THE CURVE */}
        {steps.map((step, idx) => {
          const node = nodes[idx] || { x: viewWidth / 2, y: 45 + idx * rowHeight, side: "right" };
          const isDone = step.status === "done";
          const isNextAction = step.status === "next_action";
          const isAvailable = step.status === "available";
          const isUpcoming = step.status === "upcoming";

          const leftPct = (node.x / viewWidth) * 100;
          const topPx = node.y;

          const isTextOnRight = node.side === "right";

          const titleContent = (
            <div
              className={cn(
                "inline-flex flex-col max-w-[170px] sm:max-w-[210px]",
                isTextOnRight ? "items-start text-left" : "items-end text-right",
              )}
            >
              <h3
                className={cn(
                  "font-display leading-tight transition-colors",
                  isNextAction
                    ? "text-[20px] sm:text-[24px] font-normal text-foreground"
                    : isDone
                      ? "text-[15px] sm:text-[16px] font-normal text-foreground/85"
                      : isAvailable
                        ? "text-[15px] sm:text-[16px] font-normal text-foreground"
                        : "text-[14px] sm:text-[15px] font-normal text-muted-foreground/70",
                )}
              >
                {step.title}
              </h3>

              {/* MINIMAL DISCRETE STATUS ONLY */}
              {isDone ? (
                <span className="text-[11px] sm:text-xs font-mono text-primary font-medium mt-0.5">
                  Terminé
                </span>
              ) : isUpcoming ? (
                <span className="text-[11px] sm:text-xs font-sans text-muted-foreground/60 mt-0.5">
                  À venir
                </span>
              ) : isNextAction && step.href ? (
                <div className="mt-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary text-primary-foreground font-medium text-xs shadow-xs hover:bg-primary/90 transition-colors">
                    Continuer <KrewMark type="arrow-right" tone="cream" size="sm" className="size-3" />
                  </span>
                </div>
              ) : null}
            </div>
          );

          return (
            <div
              key={step.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center z-10"
              style={{ left: `${leftPct}%`, top: `${topPx}px` }}
            >
              {/* TITLE ON LEFT SIDE */}
              {!isTextOnRight ? (
                <div className="pr-3 sm:pr-4">
                  {step.href && !isUpcoming ? (
                    (() => {
                      const parsed = parseStepHref(step.href);
                      return (
                        <Link
                          to={parsed.to as any}
                          search={parsed.search as any}
                          className="block hover:opacity-90 transition-opacity"
                        >
                          {titleContent}
                        </Link>
                      );
                    })()
                  ) : (
                    titleContent
                  )}
                </div>
              ) : null}

              {/* NODE SEAL ANCHORED EXACTLY ON PATH COORDINATES */}
              <div className="relative shrink-0 flex items-center justify-center">
                {step.href && !isUpcoming ? (
                  (() => {
                    const parsed = parseStepHref(step.href);
                    return (
                      <Link
                        to={parsed.to as any}
                        search={parsed.search as any}
                        aria-label={step.title}
                        className={cn(
                          "relative flex items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 cursor-pointer",
                          isDone &&
                            "size-8 sm:size-9 bg-sage/20 border-2 border-secondary text-primary shadow-2xs",
                          isNextAction &&
                            "size-12 sm:size-14 bg-primary text-primary-foreground border-3 border-background ring-4 ring-primary/20 shadow-md scale-105",
                          isAvailable &&
                            "size-8 sm:size-9 bg-background border-2 border-primary/50 text-primary shadow-2xs",
                        )}
                      >
                        <KrewIcon
                          name={step.iconName}
                          size="sm"
                          tone={isNextAction ? "cream" : "plum"}
                          className={cn(
                            isNextAction ? "size-6" : "size-4",
                          )}
                        />
                        {isDone ? (
                          <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-secondary text-white text-[8px] font-bold shadow-2xs">
                            ✓
                          </span>
                        ) : null}
                      </Link>
                    );
                  })()
                ) : (
                  <div
                    className={cn(
                      "relative flex items-center justify-center rounded-full",
                      isUpcoming &&
                        "size-7 sm:size-8 bg-muted/40 border border-border/70 text-muted-foreground/60",
                    )}
                  >
                    <KrewIcon
                      name={step.iconName}
                      size="sm"
                      tone="muted"
                      className="size-3.5"
                    />
                  </div>
                )}

                {/* POST-IT ANNOTATION STRICTLY ON NEXT ACTION NODE */}
                {isNextAction ? (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap z-20 pointer-events-none">
                    <KrewNote
                      variant="label"
                      tone="cream"
                      rotation={-2}
                      className="text-[13px] sm:text-[14px] py-1 px-2.5 shadow-2xs"
                    >
                      {annotationText || "Prochaine étape"}
                    </KrewNote>
                  </div>
                ) : null}
              </div>

              {/* TITLE ON RIGHT SIDE */}
              {isTextOnRight ? (
                <div className="pl-3 sm:pl-4">
                  {step.href && !isUpcoming ? (
                    (() => {
                      const parsed = parseStepHref(step.href);
                      return (
                        <Link
                          to={parsed.to as any}
                          search={parsed.search as any}
                          className="block hover:opacity-90 transition-opacity"
                        >
                          {titleContent}
                        </Link>
                      );
                    })()
                  ) : (
                    titleContent
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
