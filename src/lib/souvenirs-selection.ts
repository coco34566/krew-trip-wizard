export type SouvenirPhoto = {
  id: string;
  created_at: string;
  likes?: number | null;
  owner_user_id?: string | null;
};

/**
 * Deterministic V1 selection: balance chronology and group appreciation.
 * This is deliberately not presented as an AI judgement of people or appearance.
 */
export function buildKrewSelection(photos: SouvenirPhoto[]): SouvenirPhoto[] {
  if (photos.length <= 12) return [...photos];
  const target = Math.min(120, Math.max(12, Math.round(photos.length * 0.14)));
  const sorted = [...photos].sort(
    (a, b) => (Number(b.likes ?? 0) - Number(a.likes ?? 0)) ||
      (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  );
  const byDay = new Map<string, SouvenirPhoto[]>();
  for (const photo of sorted) {
    const day = new Date(photo.created_at).toISOString().slice(0, 10);
    const bucket = byDay.get(day) ?? [];
    bucket.push(photo);
    byDay.set(day, bucket);
  }
  const days = [...byDay.keys()].sort();
  const selected: SouvenirPhoto[] = [];
  let cursor = 0;
  while (selected.length < target && days.length) {
    const index = cursor % days.length;
    const bucket = byDay.get(days[index])!;
    const next = bucket.shift();
    if (next && !selected.some((p) => p.id === next.id)) selected.push(next);
    if (!bucket.length) days.splice(index, 1);
    else cursor++;
  }
  return selected.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}
