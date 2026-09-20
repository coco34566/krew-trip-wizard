import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { getTripAvailability } from "@/lib/availability.functions";
import {
  getMyParticipantPreferences,
  getParticipantsProgress,
} from "@/lib/participant-preferences.functions";
import { getStarPreferences } from "@/lib/star-preferences.functions";
import {
  getCostSplit,
  getGenerationReadiness,
  getTripDetail,
} from "@/lib/trips.functions";
import type { StayConcept } from "@/lib/krew/stay-profiles";

export function useTripHubData(tripId: string) {
  const fetchDetail = useServerFn(getTripDetail);
  const fetchReadiness = useServerFn(getGenerationReadiness);
  const fetchProgress = useServerFn(getParticipantsProgress);
  const fetchSplit = useServerFn(getCostSplit);
  const fetchAvail = useServerFn(getTripAvailability);
  const fetchStar = useServerFn(getStarPreferences);
  const fetchMyPrefs = useServerFn(getMyParticipantPreferences);

  const detailQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });
  const readinessQuery = useQuery({
    queryKey: ["generation-readiness", tripId],
    queryFn: () => fetchReadiness({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });
  const tasksQuery = useQuery({
    queryKey: ["trip-tasks", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_tasks" as any)
        .select(
          `
          *,
          assigned_participant:assigned_participant_id (
            id,
            display_name,
            email,
            user_id
          )
        `,
        )
        .eq("trip_id", tripId)
        .order("day_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: Boolean(tripId),
  });
  const starQuery = useQuery({
    queryKey: ["star-prefs", tripId],
    queryFn: () => fetchStar({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });
  const availabilityQuery = useQuery({
    queryKey: ["trip-availability", tripId],
    queryFn: () => fetchAvail({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });
  const costSplitQuery = useQuery({
    queryKey: ["cost-split", tripId],
    queryFn: () => fetchSplit({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });
  const progressQuery = useQuery({
    queryKey: ["trip-progress", tripId],
    queryFn: () => fetchProgress({ data: { tripId } }),
  });
  const myPrefsQuery = useQuery({
    queryKey: ["my-participant-prefs", tripId],
    queryFn: () => fetchMyPrefs({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const profile = detailQuery.data?.profile as
    | {
        calculatedConcepts: StayConcept[];
        selectedConcepts: StayConcept[];
        validated: boolean;
        legacyBypass: boolean;
      }
    | undefined;

  return {
    data: detailQuery.data,
    isLoading: detailQuery.isLoading,
    readiness: readinessQuery.data,
    tasksData: tasksQuery.data,
    starData: starQuery.data,
    availData: availabilityQuery.data,
    costSplitData: costSplitQuery.data,
    progress: progressQuery.data,
    myPrefsData: myPrefsQuery.data,
    profile,
  };
}
