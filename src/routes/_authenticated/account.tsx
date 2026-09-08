import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { KrewAvatar } from "@/components/krew/KrewAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

const MAX_SOURCE_SIZE = 10 * 1024 * 1024;
const AVATAR_SIZE = 512;
const ACCEPTED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible"));
    };
    image.src = url;
  });
}

async function prepareAvatar(file: File): Promise<Blob> {
  if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
    throw new Error("Choisis une image JPEG, PNG ou WebP.");
  }
  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error("Cette image est trop lourde. Choisis un fichier de moins de 10 Mo.");
  }

  const image = await loadImage(file);
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  if (!sourceSize) throw new Error("Image illisible");

  const sx = Math.max(0, (image.naturalWidth - sourceSize) / 2);
  const sy = Math.max(0, (image.naturalHeight - sourceSize) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossible de préparer cette image.");
  context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.84),
  );
  if (!blob) throw new Error("Impossible de préparer cette image.");
  return blob;
}

function avatarStoragePath(url: string | null) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/avatars/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length).split("?")[0] || "") || null;
}

function AccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user?.id) return;

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled && !profileError) {
        setFirstName(data?.full_name?.trim() || null);
        setAvatarUrl(data?.avatar_url || null);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function handleAvatarFile(file: File | undefined) {
    if (!file || !user?.id || avatarBusy) return;
    setAvatarBusy(true);
    setAvatarError(null);

    const previousUrl = avatarUrl;
    let uploadedPath: string | null = null;

    try {
      const blob = await prepareAvatar(file);
      uploadedPath = `${user.id}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(uploadedPath, blob, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(uploadedPath);
      const nextUrl = publicUrlData.publicUrl;
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: nextUrl, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (profileError) throw profileError;

      setAvatarUrl(nextUrl);
      const previousPath = avatarStoragePath(previousUrl);
      if (previousPath) {
        void supabase.storage.from("avatars").remove([previousPath]);
      }
    } catch (uploadError) {
      if (uploadedPath) {
        void supabase.storage.from("avatars").remove([uploadedPath]);
      }
      setAvatarError(
        uploadError instanceof Error && uploadError.message
          ? uploadError.message
          : "Impossible d’ajouter cette photo pour le moment.",
      );
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    if (!user?.id || !avatarUrl || avatarBusy) return;
    setAvatarBusy(true);
    setAvatarError(null);
    const previousUrl = avatarUrl;

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (profileError) throw profileError;

      setAvatarUrl(null);
      const previousPath = avatarStoragePath(previousUrl);
      if (previousPath) {
        void supabase.storage.from("avatars").remove([previousPath]);
      }
    } catch {
      setAvatarError("Impossible de supprimer cette photo pour le moment.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase.rpc("delete_my_account");

    if (deleteError) {
      setError("Impossible de supprimer ton compte pour le moment. Réessaie plus tard.");
      setDeleting(false);
      return;
    }

    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true, search: {} });
  }

  const createdAt = user?.created_at
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(user.created_at))
    : "—";

  const avatarName = firstName || user?.email?.split("@")[0] || "Krew";

  return (
    <main data-krew-account-page className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8 space-y-1">
        <div className="relative inline-block">
          <h1 className="font-display text-[36px] sm:text-[44px] font-normal leading-tight text-foreground">Mon compte</h1>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="sm"
            className="absolute left-0 -bottom-1.5 w-[110px] pointer-events-none"
          />
        </div>
        <p className="mt-3 text-sm text-muted-foreground font-sans">
          Tes informations de compte et tes préférences générales.
        </p>
      </div>

      <div className="space-y-10">
        <section className="space-y-3">
          <div className="border-b border-border/60 pb-2.5">
            <h2 className="font-display text-xl sm:text-2xl font-normal text-foreground">Mes informations</h2>
          </div>
          <div className="divide-y divide-border/40 text-sm">
            <div className="py-3.5 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <KrewAvatar name={avatarName} avatarUrl={avatarUrl} size="md" decorative={false} />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">Photo de profil</p>
                  <p className="text-xs text-muted-foreground">Facultative · visible par les membres de tes voyages</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => void handleAvatarFile(event.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={avatarBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                  {avatarUrl ? "Modifier ma photo" : "Ajouter une photo"}
                </Button>
                {avatarUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-muted-foreground"
                    disabled={avatarBusy}
                    onClick={() => void handleRemoveAvatar()}
                  >
                    Supprimer
                  </Button>
                ) : null}
              </div>
            </div>
            {avatarError ? (
              <p className="py-2 text-xs font-medium text-destructive" role="alert">
                {avatarError}
              </p>
            ) : null}
            {firstName ? (
              <div className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                <span className="text-muted-foreground">Prénom</span>
                <span className="font-medium text-foreground">{firstName}</span>
              </div>
            ) : null}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
              <span className="text-muted-foreground">Adresse e-mail</span>
              <span className="font-medium text-foreground break-all sm:text-right">{user?.email ?? "—"}</span>
            </div>
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
              <span className="text-muted-foreground">Compte créé le</span>
              <span className="font-medium text-foreground">{createdAt}</span>
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 pt-6 space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Gestion du compte</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              Tu peux supprimer définitivement ton compte. Certaines données peuvent être conservées si la loi l’exige.
            </p>
          </div>

          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="min-h-[40px] h-auto rounded-xl border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={() => setOpen(true)}
            disabled={deleting}
          >
            <Trash2 className="size-3.5 shrink-0" />
            Supprimer mon compte
          </Button>
        </section>
      </div>

      <Dialog open={open} onOpenChange={(nextOpen) => !deleting && setOpen(nextOpen)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ton compte ?</DialogTitle>
            <DialogDescription>
              Cette action supprimera ton compte et les données personnelles qui n'ont plus de raison légale d'être conservées. Certaines données peuvent être conservées lorsque la loi l'exige.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
              Annuler
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin shrink-0" /> : <Trash2 className="size-4 shrink-0" />}
              {deleting ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
