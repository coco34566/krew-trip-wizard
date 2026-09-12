#!/usr/bin/env bash
set -euo pipefail

npx tsc --noEmit --pretty false > /tmp/tsc-before.log 2>&1 || true

python3 <<'PY'
from pathlib import Path
p = Path('src/integrations/supabase/types.ts')
s = p.read_text()
assert '      trip_photos: {' not in s
assert '      trip_photo_likes: {' not in s

tables = '''      trip_photo_likes: {
        Row: {
          created_at: string
          photo_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          photo_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          photo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_photo_likes_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "trip_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_photos: {
        Row: {
          author: string
          captured_at: string | null
          content_hash: string | null
          created_at: string
          deleted_at: string | null
          file_size_bytes: number | null
          height: number | null
          id: string
          likes: number
          mime_type: string | null
          original_filename: string | null
          owner_user_id: string | null
          perceptual_hash: string | null
          storage_path: string | null
          trip_id: string
          url: string | null
          width: number | null
        }
        Insert: {
          author: string
          captured_at?: string | null
          content_hash?: string | null
          created_at?: string
          deleted_at?: string | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          likes?: number
          mime_type?: string | null
          original_filename?: string | null
          owner_user_id?: string | null
          perceptual_hash?: string | null
          storage_path?: string | null
          trip_id: string
          url?: string | null
          width?: number | null
        }
        Update: {
          author?: string
          captured_at?: string | null
          content_hash?: string | null
          created_at?: string
          deleted_at?: string | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          likes?: number
          mime_type?: string | null
          original_filename?: string | null
          owner_user_id?: string | null
          perceptual_hash?: string | null
          storage_path?: string | null
          trip_id?: string
          url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_photos_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
'''
marker = '      trip_preferences: {\n'
assert marker in s
s = s.replace(marker, tables + marker, 1)

assert '      toggle_trip_photo_like: {' not in s
fn = '''      toggle_trip_photo_like: {
        Args: { p_photo_id: string }
        Returns: {
          liked: boolean
          likes: number
        }[]
      }
'''
functions_start = s.index('    Functions: {\n')
enums_start = s.index('    Enums: {\n', functions_start)
functions_block = s[functions_start:enums_start]
insert_at = functions_start + functions_block.rfind('    }\n')
s = s[:insert_at] + fn + s[insert_at:]
p.write_text(s)
PY

cat > src/lib/memories-service.ts <<'EOF'
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type TripPhotoRow = Tables<"trip_photos">;
type TripPhotoLikeRow = Tables<"trip_photo_likes">;
type MemoriesTrip = Pick<
  Tables<"trips">,
  | "id"
  | "name"
  | "start_date"
  | "end_date"
  | "participants_count"
  | "selected_activity_ids"
  | "group_itinerary"
  | "group_logistics"
>;
type MemoriesDestination = Pick<Tables<"destinations">, "name" | "country">;
type PhotoWithLikes = TripPhotoRow & {
  trip_photo_likes: Array<Pick<TripPhotoLikeRow, "user_id">> | null;
};

export type Photo = Omit<TripPhotoRow, "url"> & {
  url: string;
  likedByMe: boolean;
};

async function signPhotoUrls(rows: PhotoWithLikes[]): Promise<Photo[]> {
  const photos = rows.map(({ trip_photo_likes, ...row }) => ({
    ...row,
    likedByMe: Array.isArray(trip_photo_likes) && trip_photo_likes.length > 0,
  }));
  const paths = photos
    .map((photo) => photo.storage_path)
    .filter((path): path is string => Boolean(path));
  if (!paths.length) {
    return photos.map((photo) => ({ ...photo, url: photo.url || "" }));
  }
  const { data, error } = await supabase.storage.from("trip-photos").createSignedUrls(paths, 3600);
  if (error) throw error;
  const signedByPath = new Map<string, string>();
  for (let i = 0; i < (data || []).length; i++) {
    const item = (data || [])[i];
    if (item?.error) throw new Error(String(item.error));
    const path = item?.path || paths[i];
    if (path && item?.signedUrl) signedByPath.set(path, item.signedUrl);
  }
  return photos.map((photo) =>
    photo.storage_path
      ? { ...photo, url: signedByPath.get(photo.storage_path) || "" }
      : { ...photo, url: photo.url || "" },
  );
}

export async function getMemoriesViewer(tripId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("trip_participants")
    .select("display_name")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  return { userId: user.id, userName: data?.display_name || "Moi" };
}

export async function listTripPhotos(tripId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from("trip_photos")
    .select("*, trip_photo_likes(user_id)")
    .eq("trip_id", tripId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return signPhotoUrls((data || []) as PhotoWithLikes[]);
}

export async function getMemoriesRecapSource(tripId: string) {
  const [tripResult, recoResult] = await Promise.all([
    supabase
      .from("trips")
      .select(
        "id,name,start_date,end_date,participants_count,selected_activity_ids,group_itinerary,group_logistics",
      )
      .eq("id", tripId)
      .single(),
    supabase
      .from("recommendations")
      .select("destinations(name,country)")
      .eq("trip_id", tripId)
      .eq("is_selected", true)
      .maybeSingle(),
  ]);
  if (tripResult.error) throw tripResult.error;
  if (recoResult.error) throw recoResult.error;
  const rawDestination = recoResult.data?.destinations as
    | MemoriesDestination
    | MemoriesDestination[]
    | null
    | undefined;
  const destination = Array.isArray(rawDestination)
    ? (rawDestination[0] ?? null)
    : (rawDestination ?? null);
  return { trip: tripResult.data as MemoriesTrip, destination };
}

export async function toggleTripPhotoLike(photoId: string) {
  const { error } = await supabase.rpc("toggle_trip_photo_like", {
    p_photo_id: photoId,
  });
  if (error) throw error;
}

export async function removeTripPhoto(photo: Photo) {
  if (photo.storage_path) {
    const { error } = await supabase.storage.from("trip-photos").remove([photo.storage_path]);
    if (error) throw error;
  }
  const { error } = await supabase
    .from("trip_photos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", photo.id);
  if (error) throw error;
}

export async function uploadTripPhoto({
  tripId,
  userId,
  userName,
  file,
  hash,
}: {
  tripId: string;
  userId: string;
  userName: string;
  file: File;
  hash: string;
}): Promise<{ duplicate: boolean }> {
  const { data: duplicate, error: duplicateError } = await supabase
    .from("trip_photos")
    .select("id")
    .eq("trip_id", tripId)
    .eq("content_hash", hash)
    .is("deleted_at", null)
    .maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate) return { duplicate: true };

  const id = crypto.randomUUID();
  const ext =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${tripId}/${userId}/${id}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("trip-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("trip_photos").insert({
    id,
    trip_id: tripId,
    owner_user_id: userId,
    storage_path: path,
    author: userName,
    likes: 0,
    content_hash: hash,
    original_filename: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
  });
  if (insertError) {
    await supabase.storage.from("trip-photos").remove([path]);
    throw insertError;
  }
  return { duplicate: false };
}
EOF

if grep -nE '(^|[^[:alnum:]_])any([^[:alnum:]_]|$)|as any' src/lib/memories-service.ts; then
  echo 'Untyped Memories service debt remains' >&2
  exit 1
fi

git diff --check
changed="$(git status --short -uall | sed -E 's/^.. //' | sort)"
expected="$(printf '%s\n' 'src/integrations/supabase/types.ts' 'src/lib/memories-service.ts' | sort)"
echo "$changed"
test "$changed" = "$expected"

npx vitest run 'src/routes/_authenticated/__tests__/trips.$tripId.memories.characterization.test.tsx' 'src/hooks/__tests__/use-memories-photo-permission.test.ts'
npx tsc --noEmit --pretty false > /tmp/tsc-after.log 2>&1 || true

python3 <<'PY'
import re
from collections import Counter
from pathlib import Path

def errs(path):
    out=[]
    for line in Path(path).read_text().splitlines():
        line=line.strip()
        if re.search(r'\berror TS\d+:', line):
            line=re.sub(r'^(.*?)(?:\(\d+,\d+\))(: error TS\d+:)', r'\1\2', line)
            out.append(line)
    return Counter(out)

before=errs('/tmp/tsc-before.log')
after=errs('/tmp/tsc-after.log')
added=list((after-before).elements())
print(f'before={sum(before.values())} after={sum(after.values())} added={len(added)}')
for line in sorted(added): print('ADD '+line)
if added: raise SystemExit(1)
PY

npm run build

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add src/integrations/supabase/types.ts src/lib/memories-service.ts
git commit -m 'refactor(memories): type service with generated Supabase schema'
git push origin HEAD:refactor/memories-architecture-phased
