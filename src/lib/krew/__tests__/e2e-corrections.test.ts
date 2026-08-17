import { describe, expect, it } from "vitest";
import { rankDateWindows } from "../availability";
import { buildCostSplit } from "../cost-split";
import { buildWhatsAppUrl } from "../whatsapp";

describe("corrections du parcours E2E", () => {
  it("encode le partage WhatsApp", () => {
    expect(buildWhatsAppUrl("Salut & à bientôt")).toBe(
      "https://wa.me/?text=Salut%20%26%20%C3%A0%20bient%C3%B4t",
    );
  });

  it("préfère la couverture au week-end et le week-end à couverture égale", () => {
    const entries = ["a", "b", "c", "d", "e"].map((userId, index) => ({
      userId,
      availableDates: index === 4
        ? ["2026-09-10", "2026-09-11"]
        : ["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"],
      blockedDates: index === 4 ? ["2026-09-12", "2026-09-13"] : [],
      flexDays: 0,
    }));
    const ranked = rankDateWindows(entries, 1, 10);
    expect(ranked[0]?.start).toBe("2026-09-10");
    expect(ranked.some((window) => window.isWeekend)).toBe(true);

    const tied = rankDateWindows(entries.slice(0, 4), 1, 10);
    expect(tied[0]?.isWeekend).toBe(true);
  });

  it("redistribue exactement la part de la Star sans réduire le total groupe", () => {
    const base = { destinationName: "Lyon", accommodation: 100, activities: 50, food: 50,
      origins: [
        { city: "Star", count: 1, pricePerPerson: 100, isStar: true },
        { city: "A", count: 1, pricePerPerson: 100 },
        { city: "B", count: 1, pricePerPerson: 100 },
      ] };
    const paying = buildCostSplit({ ...base, starPaysShare: true });
    const offered = buildCostSplit({ ...base, starPaysShare: false });
    expect(offered.totalGroup).toBe(paying.totalGroup);
    expect(offered.lines.find((line) => line.isStar)?.totalPerPerson).toBe(0);
    expect(offered.lines.filter((line) => !line.isStar).map((line) => line.totalPerPerson)).toEqual([450, 450]);
  });
});
