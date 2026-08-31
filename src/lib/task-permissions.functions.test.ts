import { describe, expect, it } from "vitest";

import { canEditTaskStatus, isAssignableTaskParticipant } from "./task-permissions.functions";

describe("task permission predicates", () => {
  it("lets an organizer or co-organizer update any task status", () => {
    expect(
      canEditTaskStatus({
        isAdmin: true,
        currentUserId: "admin",
        assigneeUserId: "someone-else",
        assigneeStatus: "accepte",
      }),
    ).toBe(true);
  });

  it("lets a participant update only a task assigned to their real active membership", () => {
    expect(
      canEditTaskStatus({
        isAdmin: false,
        currentUserId: "participant",
        assigneeUserId: "participant",
        assigneeStatus: "accepte",
      }),
    ).toBe(true);
    expect(
      canEditTaskStatus({
        isAdmin: false,
        currentUserId: "participant",
        assigneeUserId: "other",
        assigneeStatus: "accepte",
      }),
    ).toBe(false);
  });

  it("does not allow inactive assignees to update a task", () => {
    expect(
      canEditTaskStatus({
        isAdmin: false,
        currentUserId: "participant",
        assigneeUserId: "participant",
        assigneeStatus: "absent",
      }),
    ).toBe(false);
    expect(
      canEditTaskStatus({
        isAdmin: false,
        currentUserId: "participant",
        assigneeUserId: "participant",
        assigneeStatus: "refuse",
      }),
    ).toBe(false);
  });

  it("never treats a placeholder or unclaimed invite as assignable", () => {
    expect(isAssignableTaskParticipant({ user_id: null, status: "accepte" })).toBe(false);
    expect(isAssignableTaskParticipant({ user_id: undefined, status: "à inviter" })).toBe(false);
  });

  it("allows only real active members as assignees", () => {
    expect(isAssignableTaskParticipant({ user_id: "real-user", status: "accepte" })).toBe(true);
    expect(isAssignableTaskParticipant({ user_id: "real-user", status: "absent" })).toBe(false);
  });
});
