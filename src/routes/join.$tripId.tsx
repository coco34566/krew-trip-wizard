import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/krew/Logo";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { KrewOrganicBlob } from "@/components/krew/visual-language/KrewOrganicBlob";
import { getJoinPreview, joinTrip, checkJoinStatus } from "@/lib/join.functions";
import { useAuth } from "@/hooks/useAuth";
import { eventTypeLabel } from "@/lib/krew/constants";

export const Route = createFileRoute("/join/$tripId")({
  head: () => ({
    meta: [
      { title: "Rejoindre le voyage — KREW" },
      {
        name: "description",
        content: "Tu as été invité·e à organiser un voyage avec KREW.",
      },
    ],
  }),
  component: JoinTripPage,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
      <h1 className="text-xl font-semibold">Impossible d&apos;ouvrir l&apos;invitation</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {error?.message ?? "Erreur inattendue. Réessaie ou demande un nouveau lien."}
      </p>
      <a href="/" className="text-sm font-medium text-primary underline">
        Retour à l&apos;accueil
      </a>
    </main>
  ),
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
  const checkStatus = useServerFn(checkJoinStatus);

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
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !tripId || tripId.length < 8) return;

    setCheckingStatus(true);
    checkStatus({ data: { tripId } })
      .then((res) => {
        if (cancelled) return;
        if (res?.alreadyJoined) {
          if (res.myAvailabilityDone && res.myPreferencesDone) {
            window.location.assign(`/trips/${tripId}`);
          } else {
            window.location.assign(`/trips/${tripId}/availability`);
          }
        }
      })
      .catch((e) => {
        console.error("Erreur checkJoinStatus:", e);
      })
      .finally(() => {
        if (!cancelled) setCheckingStatus(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tripId, isAuthenticated, checkStatus]);

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
      const res = await doJoin({ data: { tripId, firstName: firstName.trim() } });
      toast.success("Bienvenue dans le voyage !");
      if (res?.alreadyMember && res?.myAvailabilityDone && res?.myPreferencesDone) {
        window.location.assign(`/trips/${tripId}`);
      } else {
        window.location.assign(`/trips/${tripId}/availability`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de rejoindre ce voyage");
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      <KrewOrganicBlob
        tone="sage"
        variant="soft"
        className="absolute -top-10 -left-10 w-[260px] h-[200px] opacity-40 pointer-events-none"
      />
      <div className="flex w-full max-w-md flex-col items-center relative z-10">
        <Link to="/" className="mb-8">
          <Logo size="lg" withTagline />
        </Link>

        <div className="w-full rounded-xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
          {loading || authLoading || checkingStatus ? (
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
                  <Link to="/auth" search={{}}>Se connecter</Link>
                </Button>
              </div>
            </div>
          ) : preview ? (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-primary font-mono">
                  Invitation KREW
                </p>
                <div className="relative inline-block">
                  <h1 className="font-display text-3xl font-normal text-foreground">{preview.name}</h1>
                  <KrewMark
                    type="underline-wave"
                    tone="sage"
                    size="sm"
                    className="absolute left-0 -bottom-1.5 w-[100px] pointer-events-none"
                  />
                </div>
                <p className="text-sm text-muted-foreground pt-1">
                  {eventTypeLabel(preview.eventType)}
                </p>
              </div>

              <ul className="space-y-2 border-y border-border/40 py-3.5 my-2 text-sm">
                <li className="flex items-center gap-2">
                  <KrewIcon name="group" tone="plum" size="sm" className="size-4 shrink-0" />
                  Groupe prévu : <span className="font-mono">~{preview.participantsCount || "?"} personnes</span>
                </li>
                {preview.startDate ? (
                  <li className="flex items-center gap-2">
                    <KrewIcon name="calendar" tone="sage" size="sm" className="size-4 shrink-0" />
                    À partir du <span className="font-mono">{new Date(preview.startDate + "T12:00:00").toLocaleDateString("fr-FR")}</span>
                  </li>
                ) : null}
              </ul>

              <p className="text-center text-sm text-muted-foreground">
                Rejoins le groupe : prénom, puis disponibilités et préférences. KREW proposera
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
                ) : null}
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
