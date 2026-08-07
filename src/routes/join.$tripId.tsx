import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Users, MapPin, Calendar, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/krew/Logo";
import { getJoinPreview, joinTrip } from "@/lib/trips.functions";
import { useAuth } from "@/hooks/useAuth";
import { eventTypeLabel } from "@/lib/krew/constants";

export const Route = createFileRoute("/join/$tripId")({
  head: () => ({
    meta: [
      { title: "Rejoindre le voyage — Krew" },
      { name: "description", content: "Tu as été invité·e à organiser un voyage avec Krew." },
    ],
  }),
  component: JoinTripPage,
});

function JoinTripPage() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const fetchPreview = useServerFn(getJoinPreview);
  const doJoin = useServerFn(joinTrip);

  const [preview, setPreview] = useState<{
    id: string;
    name: string;
    eventType: string;
    departureCity: string;
    participantsCount: number;
    startDate: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPreview({ data: { tripId } })
      .then(setPreview)
      .catch((e: any) => setError(e?.message ?? "Lien invalide"))
      .finally(() => setLoading(false));
  }, [tripId]);

  async function handleJoin() {
    if (!isAuthenticated) {
      const next = encodeURIComponent(`/join/${tripId}`);
      navigate({ to: "/auth", search: { next } as any });
      return;
    }
    if (!firstName.trim()) {
      toast.error("Indique ton prénom pour que le groupe sache qui tu es");
      return;
    }
    setJoining(true);
    try {
      await doJoin({ data: { tripId, firstName: firstName.trim() } });
      toast.success("Bienvenue dans le voyage !");
      navigate({ to: "/trips/$tripId/availability", params: { tripId } });
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de rejoindre ce voyage");
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-hero-gradient px-4 py-12">
      <Link to="/" className="mb-8">
        <Logo size="lg" withTagline />
      </Link>

      <div className="glass-panel w-full max-w-md rounded-3xl p-6 shadow-elevated sm:p-8">
        {loading || authLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="space-y-4 text-center">
            <h1 className="text-xl font-semibold">Lien invalide</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button asChild variant="hero">
              <Link to="/">Retour à l&apos;accueil</Link>
            </Button>
          </div>
        ) : preview ? (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-primary">
                Invitation Krew
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold">{preview.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {eventTypeLabel(preview.eventType)}
              </p>
            </div>

            <ul className="space-y-2 rounded-2xl border border-border bg-surface/50 px-4 py-3 text-sm">
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                Départ : {preview.departureCity}
              </li>
              <li className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                Groupe prévu : ~{preview.participantsCount} personnes
              </li>
              {preview.startDate ? (
                <li className="flex items-center gap-2">
                  <Calendar className="size-4 text-primary" />
                  À partir du {new Date(preview.startDate).toLocaleDateString("fr-FR")}
                </li>
              ) : null}
            </ul>

            <p className="text-center text-sm text-muted-foreground">
              Rejoins le groupe : commence par ton prénom, puis tes disponibilités et préférences.
              Krew proposera ensuite des destinations adaptées à tout le monde.
            </p>

            <div className="space-y-1.5 text-left">
              <label htmlFor="join-firstname" className="text-sm font-medium">
                Ton prénom
              </label>
              <input
                id="join-firstname"
                className="flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                placeholder="Ex. Léa"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
              <p className="text-xs text-muted-foreground">
                Pour savoir qui est qui (organisateur, star, participants).
              </p>
            </div>

            <Button
              variant="hero"
              size="lg"
              className="w-full"
              disabled={joining}
              onClick={handleJoin}
            >
              {joining ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}
              {isAuthenticated ? "Rejoindre et indiquer mes dispos" : "Se connecter pour rejoindre"}
            </Button>

            {!isAuthenticated ? (
              <p className="text-center text-xs text-muted-foreground">
                Pas encore de compte ? Tu pourras en créer un à l&apos;étape suivante.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
