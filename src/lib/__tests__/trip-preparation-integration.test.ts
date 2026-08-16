import { describe, expect, it } from "vitest";
import { getAssignablePackingParticipants } from "@/components/krew/PackingListCard";
import { buildTripPreparation, isFinalTripPreparationReady } from "../krew/packing-list";
import { mergeGeneratedPreparationTasks } from "../trips.functions";

describe("intégration de la préparation du voyage", () => {
  it("génère courses et tâche pour une maison avec dîner, mais pas pour un hôtel", () => {
    const activities = ["Dîner au logement"];
    const house = buildTripPreparation({ accommodation: "villa entière", activities });
    const hotel = buildTripPreparation({ accommodation: "hôtel", activities });
    expect(house.groceries.some((item) => item.id === "dinner_ingredients")).toBe(true);
    expect(house.tasks.some((task) => task.id === "do_groceries")).toBe(true);
    expect(hotel.groceries).toHaveLength(0);
    expect(hotel.tasks.some((task) => task.id === "do_groceries")).toBe(false);
  });

  it("ne considère pas un vote comme une validation d'activité", () => {
    expect(
      isFinalTripPreparationReady({
        destinationSelected: true,
        hasItinerary: true,
        selectedActivityIds: [],
      }),
    ).toBe(false);
    expect(
      isFinalTripPreparationReady({
        destinationSelected: true,
        hasItinerary: true,
        selectedActivityIds: ["activity-1"],
      }),
    ).toBe(true);
  });

  it("réutilise une tâche de préparation existante au lieu de la dupliquer", () => {
    const rows = mergeGeneratedPreparationTasks({
      tripId: "trip-1",
      generatedTasks: [{ id: "do_groceries", label: "Faire les courses" }],
      existingTasks: [
        {
          id: "task-1",
          slot_id: "prep:do_groceries",
          status: "in_progress",
          assigned_participant_id: "p1",
          is_manually_assigned: true,
        },
      ],
      assigneeIds: ["p2"],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "task-1",
      slot_id: "prep:do_groceries",
      status: "in_progress",
      assigned_participant_id: "p1",
    });
    expect(
      mergeGeneratedPreparationTasks({
        tripId: "trip-1",
        generatedTasks: [{ id: "book_restaurant", label: "Réserver le restaurant" }],
        existingTasks: [
          { id: "resto-1", slot_id: "1-0", title: "Réserver le restaurant : Chez KREW" },
        ],
      }),
    ).toHaveLength(0);
  });

  it("exclut seulement la Star virtuelle des responsables proposés", () => {
    expect(getAssignablePackingParticipants([{ id: "p1" }, { id: "star-virtual-id" }])).toEqual([
      { id: "p1" },
    ]);
  });
});
