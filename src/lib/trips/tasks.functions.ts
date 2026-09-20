import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeExternalUrl } from "@/lib/safe-url";
import { buildTripPreparation } from "@/lib/krew/packing-list";
import { isTripAdmin } from "@/lib/krew/engine";

export function mergeGeneratedPreparationTasks(input: {
  tripId: string;
  generatedTasks: { id: string; label: string }[];
  existingTasks: any[];
  assigneeIds?: string[];
}) {
  let assigneeIndex = 0;
  return input.generatedTasks.flatMap((generatedTask) => {
    const slotId = `prep:${generatedTask.id}`;
    const existing = input.existingTasks.find((task) => task.slot_id === slotId);
    const normalizedLabel = generatedTask.label.trim().toLocaleLowerCase("fr");
    const equivalentExisting = input.existingTasks.some((task) => {
      if (task.slot_id === slotId) return false;
      const title = String(task.title || "")
        .trim()
        .toLocaleLowerCase("fr");
      return title === normalizedLabel || title.startsWith(`${normalizedLabel} :`);
    });
    if (!existing && equivalentExisting) return [];
    const assignedId =
      existing?.assigned_participant_id ??
      (input.assigneeIds?.length
        ? input.assigneeIds[assigneeIndex++ % input.assigneeIds.length]
        : null);
    return [
      {
        ...(existing?.id ? { id: existing.id } : {}),
        trip_id: input.tripId,
        slot_id: slotId,
        title: generatedTask.label,
        type: "preparation",
        assigned_participant_id: assignedId,
        status: existing?.status ?? "todo",
        booking_url: null,
        start_time: null,
        day_date: null,
        price: null,
        is_manually_assigned: existing?.is_manually_assigned ?? false,
      },
    ];
  });
}

export const generateTasksForTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Fetch trip and its itinerary
    const tripRes = await supabase
      .from("trips")
      .select(
        "owner_id, co_organizer_id, group_itinerary, group_logistics, event_type, celebrated_person, has_star, star_user_id",
      )
      .eq("id", data.tripId)
      .maybeSingle();

    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    if (!isTripAdmin(tripRes.data, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut préparer les tâches",
      );
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const itinerary = (tripRes.data as any).group_itinerary;
    if (!itinerary || !Array.isArray(itinerary.days)) {
      return {
        ok: false,
        message: "Aucun planning généré pour ce voyage. Veuillez générer le planning d'abord.",
      };
    }

    // 2. Fetch all active participants
    const partsRes = await supabase
      .from("trip_participants")
      .select("id, user_id, email, display_name, status")
      .eq("trip_id", data.tripId);

    if (partsRes.error) throw partsRes.error;
    const participants = partsRes.data ?? [];

    // Identify the star to exclude her from automatic assignment
    const celebratedPerson = tripRes.data.celebrated_person;
    const starUid = tripRes.data.star_user_id || "star-virtual-uid";

    const assignable = participants.filter((p) => {
      if ((p.status as string) === "absent") return false;
      const isStarByUid = Boolean(p.user_id && starUid && p.user_id === starUid);
      return !isStarByUid;
    });

    // 3. Fetch existing tasks
    const tasksRes = await supabase
      .from("trip_tasks" as any)
      .select("*")
      .eq("trip_id", data.tripId);

    const existingTasks = (tasksRes.error ? [] : (tasksRes.data ?? [])) as any[];

    // Helper to resolve task type and default title from a slot
    const getTaskSlotInfo = (slot: any): { taskType: "resto" | "activite" | "bar"; defaultTitle: string } | null => {
      if (!slot || typeof slot !== "object") return null;

      const rawType = String(slot.type || "").trim().toLowerCase();
      const rawCategory = String(slot.category || "").trim().toLowerCase();
      const rawVenue = String(slot.venueFamily || "").trim().toLowerCase();
      const rawKind = String(slot.kind || "").trim().toLowerCase();
      const label = String(slot.label || "").trim();

      if (!label) return null;

      let taskType: "resto" | "activite" | "bar" | null = null;

      if (rawType === "resto" || rawCategory === "repas" || rawVenue === "restaurant" || rawVenue === "cafe") {
        taskType = "resto";
      } else if (rawType === "bar" || rawCategory === "soiree" || rawVenue === "bar_pub") {
        taskType = "bar";
      } else if (
        rawType === "activite" ||
        rawKind === "place_required" ||
        ["culture", "sport_outdoor", "detente", "shopping", "local_experience"].includes(rawCategory)
      ) {
        taskType = "activite";
      }

      if (!taskType) return null;

      let defaultTitle = "";
      if (taskType === "resto") defaultTitle = `Réserver le restaurant : ${label}`;
      else if (taskType === "activite") defaultTitle = `Réserver l'activité : ${label}`;
      else defaultTitle = `Vérifier / réserver : ${label}`;

      return { taskType, defaultTitle };
    };

    // 4. Generate tasks across all days
    const tasksToUpsert = [];
    let newTaskIndex = 0;

    for (const day of itinerary.days) {
      const slots = day.slots ?? [];
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
        const slot = slots[slotIndex];
        const slotInfo = getTaskSlotInfo(slot);
        if (slotInfo) {
          const slotId = `${day.day}-${slotIndex}`;
          const existing = existingTasks.find((t) => t.slot_id === slotId);

          let assignedId = null;
          let taskStatus = "todo";
          let isManual = false;
          let taskId = undefined;

          if (existing) {
            taskId = existing.id;
            assignedId = existing.assigned_participant_id;
            taskStatus = existing.status;
            isManual = existing.is_manually_assigned;

            // Reset status and manual assignment if the generated title changed
            if (existing.title !== slotInfo.defaultTitle) {
              taskStatus = "todo";
              isManual = false;
            }
          } else {
            if (assignable.length > 0) {
              const p = assignable[newTaskIndex % assignable.length]!;
              assignedId = p.id;
              newTaskIndex++;
            }
          }

          tasksToUpsert.push({
            ...(taskId ? { id: taskId } : {}),
            trip_id: data.tripId,
            slot_id: slotId,
            title: slotInfo.defaultTitle,
            type: slotInfo.taskType,
            assigned_participant_id: assignedId,
            status: taskStatus,
            booking_url: safeExternalUrl(slot.url),
            start_time: slot.time || null,
            day_date: day.date || null,
            price: slot.priceHint != null ? String(slot.priceHint) : null,
            is_manually_assigned: isManual,
          });
        }
      }
    }

    const logistics = ((tripRes.data as any).group_logistics || {}) as any;
    const selectedAccommodation = (logistics.hotels ?? []).find(
      (hotel: any) => hotel.id === logistics.selectedHotelId,
    );
    const planningLabels = itinerary.days.flatMap((day: any) =>
      (day.slots ?? []).map((slot: any) => `${slot.label || ""} ${slot.detail || ""}`.trim()),
    );
    const preparation = buildTripPreparation({
      eventType: (tripRes.data as any).event_type,
      accommodation: selectedAccommodation?.type || logistics.accommodationType || "",
      activities: planningLabels,
    });
    tasksToUpsert.push(
      ...mergeGeneratedPreparationTasks({
        tripId: data.tripId,
        generatedTasks: preparation.tasks,
        existingTasks,
        assigneeIds: assignable.map((participant) => participant.id),
      }),
    );

    const nowIso = new Date().toISOString();
    const existingTasksToUpdate: any[] = [];
    const newTasksToInsert: any[] = [];

    for (const task of tasksToUpsert) {
      if (task.id) {
        existingTasksToUpdate.push({
          ...task,
          updated_at: nowIso,
        });
      } else {
        const { id, ...newTask } = task;
        newTasksToInsert.push(newTask);
      }
    }

    if (existingTasksToUpdate.length > 0) {
      const { error: updateErr } = await supabaseAdmin
        .from("trip_tasks" as any)
        .upsert(existingTasksToUpdate, { onConflict: "trip_id,slot_id" });
      if (updateErr) throw updateErr;
    }

    if (newTasksToInsert.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("trip_tasks" as any)
        .insert(newTasksToInsert);
      if (insertErr) throw insertErr;
    }

    // Clean up orphan tasks that no longer exist in the new itinerary slots
    const activeSlotIds = new Set<string>();
    for (const day of itinerary.days) {
      const slots = day.slots ?? [];
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
        const slot = slots[slotIndex];
        const slotInfo = getTaskSlotInfo(slot);
        if (slotInfo) {
          activeSlotIds.add(`${day.day}-${slotIndex}`);
        }
      }
    }
    for (const task of preparation.tasks) activeSlotIds.add(`prep:${task.id}`);

    const orphanTaskIds = existingTasks
      .filter((task: any) => {
        const slotId = String(task.slot_id ?? "");
        return slotId && !activeSlotIds.has(slotId);
      })
      .map((task: any) => task.id)
      .filter(Boolean);

    if (orphanTaskIds.length > 0) {
      const { error: deleteErr } = await supabaseAdmin
        .from("trip_tasks" as any)
        .delete()
        .eq("trip_id", data.tripId)
        .in("id", orphanTaskIds);
      if (deleteErr) throw deleteErr;
    }

    // Verify actual database persistence of generated tasks
    const { count: persistedCount, error: countErr } = await supabaseAdmin
      .from("trip_tasks" as any)
      .select("id", { count: "exact", head: true })
      .eq("trip_id", data.tripId);

    if (countErr) throw countErr;

    if (tasksToUpsert.length > 0 && (persistedCount == null || persistedCount === 0)) {
      throw new Error(
        `Erreur de persistance des tâches : ${tasksToUpsert.length} tâches calculées mais 0 ligne enregistrée dans trip_tasks.`,
      );
    }

    return { ok: true, count: persistedCount ?? tasksToUpsert.length };
  });

export const updateTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        status: z.enum(["todo", "in_progress", "done"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("trip_tasks" as any)
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.taskId);

    if (error) throw error;
    return { ok: true };
  });

export const reassignTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        participantId: z.string().uuid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Récupérer la tâche et son trip_id
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
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut réassigner une tâche",
      );
    }

    // 2. Si participantId !== null, vérifier sa validité
    if (data.participantId !== null) {
      const partRes = await supabase
        .from("trip_participants")
        .select("id, trip_id, status")
        .eq("id", data.participantId)
        .maybeSingle();

      if (partRes.error) throw partRes.error;
      if (!partRes.data) {
        throw new Error("Participant introuvable");
      }

      const participant = partRes.data as any;

      if (participant.trip_id !== task.trip_id) {
        throw new Error("Le participant n'appartient pas à ce voyage");
      }

      if (participant.status === "absent") {
        throw new Error("Impossible d'assigner une tâche à un participant absent");
      }
    }

    // 3. Effectuer la réassignation
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("trip_tasks" as any)
      .update({
        assigned_participant_id: data.participantId,
        is_manually_assigned: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.taskId);

    if (error) throw error;
    return { ok: true };
  });
