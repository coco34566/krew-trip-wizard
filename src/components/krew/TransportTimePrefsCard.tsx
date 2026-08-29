import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
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
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) => {
      toast.error(String(e?.message ?? "Erreur lors de la sauvegarde."));
    },
  });

  return (
    <section className="space-y-3 border-y border-border/45 py-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2"><KrewIcon name="time" tone="plum" size="sm" className="size-4 shrink-0" /><h3 className="font-display text-[19px] font-normal text-foreground">Mes créneaux</h3></div>
        <p className="text-[12px] leading-relaxed text-muted-foreground">Les deux horaires utiles pour chercher tes trajets.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="space-y-1.5"><span className="block text-[12px] font-semibold text-foreground">Aller · disponible dès</span><Input type="time" className="h-9 min-h-9 rounded-[9px] border-border/55 text-sm font-mono" value={earliest} onChange={(e) => setEarliest(e.target.value)} /></label>
        <label className="space-y-1.5"><span className="block text-[12px] font-semibold text-foreground">Retour · rentré avant</span><Input type="time" className="h-9 min-h-9 rounded-[9px] border-border/55 text-sm font-mono" value={latest} onChange={(e) => setLatest(e.target.value)} /></label>
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isMyPrefsLoading} className="w-full sm:w-auto">{saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <KrewIcon name="check" tone="plum" size="sm" className="size-4" />}Enregistrer</Button>
      </div>
    </section>
  );
}
