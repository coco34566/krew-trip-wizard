/**
 * Mini radar chart (SVG pur) + barre de consensus pour une proposition Krew.
 * Aucune dépendance graphique : tokens de couleur sémantiques uniquement.
 */

export type ProposalSubScores = {
  sAmbiance?: number;
  sActivities?: number;
  sBudget?: number;
  sDistance?: number;
  sSeason?: number;
  sQuality?: number;
};

const AXES: { key: keyof ProposalSubScores; label: string }[] = [
  { key: "sAmbiance", label: "Ambiance" },
  { key: "sActivities", label: "Activités" },
  { key: "sBudget", label: "Budget" },
  { key: "sDistance", label: "Trajet" },
  { key: "sSeason", label: "Saison" },
  { key: "sQuality", label: "Qualité" },
];

const SIZE = 132;
const CENTER = SIZE / 2;
const RADIUS = 44;

function point(index: number, value: number) {
  const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2;
  const r = RADIUS * Math.max(0, Math.min(1, value));
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)] as const;
}

export function ProposalScoreRadar({
  subScores,
  consensusScore,
  minSatisfaction,
  satisfiedCount,
  participantsEvaluated,
  className,
}: {
  subScores: ProposalSubScores;
  consensusScore?: number | null;
  minSatisfaction?: number | null;
  satisfiedCount?: number | null;
  participantsEvaluated?: number | null;
  className?: string;
}) {
  const values = AXES.map((a) => Number(subScores?.[a.key] ?? 0));
  if (!values.some((v) => Number.isFinite(v) && v > 0)) return null;

  const polygon = values.map((v, i) => point(i, v).join(",")).join(" ");
  const consensusPct = Math.round(Math.max(0, Math.min(1, Number(consensusScore ?? 0))) * 100);
  const minPct = Math.round(Math.max(0, Math.min(1, Number(minSatisfaction ?? 0))) * 100);

  return (
    <div
      className={`flex flex-wrap items-center gap-5 rounded-2xl border border-border/70 bg-surface/30 p-4 ${className ?? ""}`}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Répartition des sous-scores de la proposition"
        className="shrink-0"
      >
        {[0.33, 0.66, 1].map((ring) => (
          <polygon
            key={ring}
            points={AXES.map((_, i) => point(i, ring).join(",")).join(" ")}
            className="fill-none stroke-border"
            strokeWidth={1}
          />
        ))}
        {AXES.map((_, i) => {
          const [x, y] = point(i, 1);
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              className="stroke-border"
              strokeWidth={1}
            />
          );
        })}
        <polygon
          points={polygon}
          className="fill-primary/25 stroke-primary"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {values.map((v, i) => {
          const [x, y] = point(i, v);
          return <circle key={i} cx={x} cy={y} r={2} className="fill-primary" />;
        })}
      </svg>

      <div className="min-w-[180px] flex-1 space-y-3">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {AXES.map((a, i) => (
            <li key={a.key} className="flex items-center justify-between gap-2">
              <span>{a.label}</span>
              <span className="font-medium text-foreground">
                {Math.round((values[i] ?? 0) * 100)}
              </span>
            </li>
          ))}
        </ul>

        <div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium">Consensus du groupe</span>
            <span className="text-muted-foreground">
              {consensusPct}%
              {typeof satisfiedCount === "number" && typeof participantsEvaluated === "number"
                ? ` · ${satisfiedCount}/${participantsEvaluated} satisfaits`
                : ""}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${consensusPct}%` }}
            />
          </div>
          {minSatisfaction != null ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Participant le moins servi : {minPct}%
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
