import { supabase } from "@/integrations/supabase/client";

export async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function uploadTripPhoto(file: File, tripId: string, userId: string, author: string) {
  const contentHash = await sha256File(file);
  const { data: duplicate, error: duplicateError } = await supabase
    .from("trip_photos" as any).select("id").eq("trip_id", tripId)
    .eq("content_hash", contentHash).is("deleted_at", null).maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate) return { duplicate: true, id: duplicate.id };

  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const photoId = crypto.randomUUID();
  const storagePath = `${tripId}/${userId}/${photoId}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("trip-photos")
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data: row, error: insertError } = await supabase.from("trip_photos" as any)
    .insert({ id: photoId, trip_id: tripId, owner_user_id: userId, storage_path: storagePath,
      author, likes: 0, content_hash: contentHash, original_filename: file.name,
      mime_type: file.type, file_size_bytes: file.size })
    .select("id").single();
  if (insertError) {
    await supabase.storage.from("trip-photos").remove([storagePath]);
    throw insertError;
  }
  return { duplicate: false, id: row.id };
}
