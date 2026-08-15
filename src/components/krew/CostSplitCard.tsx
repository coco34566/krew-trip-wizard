import { useRef, useMemo } from "react";
import { ImageDown, Wallet, CreditCard } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatEuro } from "@/lib/krew/constants";
import { formatCostSplitText, type CostSplitResult } from "@/lib/krew/cost-split";
import { createGroupPaymentSession } from "@/lib/trips.functions";
import { supabase } from "@/integrations/supabase/client";

type Props = { split: CostSplitResult; tripName?: string; tripId?: string };

export function CostSplitCard({ split, tripName, tripId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const paySessionFn = useServerFn(createGroupPaymentSession);
  const { data: payments, isLoading: isPaymentsLoading } = useQuery({
    queryKey: ["trip-payments", tripId],
    queryFn: async () => {
      if (!tripId) return null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: part } = await supabase.from("trip_participants").select("id").eq("trip_id", tripId).eq("user_id", user.id).maybeSingle();
      if (!part) return null;
      const { data, error } = await supabase.from("trip_payments").select("status, amount_cents").eq("trip_id", tripId).eq("participant_id", part.id);
      if (error) { console.error("Error fetching payments:", error); return null; }
      return data;
    }, enabled: !!tripId,
  });
  const payMutation = useMutation({
    mutationFn: () => paySessionFn({ data: { tripId: tripId! } }),
    onSuccess: (res: any) => { if (res?.url) window.location.href = res.url; else toast.error("URL de paiement non reçue"); },
    onError: (e: any) => toast.error(String(e?.message ?? "Erreur lors de la création de la session de paiement")),
  });
  const paymentStatus = useMemo(() => {
    if (!payments || payments.length === 0) return "unpaid";
    if (payments.some((p: any) => p.status === "paid")) return "paid";
    if (payments.some((p: any) => p.status === "pending")) return "pending";
    return "unpaid";
  }, [payments]);

  const shareOnWhatsApp = () => {
    const text = formatCostSplitText(split, tripName);
    const encodedText = encodeURIComponent(text);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `whatsapp://send?text=${encodedText}`;
      return;
    }
    window.open(`https://wa.me/?text=${encodedText}`, "_blank", "noopener,noreferrer");
  };

  async function exportImage() {
    const el = ref.current;
    if (!el) return;
    try {
      const width = el.scrollWidth; const height = el.scrollHeight; const scale = 2;
      const canvas = document.createElement("canvas"); canvas.width = width * scale; canvas.height = height * scale;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("canvas"); ctx.scale(scale, scale);
      ctx.fillStyle = "#f4f7f4"; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#1a1f1a"; ctx.font = "bold 20px system-ui, sans-serif"; let y = 32;
      ctx.fillText(tripName ? `Krew — ${tripName}` : "Krew — répartition", 24, y); y += 28;
      ctx.font = "16px system-ui, sans-serif"; ctx.fillText(`📍 ${split.destinationName}`, 24, y); y += 28;
      ctx.fillText(`Part égale (héberg. + act. + repas) : ${split.sharedPerPerson} € / pers.`, 24, y); y += 24;
      for (const l of split.lines) { ctx.font = "bold 15px system-ui, sans-serif"; ctx.fillText(`${l.city}`, 24, y); y += 22; ctx.font = "14px system-ui, sans-serif"; ctx.fillText(`Transport ${l.transport} € + part ${l.shared} € = ${l.totalPerPerson} €`, 32, y); y += 26; }
      ctx.font = "bold 16px system-ui, sans-serif"; ctx.fillText(`Total groupe : ${split.totalGroup} €`, 24, y);
      const url = canvas.toDataURL("image/png"); const a = document.createElement("a"); a.href = url; a.download = `krew-repartition-${split.destinationName.replace(/\s+/g, "-").toLowerCase()}.png`; a.click(); toast.success("Image téléchargée");
    } catch (e) { console.error(e); toast.error("Export image impossible — utilise la copie texte"); }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-medium uppercase tracking-wider text-primary">Répartition des coûts</p><h3 className="mt-1 font-display text-lg font-semibold">{split.destinationName}</h3><p className="mt-1 text-sm text-muted-foreground">Chacun paie son transport depuis sa ville + une part égale du reste.</p></div>
        <div className="flex flex-wrap gap-2 items-center">
          {tripId && !isPaymentsLoading && <div className="mr-2">{paymentStatus === "paid" ? <Badge variant="success" className="px-3 py-1 text-xs">Payé ✅</Badge> : paymentStatus === "pending" ? <div className="flex items-center gap-2"><Badge variant="sun" className="px-3 py-1 text-xs">Paiement en attente ⏳</Badge><Button type="button" variant="outline" size="sm" disabled={payMutation.isPending} onClick={() => payMutation.mutate()} className="h-8 gap-1.5"><CreditCard className="size-4" /> Réessayer</Button></div> : <Button type="button" variant="hero" size="sm" disabled={payMutation.isPending} onClick={() => payMutation.mutate()} className="h-8 gap-1.5"><CreditCard className="size-4" /> Payer ma part</Button>}</div>}
          <Button type="button" className="bg-[#25D366] text-white hover:bg-[#1ebe57] border-transparent" size="sm" onClick={shareOnWhatsApp}>Partager sur WhatsApp</Button>
          <Button type="button" variant="outline" size="sm" onClick={exportImage}><ImageDown className="size-4" /> Image</Button>
        </div>
      </div>
      <div ref={ref} className="mt-5 space-y-3">
        <div className="grid gap-2 rounded-2xl border border-border bg-surface/40 px-4 py-3 text-sm sm:grid-cols-3"><p>Hébergement : {formatEuro(split.accommodation)}</p><p>Activités : {formatEuro(split.activities)}</p><p>Repas : {formatEuro(split.food)}</p></div>
        <p className="text-sm font-medium">Part égale : {formatEuro(split.sharedPerPerson)} / pers.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground"><th className="py-2 pr-3">Participant (Ville)</th><th className="py-2 pr-3">Transport</th><th className="py-2 pr-3">Part égale</th><th className="py-2 pr-3">Total</th></tr></thead><tbody>{split.lines.map((l) => <tr key={l.city} className="border-b border-border/60"><td className="py-2.5 pr-3 font-medium">{l.city}</td><td className="py-2.5 pr-3">{formatEuro(l.transport)}</td><td className="py-2.5 pr-3">{formatEuro(l.shared)}</td><td className="py-2.5 pr-3 font-semibold">{formatEuro(l.totalPerPerson)}</td></tr>)}</tbody></table></div>
        <p className="flex items-center gap-2 font-display text-lg font-semibold"><Wallet className="size-5 text-primary" />Total groupe : {formatEuro(split.totalGroup)}</p>
      </div>
    </div>
  );
}
