import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/krew/constants";

type LiveBudget = {
  transport: number;
  accommodation: number;
  activities: number;
  food: number;
  total: number;
  destinationName: string | null;
  country: string | null;
  topHotelName: string | null;
  transportPicksCount: number;
};

type TripHubFinalRecapProps = {
  trip: {
    start_date?: string | null;
    end_date?: string | null;
    participants_count?: number | null;
  };
  participantsCount: number;
  liveBudget: LiveBudget;
  costSplitData?: {
    totalReserved?: number | null;
    totalEstimated?: number | null;
  } | null;
  onShare: () => void;
};

export function TripHubFinalRecap({
  trip,
  participantsCount,
  liveBudget,
  costSplitData,
  onShare,
}: TripHubFinalRecapProps) {
  return (
    <section className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
            <Wallet className="size-5 text-primary" />
            Résumé du voyage
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Retrouve ici les éléments principaux du voyage.
          </p>
        </div>
        <Button
          type="button"
          className="bg-[#25D366] text-white hover:bg-[#1ebe57] border-transparent"
          onClick={onShare}
        >
          Partager sur WhatsApp
        </Button>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Dates</dt>
          <dd className="mt-0.5 font-medium">
            {trip.start_date && trip.end_date
              ? `${new Date(trip.start_date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${new Date(trip.end_date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
              : trip.start_date
                ? new Date(trip.start_date + "T12:00:00").toLocaleDateString("fr-FR")
                : "À définir"}
          </dd>
        </div>
        <div className="rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Lieu</dt>
          <dd className="mt-0.5 font-medium">
            {liveBudget.destinationName
              ? `${liveBudget.destinationName}${liveBudget.country ? ` · ${liveBudget.country}` : ""}`
              : "Destination à choisir"}
          </dd>
        </div>
        <div className="rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Budget estimé par personne
          </dt>
          <dd className="mt-0.5 font-semibold text-primary text-sm">
            {(costSplitData?.totalReserved != null && costSplitData.totalReserved > 0) ||
            (costSplitData?.totalEstimated != null && costSplitData.totalEstimated > 0) ? (
              <div className="text-xs space-y-0.5 font-normal">
                <div className="flex justify-between gap-1">
                  <span>Déjà réservé :</span>{" "}
                  <span className="font-bold text-primary font-mono">
                    {formatEuro(costSplitData.totalReserved ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between gap-1">
                  <span>Reste estimé :</span>{" "}
                  <span className="font-bold text-foreground font-mono">
                    {formatEuro(costSplitData.totalEstimated ?? 0)}
                  </span>
                </div>
              </div>
            ) : liveBudget.total > 0 ? (
              `~${formatEuro(liveBudget.total)} / pers.`
            ) : (
              "À définir"
            )}
          </dd>
        </div>
        <div className="rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Groupe</dt>
          <dd className="mt-0.5 font-medium">
            {trip.participants_count || participantsCount || "?"} pers.
            {liveBudget.topHotelName ? ` · hébergement : ${liveBudget.topHotelName}` : ""}
          </dd>
        </div>
      </dl>

      {liveBudget.total > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <li className="rounded-full border border-border px-2.5 py-1">
            Transport ~{formatEuro(liveBudget.transport)}
          </li>
          <li className="rounded-full border border-border px-2.5 py-1">
            Hébergement ~{formatEuro(liveBudget.accommodation)}
          </li>
          <li className="rounded-full border border-border px-2.5 py-1">
            Activités ~{formatEuro(liveBudget.activities)}
          </li>
          <li className="rounded-full border border-border px-2.5 py-1">
            Repas ~{formatEuro(liveBudget.food)}
          </li>
          {liveBudget.transportPicksCount > 0 ? (
            <li className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-primary">
              {liveBudget.transportPicksCount} trajet(s) choisi(s)
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
