export type ParticipantStatusRow = {
  status?: string | null;
};

/**
 * Taille à envoyer aux fournisseurs externes.
 *
 * `participants_count` reste la taille prévue du groupe, y compris les places
 * pas encore invitées. En revanche, une personne explicitement absente ou qui
 * a refusé ne doit plus gonfler les chambres, les adultes ou les prix cherchés.
 */
export function getExternalSearchParticipantsCount(
  trip: { participants_count?: number | null } | null | undefined,
  participants: ParticipantStatusRow[] | null | undefined,
): number {
  const rows = Array.isArray(participants) ? participants : [];
  const inactiveCount = rows.filter((participant) =>
    participant.status === "absent" || participant.status === "refuse"
  ).length;
  const activeKnownCount = Math.max(0, rows.length - inactiveCount);
  const declaredCount = Math.max(0, Number(trip?.participants_count) || 0);
  const adjustedDeclaredCount = Math.max(0, declaredCount - inactiveCount);

  return Math.max(1, adjustedDeclaredCount, activeKnownCount);
}
