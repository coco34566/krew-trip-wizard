import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  Download,
  ExternalLink,
  Loader2,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { KrewRecapCard } from "@/components/krew/KrewRecapCard";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewIcon, KrewMark, KrewNote, KrewOrganicBlob } from "@/components/krew/visual-language";
import { useMemoriesPhotoPermission } from "@/hooks/use-memories-photo-permission";
import { buildTripRecap } from "@/lib/krew/trip-recap";
import {
  getMemoriesRecapSource,
  getMemoriesViewer,
  listTripPhotos,
  removeTripPhoto,
  toggleTripPhotoLike,
  uploadTripPhoto,
  type Photo,
} from "@/lib/memories-service";
import { createPhotosZip } from "@/lib/souvenirs-download";
import { sha256File } from "@/lib/souvenirs-photo-upload";
import { cn } from "@/lib/utils";

const MAX_PHOTO_SIZE_BYTES = 20 * 1024 * 1024;
const PHOTO_BOOK_PARTNER = {
  name: "CEWE",
  url: "https://www.cewe.fr/livres-photo-cewe.html",
  affiliateDisclosure:
    "KREW peut percevoir une rémunération si tu effectues un achat via un lien partenaire. Cela ne modifie pas le prix payé.",
};

type SelectionOverrides = { included: string[]; excluded: string[] };
type UploadProgress = {
  total: number;
  processed: number;
  added: number;
  duplicates: number;
  errors: number;
};

export const Route = createFileRoute("/_authenticated/trips/$tripId/memories")({
  head: () => ({ meta: [{ title: "Souvenirs du voyage — KREW" }] }),
  component: MemoriesPage,
});

function fileName(photo: Photo, index: number) {
  return (
    photo.original_filename?.trim() || `photo-${String(index + 1).padStart(3, "0")}.jpg`
  ).replace(/[\\/:*?"<>|]/g, "-");
}

function photoAlt(photo: Photo) {
  return photo.original_filename?.trim()
    ? `Souvenir : ${photo.original_filename.trim()}`
    : `Souvenir partagé par ${photo.author || "le groupe"}`;
}

function photoDay(photo: Photo) {
  return new Date(photo.created_at).toISOString().slice(0, 10);
}

function buildKrewSelection(photos: Photo[]) {
  if (photos.length <= 12)
    return [...photos].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  const target = Math.min(120, Math.max(12, Math.round(photos.length * 0.14)));
  const maxPerAuthor = Math.max(2, Math.ceil(target * 0.4));
  const buckets = new Map<string, Photo[]>();
  const authorCounts = new Map<string, number>();

  for (const photo of [...photos].sort(
    (a, b) => b.likes - a.likes || +new Date(a.created_at) - +new Date(b.created_at),
  )) {
    const day = photoDay(photo);
    const bucket = buckets.get(day) || [];
    bucket.push(photo);
    buckets.set(day, bucket);
  }

  const days = [...buckets.keys()].sort();
  const selected: Photo[] = [];
  let cursor = 0;

  while (selected.length < target && days.length) {
    const dayIndex = cursor % days.length;
    const day = days[dayIndex];
    const bucket = buckets.get(day)!;
    const preferredIndex = bucket.findIndex(
      (photo) => (authorCounts.get(photo.author || "") || 0) < maxPerAuthor,
    );
    const [photo] = bucket.splice(preferredIndex >= 0 ? preferredIndex : 0, 1);

    if (photo) {
      selected.push(photo);
      const author = photo.author || "";
      authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
    }

    if (!bucket.length) {
      buckets.delete(day);
      days.splice(dayIndex, 1);
      cursor = 0;
    } else {
      cursor += 1;
    }
  }

  return selected.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
}

function selectionStorageKey(tripId: string) {
  return `krew_memories_selection:${tripId}`;
}

function readSelectionOverrides(tripId: string): SelectionOverrides {
  try {
    const raw = localStorage.getItem(selectionStorageKey(tripId));
    if (!raw) return { included: [], excluded: [] };
    const parsed = JSON.parse(raw) as Partial<SelectionOverrides>;
    return {
      included: Array.isArray(parsed.included)
        ? parsed.included.filter((id): id is string => typeof id === "string")
        : [],
      excluded: Array.isArray(parsed.excluded)
        ? parsed.excluded.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return { included: [], excluded: [] };
  }
}

function writeSelectionOverrides(tripId: string, overrides: SelectionOverrides) {
  try {
    localStorage.setItem(selectionStorageKey(tripId), JSON.stringify(overrides));
  } catch {
    // Personal selection overrides are optional; Memories remains usable if storage is unavailable.
  }
}

function MemoriesPage() {
  const { tripId } = Route.useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Moi");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadFailures, setUploadFailures] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [editSelection, setEditSelection] = useState(false);
  const [showPartner, setShowPartner] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [selectionOverrides, setSelectionOverrides] = useState<SelectionOverrides>(() =>
    readSelectionOverrides(tripId),
  );
  const { permission, grantPermission, denyPermission, resetPermission } =
    useMemoriesPhotoPermission();

  useEffect(() => {
    setSelectionOverrides(readSelectionOverrides(tripId));
  }, [tripId]);

  useEffect(() => {
    getMemoriesViewer(tripId).then((viewer) => {
      if (!viewer) return;
      setUserId(viewer.userId);
      if (viewer.userName !== "Moi") setUserName(viewer.userName);
    });
  }, [tripId]);

  const {
    data: photos = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Photo[]>({
    queryKey: ["trip-photos", tripId],
    queryFn: () => listTripPhotos(tripId),
  });

  const automaticSelection = useMemo(() => buildKrewSelection(photos), [photos]);
  const automaticIds = useMemo(
    () => new Set(automaticSelection.map((photo) => photo.id)),
    [automaticSelection],
  );
  const selection = useMemo(() => {
    const included = new Set(selectionOverrides.included);
    const excluded = new Set(selectionOverrides.excluded);
    return photos
      .filter(
        (photo) =>
          (automaticIds.has(photo.id) && !excluded.has(photo.id)) || included.has(photo.id),
      )
      .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  }, [automaticIds, photos, selectionOverrides]);
  const selectionIds = useMemo(() => new Set(selection.map((photo) => photo.id)), [selection]);
  const hasSelectionOverrides =
    selectionOverrides.included.length > 0 || selectionOverrides.excluded.length > 0;

  const { data: recapSource } = useQuery({
    queryKey: ["trip-recap-source", tripId],
    queryFn: () => getMemoriesRecapSource(tripId),
    enabled: Boolean(tripId),
    retry: false,
  });
  const recap = recapSource
    ? buildTripRecap({
        trip: recapSource.trip,
        destination: recapSource.destination,
        photoCount: photos.length,
      })
    : null;

  const daysMap = useMemo(() => {
    const map = new Map<string, Photo[]>();
    for (const photo of selection) {
      const key = new Date(photo.created_at).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const list = map.get(key) || [];
      list.push(photo);
      map.set(key, list);
    }
    return map;
  }, [selection]);

  const like = useMutation({
    mutationFn: (id: string) => toggleTripPhotoLike(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip-photos", tripId] }),
    onError: (error) => {
      console.error("Impossible d'enregistrer l'appréciation:", error);
      toast.error("Impossible d’enregistrer ton choix pour le moment.");
    },
  });

  const remove = useMutation({
    mutationFn: (photo: Photo) => removeTripPhoto(photo),
    onSuccess: () => {
      setPhotoToDelete(null);
      qc.invalidateQueries({ queryKey: ["trip-photos", tripId] });
      toast.success("Photo supprimée");
    },
    onError: (error) => {
      console.error("Impossible de supprimer la photo:", error);
      toast.error("Impossible de supprimer cette photo pour le moment.");
    },
  });

  const updateSelectionOverrides = (next: SelectionOverrides) => {
    setSelectionOverrides(next);
    writeSelectionOverrides(tripId, next);
  };

  const toggleSelection = (photo: Photo) => {
    const included = new Set(selectionOverrides.included);
    const excluded = new Set(selectionOverrides.excluded);
    const isSelected = selectionIds.has(photo.id);
    const isAutomatic = automaticIds.has(photo.id);

    if (isSelected) {
      included.delete(photo.id);
      if (isAutomatic) excluded.add(photo.id);
    } else {
      excluded.delete(photo.id);
      if (!isAutomatic) included.add(photo.id);
    }

    updateSelectionOverrides({ included: [...included], excluded: [...excluded] });
  };

  const resetSelection = () => updateSelectionOverrides({ included: [], excluded: [] });

  const selectionReason = (photo: Photo) => {
    if (selectionOverrides.included.includes(photo.id)) return "Ajoutée par toi";
    if (photo.likes > 0) return `${photo.likes} appréciation${photo.likes > 1 ? "s" : ""}`;
    return "Équilibre les moments du voyage";
  };

  const download = async (isSelection = false) => {
    const source = isSelection ? selection : photos;
    if (!source.length || downloading) return;
    setDownloading(true);
    try {
      const used = new Set<string>();
      const files = source
        .filter((photo, index) => {
          const name = fileName(photo, index);
          if (used.has(name)) return false;
          used.add(name);
          return true;
        })
        .map((photo, index) => ({ name: fileName(photo, index), url: photo.url }));
      const blob = await createPhotosZip(files);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `krew-${isSelection ? "selection" : "photos"}-${tripId}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(
        `${files.length} photo${files.length > 1 ? "s" : ""} prête${files.length > 1 ? "s" : ""} à télécharger`,
      );
    } catch (error) {
      console.error("Impossible de préparer le téléchargement:", error);
      toast.error("Impossible de préparer le téléchargement pour le moment.");
    } finally {
      setDownloading(false);
    }
  };

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!userId || !files.length) {
      if (!userId && files.length) toast.error("Tu dois être connecté pour importer une photo.");
      return;
    }

    setUploading(true);
    setUploadFailures([]);
    let added = 0;
    let duplicates = 0;
    let errors = 0;
    setUploadProgress({ total: files.length, processed: 0, added: 0, duplicates: 0, errors: 0 });

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      try {
        if (!file.type.startsWith("image/")) throw new Error("Format non pris en charge");
        if (file.size > MAX_PHOTO_SIZE_BYTES) throw new Error("Fichier supérieur à 20 Mo");

        const hash = await sha256File(file);
        const result = await uploadTripPhoto({ tripId, userId, userName, file, hash });
        if (result.duplicate) duplicates += 1;
        else added += 1;
      } catch (error) {
        errors += 1;
        setUploadFailures((current) => [...current, file.name]);
        console.error(`Impossible d'importer ${file.name}:`, error);
      } finally {
        setUploadProgress({
          total: files.length,
          processed: index + 1,
          added,
          duplicates,
          errors,
        });
      }
    }

    if (added) await qc.invalidateQueries({ queryKey: ["trip-photos", tripId] });
    const summary = `${added} ajoutée${added > 1 ? "s" : ""} · ${duplicates} doublon${duplicates > 1 ? "s" : ""} · ${errors} erreur${errors > 1 ? "s" : ""}`;
    if (added) toast.success(summary);
    else if (errors) toast.error(summary);
    else toast.info(summary);
    setUploading(false);
  };

  if (isError) {
    return (
      <KrewPageShell
        data-krew-story-page="memories"
        size="story"
        gutter="wide"
        className="space-y-6 py-8 sm:py-12"
      >
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Retour au voyage
        </Link>
        <section
          className="rounded-[24px] border border-border/60 bg-surface/30 p-6 text-center sm:p-8"
          role="alert"
        >
          <h1 className="font-display text-2xl font-normal text-foreground">
            Impossible de charger les souvenirs
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            L’album n’est pas disponible pour le moment. Tes photos n’ont pas été supprimées.
          </p>
          <Button className="mt-5" onClick={() => refetch()}>
            Réessayer
          </Button>
        </section>
      </KrewPageShell>
    );
  }

  return (
    <KrewPageShell
      data-krew-story-page="memories"
      size="story"
      gutter="wide"
      className="space-y-8 py-8 sm:py-12"
    >
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour au voyage
      </Link>

      {recap?.eligible ? (
        <KrewRecapCard
          recap={recap}
          tripName={recapSource?.trip?.name as string | null}
          photos={selection
            .slice(0, 3)
            .map((photo) => ({ id: photo.id, url: photo.url, alt: photoAlt(photo) }))}
        />
      ) : null}

      <header className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative space-y-2">
          <KrewOrganicBlob
            tone="sage"
            variant="soft"
            className="pointer-events-none absolute -left-4 -top-4 z-0 h-[60px] w-[160px] opacity-40"
          />
          <div className="relative z-10 flex items-center gap-2 text-primary">
            <KrewIcon name="camera" tone="plum" size="sm" className="size-5" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">
              Souvenirs
            </span>
          </div>
          <div className="relative z-10 inline-block">
            <h1 className="font-display text-[36px] font-normal leading-tight text-foreground sm:text-[48px]">
              L&apos;album du voyage
            </h1>
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="md"
              className="pointer-events-none absolute -bottom-1.5 left-0 w-[140px]"
            />
          </div>
          <p className="font-sans text-sm text-muted-foreground">
            Retrouve les moments partagés avec le groupe.
          </p>
          {selection.length > 0 ? (
            <div className="pt-1">
              <KrewNote variant="label" tone="cream" rotation={-1}>
                {selection.length} souvenir{selection.length > 1 ? "s" : ""} sélectionné
                {selection.length > 1 ? "s" : ""}
              </KrewNote>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {photos.length > 0 ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 rounded-xl text-xs font-medium"
                onClick={() => download(false)}
                disabled={downloading}
                aria-busy={downloading}
              >
                {downloading ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin" />
                ) : (
                  <Download className="size-3.5 shrink-0" />
                )}{" "}
                {downloading ? "Préparation…" : `Toutes (${photos.length})`}
              </Button>
              <Button
                size="sm"
                className="min-h-10 rounded-xl text-xs font-medium"
                onClick={() => download(true)}
                disabled={downloading || selection.length === 0}
                aria-busy={downloading}
              >
                {downloading ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin" />
                ) : (
                  <KrewIcon name="favorite" tone="cream" size="sm" className="size-3.5 shrink-0" />
                )}{" "}
                {downloading ? "Préparation…" : `Sélection KREW (${selection.length})`}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 rounded-xl text-xs font-medium"
                onClick={() => setShowAlbum(true)}
                disabled={selection.length === 0}
              >
                <BookOpen className="size-3.5 shrink-0" /> Album
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 rounded-xl text-xs font-medium"
                onClick={() => setShowPartner(true)}
                disabled={selection.length === 0}
              >
                <ExternalLink className="size-3.5 shrink-0" /> Imprimer
              </Button>
            </>
          ) : null}
          {permission !== "prompt" ? (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              aria-label="Réinitialiser l’autorisation d’import de photos"
              onClick={resetPermission}
            >
              <Settings className="size-3.5 shrink-0" />
            </Button>
          ) : null}
        </div>
      </header>

      {photos.length > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] sm:text-sm text-foreground/90 font-sans">
          <strong>KREW a sélectionné {selection.length} photos</strong> parmi {photos.length} photos
          du voyage. La sélection répartit les photos sur les différentes journées et tient compte
          des appréciations du groupe.
        </div>
      )}

      <section className="space-y-3 rounded-[24px] border border-dashed border-border bg-surface/30 p-8 text-center">
        <input
          type="file"
          multiple
          accept="image/*"
          ref={fileInputRef}
          onChange={upload}
          className="hidden"
        />
        {!isLoading && !photos.length ? (
          <div className="mx-auto flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
            <img
              src="/brand/otter-states/trip-progress.png"
              alt=""
              className="h-auto w-[72px] object-contain sm:w-[80px]"
            />
          </div>
        ) : (
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KrewIcon name="plus" tone="plum" size="sm" className="size-6" />
          </div>
        )}
        <div>
          <p className="font-display text-2xl font-normal text-foreground">
            {!isLoading && !photos.length
              ? "L'album est encore vide"
              : "Ajoute tes photos de voyage"}
          </p>
          <p className="mx-auto mt-1 max-w-sm font-sans text-[13px] text-muted-foreground">
            {!isLoading && !photos.length
              ? "Importe les premières photos pour constituer l'album du voyage. Elles restent privées et accessibles uniquement aux participants autorisés."
              : "Les photos restent privées et accessibles uniquement aux participants autorisés."}
          </p>
        </div>
        {uploadProgress ? (
          <div className="mx-auto max-w-sm space-y-2" role="status" aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{
                  width: `${uploadProgress.total ? Math.round((uploadProgress.processed / uploadProgress.total) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {uploadProgress.processed}/{uploadProgress.total} · {uploadProgress.added} ajoutée
              {uploadProgress.added > 1 ? "s" : ""} · {uploadProgress.duplicates} doublon
              {uploadProgress.duplicates > 1 ? "s" : ""} · {uploadProgress.errors} erreur
              {uploadProgress.errors > 1 ? "s" : ""}
            </p>
            {uploadFailures.length > 0 ? (
              <p className="text-xs text-destructive">
                À vérifier : {uploadFailures.slice(0, 3).join(", ")}
                {uploadFailures.length > 3 ? ` +${uploadFailures.length - 3}` : ""}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="pt-1">
          <Button
            size="sm"
            className="min-h-10 rounded-xl font-medium"
            disabled={uploading}
            aria-busy={uploading}
            onClick={() =>
              permission === "granted"
                ? fileInputRef.current?.click()
                : setShowPermissionModal(true)
            }
          >
            {uploading ? (
              <>
                <Loader2 className="size-3.5 shrink-0 animate-spin" /> Importation…
              </>
            ) : (
              "Choisir des photos"
            )}
          </Button>
        </div>
      </section>

      {isLoading ? (
        <div className="py-8">
          <KrewThinkingState
            context="generic"
            customMessage="Chargement des souvenirs…"
            delayMs={0}
          />
        </div>
      ) : !photos.length ? null : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {photos.map((photo, index) => {
            const hasRotation =
              index % 5 === 1 ? "rotate-[1deg]" : index % 5 === 3 ? "-rotate-[1deg]" : "";
            return (
              <article
                key={photo.id}
                className={cn(
                  "group overflow-hidden rounded-[18px] border border-border/40 bg-background transition-transform duration-200 hover:-translate-y-0.5 shadow-2xs",
                  hasRotation,
                )}
              >
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  <img
                    src={photo.url}
                    alt={photoAlt(photo)}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  {photo.likes > 0 ? (
                    <div className="absolute top-2.5 right-2.5 z-10">
                      <KrewMark type="heart" tone="plum" size="sm" className="size-5" />
                    </div>
                  ) : null}
                </div>
                <div className="p-3.5 flex items-center justify-between text-[13px] sm:text-sm text-muted-foreground font-sans">
                  <span>
                    Par <strong className="text-foreground font-semibold">{photo.author}</strong>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => like.mutate(photo.id)}
                      disabled={like.isPending}
                      aria-busy={like.isPending}
                      className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-2 hover:text-primary transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60"
                      aria-label={
                        photo.likedByMe ? "Retirer mon appréciation" : "J’aime cette photo"
                      }
                    >
                      <KrewIcon
                        name="favorite"
                        tone={photo.likedByMe ? "plum" : "muted"}
                        size="sm"
                        className="size-3.5"
                      />
                      <span className="font-mono text-xs font-semibold">{photo.likes}</span>
                    </button>
                    {photo.owner_user_id === userId && (
                      <button
                        type="button"
                        onClick={() => setPhotoToDelete(photo)}
                        disabled={remove.isPending}
                        aria-busy={remove.isPending}
                        className="inline-flex size-10 items-center justify-center rounded-lg hover:text-destructive transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60"
                        aria-label="Supprimer la photo"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showPermissionModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-permission-title"
        >
          <div className="max-w-md space-y-4 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3
                id="photo-permission-title"
                className="font-display text-xl font-normal text-foreground"
              >
                Autoriser l’import de photos
              </h3>
              <button
                type="button"
                onClick={() => setShowPermissionModal(false)}
                aria-label="Fermer"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="font-sans text-[13px] leading-relaxed text-muted-foreground">
              Les photos sont stockées dans un espace privé et accessibles uniquement aux
              participants autorisés.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="min-h-10 w-full rounded-xl font-medium"
                onClick={() => {
                  grantPermission();
                  setShowPermissionModal(false);
                  setTimeout(() => fileInputRef.current?.click(), 150);
                }}
              >
                Autoriser
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 w-full rounded-xl font-medium"
                onClick={() => {
                  denyPermission();
                  setShowPermissionModal(false);
                }}
              >
                Refuser
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {photoToDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-photo-title"
        >
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-destructive">
                Suppression
              </p>
              <h2
                id="delete-photo-title"
                className="font-display text-2xl font-normal text-foreground"
              >
                Supprimer cette photo ?
              </h2>
            </div>
            <p className="font-sans text-[13px] leading-relaxed text-muted-foreground">
              Elle sera retirée de l’album du groupe et de ta sélection KREW. Cette action ne peut
              pas être annulée.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 rounded-xl"
                onClick={() => setPhotoToDelete(null)}
                disabled={remove.isPending}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="min-h-10 rounded-xl"
                onClick={() => remove.mutate(photoToDelete)}
                disabled={remove.isPending}
                aria-busy={remove.isPending}
              >
                {remove.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}{" "}
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showAlbum ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-background/85 p-4 backdrop-blur-md sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-album-title"
        >
          <div className="mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border/50 p-5 sm:p-7">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                  Souvenirs KREW
                </p>
                <h2
                  id="photo-album-title"
                  className="font-display text-2xl font-normal text-foreground sm:text-3xl"
                >
                  Notre voyage en images
                </h2>
                <p className="mt-0.5 font-sans text-[13px] text-muted-foreground">
                  {selection.length} moments · {daysMap.size} chapitre{daysMap.size > 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-9 rounded-xl text-xs"
                  onClick={() => setEditSelection((current) => !current)}
                >
                  {editSelection ? "Voir l’album" : "Personnaliser"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setEditSelection(false);
                    setShowAlbum(false);
                  }}
                  aria-label="Fermer"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            <div className="space-y-12 p-5 sm:p-8">
              {editSelection ? (
                <section
                  className="space-y-4 rounded-[24px] border border-primary/20 bg-primary/5 p-4 sm:p-5"
                  aria-label="Personnaliser la sélection KREW"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                        Ta sélection
                      </p>
                      <h3 className="font-display text-2xl font-normal text-foreground">
                        Choisis les moments à garder
                      </h3>
                      <p className="mt-1 max-w-2xl font-sans text-[13px] leading-relaxed text-muted-foreground">
                        KREW équilibre automatiquement les journées, les auteurs et les
                        appréciations. Tes ajustements restent personnels sur cet appareil et ne
                        changent pas la sélection des autres participants.
                      </p>
                    </div>
                    {hasSelectionOverrides ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-9 shrink-0 rounded-xl text-xs"
                        onClick={resetSelection}
                      >
                        Revenir à la sélection KREW
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {photos.map((photo) => {
                      const isSelected = selectionIds.has(photo.id);
                      return (
                        <article
                          key={photo.id}
                          className={cn(
                            "overflow-hidden rounded-2xl border bg-background",
                            isSelected
                              ? "border-primary/40 ring-1 ring-primary/15"
                              : "border-border/40",
                          )}
                        >
                          <div className="aspect-[4/3] overflow-hidden bg-muted">
                            <img
                              src={photo.url}
                              alt={photoAlt(photo)}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <div className="space-y-2 p-2.5">
                            <p className="truncate font-sans text-xs font-medium text-foreground">
                              {photo.original_filename || `Photo de ${photo.author}`}
                            </p>
                            <p className="min-h-8 font-sans text-[10px] leading-tight text-muted-foreground">
                              {isSelected
                                ? selectionReason(photo)
                                : "Pas dans la sélection actuelle"}
                            </p>
                            <Button
                              variant={isSelected ? "outline" : "default"}
                              size="sm"
                              className="min-h-8 w-full rounded-lg text-[11px]"
                              onClick={() => toggleSelection(photo)}
                            >
                              {isSelected ? "Retirer" : "Ajouter"}
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}
              <div className="relative aspect-[16/9] overflow-hidden rounded-[26px] border border-border/50 bg-muted sm:aspect-[16/8]">
                {selection[0] ? (
                  <img
                    src={selection[0].url}
                    alt={photoAlt(selection[0])}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/75 via-black/20 to-transparent p-6 sm:p-10">
                  <div className="max-w-xl text-white">
                    <p className="font-mono text-xs uppercase tracking-[0.2em]">
                      KREW · {recapSource?.destination?.name || "Notre voyage"}
                    </p>
                    <h3 className="font-display text-3xl font-normal sm:text-5xl">
                      {recapSource?.trip?.name || "Notre voyage"}
                    </h3>
                    <p className="mt-2 max-w-lg font-sans text-sm text-white/90">
                      Les moments que la Krew a retenus, équilibrés entre les journées, les
                      personnes et les coups de cœur du groupe.
                    </p>
                  </div>
                </div>
              </div>

              {[...daysMap.entries()].map(([day, items], dayIndex) => {
                const [hero, ...rest] = items;
                const authors = new Set(items.map((photo) => photo.author).filter(Boolean)).size;
                return (
                  <section
                    key={day}
                    className="space-y-4"
                    aria-label={`Chapitre ${dayIndex + 1} — ${day}`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <KrewNote
                          variant="label"
                          tone="cream"
                          rotation={dayIndex % 2 === 0 ? -1 : 1}
                        >
                          Chapitre {dayIndex + 1}
                        </KrewNote>
                        <h4 className="mt-2 font-display text-2xl font-normal text-foreground sm:text-3xl">
                          {day}
                        </h4>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {items.length} moment{items.length > 1 ? "s" : ""} · {authors} photographe
                        {authors > 1 ? "s" : ""}
                      </p>
                    </div>

                    {hero ? (
                      <figure className="overflow-hidden rounded-[22px] border border-border/40 bg-background">
                        <div className="aspect-[16/9] overflow-hidden bg-muted sm:aspect-[16/7]">
                          <img
                            src={hero.url}
                            alt={photoAlt(hero)}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <figcaption className="flex flex-wrap items-center justify-between gap-2 p-3.5 font-sans text-xs text-muted-foreground">
                          <span>
                            Par <strong className="text-foreground">{hero.author}</strong>
                          </span>
                          <span>
                            {hero.likes > 0
                              ? `${hero.likes} appréciation${hero.likes > 1 ? "s" : ""}`
                              : selectionReason(hero)}
                          </span>
                        </figcaption>
                      </figure>
                    ) : null}

                    {rest.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {rest.map((photo) => (
                          <figure
                            key={photo.id}
                            className="overflow-hidden rounded-2xl border border-border/40 bg-background"
                          >
                            <div className="aspect-[4/3] overflow-hidden bg-muted">
                              <img
                                src={photo.url}
                                alt={photoAlt(photo)}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <figcaption className="space-y-0.5 p-2.5 font-sans text-[11px] text-muted-foreground">
                              <p className="truncate font-medium text-foreground">
                                {photo.original_filename || "Souvenir KREW"}
                              </p>
                              <p>
                                Par {photo.author}
                                {photo.likes > 0 ? ` · ${photo.likes} ♥` : ""}
                              </p>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border/50 p-5 sm:p-7">
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 rounded-xl"
                onClick={() => {
                  setEditSelection(false);
                  setShowAlbum(false);
                }}
              >
                Fermer
              </Button>
              <Button
                size="sm"
                className="min-h-10 rounded-xl font-medium"
                onClick={() => download(true)}
                disabled={downloading}
                aria-busy={downloading}
              >
                {downloading ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin" />
                ) : (
                  <Download className="size-3.5 shrink-0" />
                )}{" "}
                {downloading ? "Préparation…" : "Télécharger la sélection"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showPartner ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-partner-title"
        >
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                  Prestataire externe
                </p>
                <h2
                  id="photo-partner-title"
                  className="font-display text-2xl font-normal text-foreground"
                >
                  Créer un album photo
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPartner(false)}
                aria-label="Fermer"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="font-sans text-[13px] leading-relaxed text-muted-foreground">
              KREW ne vend ni n&apos;imprime l&apos;album. Tu vas être redirigé·e vers{" "}
              <strong>{PHOTO_BOOK_PARTNER.name}</strong>, un prestataire externe, pour créer et
              commander ton album.
            </p>
            <div className="space-y-1 rounded-2xl border border-border/60 bg-muted/40 p-4 font-sans text-[13px]">
              <p className="font-semibold text-foreground">
                Ta sélection KREW : {selection.length} photos
              </p>
              <p className="leading-relaxed text-muted-foreground">
                Pour des raisons de confidentialité, KREW ne transmet pas automatiquement tes photos
                au prestataire. Télécharge d&apos;abord la sélection puis importe-la chez le
                prestataire.
              </p>
            </div>
            <p className="font-sans text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
              {PHOTO_BOOK_PARTNER.affiliateDisclosure}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 rounded-xl"
                onClick={() => setShowPartner(false)}
              >
                Annuler
              </Button>
              <Button size="sm" className="min-h-10 rounded-xl font-medium" asChild>
                <a href={PHOTO_BOOK_PARTNER.url} target="_blank" rel="noopener noreferrer">
                  Ouvrir {PHOTO_BOOK_PARTNER.name} <ExternalLink className="ml-1 size-3.5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </KrewPageShell>
  );
}
