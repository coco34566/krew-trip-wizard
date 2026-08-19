import { useRef } from "react";
import { ImageDown, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/krew/constants";
import { formatCostSplitText, type CostSplitResult } from "@/lib/krew/cost-split";
import { shareOnWhatsApp } from "@/lib/krew/whatsapp";

type Props = {
  split: CostSplitResult;
  tripName?: string;
  tripId?: string;
};

export function CostSplitCard({ split, tripName }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const handleWhatsApp = () => {
    const text = formatCostSplitText(split, tripName);
    shareOnWhatsApp(text);
  };

  async function exportImage() {
    const el = ref.current;
    if (!el) return;
    try {
      const width = el.scrollWidth;
      const height = el.scrollHeight;
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.scale(scale, scale);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#1C151B";
      ctx.font = "bold 20px system-ui, sans-serif";
      let y = 32;
      ctx.fillText(tripName ? `KREW — ${tripName}` : "KREW — répartition", 24, y);
      y += 28;
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillText(`📍 ${split.destinationName}`, 24, y);
      y += 28;
      ctx.fillText(
        `Part égale (héberg. + act. + repas) : ${split.sharedPerPerson} € / pers.`,
        24,
        y,
      );
      y += 24;
      for (const l of split.lines) {
        ctx.font = "bold 15px system-ui, sans-serif";
        ctx.fillText(`${l.city}`, 24, y);
        y += 22;
        ctx.font = "14px system-ui, sans-serif";
        ctx.fillText(
          `Transport ${l.transport} € + part ${l.shared} € = ${l.totalPerPerson} €`,
          32,
          y,
        );
        y += 26;
      }
      ctx.fillStyle = "#6B3A5D";
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillText(`Total groupe : ${split.totalGroup} €`, 24, y);

      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `krew-repartition-${split.destinationName.replace(/\s+/g, "-").toLowerCase()}.png`;
      a.click();
      toast.success("Image téléchargée");
    } catch (e) {
      console.error(e);
      toast.error("Export image impossible — utilise la copie texte");
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary font-mono">
            Répartition des coûts
          </p>
          <h3 className="mt-1 font-display text-2xl font-semibold">{split.destinationName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Chacun paie son transport depuis sa ville + une part égale du reste.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            type="button"
            className="bg-[#25D366] text-white hover:bg-[#1ebe57] border-transparent"
            size="sm"
            onClick={handleWhatsApp}
          >
            Partager sur WhatsApp
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportImage}>
            <ImageDown className="size-4" /> Image
          </Button>
        </div>
      </div>

      <div ref={ref} className="mt-5 space-y-4">
        <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Hébergement</p>
            <p className="font-mono font-semibold text-base mt-0.5">{formatEuro(split.accommodation)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Activités</p>
            <p className="font-mono font-semibold text-base mt-0.5">{formatEuro(split.activities)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Repas</p>
            <p className="font-mono font-semibold text-base mt-0.5">{formatEuro(split.food)}</p>
          </div>
        </div>

        <p className="text-sm font-medium">
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
            <div key={l.city} className="rounded-2xl border border-border/50 bg-background/50 p-3.5 text-sm space-y-1">
              <div className="flex justify-between items-center border-b border-border/40 pb-1.5 font-medium">
                <span>{l.city}</span>
                <span className="font-mono font-semibold text-primary">{formatEuro(l.totalPerPerson)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>Transport : <strong className="font-mono font-normal text-foreground">{formatEuro(l.transport)}</strong></span>
                <span>Part égale : <strong className="font-mono font-normal text-foreground">{formatEuro(l.shared)}</strong></span>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-border/60 flex items-center justify-between">
          <span className="flex items-center gap-2 font-display text-lg font-semibold">
            <Wallet className="size-5 text-primary" />
            Total groupe
          </span>
          <span className="font-mono font-bold text-xl text-primary">{formatEuro(split.totalGroup)}</span>
        </div>
      </div>
    </div>
  );
}
