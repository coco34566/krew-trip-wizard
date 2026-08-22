import { Button } from "@/components/ui/button";
import { KrewIcon, KrewHighlight } from "@/components/krew/visual-language";
import { formatEuro } from "@/lib/krew/constants";
import { formatCostSplitText, type CostSplitResult } from "@/lib/krew/cost-split";
import { shareOnWhatsApp } from "@/lib/krew/whatsapp";

type Props = {
  split: CostSplitResult;
  tripName?: string;
  tripId?: string;
};

export function CostSplitCard({ split, tripName }: Props) {
  const handleWhatsApp = () => {
    const text = formatCostSplitText(split, tripName);
    shareOnWhatsApp(text);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[18px] sm:text-[20px] font-normal text-foreground leading-tight">
            {split.destinationName}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground font-sans">
            Chacun paie son transport depuis sa ville + une part égale du reste.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="bg-sage/16 text-primary hover:bg-sage/25 border border-sage/30 rounded-xl h-10 px-4 text-xs font-semibold gap-2 shadow-none"
          onClick={handleWhatsApp}
        >
          <KrewIcon name="message" tone="plum" size="sm" className="size-4" />
          <span>Partager sur WhatsApp</span>
        </Button>
      </div>

      <div className="mt-5 space-y-4">
        {/* Nappe sauge pâle pour les postes principaux */}
        <div className="bg-sage/18 border border-sage/25 rounded-2xl p-4 text-xs font-sans space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <p>
            <span className="text-muted-foreground">Hébergement : </span>
            <span className="font-mono font-semibold text-foreground">{formatEuro(split.accommodation)}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Activités : </span>
            <span className="font-mono font-semibold text-foreground">{formatEuro(split.activities)}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Repas : </span>
            <span className="font-mono font-semibold text-foreground">{formatEuro(split.food)}</span>
          </p>
        </div>

        <p className="text-xs font-medium text-foreground">
          Part égale : <span className="font-mono font-semibold text-primary">{formatEuro(split.sharedPerPerson)}</span> / pers.
        </p>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pr-3">Participant (Ville)</th>
                <th className="py-2.5 pr-3">Transport</th>
                <th className="py-2.5 pr-3">Part égale</th>
                <th className="py-2.5 pr-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {split.lines.map((l) => (
                <tr key={l.city} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="py-3 pr-3 font-medium">{l.city}</td>
                  <td className="py-3 pr-3 font-mono">{formatEuro(l.transport)}</td>
                  <td className="py-3 pr-3 font-mono">{formatEuro(l.shared)}</td>
                  <td className="py-3 pr-3 font-mono font-semibold text-primary">{formatEuro(l.totalPerPerson)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked View */}
        <div className="md:hidden space-y-3">
          {split.lines.map((l) => (
            <div key={l.city} className="rounded-2xl border border-border/50 bg-background/50 p-3.5 text-sm space-y-1.5">
              <div className="flex justify-between items-center border-b border-border/40 pb-1.5">
                <span className="text-xs text-muted-foreground font-medium">Participant (Ville)</span>
                <span className="font-medium text-foreground">{l.city}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Transport</span>
                <span className="font-mono text-foreground">{formatEuro(l.transport)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Part égale</span>
                <span className="font-mono text-foreground">{formatEuro(l.shared)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold pt-1 border-t border-border/30">
                <span>Total</span>
                <span className="font-mono text-primary">{formatEuro(l.totalPerPerson)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Total groupe : point visuel principal avec KrewHighlight sauge */}
        <div className="pt-3 border-t border-border/40 flex items-center justify-between">
          <span className="flex items-center gap-2 font-display text-xl font-normal text-foreground">
            <KrewIcon name="budget" tone="plum" size="sm" className="size-5 shrink-0" />
            Total groupe :
          </span>
          <KrewHighlight tone="sage" className="font-mono font-bold text-xl text-primary px-1.5 py-0.5">
            {formatEuro(split.totalGroup)}
          </KrewHighlight>
        </div>
      </div>
    </div>
  );
}
