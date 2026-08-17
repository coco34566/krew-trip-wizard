import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Check,
  Copy,
  Link2,
  Loader2,
  UserPlus,
  Users,
  Crown,
  Shield,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  getTripDetail,
  inviteParticipant,
  removeParticipant,
  setCoOrganizer,
  finalizeInvitationStep,
} from "@/lib/trips.functions";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
import { STAR_EVENT_TYPES, eventTypeLabel } from "@/lib/krew/constants";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { shareOnWhatsApp } from "@/lib/krew/whatsapp";

export const Route = createFileRoute("/_authenticated/trips/$tripId/invite")({
  head: () => ({
    meta: [{ title: "Inviter le groupe — Krew" }],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { tripId } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fetchDetail = useServerFn(getTripDetail);
  const fetchProgress = useServerFn(getParticipantsProgress);
  const invite = useServerFn(inviteParticipant);
  const removeGuest = useServerFn(removeParticipant);
  const setCoOrg = useServerFn(setCoOrganizer);
  const finishInvite = useServerFn(finalizeInvitationStep);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
    retry: 3,
    retryDelay: 1000,
  });
  const {
    data: progress,
    isError: isProgressError,
    refetch: refetchProgress,
  } = useQuery({
    queryKey: ["trip-progress", tripId],
    queryFn: () => fetchProgress({ data: { tripId } }),
    retry: 3,
    retryDelay: 1000,
  });

  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [starMode, setStarMode] = useState<"secret" | "participant">("secret");
  const [starPaysShare, setStarPaysShare] = useState(true);

  const savedMode = (data?.trip?.group_logistics as any)?.star_mode;
  useEffect(() => {
    if (savedMode === "secret" || savedMode === "participant") {
      setStarMode(savedMode);
    }
    setStarPaysShare((data?.trip?.group_logistics as any)?.star_pays_share !== false);
  }, [savedMode, data?.trip?.group_logistics]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${tripId}`;
  }, [tripId]);

  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: { tripId, email: email.trim() } }),
    onSuccess: () => {
      toast.success("Invitation ajoutée");
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip-progress", tripId] });
    },
    onError: () => toast.error("Email invalide ou déjà invité"),
  });

  const removeMutation = useMutation({
    mutationFn: (participantId: string) => removeGuest({ data: { participantId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
  });

  const setCoOrgMutation = useMutation({
    mutationFn: ({ coOrganizerId }: { coOrganizerId: string | null }) =>
      setCoOrg({ data: { tripId, coOrganizerId } }),
    onSuccess: (_, variables) => {
      if (variables.coOrganizerId) {
        toast.success("Co-organisateur·rice nommé·e !");
      } else {
        toast.success("Rôle co-organisateur·rice retiré.");
      }
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erreur lors de la mise à jour des rôles.");
    },
  });

  const finishInviteMutation = useMutation({
    mutationFn: () =>
      finishInvite({
        data: {
          tripId,
          starMode,
          inviteStepCompleted: true,
          starPaysShare,
        },
      }),
    onSuccess: () => {
      toast.success("Étape d'invitation validée !");
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      navigate({ to: "/trips/$tripId", params: { tripId } });
    },
    onError: (err: any) => {
      console.error(err);
      toast.error("Erreur lors de la validation : " + (err?.message || ""));
    },
  });

  if (isError && !data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 space-y-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">Une erreur est survenue</h1>
        <p className="text-sm text-muted-foreground">
          Impossible de charger les détails du voyage pour le moment.
        </p>
        <Button
          onClick={() => {
            refetch();
            refetchProgress();
          }}
        >
          Réessayer
        </Button>
      </main>
    );
  }

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <div className="flex flex-col items-center justify-center space-y-4 py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">
            Chargement des détails du voyage...
          </p>
        </div>
      </main>
    );
  }

  const trip = data.trip as any;
  const rawParticipants = (data.participants ?? []) as any[];
  const celebratedPerson = trip?.celebrated_person;
  const starUid = trip?.star_user_id || "star-virtual-uid";
  const hasStar = Boolean(trip?.has_star || celebratedPerson);

  const combinedParticipants = (() => {
    if (!hasStar) return rawParticipants;

    const starExists = (rawParts: any[]) =>
      rawParts.some((p: any) => Boolean(p.user_id && starUid && p.user_id === starUid));

    if (starExists(rawParticipants)) {
      return rawParticipants.map((p) => {
        const isStarByUid = Boolean(p.user_id && starUid && p.user_id === starUid);
        if (isStarByUid) {
          return { ...p, isStar: true };
        }
        return p;
      });
    }

    const starVirtual = {
      id: "star-virtual-id",
      trip_id: tripId,
      user_id: starUid,
      email: null,
      display_name: celebratedPerson || "La Star",
      status: "accepte",
      role: "membre",
      isStar: true,
      created_at: new Date().toISOString(),
    };

    return [...rawParticipants, starVirtual];
  })();

  const placeholders = Array.from(
    { length: Math.max(0, Number(trip.participants_count || 0) - combinedParticipants.length) },
    (_, index) => ({
      id: `placeholder-${index}`,
      display_name: `Participant ${combinedParticipants.length + index + 1}`,
      email: null,
      status: "à inviter",
      placeholder: true,
    }),
  );
  const participants = [...combinedParticipants, ...placeholders];
  const answered = progress?.answered ?? 0;
  const total = Math.max(progress?.total ?? participants.length, trip.participants_count || 1);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Hub du voyage
      </Link>

      <header className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Étape collaborative · {eventTypeLabel(trip.event_type)}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Inviter le groupe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Partage le lien ou ajoute des emails. Suis qui a rejoint et qui doit encore répondre.
        </p>
      </header>

      <section className="mt-8 rounded-3xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Link2 className="size-4 text-primary" /> Lien d&apos;invitation
        </div>
        <p className="mt-2 break-all rounded-2xl border border-border bg-background/80 px-3 py-2 font-mono text-xs">
          {shareUrl || "…"}
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <Button
            className="w-full sm:w-auto"
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                toast.success("Lien copié");
                setTimeout(() => setCopied(false), 2000);
              } catch {
                toast.error("Copie impossible");
              }
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copié" : "Copier le lien"}
          </Button>
        </div>
      </section>

      {data.isOwner ? (
        <section className="mt-6 rounded-3xl border border-border bg-card p-5 space-y-4">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <UserPlus className="size-4 text-primary" /> Inviter de nouveaux participants ou
            relancer le groupe
          </h2>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Ajouter par email</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                placeholder="ami@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                disabled={!email.trim() || inviteMutation.isPending}
                onClick={() => inviteMutation.mutate()}
                className="shrink-0"
              >
                {inviteMutation.isPending ? <Loader2 className="animate-spin" /> : "Inviter"}
              </Button>
            </div>
          </div>

          <div className="border-t border-border/40 pt-4 space-y-2">
            <Label className="text-xs text-muted-foreground">
              Partager ou relancer sur WhatsApp
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                className="flex-1 bg-[#25D366] text-white hover:bg-[#1ebe57] border-transparent"
                onClick={() => {
                  const text = `Salut ! On organise « ${trip.name} » avec KREW ✈️\n\nRejoins le groupe et indique tes disponibilités et tes préférences :\n👉 ${shareUrl}`;
                  shareOnWhatsApp(text);
                }}
              >
                Inviter sur WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
                onClick={() => {
                  const missingParticipants =
                    progress?.participants?.filter(
                      (p) => !p.hasAnswered || !p.hasAnsweredAvailability,
                    ) || [];
                  const lines = [
                    `Petit point KREW pour « ${trip.name} » ✈️`,
                    "",
                    "Il reste quelques petites choses à faire :",
                  ];
                  for (const p of missingParticipants) {
                    const name = p.display_name || p.email?.split("@")[0] || "Ami";
                    const missing = [
                      !p.hasAnsweredAvailability ? "disponibilités" : null,
                      !p.hasAnswered ? "préférences" : null,
                    ].filter(Boolean);
                    lines.push(`• ${name} : ${missing.join(" + ")}`);
                  }
                  lines.push("", `👉 ${window.location.origin}/trips/${trip.id}`);
                  shareOnWhatsApp(lines.join("\n"));
                }}
                disabled={
                  !progress?.participants?.some((p) => !p.hasAnswered || !p.hasAnsweredAvailability)
                }
              >
                Relancer les retardataires
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-3xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Users className="size-4" /> Participants
          </h2>
          <Badge variant="lagoon">
            {answered}/{total} ont répondu au questionnaire
          </Badge>
        </div>
        <ul className="mt-4 space-y-2">
          {participants.length === 0 ? (
            <li className="text-sm text-muted-foreground">Personne n&apos;a encore rejoint.</li>
          ) : (
            participants.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.display_name ?? p.email}</span>
                    {p.user_id === trip.owner_id ? (
                      <Badge variant="sun" className="gap-1 px-1.5 py-0 text-[10px]">
                        <Crown className="size-2.5" /> Organisateur·rice
                      </Badge>
                    ) : p.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId) ? (
                      <Badge variant="lagoon" className="gap-1 px-1.5 py-0 text-[10px]">
                        <Shield className="size-2.5" /> Co-organisateur·rice
                      </Badge>
                    ) : null}
                    {p.isStar ? (
                      <Badge
                        variant="sun"
                        className="gap-1 px-1.5 py-0 text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20"
                      >
                        <Star className="size-2.5 fill-amber-500 text-amber-500" /> Star
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.status === "accepte" ? "success" : "muted"}>{p.status}</Badge>
                  {data.isCreator && p.user_id && p.user_id !== trip.owner_id ? (
                    p.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive hover:bg-destructive/5"
                        disabled={setCoOrgMutation.isPending}
                        onClick={() => setCoOrgMutation.mutate({ coOrganizerId: null })}
                      >
                        Retirer co-org
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-primary hover:bg-primary/5"
                        disabled={setCoOrgMutation.isPending}
                        onClick={() =>
                          setCoOrgMutation.mutate({ coOrganizerId: p.user_id || null })
                        }
                      >
                        Nommer co-org
                      </Button>
                    )
                  ) : null}
                  {data.isOwner && !p.placeholder ? (
                    <Button variant="ghost" size="sm" onClick={() => removeMutation.mutate(p.id)}>
                      Retirer
                    </Button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Rôle & Comportement de la Star (EVG, EVJF, Anniversaire, Retraite) */}
      {trip.has_star || trip.celebrated_person || STAR_EVENT_TYPES.has(trip.event_type) ? (
        <section className="mt-6 rounded-3xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <Star className="size-4 text-primary" /> Rôle de la Star (
            {trip.celebrated_person || "Star"})
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Définis si l&apos;organisation de l&apos;événement doit rester un secret pour la Star ou
            non.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!data.isOwner}
              onClick={() => setStarMode("secret")}
              className={cn(
                "rounded-2xl border p-4 text-left text-sm transition transition-all",
                starMode === "secret"
                  ? "border-primary bg-primary/10 shadow-glow text-foreground font-semibold"
                  : "border-border bg-surface/30 text-muted-foreground hover:border-primary/45",
              )}
            >
              <span className="block text-base">🤫 Mode Secret</span>
              <span className="mt-1 block text-xs text-muted-foreground font-normal leading-relaxed">
                La Star ne remplit pas elle-même son questionnaire (c&apos;est toi qui t&apos;en
                charges) et n&apos;aura pas accès au tableau de bord pour préserver la surprise !
              </span>
            </button>
            <button
              type="button"
              disabled={!data.isOwner}
              onClick={() => setStarMode("participant")}
              className={cn(
                "rounded-2xl border p-4 text-left text-sm transition transition-all",
                starMode === "participant"
                  ? "border-primary bg-primary/10 shadow-glow text-foreground font-semibold"
                  : "border-border bg-surface/30 text-muted-foreground hover:border-primary/45",
              )}
            >
              <span className="block text-base">🎂 Mode Participant</span>
              <span className="mt-1 block text-xs text-muted-foreground font-normal leading-relaxed">
                La Star est invitée, voit l&apos;organisation, peut répondre au questionnaire comme
                les autres, tout en restant identifiée comme la Star.
              </span>
            </button>
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <Label>La Star participe aux frais</Label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant={starPaysShare ? "default" : "outline"}
                onClick={() => setStarPaysShare(true)}
              >
                Oui
              </Button>
              <Button
                type="button"
                variant={!starPaysShare ? "default" : "outline"}
                onClick={() => setStarPaysShare(false)}
              >
                Non, sa part est répartie entre les autres
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {data.isOwner ? (
        <section className="mt-8 rounded-3xl border border-primary/20 bg-primary/5 p-6 text-center space-y-4">
          <div className="space-y-1">
            <h3 className="font-display text-lg font-bold text-primary">
              Finaliser l&apos;invitation
            </h3>
            <p className="text-xs text-muted-foreground">
              Une fois que tu as partagé le lien et configuré le rôle de la Star, accède au tableau
              de bord.
            </p>
          </div>
          <Button
            size="lg"
            className="w-full sm:w-auto px-8"
            disabled={finishInviteMutation.isPending}
            onClick={() => finishInviteMutation.mutate()}
          >
            {finishInviteMutation.isPending ? (
              <Loader2 className="animate-spin mr-1.5 size-4" />
            ) : (
              <Sparkles className="mr-1.5 size-4" />
            )}
            Accéder au tableau de bord du voyage
          </Button>
        </section>
      ) : (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline" className="flex-1">
            <Link to="/trips/$tripId" params={{ tripId }}>
              Voir le hub
            </Link>
          </Button>
          <Button asChild className="flex-1">
            <Link to="/trips/$tripId/availability" params={{ tripId }}>
              Continuer → disponibilités
            </Link>
          </Button>
        </div>
      )}
    </main>
  );
}
