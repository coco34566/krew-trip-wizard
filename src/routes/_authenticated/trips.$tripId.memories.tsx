import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, Heart, Plus, Sparkles, ShieldAlert, X, Settings, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/trips/$tripId/memories")({
  head: () => ({
    meta: [
      { title: "Souvenirs du voyage — Krew" },
      { name: "description", content: "Album photo collaboratif et souvenirs de notre voyage." },
    ],
  }),
  component: MemoriesPage,
});

type Photo = {
  id: string;
  trip_id: string;
  url: string;
  author: string;
  likes: number;
  created_at: string;
};

// Compression/resizing helper to keep DB storage extremely light and fast (~50-100KB per image)
const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1000;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        // Compress as JPEG to keep size minimal
        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

function MemoriesPage() {
  const { tripId } = Route.useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [userName, setUserName] = useState("Moi");
  const [uploading, setUploading] = useState(false);

  // Permission d'upload: "granted" | "denied" | "prompt"
  const [permission, setPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  const [showPermissionModal, setShowModal] = useState(false);

  // Charger la configuration d'autorisation
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPerm = localStorage.getItem("krew_photo_permission");
      if (savedPerm === "granted" || savedPerm === "denied") {
        setPermission(savedPerm);
      }
    }
  }, []);

  // Fetch photos from collaborative Supabase database table!
  const { data: photos = [], isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: ["trip-photos", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_photos" as any)
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load trip photos", error);
        throw error;
      }
      return data as Photo[];
    },
  });

  // Charger le nom d'affichage de l'utilisateur
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("trip_participants")
          .select("display_name")
          .eq("trip_id", tripId)
          .eq("user_id", user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.display_name) {
              setUserName(data.display_name);
            }
          });
      }
    });
  }, [tripId]);

  // Mutations
  const likeMutation = useMutation({
    mutationFn: async ({ id, currentLikes }: { id: string; currentLikes: number }) => {
      const { error } = await supabase
        .from("trip_photos" as any)
        .update({ likes: currentLikes + 1 })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-photos", tripId] });
    },
    onError: (e) => {
      toast.error("Impossible d'enregistrer le like.");
      console.error(e);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (payload: Omit<Photo, "id" | "created_at">[]) => {
      const { error } = await supabase.from("trip_photos" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["trip-photos", tripId] });
      toast.success(`${variables.length} photo(s) ajoutée(s) à l'album du groupe !`);
    },
    onError: (e) => {
      toast.error("Erreur lors de l'enregistrement en base.");
      console.error(e);
    },
  });

  const handleLike = (id: string, currentLikes: number) => {
    likeMutation.mutate({ id, currentLikes });
  };

  const grantPermission = () => {
    localStorage.setItem("krew_photo_permission", "granted");
    setPermission("granted");
    setShowModal(false);
    toast.success("Autorisation accordée !");
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 150);
  };

  const denyPermission = () => {
    localStorage.setItem("krew_photo_permission", "denied");
    setPermission("denied");
    setShowModal(false);
    toast.error("Importation bloquée : autorisation refusée.");
  };

  const resetPermission = () => {
    localStorage.removeItem("krew_photo_permission");
    setPermission("prompt");
    toast.info("Paramètres d'autorisation réinitialisés.");
  };

  const handleImportClick = () => {
    if (permission === "granted") {
      fileInputRef.current?.click();
    } else {
      setShowModal(true);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`Le fichier ${file.name} n'est pas une image prise en charge.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    const uploadedList: Omit<Photo, "id" | "created_at">[] = [];

    try {
      for (const file of validFiles) {
        // Resize and compress
        const base64 = await resizeImage(file);
        uploadedList.push({
          trip_id: tripId,
          url: base64,
          author: userName,
          likes: 0,
        });
      }

      if (uploadedList.length > 0) {
        await uploadMutation.mutateAsync(uploadedList);
      }
    } catch (err) {
      toast.error("Impossible de traiter les images.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8 relative">
      <div>
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition"
        >
          <ArrowLeft className="size-4" /> Retour à Mon Voyage
        </Link>
      </div>

      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Camera className="size-6" />
            <span className="text-xs font-semibold uppercase tracking-wider">Souvenirs</span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            L&apos;album de notre voyage
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Retrouve ici les meilleurs moments partagés avec tes ami·e·s. Ajoute tes propres pépites et vote pour tes préférées !
          </p>
        </div>

        {permission !== "prompt" && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetPermission}
            className="gap-1.5 text-xs self-start sm:self-auto"
          >
            <Settings className="size-3.5" /> Gérer l&apos;autorisation
          </Button>
        )}
      </header>

      {/* Zone d'importation de photos */}
      <section className="rounded-3xl border border-dashed border-border bg-surface/30 p-8 text-center space-y-3 relative overflow-hidden">
        <input
          type="file"
          multiple
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <Plus className="size-6" />
        </div>
        <div>
          <p className="font-semibold text-sm">Ajoute tes photos de voyage</p>
          <p className="text-xs text-muted-foreground mt-0.5">Tes photos seront compressées et partagées instantanément avec le groupe.</p>
        </div>

        {permission === "denied" && (
          <div className="mx-auto max-w-md bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl p-3 flex items-start gap-2 text-left text-xs">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">L&apos;accès aux photos a été désactivé</p>
              <p className="mt-0.5 leading-relaxed text-destructive/90">
                Tu as refusé l&apos;accès aux photos précédemment. Tu peux modifier ce choix en cliquant sur le bouton <strong>« Gérer l&apos;autorisation »</strong> en haut à droite.
              </p>
            </div>
          </div>
        )}

        <Button
          size="sm"
          className="gap-1.5"
          disabled={uploading}
          onClick={handleImportClick}
        >
          {uploading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Traitement des photos...
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" />
              Choisir des photos
            </>
          )}
        </Button>
      </section>

      {/* Grille de photos */}
      {photosLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement de l&apos;album...</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-12 space-y-2 border border-border rounded-3xl bg-card">
          <ImageIcon className="mx-auto size-10 text-muted-foreground/60" />
          <p className="font-medium">L&apos;album est encore vide</p>
          <p className="text-xs text-muted-foreground">Partage la première photo du séjour pour lancer l&apos;album !</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {photos.map((photo) => (
            <article
              key={photo.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                <img
                  src={photo.url}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-3 flex items-center justify-between text-xs bg-card">
                <span className="text-muted-foreground font-medium">Par {photo.author}</span>
                <button
                  type="button"
                  onClick={() => handleLike(photo.id, photo.likes)}
                  disabled={likeMutation.isPending}
                  className="inline-flex items-center gap-1 hover:text-red-500 transition text-muted-foreground font-semibold"
                >
                  <Heart className="size-3.5 fill-current text-red-500/10 hover:text-red-500" />
                  {photo.likes}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Boîte d'autorisation de type Cookie Consent */}
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-3xl shadow-elevated p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-primary">
                <Camera className="size-5" />
                <h3 className="font-display font-bold text-lg">Krew souhaite importer tes photos</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground transition"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                Afin de te permettre d&apos;enrichir l&apos;album photo collaboratif de ton voyage, Krew a besoin d&apos;ouvrir le sélecteur de photos natif de ton appareil.
              </p>
              <p>
                Tes photos importées seront stockées de manière sécurisée et partagées exclusivement avec les participants de ce voyage. Tu as le plein contrôle et tu peux révoquer ou modifier cette autorisation à tout moment depuis cette page.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                onClick={grantPermission}
                className="flex-1"
                variant="hero"
              >
                Autoriser l&apos;accès
              </Button>
              <Button
                onClick={denyPermission}
                variant="outline"
                className="flex-1"
              >
                Refuser
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Simple fallback icon
function ImageIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}
