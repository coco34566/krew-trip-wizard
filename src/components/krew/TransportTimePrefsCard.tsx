import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { setMyTransportTimePrefs } from "@/lib/trips.functions";

type Props = {
  tripId: string;
};

export function TransportTimePrefsCard({ tripId }: Props) {
  const queryClient = useQueryClient();
  const savePrefsFn = useServerFn(setMyTransportTimePrefs);

  const [earliest, setEarliest] = useState("");
  const [latest, setLatest] = useState("");

  const {
    data: myPrefs,
    isLoading: isMyPrefsLoading,
    isError: isMyPrefsError,
    refetch: refetchMyPrefs,
  } = useQuery({
    queryKey: ["my-transport-time-prefs", tripId],
    queryFn: async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) return null;

      const { data: part, error: participantError } = await supabase
        .from("trip_participants")
        .select("id")
        .eq("trip_id", tripId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (participantError) throw participantError;
      if (!part) return null;

      const { data, error: prefsError } = await supabase
        .from("trip_transport_time_prefs")
        .select("earliest_departure_time, latest_return_time")
        .eq("trip_id", tripId)
        .eq("participant_id", part.id)
        .maybeSingle();
      if (prefsError) throw prefsError;
      return data;
    },
    enabled: !!tripId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (myPrefs) {
      setEarliest(myPrefs.earliest_departure_time || "");
      setLatest(myPrefs.latest_return_time || "");
    }
  }, [myPrefs]);

  const saveMutation = useMutation({
    mutationFn: () =>
      savePrefsFn({
        data: {
          tripId,
          earliestDepartureTime: earliest || null,
          latestReturnTime: latest || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-transport-time-prefs", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) => {
      console.error("Impossible d'enregistrer les créneaux de transport:", e);
      toast.error("Impossible d’enregistrer tes créneaux pour le moment.");
    },
  });

  return (
    <section className="space-y-3 border-b border-border/45 pb-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2">
          <KrewIcon name="time" tone="plum" size="sm" className="size-4 shrink-0" />
          <h3 className="font-display text-[19px] font-normal text-foreground">Mes créneaux</h3>
        </div>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Les deux horaires utiles pour chercher tes trajets.
        </p>
      </div>
      {isMyPrefsError ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <span>Impossible de charger tes créneaux pour le moment.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 shrink-0"
            onClick={() => void refetchMyPrefs()}
          >
            Réessayer
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 items-end gap-x-3 gap-y-3 sm:grid-cols-[140px_140px_auto] sm:gap-x-4">
          <label className="min-w-0 space-y-1.5">
            <span className="block text-[12px] font-semibold text-foreground">Aller · disponible dès</span>
            <Input
              type="time"
              className="h-9 min-h-9 w-full max-w-[150px] rounded-[9px] border-border/55 px-3 text-sm font-mono"
              value={earliest}
              onChange={(e) => setEarliest(e.target.value)}
              disabled={isMyPrefsLoading}
            />
          </label>
          <label className="min-w-0 space-y-1.5">
            <span className="block text-[12px] font-semibold text-foreground">Retour · rentré avant</span>
            <Input
              type="time"
              className="h-9 min-h-9 w-full max-w-[150px] rounded-[9px] border-border/55 px-3 text-sm font-mono"
              value={latest}
              onChange={(e) => setLatest(e.target.value)}
              disabled={isMyPrefsLoading}
            />
          </label>
          <KrewStatefulButton
            size="sm"
            className="col-span-2 w-auto justify-self-start px-5 sm:col-span-1 sm:justify-self-auto"
            idleLabel="Enregistrer"
            loadingLabel="Enregistrement…"
            successLabel="Enregistré"
            errorLabel="Réessayer"
            disabled={isMyPrefsLoading}
            onAction={() => saveMutation.mutateAsync()}
          />
        </div>
      )}
    </section>
  );
}
