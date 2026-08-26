import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/krew/Logo";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { KrewOrganicBlob } from "@/components/krew/visual-language/KrewOrganicBlob";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { getJoinPreview, joinTrip, checkJoinStatus } from "@/lib/join.functions";
import { useAuth } from "@/hooks/useAuth";
import { eventTypeLabel } from "@/lib/krew/constants";

export const Route = createFileRoute("/join/$tripId")({
  head: () => ({
    meta: [
      { title: "Rejoindre le voyage — KREW" },
      {
        name: "description",
        content: "Tu as été invité·e à rejoindre un voyage organisé avec KREW.",
      },
    ],
  }),
  component: JoinTripPage,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 sm:px-6 text-center">
      <h1 className="font-display text-2xl sm:text-3xl font-normal">Impossible d&apos;ouvrir l&apos;invitation</h1>
      <p className="max-w-md text-sm sm:text-base text-muted-foreground leading-relaxed">
        {error?.message ?? "Erreur inattendue. Réessaie ou demande un nouveau lien."}
      </p>
      <a href="/" className="text-sm font-medium text-primary underline underline-offset-4">
        Retour à l&apos;accueil
      </a>
    </main>
  ),
});

function normalizeTripId(raw: string): string {
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 sm:px-6 py-10 sm:py-12 relative overflow-hidden">
      <KrewOrganicBlob
        tone="sage"
        variant="soft"
        className="absolute -top-10 -left-10 w-[260px] h-[200px] opacity-40 pointer-events-none"
      />
      <div className="flex w-full max-w-md flex-col items-center relative z-10">
        <Link to="/" className="mb-7 sm:mb-8">
          <Logo size="lg" withTagline />
        </Link>

        <div className="w-full rounded-[24px] border border-border/50 bg-card p-6 shadow-2xs sm:p-8">
          {loading || authLoading || checkingStatus ? (
            <div className="py-8">
              <KrewThinkingState context="generic" customMessage="Chargement de l’invitation…" delayMs={0} />
            </div>
          ) : error ? (
            <div className="space-y-4 text-center">
              <h1 className="font-display text-2xl font-normal">Impossible d&apos;ouvrir l&apos;invitation</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button asChild className="min-h-[44px]">
                  <Link to="/">Retour à l&apos;accueil</Link>
                </Button>
                <Button asChild variant="outline" className="min-h-[44px]">
                  <Link to="/auth" search={{}}>Se connecter</Link>
                </Button>
              </div>
            </div>
          ) : preview ? (
            <div className="space-y-6">
              <div className="text-center space-y-1.5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary font-mono">
                  Tu es invité·e
                </p>
                <div className="relative inline-block max-w-full">
                  <h1 className="font-display text-3xl sm:text-[34px] font-normal leading-tight text-foreground break-words">{preview.name}</h1>
                  <KrewMark
                    type="underline-wave"
                    tone="sage"
                    size="sm"
                    className="absolute left-0 -bottom-1.5 w-[110px] pointer-events-none"
                  />
                </div>
                <p className="text-sm text-muted-foreground pt-1">
                  {eventTypeLabel(preview.eventType)}
                </p>
              </div>

              <ul className="space-y-2.5 border-y border-border/40 py-4 text-sm sm:text-base">
                <li className="flex items-start gap-2.5">
                  <KrewIcon name="group" tone="plum" size="sm" className="size-4 shrink-0 mt-0.5" />
                  <span>Groupe prévu : <span className="font-mono">~{preview.participantsCount || "?"} personnes</span></span>
                </li>
                {preview.startDate ? (
                  <li className="flex items-start gap-2.5">
                    <KrewIcon name="calendar" tone="sage" size="sm" className="size-4 shrink-0 mt-0.5" />
                    <span>À partir du <span className="font-mono">{new Date(preview.startDate + "T12:00:00").toLocaleDateString("fr-FR")}</span></span>
                  </li>
                ) : null}
              </ul>

              <p className="text-center text-sm sm:text-base text-muted-foreground leading-relaxed">
                Rejoins le groupe. KREW te demandera ensuite tes disponibilités et tes préférences pour préparer les propositions du voyage.
              </p>

              <div className="space-y-1.5 text-left">
                <label htmlFor="join-firstname" className="text-sm font-semibold text-foreground">
                  Ton prénom
                </label>
                <Input
                  id="join-firstname"
                  className="h-12 rounded-xl border-border text-base"
                  placeholder="Ex. Léa"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
                <p className="text-sm text-muted-foreground">
                  Pour que le groupe sache qui tu es.
                </p>
              </div>

              <Button
                size="lg"
                className="w-full min-h-[48px] h-auto rounded-xl font-medium text-base whitespace-normal text-center leading-tight py-2.5"
                disabled={joining}
                onClick={handleJoin}
              >
                {joining ? <Loader2 className="size-4 animate-spin shrink-0" /> : null}
                {isAuthenticated ? "Rejoindre et indiquer mes dispos" : "Se connecter pour rejoindre le voyage"}
              </Button>

              {!isAuthenticated ? (
                <p className="text-center text-sm text-muted-foreground">
                  Pas encore de compte ? Tu pourras en créer un à l&apos;étape suivante.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4 text-center py-8">
              <h1 className="font-display text-2xl font-normal">Invitation introuvable</h1>
              <Button asChild className="min-h-[44px]">
                <Link to="/">Retour à l&apos;accueil</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
