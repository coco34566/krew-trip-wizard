import { useRef, useState } from "react";
import { Copy, Check, ImageDown, Users, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/krew/constants";
import {
  formatCostSplitText,
  type CostSplitResult,
} from "@/lib/krew/cost-split";

type Props = {
  split: CostSplitResult;
  tripName?: string;
};

export function CostSplitCard({ split, tripName }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  async function copyText() {
    const text = formatCostSplitText(split, tripName);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Tableau copié — colle-le dans WhatsApp");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible");
    }
  }

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
      ctx.fillStyle = "#f4f7f4";
      ctx.fillRect(0, 0, width, height);

      // Render simple text layout (robust sans html2canvas)
      ctx.fillStyle = "#1a1f1a";
      ctx.font = "bold 20px system-ui, sans-serif";
      let y = 32;
      ctx.fillText(tripName ? `Krew — ${tripName}` : "Krew — répartition", 24, y);
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
        ctx.fillText(`${l.city} (${l.count} pers.)`, 24, y);
        y += 22;
        ctx.font = "14px system-ui, sans-serif";
        ctx.fillText(
          `Transport ${l.transport} € + part ${l.shared} € = ${l.totalPerPerson} € / pers.  |  sous-total ${l.subtotalCity} €`,
          32,
          y,
        );
        y += 26;
      }
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
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            Répartition des coûts
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold">
            {split.destinationName}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Chacun paie son transport depuis sa ville + une part égale du reste.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="hero" size="sm" onClick={copyText}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copié" : "Copier pour WhatsApp"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportImage}>
            <ImageDown className="size-4" /> Image
          </Button>
        </div>
      </div>

      <div ref={ref} className="mt-5 space-y-3">
        <div className="grid gap-2 rounded-2xl border border-border bg-surface/40 px-4 py-3 text-sm sm:grid-cols-3">
          <p>Hébergement : {formatEuro(split.accommodation)}</p>
          <p>Activités : {formatEuro(split.activities)}</p>
          <p>Repas : {formatEuro(split.food)}</p>
        </div>
        <p className="text-sm font-medium">
          Part égale : {formatEuro(split.sharedPerPerson)} / pers.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Ville</th>
                <th className="py-2 pr-3">Pers.</th>
                <th className="py-2 pr-3">Transport</th>
                <th className="py-2 pr-3">Part égale</th>
                <th className="py-2 pr-3">Total / pers.</th>
                <th className="py-2">Sous-total</th>
              </tr>
            </thead>
            <tbody>
              {split.lines.map((l) => (
                <tr key={l.city} className="border-b border-border/60">
                  <td className="py-2.5 pr-3 font-medium">{l.city}</td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5 opacity-60" /> {l.count}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">{formatEuro(l.transport)}</td>
                  <td className="py-2.5 pr-3">{formatEuro(l.shared)}</td>
                  <td className="py-2.5 pr-3 font-semibold">{formatEuro(l.totalPerPerson)}</td>
                  <td className="py-2.5">{formatEuro(l.subtotalCity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="flex items-center gap-2 font-display text-lg font-semibold">
          <Wallet className="size-5 text-primary" />
          Total groupe : {formatEuro(split.totalGroup)}
        </p>
      </div>
    </div>
  );
}
