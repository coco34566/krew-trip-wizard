import { describe, expect, it } from "vitest";
import { getKrewAwardResult } from "@/lib/krew/krew-awards";

describe("getKrewAwardResult", () => {
  it("keeps a category hidden until two votes exist", () => {
    expect(
      getKrewAwardResult(
        [{ category: "gps-humain", nominee_participant_id: "participant-a" }],
        "gps-humain",
      ),
    ).toEqual({ revealed: false, winnerParticipantIds: [], isTie: false });
  });

  it("reveals one winner without creating a ranking", () => {
    expect(
      getKrewAwardResult(
        [
          { category: "gps-humain", nominee_participant_id: "participant-a" },
          { category: "gps-humain", nominee_participant_id: "participant-a" },
          { category: "gps-humain", nominee_participant_id: "participant-b" },
        ],
        "gps-humain",
      ),
    ).toEqual({ revealed: true, winnerParticipantIds: ["participant-a"], isTie: false });
  });

  it("returns every co-winner when the top vote is tied", () => {
    expect(
      getKrewAwardResult(
        [
          { category: "dernier-pret", nominee_participant_id: "participant-b" },
          { category: "dernier-pret", nominee_participant_id: "participant-a" },
        ],
        "dernier-pret",
      ),
    ).toEqual({
      revealed: true,
      winnerParticipantIds: ["participant-a", "participant-b"],
      isTie: true,
    });
  });

  it("does not mix votes from different categories", () => {
    expect(
      getKrewAwardResult(
        [
          { category: "gps-humain", nominee_participant_id: "participant-a" },
          { category: "photographe-officiel", nominee_participant_id: "participant-b" },
          { category: "photographe-officiel", nominee_participant_id: "participant-b" },
        ],
        "gps-humain",
      ).revealed,
    ).toBe(false);
  });
});
