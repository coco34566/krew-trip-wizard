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
 * Calculates a smooth, strongly curved S-path (Bézier points) for N steps.
 * Returns both the SVG path string (`d`) and the (x, y) coordinate percentage for each step node.
 */
function computePathAndNodes(
  count: number,
  viewWidth = 360,
  rowHeight = 90,
  amplitudeDesktop = 110,
  amplitudeMobile = 60,
) {
  const height = Math.max(300, count * rowHeight);
  const centerX = viewWidth / 2;

  const nodes: { x: number; y: number; side: "left" | "right" }[] = [];

  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const y = 40 + i * rowHeight;
    // Alternate left and right horizontal displacement using a sine wave
    // Sine wave offset produces organic hand-drawn travel path feel
    const wave = Math.sin(t * Math.PI * 2.5); // ~1.25 full S-curves
    // On desktop we use wider amplitude, on mobile a slightly constrained amplitude
    const currentAmp = amplitudeDesktop;
    const x = centerX + wave * currentAmp;
    const side = wave >= 0 ? "right" : "left";
    nodes.push({ x, y, side });
  }

  // Construct SVG cubic Bézier path connecting the nodes smoothly
  let d = `M ${nodes[0]?.x ?? centerX} ${nodes[0]?.y ?? 40}`;
  for (let i = 0; i < nodes.length - 1; i++) {
    const curr = nodes[i]!;
    const next = nodes[i + 1]!;
    const midY = (curr.y + next.y) / 2;
    // Control points curve out horizontally
    const cp1x = curr.x + (next.x - curr.x) * 0.2;
    const cp2x = next.x - (next.x - curr.x) * 0.2;
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
  const rowHeight = 96; // Generous vertical spacing so path curves breathe
  const viewWidth = 400; // viewBox width for desktop/tablet
  const amplitudeDesktop = 115; // Strong horizontal curve amplitude

  const { height, nodes, d } = computePathAndNodes(
    count,
    viewWidth,
    rowHeight,
    amplitudeDesktop,
  );

  return (
    <div className="w-full max-w-[680px] mx-auto px-0 py-2 space-y-6 font-sans">
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
      <div className="relative my-6 select-none" style={{ minHeight: `${height}px` }}>
        {/* SVG CURVED TRAVEL PATH LAYER */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
          viewBox={`0 0 ${viewWidth} ${height}`}
          preserveAspectRatio="none"
        >
          {/* Base upcoming dashed path */}
          <path
            d={d}
            stroke="var(--secondary)"
            strokeWidth="2.5"
            strokeDasharray="5 5"
            strokeLinecap="round"
            fill="none"
            className="opacity-35"
          />

          {/* Solid completed progress path */}
          {activeProgressIdx >= 0 ? (
            <path
              d={d}
              stroke="var(--secondary)"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
              style={{
                strokeDasharray: 2000,
                strokeDashoffset: Math.max(
                  0,
                  2000 - (2000 * (activeProgressIdx + 0.6)) / Math.max(1, count),
                ),
                transition: "stroke-dashoffset 0.5s ease-in-out",
              }}
            />
          ) : null}
        </svg>

        {/* NODES & TITLES LAYER PLACED DIRECTLY ON CURVE */}
        {steps.map((step, idx) => {
          const node = nodes[idx] || { x: viewWidth / 2, y: 40 + idx * rowHeight, side: "right" };
          const isDone = step.status === "done";
          const isNextAction = step.status === "next_action";
          const isAvailable = step.status === "available";
          const isUpcoming = step.status === "upcoming";

          // Calculate left percentage position based on SVG viewBox coordinate
          const leftPct = (node.x / viewWidth) * 100;
          const topPx = node.y;

          // Responsive alignment: text placed right if node is left of center, or placed left if node is right of center
          const isLeftAligned = node.side === "left";

          const titleContent = (
            <div
              className={cn(
                "inline-flex flex-col max-w-[180px] sm:max-w-[230px]",
                isLeftAligned ? "items-start text-left" : "items-end text-right",
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
                        : "text-[14px] sm:text-[15px] font-normal text-muted-foreground/75",
                )}
              >
                {step.title}
              </h3>

              {/* DISCRETE SHORT STATUS OR SUBTITLE ONLY */}
              {isDone ? (
                <span className="text-xs font-mono text-primary font-medium mt-0.5">
                  Terminé
                </span>
              ) : isUpcoming ? (
                <span className="text-xs font-sans text-muted-foreground/60 mt-0.5">
                  À venir
                </span>
              ) : step.subtitle ? (
                <span
                  className={cn(
                    "text-xs font-sans mt-0.5",
                    isNextAction ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {step.subtitle}
                </span>
              ) : null}

              {/* NEXT ACTION CONTINUER CTA BUTTON */}
              {isNextAction && step.href ? (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-medium text-xs shadow-xs hover:bg-primary/90 transition-colors">
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
              {/* TITLE ON LEFT SIDE (WHEN NODE IS ON THE RIGHT) */}
              {!isLeftAligned ? (
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

              {/* NODE SEAL CENTERED EXACTLY ON THE PATH */}
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
                          <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-secondary text-white text-[9px] font-bold shadow-2xs">
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
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap z-20 pointer-events-none">
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

              {/* TITLE ON RIGHT SIDE (WHEN NODE IS ON THE LEFT) */}
              {isLeftAligned ? (
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
