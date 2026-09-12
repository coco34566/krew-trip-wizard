import { supabase } from "@/integrations/supabase/client";

export type Photo = {
  id: string;
  trip_id: string;
  url: string;
  author: string;
  likes: number;
  likedByMe: boolean;
  created_at: string;
  storage_path?: string | null;
  owner_user_id?: string | null;
  original_filename?: string | null;
};

async function signPhotoUrls(rows: any[]): Promise<Photo[]> {
  const photos = rows.map((row) => {
    const photo = {
      ...row,
      likedByMe: Array.isArray(row.trip_photo_likes) && row.trip_photo_likes.length > 0,
    };
    delete photo.trip_photo_likes;
    return photo;
  });
  const paths = photos
    .map((photo) => photo.storage_path)
    .filter((path): path is string => Boolean(path));
  if (!paths.length) {
    return photos.map((photo) => ({ ...photo, url: photo.url || "" })) as Photo[];
  }
  const { data, error } = await supabase.storage.from("trip-photos").createSignedUrls(paths, 3600);
  if (error) throw error;
  const signedByPath = new Map<string, string>();
  for (let i = 0; i < (data || []).length; i++) {
    const item = (data || [])[i] as any;
    if (item?.error) throw new Error(String(item.error));
    const path = item?.path || paths[i];
    if (path && item?.signedUrl) signedByPath.set(path, item.signedUrl);
  }
  return photos.map((photo) =>
    photo.storage_path
      ? { ...photo, url: signedByPath.get(photo.storage_path) || "" }
      : { ...photo, url: photo.url || "" },
  ) as Photo[];
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
    .from("trip_photos" as any)
    .select("*, trip_photo_likes(user_id)")
    .eq("trip_id", tripId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return signPhotoUrls(data || []);
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
  const rawDestination = (recoResult.data as any)?.destinations;
  const destination = Array.isArray(rawDestination)
    ? (rawDestination[0] ?? null)
    : (rawDestination ?? null);
  return { trip: tripResult.data as any, destination };
}

export async function toggleTripPhotoLike(photoId: string) {
  const { error } = await supabase.rpc("toggle_trip_photo_like" as any, {
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
    .from("trip_photos" as any)
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
    .from("trip_photos" as any)
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

  const { error: insertError } = await supabase.from("trip_photos" as any).insert({
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
