import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export function useKrewTripAvatars(tripId: string) {
  return useQuery({
    queryKey: ["trip-member-avatars", tripId],
    enabled: Boolean(tripId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_trip_member_avatars" as any, {
        p_trip_id: tripId,
      } as any);

      if (error) throw error;

      return new Map<string, string | null>(
        ((data ?? []) as { user_id: string; avatar_url: string | null }[]).map((row) => [
          row.user_id,
          row.avatar_url,
        ]),
      );
    },
  });
}
