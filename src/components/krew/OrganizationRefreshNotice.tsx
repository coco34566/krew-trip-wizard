import { KrewIcon, KrewMark } from "@/components/krew/visual-language";
import {
  getOrganizationRefreshState,
  type OrganizationRefreshItem,
  type OrganizationRefreshReason,
} from "@/lib/krew/organization-refresh";

type Props = {
  logistics: unknown;
  destinationName?: string | null;
  canManage: boolean;
};

function itemCopy(item: OrganizationRefreshItem, reasons: OrganizationRefreshReason[]) {
  const destinationChanged = reasons.includes("destination");

  switch (item.section) {
    case "accommodation":
      return {
        icon: "accommodation" as const,
        label: "Hébergement",
        status: destinationChanged ? "À rechercher de nouveau" : "À mettre à jour",
        detail: destinationChanged
          ? "Les propositions actuelles concernent l’ancienne destination."
          : "Les disponibilités et tarifs peuvent avoir changé avec les nouvelles dates.",
      };
    case "transport":
      return {
        icon: "transport" as const,
        label: "Transports",
        status: destinationChanged ? "À recalculer" : "À mettre à jour",
        detail: destinationChanged
          ? "Les trajets doivent être recherchés vers la nouvelle destination."
          : "Les trajets, horaires et prix doivent correspondre aux nouvelles dates.",
      };
    case "itinerary":
      return {
        icon: "planning" as const,
        label: "Planning et activités",
        status: "À régénérer",
        detail: destinationChanged
          ? "Le programme actuel a été construit pour l’ancienne destination."
          : "Les activités doivent être replacées sur les nouveaux jours et horaires.",
      };
    case "tasks":
      return {
        icon: "tasks" as const,
        label: "Tâches liées au planning",
        status: "À vérifier",
        detail: destinationChanged
          ? "Certaines réservations ou actions peuvent ne plus être pertinentes."
          : "Certaines réservations ou échéances peuvent dépendre de l’ancien planning.",
      };
  }
}

export function OrganizationRefreshNotice({
  logistics,
  destinationName,
  canManage,
}: Props) {
  const refresh = getOrganizationRefreshState(logistics);
  if (!refresh) return null;

  const hasDates = refresh.reasons.includes("dates");
  const hasDestination = refresh.reasons.includes("destination");
  const effectiveDestination = refresh.destinationName || destinationName || "la nouvelle destination";

  const title =
    hasDates && hasDestination
      ? "Organisation à mettre à jour"
      : hasDestination
        ? "À mettre à jour suite au changement de destination"
        : "À mettre à jour suite au changement de dates";

  const intro =
    hasDates && hasDestination
      ? `Les dates et la destination ont changé. Pour adapter l’organisation à ${effectiveDestination}, certains éléments doivent être mis à jour.`
      : hasDestination
        ? `La destination a changé. Pour adapter l’organisation à ${effectiveDestination}, certains éléments doivent être mis à jour.`
        : "Les dates du voyage ont changé. Pour garder l’organisation cohérente avec les nouvelles dates, certains éléments doivent être mis à jour.";

  return (
    <section
      aria-label="Organisation à mettre à jour"
      className="relative overflow-hidden rounded-[22px] border border-primary/15 bg-primary/[0.035] px-4 py-4 sm:px-5 sm:py-5"
    >
      <KrewMark
        type="sparkle"
        tone="sage"
        size="sm"
        className="pointer-events-none absolute right-3 top-3 opacity-55"
      />

      <div className="relative pr-7">
        <p className="font-display text-[24px] leading-tight text-foreground sm:text-[28px]">
          {title}
        </p>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {intro}
        </p>
      </div>

      <div className="mt-4 divide-y divide-border/55 rounded-2xl bg-background/75 px-3 sm:px-4">
        {refresh.items.map((item) => {
          const copy = itemCopy(item, refresh.reasons);
          return (
            <div
              key={item.section}
              className="flex items-start gap-3 py-3 first:pt-3 last:pb-3"
            >
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/8">
                <KrewIcon name={copy.icon} tone="plum" size="sm" className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                  <p className="text-sm font-semibold text-foreground">{copy.label}</p>
                  <span className="w-fit rounded-full bg-secondary/70 px-2 py-0.5 text-[11px] font-semibold text-foreground/80">
                    {copy.status}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
                  {copy.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {canManage
          ? "Rien n’est relancé automatiquement : tu peux remettre chaque élément à jour à ton rythme."
          : "Ces éléments restent visibles pour le moment, mais ils peuvent correspondre à l’ancienne organisation."}
      </p>
    </section>
  );
}
