/**
 * Répartition des coûts par personne selon ville de départ.
 * Transport individuel + part égale hébergement / activités / repas.
 */

export type OriginTransport = {
  city: string;
  count: number;
  pricePerPerson: number;
  paysSharedCosts?: boolean;
};

export type CostSplitLine = {
  city: string;
  count: number;
  transport: number;
  shared: number; // hébergement + activités + repas
  totalPerPerson: number;
  subtotalCity: number;
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

  const travelers = origins.reduce((sum, origin) => sum + origin.count, 0);
  const payers = origins.reduce(
    (sum, origin) => sum + (origin.paysSharedCosts === false ? 0 : origin.count),
    0,
  );
  const sharedPerPayer = payers > 0 ? Math.round((shared * travelers) / payers) : 0;
  const lines: CostSplitLine[] = origins.map((o) => {
    const transport = Math.round(o.pricePerPerson);
    const allocatedShared = o.paysSharedCosts === false ? 0 : sharedPerPayer;
    const totalPerPerson = (o.paysSharedCosts === false ? 0 : transport) + allocatedShared;
    return {
      city: o.city,
      count: o.count,
      transport,
      shared: allocatedShared,
      totalPerPerson,
      subtotalCity: totalPerPerson * o.count,
    };
  });

  const totalGroup = lines.reduce((s, l) => s + l.subtotalCity, 0);

  return {
    destinationName: params.destinationName,
    lines,
    sharedPerPerson: sharedPerPayer,
    totalGroup,
    accommodation: Math.round(params.accommodation || 0),
    activities: Math.round(params.activities || 0),
    food: Math.round(params.food || 0),
  };
}

/** Texte WhatsApp / presse-papiers. */
export function formatCostSplitText(
  split: CostSplitResult,
  tripName?: string,
): string {
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
