import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isTripAdmin } from "@/lib/krew/engine";

const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);

export const updateTaskStatusSecure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ taskId: z.string().uuid(), status: taskStatusSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const taskRes = await supabase
      .from("trip_tasks" as any)
      .select("id, trip_id, assigned_participant_id")
      .eq("id", data.taskId)
      .maybeSingle();
    if (taskRes.error) throw taskRes.error;
    if (!taskRes.data) throw new Error("Tâche introuvable");
    const task = taskRes.data as any;

    const tripRes = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id")
      .eq("id", task.trip_id)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");

    const admin = isTripAdmin(tripRes.data, userId);
    if (!admin) {
      if (!task.assigned_participant_id) {
        throw new Error("403 Forbidden: cette tâche ne t’est pas attribuée");
      }
      const assigneeRes = await supabase
        .from("trip_participants")
        .select("id, user_id, status")
        .eq("id", task.assigned_participant_id)
        .eq("trip_id", task.trip_id)
        .maybeSingle();
      if (assigneeRes.error) throw assigneeRes.error;
      if (
        !assigneeRes.data ||
        assigneeRes.data.user_id !== userId ||
        assigneeRes.data.status === "absent" ||
        assigneeRes.data.status === "refuse"
      ) {
        throw new Error("403 Forbidden: tu peux modifier uniquement tes tâches attribuées");
      }
    }

    const updateRes = await supabase
      .from("trip_tasks" as any)
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.taskId)
      .select("id")
      .maybeSingle();
    if (updateRes.error) throw updateRes.error;
    if (!updateRes.data) throw new Error("Mise à jour de la tâche refusée");
    return { ok: true };
  });

export const reassignTaskSecure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ taskId: z.string().uuid(), participantId: z.string().uuid().nullable() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const taskRes = await supabase
      .from("trip_tasks" as any)
      .select("id, trip_id")
      .eq("id", data.taskId)
      .maybeSingle();
    if (taskRes.error) throw taskRes.error;
    if (!taskRes.data) throw new Error("Tâche introuvable");
    const task = taskRes.data as any;

    const tripRes = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id")
      .eq("id", task.trip_id)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data || !isTripAdmin(tripRes.data, userId)) {
      throw new Error("403 Forbidden: seul l’organisateur ou co-organisateur peut réassigner une tâche");
    }

    if (data.participantId) {
      const participantRes = await supabase
        .from("trip_participants")
        .select("id, trip_id, user_id, status")
        .eq("id", data.participantId)
        .maybeSingle();
      if (participantRes.error) throw participantRes.error;
      if (!participantRes.data) throw new Error("Participant introuvable");
      if (participantRes.data.trip_id !== task.trip_id) {
        throw new Error("Le participant n’appartient pas à ce voyage");
      }
      if (!participantRes.data.user_id) {
        throw new Error("Impossible d’assigner une tâche à un emplacement non rejoint");
      }
      if (participantRes.data.status === "absent" || participantRes.data.status === "refuse") {
        throw new Error("Impossible d’assigner une tâche à un participant qui ne participe plus");
      }
    }

    const updateRes = await supabase
      .from("trip_tasks" as any)
      .update({
        assigned_participant_id: data.participantId,
        is_manually_assigned: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.taskId)
      .select("id")
      .maybeSingle();
    if (updateRes.error) throw updateRes.error;
    if (!updateRes.data) throw new Error("Réattribution de la tâche refusée");
    return { ok: true };
  });

export const sanitizeTaskAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tripRes = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data || !isTripAdmin(tripRes.data, userId)) {
      throw new Error("403 Forbidden: seul l’organisateur ou co-organisateur peut préparer les tâches");
    }

    const [tasksRes, participantsRes] = await Promise.all([
      supabase
        .from("trip_tasks" as any)
        .select("id, assigned_participant_id")
        .eq("trip_id", data.tripId),
      supabase
        .from("trip_participants")
        .select("id, user_id, status")
        .eq("trip_id", data.tripId),
    ]);
    if (tasksRes.error) throw tasksRes.error;
    if (participantsRes.error) throw participantsRes.error;

    const validAssigneeIds = new Set(
      (participantsRes.data ?? [])
        .filter(
          (participant: any) =>
            Boolean(participant.user_id) &&
            participant.status !== "absent" &&
            participant.status !== "refuse",
        )
        .map((participant: any) => participant.id),
    );
    const invalidTaskIds = (tasksRes.data ?? [])
      .filter(
        (task: any) =>
          Boolean(task.assigned_participant_id) && !validAssigneeIds.has(task.assigned_participant_id),
      )
      .map((task: any) => task.id);

    if (invalidTaskIds.length) {
      const updateRes = await supabase
        .from("trip_tasks" as any)
        .update({ assigned_participant_id: null, updated_at: new Date().toISOString() })
        .in("id", invalidTaskIds);
      if (updateRes.error) throw updateRes.error;
    }

    return { ok: true, sanitized: invalidTaskIds.length };
  });
