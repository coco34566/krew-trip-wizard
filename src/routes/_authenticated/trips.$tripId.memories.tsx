import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, Heart, Plus, Sparkles, ShieldAlert, X, Settings, Loader2, Trash2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sha256File } from "@/lib/souvenirs-photo-upload";

export const Route = createFileRoute("/_authenticated/trips/$tripId/memories")({
  head: () => ({ meta: [{ title: "Souvenirs du voyage — Krew" }, { name: "description", content: "Album photo collaboratif et souvenirs de notre voyage." }] }),
  component: MemoriesPage,
});

type Photo = { id: string; trip_id: string; url: string; author: string; likes: number; created_at: string; storage_path?: string | null; owner_user_id?: string | null; };

async function signPhotoUrls(rows: any[]): Promise<Photo[]> {
  return Promise.all(rows.map(async (row) => {
    if (!row.storage_path) return { ...row, url: row.url || "" } as Photo;
    const { data, error } = await supabase.storage.from("trip-photos").createSignedUrl(row.storage_path, 3600);
    if (error) throw error;
    return { ...row, url: data.signedUrl } as Photo;
  }));
}

function getSupabaseError(error: unknown) {
  if (error && typeof error === "object") {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    return [e.message, e.details, e.hint, e.code ? `code ${e.code}` : ""].filter(Boolean).join(" — ");
  }
  return String(error || "Erreur inconnue");
}

function MemoriesPage() {
  const { tripId } = Route.useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Moi");
  const [uploading, setUploading] = useState(false);
  const [permission, setPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  const [showPermissionModal, setShowModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPerm = localStorage.getItem("krew_photo_permission");
      if (savedPerm === "granted" || savedPerm === "denied") setPermission(savedPerm);
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      supabase.from("trip_participants").select("display_name").eq("trip_id", tripId).eq("user_id", user.id).maybeSingle()
        .then(({ data }) => { if (data?.display_name) setUserName(data.display_name); });
    });
  }, [tripId]);

  const { data: photos = [], isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: ["trip-photos", tripId],
    queryFn: async () => {
      const { data, error } = await supabase.from("trip_photos" as any).select("*").eq("trip_id", tripId).is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return signPhotoUrls(data || []);
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("increment_trip_photo_likes", { p_photo_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip-photos", tripId] }),
    onError: (e) => { toast.error("Impossible d'enregistrer le like."); console.error(e); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photo: Photo) => {
      if (photo.storage_path) {
        const { error } = await supabase.storage.from("trip-photos").remove([photo.storage_path]);
        if (error) throw error;
      }
      const { error } = await supabase.from("trip_photos" as any).update({ deleted_at: new Date().toISOString() }).eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trip-photos", tripId] }); toast.success("Photo supprimée."); },
    onError: (e) => { toast.error(`Impossible de supprimer la photo : ${getSupabaseError(e)}`); console.error(e); },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!userId || files.length === 0) {
      if (!userId && files.length) toast.error("Tu dois être connecté pour importer une photo.");
      return;
    }
    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("image/")) { toast.error(`${file.name} n'est pas une image prise en charge.`); return false; }
      return true;
    });
    if (!validFiles.length) return;
    setUploading(true);
    let added = 0, duplicates = 0;
    try {
      for (const file of validFiles) {
        const hash = await sha256File(file);
        const { data: duplicate, error: duplicateError } = await supabase.from("trip_photos" as any).select("id").eq("trip_id", tripId).eq("content_hash", hash).is("deleted_at", null).maybeSingle();
        if (duplicateError) throw duplicateError;
        if (duplicate) { duplicates++; continue; }
        const photoId = crypto.randomUUID();
        const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const storagePath = `${tripId}/${userId}/${photoId}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("trip-photos").upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase.from("trip_photos" as any).insert({ id: photoId, trip_id: tripId, owner_user_id: userId, storage_path: storagePath, author: userName, likes: 0, content_hash: hash, original_filename: file.name, mime_type: file.type, file_size_bytes: file.size });
        if (insertError) { await supabase.storage.from("trip-photos").remove([storagePath]); throw insertError; }
        added++;
      }
      await queryClient.invalidateQueries({ queryKey: ["trip-photos", tripId] });
      if (added) toast.success(`${added} photo(s) ajoutée(s) à l'album.`);
      if (duplicates) toast.info(`${duplicates} doublon(s) exact(s) ignoré(s).`);
    } catch (err) {
      const detail = getSupabaseError(err);
      toast.error(`Impossible d'importer les photos : ${detail}`);
      console.error("KREW photo upload failed", { tripId, userId, error: err });
    } finally { setUploading(false); }
  };

  const grantPermission = () => { localStorage.setItem("krew_photo_permission", "granted"); setPermission("granted"); setShowModal(false); setTimeout(() => fileInputRef.current?.click(), 150); };
  const denyPermission = () => { localStorage.setItem("krew_photo_permission", "denied"); setPermission("denied"); setShowModal(false); };
  const resetPermission = () => { localStorage.removeItem("krew_photo_permission"); setPermission("prompt"); };
  const handleImportClick = () => permission === "granted" ? fileInputRef.current?.click() : setShowModal(true);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8 relative">
      <Link to="/trips/$tripId" params={{ tripId }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition"><ArrowLeft className="size-4" /> Retour à Mon Voyage</Link>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div className="space-y-2"><div className="flex items-center gap-2 text-primary"><Camera className="size-6" /><span className="text-xs font-semibold uppercase tracking-wider">Souvenirs</span></div><h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">L&apos;album de notre voyage</h1><p className="text-sm text-muted-foreground max-w-xl">Retrouve ici les meilleurs moments partagés avec tes ami·e·s. Ajoute tes propres pépites et vote pour tes préférées !</p></div>{permission !== "prompt" && <Button variant="outline" size="sm" onClick={resetPermission} className="gap-1.5 text-xs"><Settings className="size-3.5" /> Gérer l&apos;autorisation</Button>}</header>
      <section className="rounded-3xl border border-dashed border-border bg-surface/30 p-8 text-center space-y-3 relative overflow-hidden"><input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" /><div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><Plus className="size-6" /></div><div><p className="font-semibold text-sm">Ajoute tes photos de voyage</p><p className="text-xs text-muted-foreground mt-0.5">Tes photos sont stockées dans un espace privé et partagées uniquement avec les participants du voyage.</p></div>{permission === "denied" && <div className="mx-auto max-w-md bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl p-3 flex items-start gap-2 text-left text-xs"><ShieldAlert className="size-4 shrink-0 mt-0.5" /><div><p className="font-semibold">L&apos;accès aux photos a été désactivé</p><p className="mt-0.5">Tu peux modifier ce choix avec « Gérer l&apos;autorisation ».</p></div></div>}<Button size="sm" className="gap-1.5" disabled={uploading} onClick={handleImportClick}>{uploading ? <><Loader2 className="size-3.5 animate-spin" /> Importation...</> : <><Sparkles className="size-3.5" /> Choisir des photos</>}</Button></section>
      {photosLoading ? <div className="flex flex-col items-center justify-center py-12 gap-3"><Loader2 className="size-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Chargement de l&apos;album...</p></div> : photos.length === 0 ? <div className="text-center py-12 space-y-2 border border-border rounded-3xl bg-card"><Camera className="mx-auto size-10 text-muted-foreground/60" /><p className="font-medium">L&apos;album est encore vide</p><p className="text-xs text-muted-foreground">Partage la première photo du séjour pour lancer l&apos;album !</p></div> : <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">{photos.map((photo) => <article key={photo.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md"><div className="aspect-[4/3] w-full overflow-hidden bg-muted"><img src={photo.url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" /></div><div className="p-3 flex items-center justify-between text-xs bg-card"><span className="text-muted-foreground font-medium">Par {photo.author}</span><div className="flex items-center gap-3"><button type="button" onClick={() => likeMutation.mutate(photo.id)} disabled={likeMutation.isPending} className="inline-flex items-center gap-1 text-muted-foreground hover:text-red-500"><Heart className="size-3.5 fill-current text-red-500/10" /> {photo.likes}</button>{photo.owner_user_id === userId && <button type="button" onClick={() => deleteMutation.mutate(photo)} disabled={deleteMutation.isPending} aria-label="Supprimer la photo" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>}</div></div></article>)}</div>}
      {showPermissionModal && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-card border border-border w-full max-w-md rounded-3xl shadow-elevated p-6 space-y-4"><div className="flex items-start justify-between"><div className="flex items-center gap-2.5 text-primary"><Camera className="size-5" /><h3 className="font-display font-bold text-lg">Krew souhaite importer tes photos</h3></div><button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div><div className="space-y-3 text-sm text-muted-foreground leading-relaxed"><p>Afin d&apos;enrichir l&apos;album collaboratif, Krew ouvre le sélecteur de photos de ton appareil.</p><p>Les photos sont stockées dans un espace privé et accessibles uniquement aux participants autorisés de ce voyage.</p></div><div className="flex flex-col sm:flex-row gap-2 pt-2"><Button onClick={grantPermission} className="flex-1" variant="hero">Autoriser l&apos;accès</Button><Button onClick={denyPermission} variant="outline" className="flex-1">Refuser</Button></div></div></div>}
    </main>
  );
}
