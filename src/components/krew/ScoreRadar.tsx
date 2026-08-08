import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

interface SubScores {
  sAmbiance?: number;
  sActivities?: number;
  sBudget?: number;
  sConsensus?: number;
  [key: string]: any;
}

interface ScoreRadarProps {
  score: number;
  subScores?: SubScores;
  budget?: {
    subScores?: SubScores;
    [key: string]: any;
  } | null;
}

export function ScoreRadar({ score, subScores, budget }: ScoreRadarProps) {
  // Extraction robuste des sous-scores avec fallbacks
  const ss = subScores || budget?.subScores || {};

  // Normalisation des sous-scores (de 0-1 à 0-100) avec valeurs par défaut raisonnables si null/undefined
  const ambianceVal = Math.round((ss.sAmbiance ?? ss.s_ambiance ?? 0.7) * 100);
  const budgetVal = Math.round((ss.sBudget ?? ss.s_budget ?? 0.7) * 100);
  const activitiesVal = Math.round((ss.sActivities ?? ss.s_activities ?? 0.7) * 100);
  const consensusVal = Math.round((ss.sConsensus ?? ss.s_consensus ?? 0.7) * 100);

  const data = [
    { subject: "Ambiance", value: ambianceVal },
    { subject: "Budget", value: budgetVal },
    { subject: "Activités", value: activitiesVal },
    { subject: "Consensus", value: consensusVal },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/60 bg-surface/30 p-2 sm:p-3">
      {/* Mini Radar Chart */}
      <div className="relative h-[110px] w-[110px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="var(--color-border)" opacity={0.6} />
            <PolarAngleAxis
              dataKey="subject"
              tick={{
                fill: "var(--color-muted-foreground)",
                fontSize: 9,
                fontWeight: 500,
              }}
            />
            <Radar
              name="Score"
              dataKey="value"
              stroke="var(--color-primary)"
              fill="var(--color-primary)"
              fillOpacity={0.25}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Note Globale */}
      <div className="flex flex-col items-center justify-center rounded-xl bg-primary/10 px-3 py-2 border border-primary/20 shrink-0">
        <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Score Global</span>
        <span className="font-display text-xl font-bold text-primary tabular-nums">
          {Math.round(score)}%
        </span>
      </div>

      {/* Légende Compacte interactive */}
      <div className="hidden min-w-[120px] flex-col gap-0.5 text-[10px] text-muted-foreground xs:flex">
        <div className="flex items-center justify-between">
          <span className="font-medium">Ambiance:</span>
          <span className="font-semibold text-foreground tabular-nums">{ambianceVal}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Budget:</span>
          <span className="font-semibold text-foreground tabular-nums">{budgetVal}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Activités:</span>
          <span className="font-semibold text-foreground tabular-nums">{activitiesVal}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Consensus:</span>
          <span className="font-semibold text-foreground tabular-nums">{consensusVal}%</span>
        </div>
      </div>
    </div>
  );
}
