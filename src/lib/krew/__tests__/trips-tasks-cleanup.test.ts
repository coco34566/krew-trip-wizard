import { describe, expect, it, vi } from "vitest";

describe("Cleanup trip_tasks par IDs DB réels", () => {
  const executeCleanupLogic = (input: {
    tripId: string;
    existingTasks: any[];
    activeSlotIds: Set<string>;
  }) => {
    const orphanTaskIds = input.existingTasks
      .filter((task: any) => {
        const slotId = String(task.slot_id ?? "");
        return slotId && !input.activeSlotIds.has(slotId);
      })
      .map((task: any) => task.id)
      .filter(Boolean);

    let deleteCalled = false;
    let deletedIds: string[] = [];

    if (orphanTaskIds.length > 0) {
      deleteCalled = true;
      deletedIds = orphanTaskIds;
    }

    return { deleteCalled, deletedIds };
  };

  it("1. activeSlotIds contient 2-1 et prep:prepare_game -> ces tâches ne sont PAS supprimées", () => {
    const activeSlotIds = new Set(["2-1", "prep:prepare_game"]);
    const existingTasks = [
      { id: "t1", trip_id: "trip-A", slot_id: "2-1" },
      { id: "t2", trip_id: "trip-A", slot_id: "prep:prepare_game" },
    ];

    const res = executeCleanupLogic({ tripId: "trip-A", existingTasks, activeSlotIds });

    expect(res.deleteCalled).toBe(false);
    expect(res.deletedIds).toHaveLength(0);
  });

  it("2. une troisième tâche absente de activeSlotIds -> seule celle-ci est supprimée", () => {
    const activeSlotIds = new Set(["2-1", "prep:prepare_game"]);
    const existingTasks = [
      { id: "t1", trip_id: "trip-A", slot_id: "2-1" },
      { id: "t2", trip_id: "trip-A", slot_id: "prep:prepare_game" },
      { id: "t3-orphan", trip_id: "trip-A", slot_id: "3-0" },
    ];

    const res = executeCleanupLogic({ tripId: "trip-A", existingTasks, activeSlotIds });

    expect(res.deleteCalled).toBe(true);
    expect(res.deletedIds).toEqual(["t3-orphan"]);
  });

  it("3. aucun orphan -> aucune requête delete", () => {
    const activeSlotIds = new Set(["1-0"]);
    const existingTasks = [{ id: "t1", trip_id: "trip-A", slot_id: "1-0" }];

    const res = executeCleanupLogic({ tripId: "trip-A", existingTasks, activeSlotIds });

    expect(res.deleteCalled).toBe(false);
    expect(res.deletedIds).toHaveLength(0);
  });

  it("4. deux voyages ont le même slot_id -> cleanup du voyage A ne touche jamais le voyage B", () => {
    const activeSlotIds = new Set(["1-0"]);
    const existingTasksTripA = [{ id: "t-tripA", trip_id: "trip-A", slot_id: "1-0" }];
    const existingTasksTripB = [{ id: "t-tripB", trip_id: "trip-B", slot_id: "1-0" }];

    const resA = executeCleanupLogic({ tripId: "trip-A", existingTasks: existingTasksTripA, activeSlotIds });

    expect(resA.deleteCalled).toBe(false);
    expect(resA.deletedIds).not.toContain("t-tripB");
  });

  it("5. activeSlotIds vide -> suppression sûre via IDs DB des tâches existantes du voyage courant, sans NOT IN ()", () => {
    const activeSlotIds = new Set<string>();
    const existingTasks = [
      { id: "t1", trip_id: "trip-A", slot_id: "1-0" },
      { id: "t2", trip_id: "trip-A", slot_id: "prep:game" },
    ];

    const res = executeCleanupLogic({ tripId: "trip-A", existingTasks, activeSlotIds });

    expect(res.deleteCalled).toBe(true);
    expect(res.deletedIds).toEqual(["t1", "t2"]);
  });
});
