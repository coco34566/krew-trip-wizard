import { describe, expect, it } from "vitest";

describe("Synchronisation et persistance des tâches (Test 16 fix)", () => {
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
});
