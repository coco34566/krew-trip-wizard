export const KREW_AWARD_CATEGORIES = [
  { id: "gps-humain", label: "Le GPS humain" },
  { id: "premier-debout", label: "Premier debout" },
  { id: "dernier-pret", label: "Dernier prêt" },
  { id: "photographe-officiel", label: "Photographe officiel" },
  { id: "maitre-du-planning", label: "Maître du planning" },
  { id: "toujours-partant", label: "Toujours partant" },
] as const;

export type KrewAwardCategoryId = (typeof KREW_AWARD_CATEGORIES)[number]["id"];

export const MIN_KREW_AWARD_VOTES_TO_REVEAL = 2;

export type KrewAwardVoteLike = {
  category: string;
  nominee_participant_id: string;
};

export type KrewAwardResult = {
  revealed: boolean;
  winnerParticipantIds: string[];
  isTie: boolean;
};

export function isKrewAwardCategory(value: string): value is KrewAwardCategoryId {
  return KREW_AWARD_CATEGORIES.some((category) => category.id === value);
}

export function getKrewAwardResult(
  votes: KrewAwardVoteLike[],
  category: KrewAwardCategoryId,
  minimumVotes = MIN_KREW_AWARD_VOTES_TO_REVEAL,
): KrewAwardResult {
  const categoryVotes = votes.filter((vote) => vote.category === category);
  if (categoryVotes.length < minimumVotes) {
    return { revealed: false, winnerParticipantIds: [], isTie: false };
  }

  const totals = new Map<string, number>();
  for (const vote of categoryVotes) {
    totals.set(vote.nominee_participant_id, (totals.get(vote.nominee_participant_id) ?? 0) + 1);
  }

  const highestTotal = Math.max(...totals.values());
  const winnerParticipantIds = [...totals.entries()]
    .filter(([, total]) => total === highestTotal)
    .map(([participantId]) => participantId)
    .sort();

  return {
    revealed: true,
    winnerParticipantIds,
    isTie: winnerParticipantIds.length > 1,
  };
}
