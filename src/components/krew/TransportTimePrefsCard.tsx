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
  const { data: groupPrefs, refetch: refetchGroup } = useQuery({
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
      toast.error(String(e?.message ?? "Erreur lors de l'sauvegarde."));
    },
  });

  return (
    <div className="rounded-2xl border border-border/60 bg-background p-4 space-y-3">
      <div className="flex items-center gap-2">
        <KrewIcon name="time" tone="plum" size="sm" className="size-4" />
        <h3 className="font-display text-lg font-normal text-foreground">
          Horaires de transport
        </h3>
      </div>
      <p className="text-xs text-muted-foreground font-sans">
        Indiquer l’heure de départ la plus tôt possible et l’heure limite de retour.
      </p>

      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">
            Départ au plus tôt
          </label>
          <Input
            type="time"
            className="h-9 text-xs rounded-xl"
            value={earliest}
            onChange={(e) => setEarliest(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">
            Retour au plus tard
          </label>
          <Input
            type="time"
            className="h-9 text-xs rounded-xl"
            value={latest}
            onChange={(e) => setLatest(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
        <p className="text-xs text-muted-foreground font-sans">
          {groupWindow.earliestDeparture || groupWindow.latestReturn ? (
            <span>
              Groupe :
              {groupWindow.earliestDeparture
                ? ` départ au plus tôt à ${groupWindow.earliestDeparture}`
                : ""}
              {groupWindow.earliestDeparture && groupWindow.latestReturn ? " · " : ""}
              {groupWindow.latestReturn ? `retour au plus tard à ${groupWindow.latestReturn}` : ""}
            </span>
          ) : (
            <span>Aucune contrainte horaire définie pour le groupe.</span>
          )}
        </p>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isMyPrefsLoading}
          size="sm"
          className="h-8 rounded-xl text-xs px-3 font-medium"
        >
          {saveMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin mr-1" />
          ) : (
            <KrewIcon name="check" tone="plum" size="sm" className="size-3.5 mr-1" />
          )}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
