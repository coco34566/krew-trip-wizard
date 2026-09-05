import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KrewIcon, KrewMark } from "@/components/krew/visual-language";
import { selectManualDestination } from "@/lib/manual-destination.functions";

export function ManualDestinationFallback({
  tripId,
  onSelected,
}: {
  tripId: string;
  onSelected?: () => void;
}) {
  const selectManual = useServerFn(selectManualDestination);
  const [destination, setDestination] = useState("");
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      selectManual({
        data: {
          tripId,
          destination: destination.trim(),
        },
      }),
    onSuccess: () => {
      setSaved(true);
      setDestination("");
      if (onSelected) onSelected();
      else if (typeof window !== "undefined") window.location.reload();
    },
    onError: (error: any) => {
      const message = String(error?.message || "");
      toast.error(
        message.includes("Destination introuvable")
          ? "Destination introuvable. Précise une ville, une île ou une région connue."
          : "Impossible d’enregistrer cette destination pour le moment.",
      );
    },
  });

  return (
    <div className="mt-5 w-full basis-full rounded-2xl border border-dashed border-primary/25 bg-primary/[0.03] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <KrewIcon name="destination" tone="plum" size="sm" className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-normal text-foreground">
            KREW n’a pas trouvé la bonne destination ?
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Si votre groupe a déjà fait son choix, indiquez la destination pour continuer à organiser le voyage avec KREW.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={destination}
              onChange={(event) => {
                setSaved(false);
                setDestination(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && destination.trim().length >= 2 && !mutation.isPending) {
                  event.preventDefault();
                  mutation.mutate();
                }
              }}
              maxLength={120}
              placeholder="Ex. Annecy, Lisbonne, Côte basque…"
              aria-label="Destination choisie par le groupe"
              className="sm:max-w-md"
            />
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={destination.trim().length < 2 || mutation.isPending || saved}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {saved ? <KrewMark type="check" tone="sage" size="sm" className="size-4" /> : null}
              {mutation.isPending ? "Validation…" : saved ? "Destination choisie" : "Utiliser cette destination"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Ce choix sera indiqué comme « Choisie par le groupe » et ne recevra pas de score de compatibilité KREW.
          </p>
        </div>
      </div>
    </div>
  );
}
