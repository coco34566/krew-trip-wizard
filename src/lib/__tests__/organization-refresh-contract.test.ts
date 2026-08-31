import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getOrganizationRefreshState,
  maskStaleOrganizationDataForDashboard,
} from "../krew/organization-refresh";

describe("organization refresh state", () => {
  it("keeps each stale section independent so refreshed items can disappear one by one", () => {
    const logistics = {
      hotels: [{ id: "old-hotel" }],
      transports: [{ id: "old-transport" }],
      organizationRefresh: {
        changedAt: "2026-08-31T10:00:00Z",
        sections: {
          accommodation: {
            stale: true,
            reasons: ["dates"],
            invalidatedAt: "2026-08-31T10:00:00Z",
          },
          transport: {
            stale: true,
            reasons: ["dates"],
            invalidatedAt: "2026-08-31T10:00:00Z",
          },
          itinerary: {
            stale: true,
            reasons: ["dates"],
            invalidatedAt: "2026-08-31T10:00:00Z",
          },
          tasks: {
            stale: true,
            reasons: ["dates"],
            invalidatedAt: "2026-08-31T10:00:00Z",
          },
        },
      },
    };

    expect(getOrganizationRefreshState(logistics)?.items.map((item) => item.section)).toEqual([
      "accommodation",
      "transport",
      "itinerary",
      "tasks",
    ]);

    const accommodationRefreshed = structuredClone(logistics);
    delete (accommodationRefreshed.organizationRefresh.sections as any).accommodation;

    expect(
      getOrganizationRefreshState(accommodationRefreshed)?.items.map((item) => item.section),
    ).toEqual(["transport", "itinerary", "tasks"]);
  });

  it("masks stale content only from dashboard readiness while preserving the source object", () => {
    const trip = {
      group_itinerary: { days: [{ day: 1 }] },
      group_logistics: {
        hotels: [{ id: "old-hotel" }],
        transports: [{ id: "old-transport" }],
        transportPicks: [{ userId: "u1", mode: "train" }],
        organizationRefresh: {
          sections: {
            accommodation: { stale: true, reasons: ["destination"] },
            transport: { stale: true, reasons: ["destination"] },
            itinerary: { stale: true, reasons: ["destination"] },
          },
        },
      },
    };

    const masked = maskStaleOrganizationDataForDashboard(trip);

    expect((masked.group_logistics as any).hotels).toEqual([]);
    expect((masked.group_logistics as any).transports).toEqual([]);
    expect((masked.group_logistics as any).transportPicks).toEqual([
      { userId: "u1", mode: "train" },
    ]);
    expect(masked.group_itinerary).toBeNull();

    expect(trip.group_logistics.hotels).toEqual([{ id: "old-hotel" }]);
    expect(trip.group_itinerary).toEqual({ days: [{ day: 1 }] });
  });

  it("wires date/destination invalidation without any automatic generation", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260831121500_organization_refresh_state.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("before update of start_date, end_date, dates_locked");
    expect(migration).toContain("after insert or update of is_selected, destination_id");
    expect(migration).toContain("'accommodation', 'transport', 'itinerary', 'tasks'");
    expect(migration).toContain("'dates'");
    expect(migration).toContain("'destination'");
    expect(migration).toContain("old.group_logistics -> 'transportsGeneratedAt'");
    expect(migration).toContain("old.group_itinerary is distinct from new.group_itinerary");

    expect(migration).not.toMatch(/generateGroupItinerary|proposeStayAndTransport|generateTasksForTrip|Gemini|gemini/i);
  });
});
