from pathlib import Path

p = Path('/tmp/memories-phase4.sh')
s = p.read_text()

old = '''fn = \'\'\'      toggle_trip_photo_like: {\n        Args: { p_photo_id: string }\n        Returns: {\n          liked: boolean\n          likes: number\n        }[]\n      }\n\'\'\'\n'''
new = '''fn = \'\'\'      get_recalibrate_cron_secret: { Args: never; Returns: string }\n      toggle_trip_photo_like: {\n        Args: { p_photo_id: string }\n        Returns: {\n          liked: boolean\n          likes: number\n        }[]\n      }\n\'\'\'\n'''
assert old in s
s = s.replace(old, new, 1)

old = '''import type { Tables } from "@/integrations/supabase/types";\n\ntype TripPhotoRow = Tables<"trip_photos">;'''
new = '''import type { Tables } from "@/integrations/supabase/types";\nimport type { TripRecapSource } from "@/lib/krew/trip-recap";\n\ntype TripPhotoRow = Tables<"trip_photos">;'''
assert old in s
s = s.replace(old, new, 1)

old = '''type MemoriesTrip = Pick<\n  Tables<"trips">,\n  | "id"\n  | "name"\n  | "start_date"\n  | "end_date"\n  | "participants_count"\n  | "selected_activity_ids"\n  | "group_itinerary"\n  | "group_logistics"\n>;'''
new = '''type MemoriesTripRow = Pick<\n  Tables<"trips">,\n  | "id"\n  | "name"\n  | "start_date"\n  | "end_date"\n  | "participants_count"\n  | "selected_activity_ids"\n  | "group_itinerary"\n  | "group_logistics"\n>;\ntype MemoriesTrip = Omit<MemoriesTripRow, "group_itinerary" | "group_logistics"> & {\n  group_itinerary: Exclude<TripRecapSource["trip"]["group_itinerary"], undefined>;\n  group_logistics: Exclude<TripRecapSource["trip"]["group_logistics"], undefined>;\n};'''
assert old in s
s = s.replace(old, new, 1)

old = '''  return { trip: tripResult.data as MemoriesTrip, destination };'''
new = '''  const row = tripResult.data as MemoriesTripRow;\n  const trip: MemoriesTrip = {\n    ...row,\n    group_itinerary: row.group_itinerary as MemoriesTrip["group_itinerary"],\n    group_logistics: row.group_logistics as MemoriesTrip["group_logistics"],\n  };\n  return { trip, destination };'''
assert old in s
s = s.replace(old, new, 1)

needle = '''if grep -nE '(^|[^[:alnum:]_])any([^[:alnum:]_]|$)|as any' src/lib/memories-service.ts; then'''
insert = '''python3 <<'PYROUTE'\nfrom pathlib import Path\np = Path('src/routes/_authenticated/trips.$tripId.memories.tsx')\ns = p.read_text()\nold = '          tripName={recapSource?.trip?.name}\\n'\nnew = '          tripName={recapSource?.trip?.name as string | null}\\n'\nassert old in s\np.write_text(s.replace(old, new, 1))\nPYROUTE\n\n'''
assert needle in s
s = s.replace(needle, insert + needle, 1)

old = '''expected="$(printf '%s\\n' 'src/integrations/supabase/types.ts' 'src/lib/memories-service.ts' | sort)"'''
new = '''expected="$(printf '%s\\n' 'src/integrations/supabase/types.ts' 'src/lib/memories-service.ts' 'src/routes/_authenticated/trips.$tripId.memories.tsx' | sort)"'''
assert old in s
s = s.replace(old, new, 1)

old = '''git add src/integrations/supabase/types.ts src/lib/memories-service.ts'''
new = '''git add src/integrations/supabase/types.ts src/lib/memories-service.ts 'src/routes/_authenticated/trips.$tripId.memories.tsx' '''
assert old in s
s = s.replace(old, new, 1)

p.write_text(s)
