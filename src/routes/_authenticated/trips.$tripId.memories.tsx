import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, Heart, Plus, Sparkles, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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
  url: string;
  author: string;
  likes: number;
};

const SEED_PHOTOS: Photo[] = [
  {
    id: "1",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    author: "Alexandre",
    likes: 4,
  },
  {
    id: "2",
    url: "https://images.unsplash.com/photo-1527631746610-b998ef1c7d1d?auto=format&fit=crop&w=800&q=80",
    author: "Sophie",
    likes: 7,
  },
  {
    id: "3",
    url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80",
    author: "Marc",
    likes: 2,
  },
];

function MemoriesPage() {
  const { tripId } = Route.useParams();
  const [photos, setPhotos] = useState<Photo[]>(SEED_PHOTOS);

  const handleLike = (id: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p))
    );
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div>
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition"
        >
          <ArrowLeft className="size-4" /> Retour à Mon Voyage
        </Link>
      </div>

      <header className="space-y-2">
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
      </header>

      <section className="rounded-3xl border border-dashed border-border bg-surface/30 p-8 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <Plus className="size-6" />
        </div>
        <div>
          <p className="font-semibold text-sm">Ajoute tes photos de voyage</p>
          <p className="text-xs text-muted-foreground mt-0.5">Glisse tes fichiers ici ou clique pour parcourir</p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Sparkles className="size-3.5" /> Choisir des photos
        </Button>
      </section>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {photos.map((photo) => (
          <article
            key={photo.id}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md"
          >
            <div className="aspect-[4/3] w-full overflow-hidden">
              <img
                src={photo.url}
                alt=""
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                loading="lazy"
              />
            </div>
            <div className="p-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Par {photo.author}</span>
              <button
                type="button"
                onClick={() => handleLike(photo.id)}
                className="inline-flex items-center gap-1 hover:text-red-500 transition text-muted-foreground font-semibold"
              >
                <Heart className="size-3.5 fill-current text-red-500/10 hover:text-red-500" />
                {photo.likes}
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
