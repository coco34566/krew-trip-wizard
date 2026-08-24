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

  // 1. Fetch current user's preferences
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

  // 2. Fetch all transport time preferences for the group
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

  const groupWindow = useMemo(() => {
    return computeGroupTimeWindow(groupPrefs ?? []);
  }, [groupPrefs]);

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
    <div className="rounded-2xl border border-border/40 bg-surface/20 p-4 sm:p-5 space-y-4 shadow-none">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <KrewIcon name="time" tone="plum" size="sm" className="size-5 shrink-0" />
          <h3 className="font-display text-lg font-normal text-foreground">
            Mes créneaux horaires
          </h3>
        </div>
        <p className="text-xs text-muted-foreground font-sans">
          Mes disponibilités pour les trajets aller et retour
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Zone ALLER */}
        <div className="rounded-xl border border-border/30 p-3.5 space-y-2 shadow-none">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary font-mono">
            <KrewIcon name="plane" tone="plum" size="sm" className="size-3.5 shrink-0" />
            <span>ALLER · Départ</span>
          </div>
          <p className="text-[11px] text-muted-foreground font-sans">
            Disponible au plus tôt à partir de :
          </p>
          <Input
            type="time"
            className="h-9 text-xs font-mono rounded-lg w-full border-border/50 focus:border-primary"
            value={earliest}
            onChange={(e) => setEarliest(e.target.value)}
          />
        </div>

        {/* Zone RETOUR */}
        <div className="rounded-xl border border-border/30 p-3.5 space-y-2 shadow-none">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary font-mono">
            <KrewIcon name="train" tone="plum" size="sm" className="size-3.5 shrink-0" />
            <span>RETOUR · Arrivée</span>
          </div>
          <p className="text-[11px] text-muted-foreground font-sans">
            Impératif de rentrer au plus tard avant :
          </p>
          <Input
            type="time"
            className="h-9 text-xs font-mono rounded-lg w-full border-border/50 focus:border-primary"
            value={latest}
            onChange={(e) => setLatest(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
        <p className="text-xs text-muted-foreground font-sans">
          {groupWindow.earliestDeparture || groupWindow.latestReturn ? (
            <span className="font-mono">
              Synthèse groupe :
              {groupWindow.earliestDeparture ? ` Aller dès ${groupWindow.earliestDeparture}` : ""}
              {groupWindow.earliestDeparture && groupWindow.latestReturn ? " · " : ""}
              {groupWindow.latestReturn ? `Retour avant ${groupWindow.latestReturn}` : ""}
            </span>
          ) : (
            <span>Aucune contrainte horaire définie pour le groupe.</span>
          )}
        </p>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isMyPrefsLoading}
          size="sm"
          className="h-9 rounded-xl text-xs px-4 font-medium self-end sm:self-auto shrink-0"
        >
          {saveMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin mr-1.5" />
          ) : (
            <KrewIcon name="check" tone="plum" size="sm" className="size-3.5 mr-1.5" />
          )}
          Enregistrer mes créneaux
        </Button>
      </div>
    </div>
  );
}
