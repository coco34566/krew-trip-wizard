import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewIcon } from "@/components/krew/visual-language";
import { selectManualDestination } from "@/lib/manual-destination.functions";

export function ManualDestinationFallback({
  tripId,
  onSelected,
}: {
  tripId: string;
  onSelected: () => void;
}) {
  const selectManual = useServerFn(selectManualDestination);
  const [destination, setDestination] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      selectManual({
        data: {
          tripId,
          destination: destination.trim(),
        },
      }),
    onSuccess: () => {
      setDestination("");
      onSelected();
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
    <div className="mt-5 rounded-2xl border border-dashed border-primary/25 bg-primary/[0.03] p-4 sm:p-5">
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
              onChange={(event) => setDestination(event.target.value)}
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
            <KrewStatefulButton
              className="w-full sm:w-auto"
              idleLabel="Utiliser cette destination"
              loadingLabel="Validation…"
              successLabel="Destination choisie"
              errorLabel="Réessayer"
              disabled={destination.trim().length < 2}
              onAction={() => mutation.mutateAsync()}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Ce choix sera indiqué comme « Choisie par le groupe » et ne recevra pas de score de compatibilité KREW.
          </p>
        </div>
      </div>
    </div>
  );
}
