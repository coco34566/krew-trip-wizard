import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";

export const Route = createFileRoute("/_authenticated/aceternity-test")({
  head: () => ({ meta: [{ title: "Test Aceternity — KREW" }] }),
  component: AceternityTestPage,
});

function AceternityTestPage() {
  const [normalCopied, setNormalCopied] = useState(false);
  const sample = "https://krew.app/join/demo";

  return (
    <main className="mx-auto max-w-[820px] space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <KrewJourneyPageHeader
        tripName="Prototype UI"
        title="Un bouton KREW plus vivant ?"
        otterSrc="/brand/otter-states/next-action.png"
        waveClassName="w-[220px]"
      >
        <p className="max-w-[42rem] text-[15px] leading-[1.55] text-muted-foreground sm:text-[16px]">
          Même action, même design system. À gauche le bouton actuel ; à droite une mécanique inspirée du Stateful Button d’Aceternity.
        </p>
      </KrewJourneyPageHeader>

      <section className="space-y-4 border-y border-sage/25 bg-sage/[0.05] px-4 py-5 sm:px-5">
        <p className="break-all font-mono text-[12px] leading-relaxed text-foreground sm:text-[13px]">{sample}</p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-muted-foreground">Bouton actuel</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setNormalCopied(true);
                toast.success("Lien copié");
                setTimeout(() => setNormalCopied(false), 1800);
              }}
            >
              <Copy className="size-4" />
              {normalCopied ? "Copié" : "Copier le lien"}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-muted-foreground">Version stateful</p>
            <KrewStatefulButton
              variant="outline"
              className="w-full"
              idleLabel="Copier le lien"
              successLabel="Copié"
              onAction={async () => {
                await new Promise((resolve) => setTimeout(resolve, 450));
                toast.success("Lien copié");
              }}
            />
          </div>
        </div>

        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Le test reprend seulement la mécanique Aceternity : feedback immédiat, état d’attente puis succès. Les couleurs, dimensions, radius et typographies restent ceux de KREW.
        </p>
      </section>
    </main>
  );
}
