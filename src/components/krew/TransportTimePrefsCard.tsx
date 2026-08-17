import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Loader2, Save, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="space-y-3 py-2">
      <div className="flex items-center gap-2">
        <Clock className="size-5 text-primary" />
        <h2 className="font-display text-base font-semibold tracking-tight">
          Contraintes horaires
        </h2>
      </div>
      <p className="text-xs text-muted-foreground leading-snug">
        Indique l'heure à partir de laquelle tu peux partir à l'aller, et l'heure limite de retour
        chez toi. Ces préférences orientent le choix des billets du groupe.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Je peux partir à partir de
          </label>
          <Input
            type="time"
            className="mt-1 w-full"
            value={earliest}
            onChange={(e) => setEarliest(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Je dois être rentré avant
          </label>
          <Input
            type="time"
            className="mt-1 w-full"
            value={latest}
            onChange={(e) => setLatest(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 mt-2">
        {/* Contrainte collective du groupe */}
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-1 min-w-[200px]">
          <Users className="size-4 text-primary opacity-80" />
          {groupWindow.earliestDeparture || groupWindow.latestReturn ? (
            <span>
              Contrainte collective :
              {groupWindow.earliestDeparture
                ? ` départ au plus tôt à ${groupWindow.earliestDeparture}`
                : ""}
              {groupWindow.earliestDeparture && groupWindow.latestReturn ? " et " : ""}
              {groupWindow.latestReturn ? ` retour au plus tard à ${groupWindow.latestReturn}` : ""}
            </span>
          ) : (
            <span>Aucune contrainte horaire définie pour le groupe pour l'instant.</span>
          )}
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isMyPrefsLoading}
          variant="hero"
          size="sm"
          className="gap-1.5 shrink-0"
        >
          {saveMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Sauvegarder
        </Button>
      </div>
    </div>
  );
}
