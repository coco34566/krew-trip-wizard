import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { supabase } from "@/integrations/supabase/client";
import { setMyTransportTimePrefs } from "@/lib/trips.functions";
import { computeGroupTimeWindow } from "@/lib/krew/engine";

type Props = {
  tripId: string;
};

export function TransportTimePrefsCard({ tripId }: Props) {
  const queryClient = useQueryClient();
  const savePrefsFn = useServerFn(setMyTransportTimePrefs);

  const [earliest, setEarliest] = useState("");
  const [latest, setLatest] = useState("");

  const { data: myPrefs, isLoading: isMyPrefsLoading } = useQuery({
    queryKey: ["my-transport-time-prefs", tripId],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: part } = await supabase
        .from("trip_participants")
        .select("id")
        .eq("trip_id", tripId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!part) return null;

      const { data } = await supabase
        .from("trip_transport_time_prefs")
        .select("*")
        .eq("trip_id", tripId)
        .eq("participant_id", part.id)
        .maybeSingle();
      return data;
    },
    enabled: !!tripId,
  });

  const { data: groupPrefs } = useQuery({
    queryKey: ["group-transport-time-prefs", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_transport_time_prefs")
        .select("earliest_departure_time, latest_return_time")
        .eq("trip_id", tripId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tripId,
  });

  const groupWindow = useMemo(() => computeGroupTimeWindow(groupPrefs ?? []), [groupPrefs]);

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
      toast.success("Horaires de transport enregistrés !");
      queryClient.invalidateQueries({ queryKey: ["my-transport-time-prefs", tripId] });
      queryClient.invalidateQueries({ queryKey: ["group-transport-time-prefs", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) => {
      toast.error(String(e?.message ?? "Erreur lors de la sauvegarde."));
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2">
          <KrewIcon name="time" tone="plum" size="sm" className="size-5 shrink-0" />
          <h3 className="font-display text-xl font-normal text-foreground">Mes créneaux horaires</h3>
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground font-sans sm:max-w-[320px] sm:text-right">
          Mes disponibilités pour les trajets aller et retour
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
        <div className="space-y-2 border-t border-border/50 pt-4">
          <div className="flex items-center gap-1.5 font-mono text-[12px] font-semibold uppercase tracking-wider text-primary">
            <KrewIcon name="plane" tone="plum" size="sm" className="size-3.5 shrink-0" />
            <span>Aller · départ</span>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground font-sans">
            Disponible au plus tôt à partir de :
          </p>
          <Input
            type="time"
            className="min-h-10 w-full rounded-[10px] border-border/50 text-sm font-mono focus:border-primary"
            value={earliest}
            onChange={(e) => setEarliest(e.target.value)}
          />
        </div>

        <div className="space-y-2 border-t border-border/50 pt-4">
          <div className="flex items-center gap-1.5 font-mono text-[12px] font-semibold uppercase tracking-wider text-primary">
            <KrewIcon name="train" tone="plum" size="sm" className="size-3.5 shrink-0" />
            <span>Retour · arrivée</span>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground font-sans">
            Impératif de rentrer au plus tard avant :
          </p>
          <Input
            type="time"
            className="min-h-10 w-full rounded-[10px] border-border/50 text-sm font-mono focus:border-primary"
            value={latest}
            onChange={(e) => setLatest(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed text-muted-foreground font-sans sm:max-w-[620px]">
          {groupWindow.earliestDeparture || groupWindow.latestReturn ? (
            <span className="font-mono">
              Synthèse groupe :
              {groupWindow.earliestDeparture ? ` Aller dès ${groupWindow.earliestDeparture}` : ""}
              {groupWindow.earliestDeparture && groupWindow.latestReturn ? " · " : ""}
              {groupWindow.latestReturn ? `Retour avant ${groupWindow.latestReturn}` : ""}
            </span>
          ) : (
            <span>
              Aucune contrainte horaire définie pour le groupe. Tant que KREW ne connaît pas les horaires de transport réels, le planning utilise des repères estimés (arrivée 18:30 · départ 16:30), à confirmer.
            </span>
          )}
        </p>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isMyPrefsLoading}
          size="sm"
          className="min-h-10 shrink-0 self-end text-[13px] sm:self-auto"
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <KrewIcon name="check" tone="plum" size="sm" className="mr-1.5 size-3.5" />
          )}
          Enregistrer mes créneaux
        </Button>
      </div>
    </div>
  );
}
