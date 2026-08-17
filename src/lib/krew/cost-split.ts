/**
 * Répartition des coûts par personne selon ville de départ.
 * Transport individuel + part égale hébergement / activités / repas.
 */

export type OriginTransport = {
  city: string;
  count: number;
  pricePerPerson: number;
  isStar?: boolean;
};

export type CostSplitLine = {
  city: string;
  count: number;
  transport: number;
  shared: number; // hébergement + activités + repas
  totalPerPerson: number;
  subtotalCity: number;
  isStar?: boolean;
};

export type CostSplitResult = {
  destinationName: string;
  lines: CostSplitLine[];
  sharedPerPerson: number;
  totalGroup: number;
  accommodation: number;
  activities: number;
  food: number;
};

export function buildCostSplit(params: {
  destinationName: string;
  accommodation: number;
  activities: number;
  food: number;
  /** Transport par origine ; sinon transport moyen unique. */
  origins: OriginTransport[];
  fallbackTransportPerPerson?: number;
  participants?: number;
  starPaysShare?: boolean;
}): CostSplitResult {
  const shared = Math.round(
    (params.accommodation || 0) + (params.activities || 0) + (params.food || 0),
  );
  let origins = params.origins.filter((o) => o.count > 0);
  if (!origins.length) {
    origins = [
      {
        city: "Groupe",
        count: Math.max(1, params.participants ?? 1),
        pricePerPerson: Math.round(params.fallbackTransportPerPerson ?? 0),
      },
    ];
  }

  let lines: CostSplitLine[] = origins.map((o) => {
    const transport = Math.round(o.pricePerPerson);
    const totalPerPerson = transport + shared;
    return {
      city: o.city,
      count: o.count,
      transport,
      shared,
      totalPerPerson,
      subtotalCity: totalPerPerson * o.count,
      isStar: o.isStar,
    };
  });

  const totalGroup = lines.reduce((s, l) => s + l.subtotalCity, 0);
  if (params.starPaysShare === false) {
    const starCost = lines
      .filter((line) => line.isStar)
      .reduce((sum, line) => sum + line.subtotalCity, 0);
    const payerCount = lines
      .filter((line) => !line.isStar)
      .reduce((sum, line) => sum + line.count, 0);
    lines = lines.map((line) => {
      if (line.isStar)
        return { ...line, transport: 0, shared: 0, totalPerPerson: 0, subtotalCity: 0 };
      const extra = payerCount ? starCost / payerCount : 0;
      const totalPerPerson = line.totalPerPerson + extra;
      return {
        ...line,
        shared: line.shared + extra,
        totalPerPerson,
        subtotalCity: totalPerPerson * line.count,
      };
    });
  }

  return {
    destinationName: params.destinationName,
    lines,
    sharedPerPerson: shared,
    totalGroup,
    accommodation: Math.round(params.accommodation || 0),
    activities: Math.round(params.activities || 0),
    food: Math.round(params.food || 0),
  };
}

/** Texte WhatsApp / presse-papiers. */
export function formatCostSplitText(split: CostSplitResult, tripName?: string): string {
  const lines = [
    tripName ? `*${tripName}*` : null,
    `📍 ${split.destinationName}`,
    ``,
    `Part égale (héberg. + activités + repas) : ${split.sharedPerPerson} € / pers.`,
    `  · Hébergement ${split.accommodation} €`,
    `  · Activités ${split.activities} €`,
    `  · Repas ${split.food} €`,
    ``,
    `*Répartition par ville de départ*`,
  ].filter(Boolean) as string[];

  for (const l of split.lines) {
    lines.push(
      `• ${l.city} (${l.count} pers.)`,
      `  Transport ${l.transport} € + part ${l.shared} € = *${l.totalPerPerson} € / pers.*`,
      `  Sous-total ville : ${l.subtotalCity} €`,
    );
  }
  lines.push(``, `💰 Total groupe estimé : *${split.totalGroup} €*`);
  lines.push(``, `_Estimations Krew — à vérifier sur les comparateurs_`);
  return lines.join("\n");
}
