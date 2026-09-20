import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  cancelTrip,
  removeParticipant,
  setCoOrganizer,
  updateTripParticipantsCount,
} from "@/lib/trips.functions";
import { declareMyStatus } from "@/lib/participant-preferences.functions";

export function useTripHubActions(tripId: string) {
  const queryClient = useQueryClient();
  const removeGuest = useServerFn(removeParticipant);
  const setCoOrg = useServerFn(setCoOrganizer);
  const updateCount = useServerFn(updateTripParticipantsCount);
  const declareStatus = useServerFn(declareMyStatus);
  const cancel = useServerFn(cancelTrip);

  const [isEditingCount, setIsEditingCount] = useState(false);
  const [countInput, setCountInput] = useState(2);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    queryClient.invalidateQueries({ queryKey: ["trip-progress", tripId] });
  };

  const updateCountMutation = useMutation({
    mutationFn: (count: number) =>
      updateCount({ data: { tripId, participantsCount: count } }),
    onSuccess: () => {
      setIsEditingCount(false);
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip-progress", tripId] });
      queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
    },
    onError: (error: unknown) => {
      console.error("Impossible de mettre à jour le nombre de participants:", error);
      toast.error("Impossible de mettre à jour le nombre de participants pour le moment.");
    },
  });

  const setCoOrgMutation = useMutation({
    mutationFn: ({ coOrganizerId }: { coOrganizerId: string | null }) =>
      setCoOrg({ data: { tripId, coOrganizerId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (error: unknown) => {
      console.error(error);
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
    onError: (error: unknown) => {
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
    onError: (error: unknown) => {
      console.error("Impossible de gérer le voyage:", error);
      toast.error("Impossible d’effectuer cette action pour le moment.");
    },
  });

  return {
    isEditingCount,
    setIsEditingCount,
    countInput,
    setCountInput,
    updateCountMutation,
    setCoOrgMutation,
    removeMutation,
    declareStatusMutation,
    cancelMutation,
  };
}

export type TripHubActions = ReturnType<typeof useTripHubActions>;
