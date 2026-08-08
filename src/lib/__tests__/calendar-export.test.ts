import { describe, it, expect } from "vitest";
import { buildTripIcs } from "../krew/calendar-export";

describe("Export Calendrier (calendar-export.ts)", () => {
  it("ne génère pas d'export si les dates ne sont pas verrouillées (dates_locked !== true)", () => {
    const trip = {
      name: "Trip Barcelone",
      start_date: "2026-08-01",
      end_date: "2026-08-04",
      dates_locked: false,
    };
    const ics = buildTripIcs(trip);
    expect(ics).toBeNull();
  });

  it("génère un événement all-day couvrant le séjour si aucun GroupItinerary n'existe", () => {
    const trip = {
      name: "Trip Barcelone",
      start_date: "2026-08-01",
      end_date: "2026-08-04",
      dates_locked: true,
    };
    const ics = buildTripIcs(trip);
    expect(ics).not.toBeNull();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Trip Barcelone");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260801");
    // Le lendemain de 2026-08-04 est 2026-08-05 (car DTEND all-day est exclusif)
    expect(ics).toContain("DTEND;VALUE=DATE:20260805");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("génère un événement par ActivitySlot si un GroupItinerary valide existe", () => {
    const trip = {
      id: "trip-uuid",
      name: "Trip Barcelone",
      start_date: "2026-08-01",
      end_date: "2026-08-03",
      dates_locked: true,
    };
    const itinerary = {
      days: [
        {
          day: 1,
          date: "2026-08-01",
          slots: [
            { moment: "Matin", label: "Arrivée Barcelone", detail: "Vol direct" },
            { moment: "Après-midi", label: "Visite Sagrada Familia", detail: "Prendre ticket" },
          ],
        },
        {
          day: 2,
          date: "2026-08-02",
          slots: [
            { moment: "Soirée", label: "Dîner tapas", detail: "Réservé au resto" },
          ],
        },
      ],
    };

    const ics = buildTripIcs(trip, itinerary);
    expect(ics).not.toBeNull();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Arrivée Barcelone");
    expect(ics).toContain("DTSTART:20260801T090000");
    expect(ics).toContain("DTEND:20260801T120000");
    expect(ics).toContain("SUMMARY:Visite Sagrada Familia");
    expect(ics).toContain("DTSTART:20260801T140000");
    expect(ics).toContain("DTEND:20260801T170000");
    expect(ics).toContain("SUMMARY:Dîner tapas");
    expect(ics).toContain("DTSTART:20260802T190000");
    expect(ics).toContain("DTEND:20260802T220000");
    expect(ics).toContain("END:VCALENDAR");
  });
});
