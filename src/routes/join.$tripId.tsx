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
      {
        name: "description",
        content: "Tu as été invité·e à organiser un voyage avec Krew.",
      },
    ],
  }),
  component: JoinTripPage,
});

function normalizeTripId(raw: string): string {
  // Retire query/hash et espaces (liens WhatsApp parfois cassés)
  return decodeURIComponent(String(raw || ""))
    .split("?")[0]!
    .split("#")[0]!
    .trim();
}

function JoinTripPage() {
  const params = Route.useParams();
  const tripId = normalizeTripId(params.tripId);
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
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (!tripId || tripId.length < 8) {
      setError("Lien d'invitation incomplet.");
      setLoading(false);
      return;
    }

    fetchPreview({ data: { tripId } })
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch((e: any) => {
        if (!cancelled) {
          const msg = String(e?.message ?? e ?? "Lien invalide");
          setError(
            msg.includes("uuid") || msg.includes("UUID")
              ? "Lien d'invitation invalide (identifiant incorrect)."
              : msg.slice(0, 200),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tripId, fetchPreview]);

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
      // Dispos d'abord, fallback hub si la route dispo pose problème
      window.location.assign(`/trips/${tripId}/availability`);
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de rejoindre ce voyage");
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-hero-gradient opacity-80" />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <Link to="/" className="mb-8">
          <Logo size="lg" withTagline />
        </Link>

        <div className="w-full rounded-3xl border border-border bg-card p-6 shadow-elevated sm:p-8">
          {loading || authLoading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Chargement de l&apos;invitation…</p>
            </div>
          ) : error ? (
            <div className="space-y-4 text-center">
              <h1 className="text-xl font-semibold">Impossible d&apos;ouvrir l&apos;invitation</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button asChild variant="hero">
                  <Link to="/">Retour à l&apos;accueil</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/auth">Se connecter</Link>
                </Button>
              </div>
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
                {preview.departureCity ? (
                  <li className="flex items-center gap-2">
                    <MapPin className="size-4 shrink-0 text-primary" />
                    Départ : {preview.departureCity}
                  </li>
                ) : null}
                <li className="flex items-center gap-2">
                  <Users className="size-4 shrink-0 text-primary" />
                  Groupe prévu : ~{preview.participantsCount || "?"} personnes
                </li>
                {preview.startDate ? (
                  <li className="flex items-center gap-2">
                    <Calendar className="size-4 shrink-0 text-primary" />
                    À partir du {new Date(preview.startDate + "T12:00:00").toLocaleDateString("fr-FR")}
                  </li>
                ) : null}
              </ul>

              <p className="text-center text-sm text-muted-foreground">
                Rejoins le groupe : prénom, puis disponibilités et préférences. Krew proposera
                ensuite des destinations adaptées à tout le monde.
              </p>

              <div className="space-y-1.5 text-left">
                <label htmlFor="join-firstname" className="text-sm font-medium">
                  Ton prénom
                </label>
                <input
                  id="join-firstname"
                  className="flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Ex. Léa"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
                <p className="text-xs text-muted-foreground">
                  Pour savoir qui est qui dans le groupe.
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
                {isAuthenticated
                  ? "Rejoindre et indiquer mes dispos"
                  : "Se connecter pour rejoindre"}
              </Button>

              {!isAuthenticated ? (
                <p className="text-center text-xs text-muted-foreground">
                  Pas encore de compte ? Tu pourras en créer un à l&apos;étape suivante.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4 text-center py-8">
              <h1 className="text-xl font-semibold">Invitation introuvable</h1>
              <Button asChild variant="hero">
                <Link to="/">Retour à l&apos;accueil</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
