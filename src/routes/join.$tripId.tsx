import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/krew/Logo";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { KrewOrganicBlob } from "@/components/krew/visual-language/KrewOrganicBlob";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { getJoinPreview, joinTrip, checkJoinStatus } from "@/lib/join.functions";
import { useAuth } from "@/hooks/useAuth";
import { eventTypeLabel } from "@/lib/krew/constants";

export const Route = createFileRoute("/join/$tripId")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
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
  errorComponent: ({ error }) => {
    console.error("Impossible d'ouvrir l'invitation:", error);
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center sm:px-6">
        <h1 className="font-display text-2xl font-normal sm:text-3xl">Impossible d&apos;ouvrir l&apos;invitation</h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          Ce lien n’est pas disponible. Demande un nouveau lien d’invitation si besoin.
        </p>
        <a href="/" className="inline-flex min-h-10 items-center text-sm font-semibold text-primary underline underline-offset-4">
          Retour à l&apos;accueil
        </a>
      </main>
    );
  },
});

const JOIN_INPUT_CLASS =
  "h-11 rounded-[10px] border-border/70 bg-background px-3 text-[15px] shadow-none transition-colors focus-visible:border-primary/55 focus-visible:ring-2 focus-visible:ring-primary/10";

function normalizeTripId(raw: string): string {
  return decodeURIComponent(String(raw || ""))
    .split("?")[0]!
    .split("#")[0]!
    .trim();
}

function JoinTripPage() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const tripId = normalizeTripId(params.tripId);
  const token = search.token?.trim() || undefined;
  const invitePath = token
    ? `/join/${tripId}?token=${encodeURIComponent(token)}`
    : `/join/${tripId}`;
  const authNext = encodeURIComponent(invitePath);
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
      setError("Ce lien d’invitation est incomplet.");
      setLoading(false);
      return;
    }
    if (!token) {
      setError("Ce lien d’invitation a été remplacé ou est incomplet. Demande le lien actuel à l’organisateur.");
      setLoading(false);
      return;
    }

    fetchPreview({ data: { tripId, token } })
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch((e: any) => {
        console.error("Impossible de charger l'invitation:", e);
        if (!cancelled) {
          const msg = String(e?.message ?? e ?? "");
          setError(
            msg.includes("uuid") || msg.includes("UUID")
              ? "Ce lien d’invitation est invalide."
              : "Cette invitation n’est plus disponible. Demande le lien actuel à l’organisateur.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tripId, token, fetchPreview]);

  async function handleJoin() {
    if (!isAuthenticated) {
      navigate({ to: "/auth", search: { next: authNext } as any });
      return;
    }
    if (!firstName.trim()) {
      toast.error("Indique ton prénom pour que le groupe sache qui tu es.");
      throw new Error("Prénom manquant");
    }
    setJoining(true);
    try {
      const res = await doJoin({ data: { tripId, token, firstName: firstName.trim() } });
      if (res?.alreadyMember && res?.myAvailabilityDone && res?.myPreferencesDone) {
        window.location.assign(`/trips/${tripId}`);
      } else {
        window.location.assign(`/trips/${tripId}/availability`);
      }
    } catch (e: any) {
      console.error("Impossible de rejoindre le voyage:", e);
      const msg = String(e?.message ?? e ?? "");
      toast.error(
        msg.includes("Invitation invalide") || msg.includes("renouvelée")
          ? "Ce lien n’est plus valide. Demande le lien actuel à l’organisateur."
          : "Impossible de rejoindre ce voyage pour le moment. Réessaie dans un instant.",
      );
      throw e;
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
      <KrewOrganicBlob tone="sage" variant="soft" className="pointer-events-none absolute -left-20 -top-20 h-[280px] w-[360px] opacity-35" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[760px] flex-col justify-center">
        <Link to="/" className="mb-9 w-fit">
          <Logo size="lg" withTagline />
        </Link>

        {loading || authLoading || checkingStatus ? (
          <div className="max-w-[560px] py-8">
            <KrewThinkingState context="generic" customMessage="Chargement de l’invitation…" delayMs={0} />
          </div>
        ) : error ? (
          <div className="max-w-[560px] space-y-5">
            <h1 className="font-display text-[34px] font-normal leading-tight text-foreground sm:text-[40px]">Impossible d&apos;ouvrir l&apos;invitation</h1>
            <p className="text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">{error}</p>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button asChild><Link to="/">Retour à l&apos;accueil</Link></Button>
              {!isAuthenticated ? (
                <Link
                  to="/auth"
                  search={{ next: authNext } as any}
                  className="inline-flex min-h-10 items-center text-[14px] font-semibold text-muted-foreground transition-colors hover:text-primary"
                >
                  Se connecter
                </Link>
              ) : null}
            </div>
          </div>
        ) : preview ? (
          <div className="max-w-[620px] space-y-7">
            <div className="space-y-2">
              <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">Tu es invité·e</p>
              <div className="relative inline-block max-w-full pb-2">
                <h1 className="break-words font-display text-[36px] font-normal leading-[0.98] text-foreground sm:text-[44px]">{preview.name}</h1>
                <KrewMark type="underline-wave" tone="sage" size="sm" className="pointer-events-none absolute -bottom-1 left-0 h-3 w-[140px] opacity-70" />
              </div>
              <p className="text-[14px] text-muted-foreground sm:text-[15px]">{eventTypeLabel(preview.eventType)}</p>
            </div>

            <ul className="space-y-3 border-y border-border/50 py-5 text-[14px] sm:text-[15px]">
              <li className="flex items-start gap-2.5">
                <KrewIcon name="group" tone="plum" size="sm" className="mt-0.5 size-4 shrink-0" />
                <span>Groupe prévu : <span className="font-mono">~{preview.participantsCount || "?"} personnes</span></span>
              </li>
              {preview.startDate ? (
                <li className="flex items-start gap-2.5">
                  <KrewIcon name="calendar" tone="sage" size="sm" className="mt-0.5 size-4 shrink-0" />
                  <span>À partir du <span className="font-mono">{new Date(preview.startDate + "T12:00:00").toLocaleDateString("fr-FR")}</span></span>
                </li>
              ) : null}
            </ul>

            <p className="max-w-[560px] text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
              Rejoins le groupe. KREW te demandera ensuite tes disponibilités et tes préférences pour préparer les propositions du voyage.
            </p>

            <div className="max-w-[460px] space-y-2">
              <label htmlFor="join-firstname" className="text-[13px] font-semibold text-foreground">Ton prénom</label>
              <Input id="join-firstname" className={JOIN_INPUT_CLASS} placeholder="Ex. Léa" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
              <p className="text-[13px] text-muted-foreground">Pour que le groupe sache qui tu es.</p>
            </div>

            <KrewStatefulButton
              className="max-w-[460px]"
              idleLabel={isAuthenticated ? "Rejoindre le voyage" : "Se connecter pour rejoindre le voyage"}
              loadingLabel={isAuthenticated ? "On rejoint la Krew…" : "Redirection…"}
              successLabel={isAuthenticated ? "Voyage rejoint" : "Ouverture de la connexion"}
              errorLabel="Réessayer"
              onAction={handleJoin}
            />

            {!isAuthenticated ? (
              <p className="max-w-[460px] text-[13px] text-muted-foreground">Pas encore de compte ? Tu pourras en créer un à l&apos;étape suivante.</p>
            ) : null}
          </div>
        ) : (
          <div className="max-w-[560px] space-y-4 py-8">
            <h1 className="font-display text-[34px] font-normal text-foreground">Invitation introuvable</h1>
            <p className="text-[14px] text-muted-foreground">Demande un nouveau lien d’invitation pour rejoindre le voyage.</p>
            <Button asChild><Link to="/">Retour à l&apos;accueil</Link></Button>
          </div>
        )}
      </div>
    </main>
  );
}
