import type { ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { TripLifecycleProvider } from "@/lib/krew/trip-lifecycle-context";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import { PackingListCard as PackingListCardLegacy } from "./PackingListCard";

type Props = ComponentProps<typeof PackingListCardLegacy>;

export function PackingListCard(props: Props) {
  const lifecycleQuery = useQuery({
    queryKey: ["packing-trip-lifecycle", props.tripId],
    enabled: Boolean(props.tripId && props.tripId !== "preview"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("dates_locked, start_date, end_date")
        .eq("id", props.tripId!)
        .maybeSingle();
      if (error) throw error;
      const datesLocked = Boolean(data?.dates_locked);
      return getTripLifecycleState({
        datesLocked,
        startDate: data?.start_date ?? null,
        endDate: data?.end_date ?? null,
      });
    },
    retry: false,
    staleTime: 60_000,
  });

  return (
    <TripLifecycleProvider lifecycle={lifecycleQuery.data ?? "future"}>
      <PackingListCardLegacy {...props} />
    </TripLifecycleProvider>
  );
}
