import { PROFILE_LABELS, STAY_PROFILE_IDS, type StayConcept, type StayProfileId } from "@/lib/krew/stay-profiles";

export function normalizeStayConcepts(concepts: any[]): StayConcept[] {
  if (!Array.isArray(concepts)) return [];
  const result: StayConcept[] = [];
  const seen = new Set<StayProfileId>();

  for (const c of concepts) {
    if (!c) continue;
    const rawProfiles: string[] =
      Array.isArray(c.profiles) && c.profiles.length > 0
        ? c.profiles
        : (STAY_PROFILE_IDS as readonly string[]).includes(c.id)
          ? [c.id]
          : [];

    for (const pId of rawProfiles) {
      if ((STAY_PROFILE_IDS as readonly string[]).includes(pId) && !seen.has(pId as StayProfileId)) {
        const id = pId as StayProfileId;
        seen.add(id);
        result.push({
          id,
          profiles: [id],
          title: PROFILE_LABELS[id],
          score: typeof c.score === "number" ? c.score : 50,
          rationale: PROFILE_LABELS[id],
        });
      }
    }
  }

  return result;
}
