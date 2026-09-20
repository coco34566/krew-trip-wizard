import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { getTripAvailability } from "@/lib/availability.functions";
import { getMyParticipantPreferences, getParticipantsProgress } from "@/lib/participant-preferences.functions";
import { getStarPreferences } from "@/lib/star-preferences.functions";
import { getCostSplit, getGenerationReadiness, getTripDetail } from "@/lib/trips.functions";
import type { StayConcept } from "@/lib/krew/stay-profiles";

export type TripHubProfile = {
  calculatedConcepts: StayConcept[];
  selectedConcepts: StayConcept[];
  validated: boolean;
  legacyBypass: boolean;
};

export function useTripHubData(tripId: string) {
  const fetchDetail = useServerFn(getTripDetail);
  const fetchReadiness = useServerFn(getGenerationReadiness);
  const fetchProgress = useServerFn(getParticipantsProgress);
  const fetchSplit = useServerFn(getCostSplit);
  const fetchAvailability = useServerFn(getTripAvailability);
  const fetchStar = useServerFn(getStarPreferences);
  const fetchMyPrefs = useServerFn(getMyParticipantPreferences);

  const queryKey = ["trip", tripId];
  const progressQueryKey = ["trip-progress", tripId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchDetail({ data: { tripId } }),
  });

  const { data: readiness } = useQuery({
    queryKey: ["generation-readiness", tripId],
    queryFn: () => fetchReadiness({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const { data: tasksData } = useQuery({
    queryKey: ["trip-tasks", tripId],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from("trip_tasks")
        .select("*, assigned_participant:assigned_participant_id ( id, display_name, email, user_id )")
        .eq("trip_id", tripId)
        .order("day_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return tasks ?? [];
    },
    enabled: Boolean(tripId),
  });

  const { data: starData } = useQuery({
    queryKey: ["star-prefs", tripId],
    queryFn: () => fetchStar({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const { data: availData } = useQuery({
    queryKey: ["trip-availability", tripId],
    queryFn: () => fetchAvailability({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const { data: costSplitData } = useQuery({
    queryKey: ["cost-split", tripId],
    queryFn: () => fetchSplit({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const { data: progress } = useQuery({
    queryKey: progressQueryKey,
    queryFn: () => fetchProgress({ data: { tripId } }),
  });

  const { data: myPrefsData } = useQuery({
    queryKey: ["my-participant-prefs", tripId],
    queryFn: () => fetchMyPrefs({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const profile = data?.profile as TripHubProfile | undefined;

  return {
    data,
    isLoading,
    profile,
    readiness,
    tasksData,
    starData,
    availData,
    costSplitData,
    progress,
    myPrefsData,
    queryKey,
    progressQueryKey,
  };
}
