import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  AccommodationPlaceAutocomplete,
  type AccommodationPlaceSelection,
} from "@/components/krew/AccommodationPlaceAutocomplete";
import { KrewIcon, KrewMark } from "@/components/krew/visual-language";
import { Button } from "@/components/ui/button";
import {
  getManualAccommodationContext,
  selectManualAccommodation,
} from "@/lib/manual-accommodation.functions";

export function ManualAccommodationFallback({ tripId }: { tripId: string }) {
  const selectManual = useServerFn(selectManualAccommodation);
  const getContext = useServerFn(getManualAccommodationContext);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<AccommodationPlaceSelection | null>(null);
  const [saved, setSaved] = useState(false);
  const [destinationName, setDestinationName] = useState<string | null>(null);
  const [destinationCountry, setDestinationCountry] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getContext({ data: { tripId } })
      .then((result) => {
        if (!active) return;
        setDestinationName(result.destinationName ?? null);
        setDestinationCountry(result.destinationCountry ?? null);
      })
      .catch(() => {
        if (!active) return;
        setDestinationName(null);
        setDestinationCountry(null);
      });
    return () => {
      active = false;
    };
  }, [getContext, tripId]);

  const destinationHint = useMemo(
    () => [destinationName, destinationCountry].filter(Boolean).join(", ") || null,
    [destinationName, destinationCountry],
  );

  const mutation = useMutation({
    mutationFn: () => {
      if (!selection) throw new Error("Sélectionne un hébergement dans la liste");
      return selectManual({
        data: {
          tripId,
          name: selection.name,
          address: selection.address,
          city: selection.city,
          country: selection.country,
          latitude: selection.latitude,
          longitude: selection.longitude,
          externalId: selection.externalId,
        },
      });
    },
    onSuccess: () => {
      setSaved(true);
      setQuery("");
      setSelection(null);
      if (typeof window !== "undefined") window.location.reload();
    },
    onError: (error: any) => {
      const message = String(error?.message || "");
      if (message.includes("Hébergement hors destination")) {
        toast.error(
          destinationName
            ? `Cet hébergement semble être en dehors de ${destinationName}. Choisis un établissement dans la destination sélectionnée.`
            : "Cet hébergement semble être en dehors de la destination sélectionnée.",
        );
        return;
      }
      toast.error(
        message.includes("Choisis d’abord une destination")
          ? "Choisis d’abord la destination du voyage."
          : "Impossible d’enregistrer cet hébergement pour le moment.",
      );
    },
  });

  return (
    <div className="mt-8 w-full text-center sm:mt-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <KrewIcon name="accommodation" tone="sage" size="sm" className="size-4" />
          <p className="font-display text-base font-normal text-foreground/80 sm:text-lg">
            KREW n’a pas trouvé votre hébergement ?
          </p>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Si votre groupe a déjà réservé, recherchez l’hébergement pour continuer à organiser le séjour avec KREW.
        </p>

        <div className="mx-auto mt-3 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
          <AccommodationPlaceAutocomplete
            value={query}
            onChange={(value) => {
              setSaved(false);
              setQuery(value);
              setSelection(null);
            }}
            onSelect={(place) => {
              setSaved(false);
              setQuery(place.name);
              setSelection(place);
            }}
            destinationHint={destinationHint}
            placeholder="Rechercher un hôtel, une maison ou une adresse…"
            className="w-full text-left text-sm [&_input]:text-sm [&_input::placeholder]:text-sm sm:max-w-sm"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full shrink-0 sm:w-auto"
            disabled={!selection || mutation.isPending || saved}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {saved ? <KrewMark type="check" tone="sage" size="sm" className="size-4" /> : null}
            {mutation.isPending ? "Validation…" : saved ? "Hébergement choisi" : "Choisir"}
          </Button>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground/80">
          Sélection manuelle du groupe · l’adresse choisie servira de repère pour la carte du planning.
        </p>
      </div>
    </div>
  );
}
