import { describe, expect, it } from "vitest";
import { generateTasksForTripHelper } from "../trips.functions";

describe("generateTasksForTripHelper", () => {
  it("generates tasks for 3-day itinerary (9 slots), ensures idempotency, and cleans orphan tasks", async () => {
    // 1. Mock trip data with 3 days, 9 valid slots ("resto", "activite", "bar")
    const mockTrip = {
      id: "ed6a82bf-61c6-484c-a720-2421c956909f",
      group_itinerary: {
        days: [
          {
            day: 1,
            date: "2025-08-11",
            slots: [
              { type: "resto", label: "Petit Déjeuner Café", time: "09:00", priceHint: 15 },
              { type: "resto", label: "Déjeuner Bistro", time: "12:30", priceHint: 25 },
              { type: "activite", label: "Visite Musée", time: "15:00", priceHint: 20 },
              { type: "bar", label: "Cocktails Rooftop", time: "21:00", priceHint: 30 },
            ],
          },
          {
            day: 2,
            date: "2025-08-12",
            slots: [
              { type: "activite", label: "Balade Parc", time: "10:00", priceHint: 0 },
              { type: "resto", label: "Brasserie", time: "13:00", priceHint: 30 },
              { type: "bar", label: "Bar à Vins", time: "20:00", priceHint: 25 },
            ],
          },
          {
            day: 3,
            date: "2025-08-13",
            slots: [
              { type: "resto", label: "Brunch", time: "11:00", priceHint: 35 },
              { type: "activite", label: "Shopping / Souvenirs", time: "14:30", priceHint: 10 },
            ],
          },
        ],
      },
      celebrated_person: "Julie",
      has_star: true,
      star_user_id: "star-uid-123",
    };

    const mockParticipants = [
      {
        id: "9874330c-254c-4dd1-be52-5001258fe7c9",
        user_id: "3d9c5890-32e8-4469-8135-d9004c97d994",
        email: "participant@example.com",
        display_name: "Participant Test",
        status: "accepte",
      },
    ];

    let storedTasks: any[] = [];

    // Create a chainable mock Supabase client
    const createMockSupabase = () => {
      const client: any = {
        from: (table: string) => {
          if (table === "trips") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: mockTrip, error: null }),
                }),
              }),
            };
          }
          if (table === "trip_participants") {
            return {
              select: () => ({
                eq: async () => ({ data: mockParticipants, error: null }),
              }),
            };
          }
          if (table === "trip_tasks") {
            return {
              select: () => ({
                eq: async () => ({ data: storedTasks, error: null }),
              }),
              upsert: async (tasks: any[], options?: any) => {
                // Simulate database upsert using (trip_id, slot_id)
                for (const task of tasks) {
                  const idx = storedTasks.findIndex(
                    (t) => t.trip_id === task.trip_id && t.slot_id === task.slot_id
                  );
                  if (idx >= 0) {
                    storedTasks[idx] = { ...storedTasks[idx], ...task };
                  } else {
                    storedTasks.push({
                      id: task.id || `task-uuid-${task.slot_id}`,
                      ...task,
                    });
                  }
                }
                return { data: storedTasks, error: null };
              },
              delete: () => {
                let tripIdFilter: string | null = null;
                const deleteChain = {
                  eq: (col: string, val: string) => {
                    if (col === "trip_id") tripIdFilter = val;
                    return deleteChain;
                  },
                  not: async (col: string, op: string, inClause: string) => {
                    // inClause is formatted like "(1-0,1-1,...)"
                    const activeIds = inClause
                      .replace(/^\(/, "")
                      .replace(/\)$/, "")
                      .split(",");
                    storedTasks = storedTasks.filter(
                      (t) => t.trip_id !== tripIdFilter || activeIds.includes(t.slot_id)
                    );
                    return { error: null };
                  },
                  then: (resolve: any) => {
                    // If delete is called without .not() (total cleanup)
                    storedTasks = storedTasks.filter((t) => t.trip_id !== tripIdFilter);
                    return resolve({ error: null });
                  },
                };
                return deleteChain;
              },
            };
          }
          return {};
        },
      };
      return client;
    };

    const mockSupabase = createMockSupabase();

    // 2. Execute task generation helper first time
    const res1 = await generateTasksForTripHelper(
      mockSupabase,
      "ed6a82bf-61c6-484c-a720-2421c956909f",
    );

    expect(res1.ok).toBe(true);
    expect(res1.count).toBe(9);
    expect(storedTasks.length).toBe(9);

    const expectedSlotIds = [
      "1-0", "1-1", "1-2", "1-3",
      "2-0", "2-1", "2-2",
      "3-0", "3-1",
    ];
    const createdSlotIds = storedTasks.map((t) => t.slot_id).sort();
    expect(createdSlotIds).toEqual(expectedSlotIds.sort());

    // 3. Test idempotency: Execute task generation a second time
    const res2 = await generateTasksForTripHelper(
      mockSupabase,
      "ed6a82bf-61c6-484c-a720-2421c956909f",
    );

    expect(res2.ok).toBe(true);
    expect(res2.count).toBe(9);
    expect(storedTasks.length).toBe(9); // Still exactly 9 tasks, no duplicate tasks created

    // 4. Test orphan task cleanup when an itinerary slot is removed
    // Remove slot 3-1 from day 3
    mockTrip.group_itinerary.days[2]!.slots.pop();

    const res3 = await generateTasksForTripHelper(
      mockSupabase,
      "ed6a82bf-61c6-484c-a720-2421c956909f",
    );

    expect(res3.ok).toBe(true);
    expect(res3.count).toBe(8);
    expect(storedTasks.length).toBe(8);
    expect(storedTasks.find((t) => t.slot_id === "3-1")).toBeUndefined();
  });
});
