import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Download,
  X,
  Settings,
  Loader2,
  Trash2,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sha256File } from "@/lib/souvenirs-photo-upload";
import { createPhotosZip } from "@/lib/souvenirs-download";
import {
  getMemoriesRecapSource,
  getMemoriesViewer,
  listTripPhotos,
  removeTripPhoto,
  toggleTripPhotoLike,
  uploadTripPhoto,
  type Photo,
} from "@/lib/memories-service";
import { KrewIcon, KrewMark, KrewNote, KrewOrganicBlob } from "@/components/krew/visual-language";
import { KrewRecapCard } from "@/components/krew/KrewRecapCard";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { buildTripRecap } from "@/lib/krew/trip-recap";
import { cn } from "@/lib/utils";
import { useMemoriesPhotoPermission } from "@/hooks/use-memories-photo-permission";

const MAX_PHOTO_SIZE_BYTES = 20 * 1024 * 1024;
const PHOTO_BOOK_PARTNER = {
  name: "CEWE",
  url: "https://www.cewe.fr/livres-photo-cewe.html",
  affiliateDisclosure:
    "KREW peut percevoir une rémunération si tu effectues un achat via un lien partenaire. Cela ne modifie pas le prix payé.",
};
export const Route = createFileRoute("/_authenticated/trips/$tripId/memories")({
  head: () => ({ meta: [{ title: "Souvenirs du voyage — KREW" }] }),
  component: MemoriesPage,
});
function fileName(p: Photo, i: number) {
  return (p.original_filename?.trim() || `photo-${String(i + 1).padStart(3, "0")}.jpg`).replace(
    /[\\/:*?"<>|]/g,
    "-",
  );
}
function photoAlt(p: Photo) {
  return p.original_filename?.trim()
    ? `Souvenir : ${p.original_filename.trim()}`
    : `Souvenir partagé par ${p.author || "le groupe"}`;
}
function buildKrewSelection(photos: Photo[]) {
  if (photos.length <= 12) return [...photos];
  const target = Math.min(120, Math.max(12, Math.round(photos.length * 0.14)));
  const buckets = new Map<string, Photo[]>();
  for (const p of [...photos].sort((a, b) => b.likes - a.likes)) {
    const d = new Date(p.created_at).toISOString().slice(0, 10);
    const b = buckets.get(d) || [];
    b.push(p);
    buckets.set(d, b);
  }
  const days = [...buckets.keys()].sort();
  const out: Photo[] = [];
  let i = 0;
  while (out.length < target && days.length) {
    const d = days[i % days.length],
      b = buckets.get(d)!;
    const p = b.shift();
    if (p) out.push(p);
    if (!b.length) {
      buckets.delete(d);
      days.splice(i % days.length, 1);
      i = 0;
    } else i++;
  }
  return out.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
}

function MemoriesPage() {
  const { tripId } = Route.useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Moi");
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [showPartner, setShowPartner] = useState(false);
  const { permission, grantPermission, denyPermission, resetPermission } = useMemoriesPhotoPermission();
  const [showModal, setShowModal] = useState(false);
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
  const selection = buildKrewSelection(photos);
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
  const daysMap = new Map<string, Photo[]>();
  for (const p of selection) {
    const key = new Date(p.created_at).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const list = daysMap.get(key) || [];
    list.push(p);
    daysMap.set(key, list);
  }
  const like = useMutation({
    mutationFn: (id: string) => toggleTripPhotoLike(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip-photos", tripId] }),
    onError: (e) => {
      console.error("Impossible d'enregistrer l'appréciation:", e);
      toast.error("Impossible d’enregistrer ton choix pour le moment.");
    },
  });
  const remove = useMutation({
    mutationFn: (p: Photo) => removeTripPhoto(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip-photos", tripId] });
      toast.success("Photo supprimée");
    },
    onError: (e) => {
      console.error("Impossible de supprimer la photo:", e);
      toast.error("Impossible de supprimer cette photo pour le moment.");
    },
  });
  const download = async (isSelection = false) => {
    const source = isSelection ? selection : photos;
    if (!source.length || downloading) return;
    setDownloading(true);
    try {
      const used = new Set<string>();
      const files = source
        .filter((p, i) => {
          const n = fileName(p, i);
          if (used.has(n)) return false;
          used.add(n);
          return true;
        })
        .map((p, i) => ({ name: fileName(p, i), url: p.url }));
      const blob = await createPhotosZip(files);
      const u = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = u;
      a.download = `krew-${isSelection ? "selection" : "photos"}-${tripId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(u);
      toast.success(
        `${files.length} photo${files.length > 1 ? "s" : ""} prête${files.length > 1 ? "s" : ""} à télécharger`,
      );
    } catch (e) {
      console.error("Impossible de préparer le téléchargement:", e);
      toast.error("Impossible de préparer le téléchargement pour le moment.");
    } finally {
      setDownloading(false);
    }
  };
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!userId || !files.length) {
      if (!userId && files.length) toast.error("Tu dois être connecté pour importer une photo.");
      return;
    }
    setUploading(true);
    let added = 0,
      duplicates = 0;
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} n'est pas une image prise en charge.`);
          continue;
        }
        if (file.size > MAX_PHOTO_SIZE_BYTES) {
          toast.error(`${file.name} dépasse la limite de 20 Mo.`);
          continue;
        }
        const hash = await sha256File(file);
        const result = await uploadTripPhoto({ tripId, userId, userName, file, hash });
        if (result.duplicate) {
          duplicates++;
          continue;
        }
        added++;
      }
      await qc.invalidateQueries({ queryKey: ["trip-photos", tripId] });
      if (added)
        toast.success(
          `${added} photo${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""} à l’album`,
        );
      if (duplicates)
        toast.info(
          `${duplicates} doublon${duplicates > 1 ? "s" : ""} ignoré${duplicates > 1 ? "s" : ""}`,
        );
    } catch (e) {
      console.error("Impossible d'importer les photos:", e);
      toast.error("Impossible d’importer les photos pour le moment.");
    } finally {
      setUploading(false);
    }
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
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="size-4" /> Retour au voyage
      </Link>

      {recap?.eligible ? (
        <KrewRecapCard
          recap={recap}
          tripName={recapSource?.trip?.name}
          photos={selection
            .slice(0, 3)
            .map((photo) => ({ id: photo.id, url: photo.url, alt: photoAlt(photo) }))}
        />
      ) : null}

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 relative">
        <div className="space-y-2 relative">
          <KrewOrganicBlob
            tone="sage"
            variant="soft"
            className="absolute -top-4 -left-4 w-[160px] h-[60px] opacity-40 pointer-events-none z-0"
          />
          <div className="flex items-center gap-2 text-primary relative z-10">
            <KrewIcon name="camera" tone="plum" size="sm" className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wider font-mono">
              Souvenirs
            </span>
          </div>
          <div className="relative inline-block z-10">
            <h1 className="font-display text-[36px] sm:text-[48px] font-normal leading-tight text-foreground">
              L&apos;album du voyage
            </h1>
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="md"
              className="absolute left-0 -bottom-1.5 w-[140px] pointer-events-none"
            />
          </div>
          <p className="text-sm text-muted-foreground font-sans">
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
          {photos.length > 0 && (
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
                disabled={downloading}
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
              >
                <BookOpen className="size-3.5 shrink-0" /> Album
              </Button>
            </>
          )}
          {photos.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-10 rounded-xl text-xs font-medium"
              onClick={() => setShowPartner(true)}
            >
              <ExternalLink className="size-3.5 shrink-0" /> Imprimer
            </Button>
          )}
          {permission !== "prompt" && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              aria-label="Réinitialiser l’autorisation d’import de photos"
              onClick={resetPermission}
            >
              <Settings className="size-3.5 shrink-0" />
            </Button>
          )}
        </div>
      </header>

      {photos.length > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] sm:text-sm text-foreground/90 font-sans">
          <strong>KREW a sélectionné {selection.length} photos</strong> parmi {photos.length} photos
          du voyage. La sélection répartit les photos sur les différentes journées et tient compte
          des appréciations du groupe.
        </div>
      )}

      <section className="rounded-[24px] border border-dashed border-border bg-surface/30 p-8 text-center space-y-3">
        <input
          type="file"
          multiple
          accept="image/*"
          ref={fileInputRef}
          onChange={upload}
          className="hidden"
        />
        {!isLoading && !photos.length ? (
          <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
            <img
              src="/brand/otter-states/trip-progress.png"
              alt=""
              className="w-[72px] sm:w-[80px] h-auto object-contain"
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
          <p className="text-[13px] text-muted-foreground font-sans mt-1 max-w-sm mx-auto">
            {!isLoading && !photos.length
              ? "Importe les premières photos pour constituer l'album du voyage. Elles restent privées et accessibles uniquement aux participants autorisés."
              : "Les photos restent privées et accessibles uniquement aux participants autorisés."}
          </p>
        </div>
        <div className="pt-1">
          <Button
            size="sm"
            className="min-h-10 rounded-xl font-medium"
            disabled={uploading}
            aria-busy={uploading}
            onClick={() =>
              permission === "granted" ? fileInputRef.current?.click() : setShowModal(true)
            }
          >
            {uploading ? (
              <>
                <Loader2 className="size-3.5 animate-spin shrink-0" /> Importation…
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
          {photos.map((p, idx) => {
            const hasRotation =
              idx % 5 === 1 ? "rotate-[1deg]" : idx % 5 === 3 ? "-rotate-[1deg]" : "";
            return (
              <article
                key={p.id}
                className={cn(
                  "group overflow-hidden rounded-[18px] border border-border/40 bg-background transition-transform duration-200 hover:-translate-y-0.5 shadow-2xs",
                  hasRotation,
                )}
              >
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  <img
                    src={p.url}
                    alt={photoAlt(p)}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  {p.likes > 0 ? (
                    <div className="absolute top-2.5 right-2.5 z-10">
                      <KrewMark type="heart" tone="plum" size="sm" className="size-5" />
                    </div>
                  ) : null}
                </div>
                <div className="p-3.5 flex items-center justify-between text-[13px] sm:text-sm text-muted-foreground font-sans">
                  <span>
                    Par <strong className="text-foreground font-semibold">{p.author}</strong>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => like.mutate(p.id)}
                      disabled={like.isPending}
                      aria-busy={like.isPending}
                      className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-2 hover:text-primary transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60"
                      aria-label={p.likedByMe ? "Retirer mon appréciation" : "J’aime cette photo"}
                    >
                      <KrewIcon
                        name="favorite"
                        tone={p.likedByMe ? "plum" : "muted"}
                        size="sm"
                        className="size-3.5"
                      />
                      <span className="font-mono text-xs font-semibold">{p.likes}</span>
                    </button>
                    {p.owner_user_id === userId && (
                      <button
                        type="button"
                        onClick={() => remove.mutate(p)}
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

      {showModal && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-permission-title"
        >
          <div className="bg-card border border-border/60 rounded-2xl p-6 max-w-md space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3
                id="photo-permission-title"
                className="font-display text-xl font-normal text-foreground"
              >
                Autoriser l’import de photos
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Fermer"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-[13px] text-muted-foreground font-sans leading-relaxed">
              Les photos sont stockées dans un espace privé et accessibles uniquement aux
              participants autorisés.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="min-h-10 rounded-xl font-medium w-full"
                onClick={() => {
                  grantPermission();
                  setShowModal(false);
                  setTimeout(() => fileInputRef.current?.click(), 150);
                }}
              >
                Autoriser
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 rounded-xl font-medium w-full"
                onClick={() => {
                  denyPermission();
                  setShowModal(false);
                }}
              >
                Refuser
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAlbum && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 overflow-y-auto p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-album-title"
        >
          <div className="mx-auto max-w-5xl rounded-[28px] bg-card border border-border/60 shadow-xl overflow-hidden">
            <div className="p-5 sm:p-7 flex items-center justify-between border-b border-border/50 gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary font-mono">
                  Souvenirs KREW
                </p>
                <h2
                  id="photo-album-title"
                  className="font-display text-2xl sm:text-3xl font-normal text-foreground"
                >
                  Notre voyage en images
                </h2>
                <p className="text-[13px] text-muted-foreground font-sans mt-0.5">
                  {selection.length} moments sélectionnés · {daysMap.size} journée(s)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAlbum(false)}
                aria-label="Fermer"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-5 sm:p-8 space-y-10">
              <div className="rounded-[24px] overflow-hidden border border-border/50 bg-muted aspect-[16/8] relative">
                {selection[0] && (
                  <img
                    src={selection[0].url}
                    alt={photoAlt(selection[0])}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-6 sm:p-10">
                  <div className="text-white">
                    <p className="text-xs uppercase tracking-[0.2em] font-mono">KREW</p>
                    <h3 className="font-display text-3xl sm:text-5xl font-normal">Notre voyage</h3>
                    <p className="text-xs mt-1 opacity-90 font-sans">
                      Une sélection de {selection.length} souvenirs
                    </p>
                  </div>
                </div>
              </div>
              {[...daysMap.entries()].map(([day, items]) => (
                <section key={day} className="space-y-3">
                  <h4 className="font-display text-xl font-normal text-foreground">{day}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {items.map((p, i) => (
                      <figure key={p.id} className="space-y-1">
                        <div className="aspect-[4/3] rounded-xl overflow-hidden bg-muted border border-border/40">
                          <img
                            src={p.url}
                            alt={photoAlt(p)}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <figcaption className="text-xs text-muted-foreground truncate font-sans">
                          {p.original_filename || `Souvenir ${i + 1}`}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="p-5 sm:p-7 border-t border-border/50 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 rounded-xl"
                onClick={() => setShowAlbum(false)}
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
      )}

      {showPartner && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-partner-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-card border border-border/60 p-6 space-y-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary font-mono">
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
            <p className="text-[13px] text-muted-foreground font-sans leading-relaxed">
              KREW ne vend ni n&apos;imprime l&apos;album. Tu vas être redirigé·e vers{" "}
              <strong>{PHOTO_BOOK_PARTNER.name}</strong>, un prestataire externe, pour créer et
              commander ton album.
            </p>
            <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-[13px] font-sans space-y-1">
              <p className="font-semibold text-foreground">
                Ta sélection KREW : {selection.length} photos
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Pour des raisons de confidentialité, KREW ne transmet pas automatiquement tes photos
                au prestataire. Télécharge d&apos;abord la sélection puis importe-la chez le
                prestataire.
              </p>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed font-sans">
              {PHOTO_BOOK_PARTNER.affiliateDisclosure}
            </p>
            <div className="flex gap-2 justify-end pt-1">
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
                  Ouvrir {PHOTO_BOOK_PARTNER.name} <ExternalLink className="size-3.5 ml-1" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </KrewPageShell>
  );
}
