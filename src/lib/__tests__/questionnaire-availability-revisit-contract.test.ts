import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("questionnaire availability revisit contract", () => {
  it("shows saved availability before preferences, including after dates are locked", () => {
    const layout = readFileSync(
      resolve(process.cwd(), "src/routes/_authenticated/trips.$tripId.tsx"),
      "utf8",
    );

    const flowStart = layout.indexOf("function QuestionnaireResponseFlow");
    expect(flowStart).toBeGreaterThanOrEqual(0);
    const flow = layout.slice(flowStart, flowStart + 2600);

    expect(flow).toContain("if (showPreferences) return <>{children}</>;");
    expect(flow).toContain("if (data.trip.datesLocked)");
    expect(flow).toContain("if (!data.mine) return <>{children}</>;");
    expect(flow).toContain("readOnly");

    const questionnaireOutlet = layout.indexOf(
      "showQuestionnairePage ? (",
    );
    const flowWrapper = layout.indexOf(
      "<QuestionnaireResponseFlow tripId={tripId}>",
      questionnaireOutlet,
    );
    const preferencesWrapper = layout.indexOf(
      "<PreferencesResponseGate tripId={tripId}>",
      questionnaireOutlet,
    );
    expect(flowWrapper).toBeGreaterThan(questionnaireOutlet);
    expect(preferencesWrapper).toBeGreaterThan(flowWrapper);
  });

  it("rehydrates saved dates and opens the calendar on the first saved month", () => {
    const availability = readFileSync(
      resolve(process.cwd(), "src/components/krew/ParticipantAvailabilityStep.tsx"),
      "utf8",
    );

    expect(availability).toContain("readOnly?: boolean");
    expect(availability).toContain("const savedDates = [");
    expect(availability).toContain("const firstSavedDate = savedDates[0]");
    expect(availability).toContain("setMonthOffset((year - base.getFullYear()) * 12 + (month - 1 - base.getMonth()))");
    expect(availability).toContain('disabled={readOnly || isPast}');
    expect(availability).toContain("Voir mes préférences");
  });
});
