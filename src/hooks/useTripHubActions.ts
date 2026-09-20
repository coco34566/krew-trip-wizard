import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  onParticipantsCountUpdated,
}: {
  tripId: string;
  onParticipantsCountUpdated?: () => void;
}) {
  const queryClient = useQueryClient();
  const removeGuest = useServerFn(removeParticipant);
  const setCoOrganizerFn = useServerFn(setCoOrganizer);
  const updateParticipantsCount = useServerFn(updateTripParticipantsCount);
  const declareStatus = useServerFn(declareMyStatus);
  const cancel = useServerFn(cancelTrip);

  const refreshHub = () => {
    void queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    void queryClient.invalidateQueries({ queryKey: ["trip-progress", tripId] });
  };

  const updateCountMutation = useMutation({
    mutationFn: (count: number) =>
      updateParticipantsCount({ data: { tripId, participantsCount: count } }),
    onSuccess: () => {
      onParticipantsCountUpdated?.();
      void queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      void queryClient.invalidateQueries({ queryKey: ["trip-progress", tripId] });
      void queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
    },
    onError: (error) => {
      console.error("Impossible de mettre à jour le nombre de participants:", error);
      toast.error("Impossible de mettre à jour le nombre de participants pour le moment.");
    },
  });

  const setCoOrgMutation = useMutation({
    mutationFn: ({ coOrganizerId }: { coOrganizerId: string | null }) =>
      setCoOrganizerFn({ data: { tripId, coOrganizerId } }),
    onSuccess: refreshHub,
    onError: (error) => {
      console.error(error);
      toast.error("Impossible de mettre à jour ce rôle pour le moment.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (participantId: string) => removeGuest({ data: { participantId } }),
    onSuccess: refreshHub,
  });

  const declareStatusMutation = useMutation({
    mutationFn: (status: "accepte" | "absent") =>
      declareStatus({ data: { tripId, status } }),
    onSuccess: refreshHub,
    onError: (error) => {
      console.error("Impossible de mettre à jour ta participation:", error);
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
    onError: (error) => {
      console.error("Impossible de gérer le voyage:", error);
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
