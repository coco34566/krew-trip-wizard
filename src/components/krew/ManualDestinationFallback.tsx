import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CityAutocomplete } from "@/components/krew/CityAutocomplete";
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
  const [confirmedDestination, setConfirmedDestination] = useState("");
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      selectManual({
        data: {
          tripId,
          destination: confirmedDestination.trim(),
        },
      }),
    onSuccess: () => {
      setSaved(true);
      setDestination("");
      setConfirmedDestination("");
      if (onSelected) onSelected();
      else if (typeof window !== "undefined") window.location.reload();
    },
    onError: (error: any) => {
      const message = String(error?.message || "");
      toast.error(
        message.includes("Destination introuvable")
          ? "Destination introuvable. Choisis une proposition dans la liste."
          : "Impossible d’enregistrer cette destination pour le moment.",
      );
    },
  });

  return (
    <div className="mt-8 w-full text-center sm:mt-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <KrewIcon name="destination" tone="sage" size="sm" className="size-4" />
          <p className="font-display text-base font-normal text-foreground/80 sm:text-lg">
            KREW n’a pas trouvé la bonne destination ?
          </p>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Si votre groupe a déjà fait son choix, indiquez la destination pour continuer à organiser le voyage avec KREW.
        </p>

        <div className="mx-auto mt-3 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
          <CityAutocomplete
            value={destination}
            onChange={(value) => {
              setSaved(false);
              setDestination(value);
              setConfirmedDestination("");
            }}
            onSelect={(selection) => {
              setSaved(false);
              setDestination(selection.city);
              setConfirmedDestination(
                selection.country ? `${selection.city}, ${selection.country}` : selection.city,
              );
            }}
            placeholder="Chercher une ville ou un endroit…"
            className="w-full text-left sm:max-w-sm"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full shrink-0 sm:w-auto"
            disabled={!confirmedDestination || mutation.isPending || saved}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {saved ? <KrewMark type="check" tone="sage" size="sm" className="size-4" /> : null}
            {mutation.isPending ? "Validation…" : saved ? "Destination choisie" : "Choisir"}
          </Button>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground/80">
          Sélection manuelle du groupe · pas de score de compatibilité KREW.
        </p>
      </div>
    </div>
  );
}
