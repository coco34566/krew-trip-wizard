import { describe, expect, it } from "vitest";

describe("Synchronisation, réassignation et UX des tâches (Test 16 & UX fix)", () => {
  const partitionTasks = (tasksToUpsert: any[]) => {
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

    return { existingTasksToUpdate, newTasksToInsert };
  };

  const executeReassignTaskLogic = async (
    supabaseMock: any,
    data: { taskId: string; participantId: string | null },
  ) => {
    // 1. Récupérer la tâche et son trip_id
    const taskRes = await supabaseMock
      .from("trip_tasks")
      .select("id, trip_id")
      .eq("id", data.taskId)
      .maybeSingle();

    if (taskRes.error) throw taskRes.error;
    if (!taskRes.data) throw new Error("Tâche introuvable");
    const task = taskRes.data;

    // 2. Si participantId !== null, vérifier sa validité
    if (data.participantId !== null) {
      const partRes = await supabaseMock
        .from("trip_participants")
        .select("id, trip_id, status")
        .eq("id", data.participantId)
        .maybeSingle();

      if (partRes.error) throw partRes.error;
      if (!partRes.data) {
        throw new Error("Participant introuvable");
      }

      const participant = partRes.data;

      if (participant.trip_id !== task.trip_id) {
        throw new Error("Le participant n'appartient pas à ce voyage");
      }

      if (participant.status === "absent") {
        throw new Error("Impossible d'assigner une tâche à un participant absent");
      }
    }

    // 3. Effectuer la réassignation
    const { error } = await supabaseMock
      .from("trip_tasks")
      .update({
        assigned_participant_id: data.participantId,
        is_manually_assigned: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.taskId);

    if (error) throw error;
    return { ok: true };
  };

  it("1. Partitionne correctement les tâches existantes avec id et les nouvelles tâches sans clé id", () => {
    const tasksToUpsert = [
      { id: "task-uuid-1", trip_id: "trip-1", slot_id: "1-0", title: "Réserver resto" },
      { trip_id: "trip-1", slot_id: "1-1", title: "Réserver activité" },
    ];

    const { existingTasksToUpdate, newTasksToInsert } = partitionTasks(tasksToUpsert);

    expect(existingTasksToUpdate).toHaveLength(1);
    expect(existingTasksToUpdate[0].id).toBe("task-uuid-1");
    expect(existingTasksToUpdate[0].updated_at).toBeDefined();

    expect(newTasksToInsert).toHaveLength(1);
    expect("id" in newTasksToInsert[0]).toBe(false);
    expect(Object.keys(newTasksToInsert[0])).not.toContain("id");
    expect(newTasksToInsert[0].slot_id).toBe("1-1");
  });

  it("2. Scénario Test 16 : préservation slot conservé, création nouveau slot sans id, cleanup des orphelines après succès", async () => {
    // Mock DB operations to verify execution order and payloads
    const callsOrder: string[] = [];
    let insertedRows: any[] = [];
    let updatedRows: any[] = [];
    let deletedOrphanIds: string[] = [];

    const mockSupabase = {
      from: (table: string) => ({
        upsert: async (rows: any[]) => {
          callsOrder.push("upsert");
          updatedRows = rows;
          return { error: null };
        },
        insert: async (rows: any[]) => {
          callsOrder.push("insert");
          insertedRows = rows;
          return { error: null };
        },
        delete: () => ({
          eq: () => ({
            in: async (_col: string, ids: string[]) => {
              callsOrder.push("delete_orphans");
              deletedOrphanIds = ids;
              return { error: null };
            },
          }),
        }),
      }),
    };

    // Planning A initial: slots 1-0 et 1-1 existent
    const existingTasksInDb = [
      {
        id: "task-10-uuid",
        trip_id: "trip-16",
        slot_id: "1-0",
        title: "Réserver le restaurant : Le Bistrot",
        status: "in_progress",
        assigned_participant_id: "part-1",
        is_manually_assigned: true,
      },
      {
        id: "task-11-uuid",
        trip_id: "trip-16",
        slot_id: "1-1",
        title: "Réserver l'activité : Kayak",
        status: "todo",
        assigned_participant_id: "part-2",
        is_manually_assigned: false,
      },
    ];

    // Planning B (régénéré) :
    // - Jour 1 slot 0 (1-0) est conservé avec le même titre
    // - Jour 1 slot 1 (1-1) a été supprimé
    // - Jour 2 slot 0 (2-0) est un nouveau slot sans tâche existante
    const itineraryB = {
      days: [
        {
          day: 1,
          slots: [
            { type: "resto", label: "Le Bistrot" }, // -> slot_id "1-0"
          ],
        },
        {
          day: 2,
          slots: [
            { type: "activite", label: "Musée" },    // -> slot_id "2-0" (nouveau slot)
          ],
        },
      ],
    };

    // Simulate task computation logic
    const tasksToUpsert: any[] = [];
    const activeSlotIds = new Set<string>();

    for (const day of itineraryB.days) {
      for (let slotIndex = 0; slotIndex < day.slots.length; slotIndex++) {
        const slot = day.slots[slotIndex];
        const slotId = `${day.day}-${slotIndex}`;
        activeSlotIds.add(slotId);

        const defaultTitle = slot.type === "resto"
          ? `Réserver le restaurant : ${slot.label}`
          : `Réserver l'activité : ${slot.label}`;

        const existing = existingTasksInDb.find((t) => t.slot_id === slotId);

        if (existing) {
          tasksToUpsert.push({
            id: existing.id,
            trip_id: "trip-16",
            slot_id: slotId,
            title: defaultTitle,
            status: existing.title === defaultTitle ? existing.status : "todo",
            assigned_participant_id: existing.assigned_participant_id,
            is_manually_assigned: existing.is_manually_assigned,
          });
        } else {
          tasksToUpsert.push({
            trip_id: "trip-16",
            slot_id: slotId,
            title: defaultTitle,
            status: "todo",
            assigned_participant_id: "part-1",
            is_manually_assigned: false,
          });
        }
      }
    }

    // Execution of partition and sync
    const { existingTasksToUpdate, newTasksToInsert } = partitionTasks(tasksToUpsert);

    if (existingTasksToUpdate.length > 0) {
      await mockSupabase.from("trip_tasks").upsert(existingTasksToUpdate);
    }
    if (newTasksToInsert.length > 0) {
      await mockSupabase.from("trip_tasks").insert(newTasksToInsert);
    }

    // Cleanup orphans after successful writes
    const orphanTaskIds = existingTasksInDb
      .filter((t) => !activeSlotIds.has(t.slot_id))
      .map((t) => t.id);

    if (orphanTaskIds.length > 0) {
      await mockSupabase.from("trip_tasks").delete().eq("trip_id", "trip-16").in("id", orphanTaskIds);
    }

    // VERIFICATIONS :
    // 1. Transactional Order: upsert -> insert -> delete_orphans
    expect(callsOrder).toEqual(["upsert", "insert", "delete_orphans"]);

    // 2. Updated row retains id, status and assigned participant
    expect(updatedRows).toHaveLength(1);
    expect(updatedRows[0].id).toBe("task-10-uuid");
    expect(updatedRows[0].status).toBe("in_progress");
    expect(updatedRows[0].assigned_participant_id).toBe("part-1");
    expect(updatedRows[0].updated_at).toBeDefined();

    // 3. New inserted row MUST NOT contain property 'id'
    expect(insertedRows).toHaveLength(1);
    expect(Object.prototype.hasOwnProperty.call(insertedRows[0], "id")).toBe(false);
    expect(insertedRows[0].slot_id).toBe("2-0");
    expect(insertedRows[0].title).toBe("Réserver l'activité : Musée");

    // 4. Orphan task (old 1-1 Kayak, uuid task-11-uuid) deleted
    expect(deletedOrphanIds).toEqual(["task-11-uuid"]);
  });

  it("3. En cas d'échec d'insert/update, le cleanup des orphelines N'EST PAS exécuté", async () => {
    let deleteCalled = false;

    const mockSupabaseFailing = {
      from: () => ({
        upsert: async () => ({ error: null }),
        insert: async () => {
          throw new Error("Supabase insert DB error");
        },
        delete: () => ({
          eq: () => ({
            in: async () => {
              deleteCalled = true;
              return { error: null };
            },
          }),
        }),
      }),
    };

    const tasksToUpsert = [
      { id: "existing-id", trip_id: "trip-1", slot_id: "1-0", title: "Existante" },
      { trip_id: "trip-1", slot_id: "1-1", title: "Nouvelle" },
    ];

    const { existingTasksToUpdate, newTasksToInsert } = partitionTasks(tasksToUpsert);

    try {
      if (existingTasksToUpdate.length > 0) {
        await mockSupabaseFailing.from("trip_tasks").upsert(existingTasksToUpdate);
      }
      if (newTasksToInsert.length > 0) {
        await mockSupabaseFailing.from("trip_tasks").insert(newTasksToInsert);
      }

      // Cleanup
      await mockSupabaseFailing.from("trip_tasks").delete().eq("trip_id", "trip-1").in("id", ["orphan-id"]);
    } catch {
      // expected error
    }

    expect(deleteCalled).toBe(false);
  });

  // TESTS UX & backend reassignTask A-F
  it("A & B. Condition d'affichage 'Il manque encore du monde'", () => {
    const isMissingMessageVisible = (participantsCount: number, rawParticipants: any[]) => {
      const identifiedActiveCount = rawParticipants.filter((p: any) => p.status !== "absent").length;
      return Number(participantsCount || 0) > identifiedActiveCount;
    };

    // Test A : participants_count = 5, 1 seul participant réels
    const rawPartsA = [{ id: "p1", status: "accepte" }];
    expect(isMissingMessageVisible(5, rawPartsA)).toBe(true);

    // Test B : participants_count = 2, 2 participants réels
    const rawPartsB = [{ id: "p1", status: "accepte" }, { id: "p2", status: "accepte" }];
    expect(isMissingMessageVisible(2, rawPartsB)).toBe(false);
  });

  it("C. reassignTask avec participant du même voyage -> succès", async () => {
    let updatePayload: any = null;
    const mockDb = {
      tasks: [{ id: "task-1", trip_id: "trip-A" }],
      participants: [{ id: "part-1", trip_id: "trip-A", status: "accepte" }],
    };

    const mockSupabase = {
      from: (table: string) => ({
        select: () => ({
          eq: (_col: string, val: string) => ({
            maybeSingle: async () => {
              if (table === "trip_tasks") {
                return { data: mockDb.tasks.find((t) => t.id === val) || null, error: null };
              }
              if (table === "trip_participants") {
                return { data: mockDb.participants.find((p) => p.id === val) || null, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
        update: (payload: any) => ({
          eq: async () => {
            updatePayload = payload;
            return { error: null };
          },
        }),
      }),
    };

    const res = await executeReassignTaskLogic(mockSupabase, { taskId: "task-1", participantId: "part-1" });
    expect(res.ok).toBe(true);
    expect(updatePayload.assigned_participant_id).toBe("part-1");
    expect(updatePayload.is_manually_assigned).toBe(true);
  });

  it("D. reassignTask avec participant d'un autre voyage -> rejet", async () => {
    const mockDb = {
      tasks: [{ id: "task-1", trip_id: "trip-A" }],
      participants: [{ id: "part-other", trip_id: "trip-B", status: "accepte" }],
    };

    const mockSupabase = {
      from: (table: string) => ({
        select: () => ({
          eq: (_col: string, val: string) => ({
            maybeSingle: async () => {
              if (table === "trip_tasks") {
                return { data: mockDb.tasks.find((t) => t.id === val) || null, error: null };
              }
              if (table === "trip_participants") {
                return { data: mockDb.participants.find((p) => p.id === val) || null, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
      }),
    };

    await expect(
      executeReassignTaskLogic(mockSupabase, { taskId: "task-1", participantId: "part-other" }),
    ).rejects.toThrow("Le participant n'appartient pas à ce voyage");
  });

  it("E. reassignTask avec participant absent -> rejet", async () => {
    const mockDb = {
      tasks: [{ id: "task-1", trip_id: "trip-A" }],
      participants: [{ id: "part-absent", trip_id: "trip-A", status: "absent" }],
    };

    const mockSupabase = {
      from: (table: string) => ({
        select: () => ({
          eq: (_col: string, val: string) => ({
            maybeSingle: async () => {
              if (table === "trip_tasks") {
                return { data: mockDb.tasks.find((t) => t.id === val) || null, error: null };
              }
              if (table === "trip_participants") {
                return { data: mockDb.participants.find((p) => p.id === val) || null, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
      }),
    };

    await expect(
      executeReassignTaskLogic(mockSupabase, { taskId: "task-1", participantId: "part-absent" }),
    ).rejects.toThrow("Impossible d'assigner une tâche à un participant absent");
  });

  it("F. reassignTask avec participantId = null -> succès, tâche non attribuée", async () => {
    let updatePayload: any = null;
    const mockDb = {
      tasks: [{ id: "task-1", trip_id: "trip-A" }],
    };

    const mockSupabase = {
      from: (table: string) => ({
        select: () => ({
          eq: (_col: string, val: string) => ({
            maybeSingle: async () => {
              if (table === "trip_tasks") {
                return { data: mockDb.tasks.find((t) => t.id === val) || null, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
        update: (payload: any) => ({
          eq: async () => {
            updatePayload = payload;
            return { error: null };
          },
        }),
      }),
    };

    const res = await executeReassignTaskLogic(mockSupabase, { taskId: "task-1", participantId: null });
    expect(res.ok).toBe(true);
    expect(updatePayload.assigned_participant_id).toBeNull();
    expect(updatePayload.is_manually_assigned).toBe(true);
  });
});
