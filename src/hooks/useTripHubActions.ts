import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { declareMyStatus } from "@/lib/participant-preferences.functions";
import {
  cancelTrip,
  removeParticipant,
  setCoOrganizer,
  updateTripParticipantsCount,
} from "@/lib/trips.functions";

export function useTripHubActions({
  tripId,
  queryKey,
  progressQueryKey,
}: {
  tripId: string;
  queryKey: QueryKey;
  progressQueryKey: QueryKey;
}) {
  const queryClient = useQueryClient();
  const removeGuest = useServerFn(removeParticipant);
  const setCoOrg = useServerFn(setCoOrganizer);
  const updateCount = useServerFn(updateTripParticipantsCount);
  const declareStatus = useServerFn(declareMyStatus);
  const cancel = useServerFn(cancelTrip);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: progressQueryKey });
  };

  const updateCountMutation = useMutation({
    mutationFn: (count: number) =>
      updateCount({ data: { tripId, participantsCount: count } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip-progress", tripId] });
      queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
    },
    onError: (err: any) => {
      console.error("Impossible de mettre à jour le nombre de participants:", err);
      toast.error("Impossible de mettre à jour le nombre de participants pour le moment.");
    },
  });

  const setCoOrgMutation = useMutation({
    mutationFn: ({ coOrganizerId }: { coOrganizerId: string | null }) =>
      setCoOrg({ data: { tripId, coOrganizerId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Impossible de mettre à jour ce rôle pour le moment.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (participantId: string) => removeGuest({ data: { participantId } }),
    onSuccess: refresh,
  });

  const declareStatusMutation = useMutation({
    mutationFn: (status: "accepte" | "absent") =>
      declareStatus({ data: { tripId, status } }),
    onSuccess: refresh,
    onError: (err: any) => {
      console.error("Impossible de mettre à jour ta participation:", err);
      toast.error("Impossible de mettre à jour ta participation pour le moment.");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (hardDelete?: boolean) =>
      cancel({ data: { tripId, hardDelete: Boolean(hardDelete) } }),
    onSuccess: (result) => {
      toast.success(result.mode === "deleted" ? "Voyage supprimé" : "Voyage archivé");
      window.location.href = "/dashboard";
    },
    onError: (err: any) => {
      console.error("Impossible de gérer le voyage:", err);
      toast.error("Impossible d’effectuer cette action pour le moment.");
    },
  });

  return {
    updateCountMutation,
    setCoOrgMutation,
    removeMutation,
    declareStatusMutation,
    cancelMutation,
  };
}
