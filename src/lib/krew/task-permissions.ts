export function isAssignableTaskParticipant(participant: {
  user_id?: string | null;
  status?: unknown;
}) {
  return Boolean(participant.user_id) && participant.status !== "absent" && participant.status !== "refuse";
}

export function canEditTaskStatus(input: {
  isAdmin: boolean;
  currentUserId: string;
  assigneeUserId?: string | null;
  assigneeStatus?: unknown;
}) {
  if (input.isAdmin) return true;
  return Boolean(
    input.assigneeUserId &&
      input.assigneeUserId === input.currentUserId &&
      input.assigneeStatus !== "absent" &&
      input.assigneeStatus !== "refuse",
  );
}
