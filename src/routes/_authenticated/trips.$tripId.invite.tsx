import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
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
    meta: [{ title: "Groupe — KREW" }],
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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
    retry: 3,
    retryDelay: 1000,
  });
  const {
    data: progress,
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
  const realJoinedCount = rawParticipants.filter((p) => p.user_id && !p.placeholder).length;
  const totalPlanned = Number(trip.participants_count || 1);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Top Navigation Tabs */}
      <nav aria-label="Navigation principale du voyage" className="flex items-center border-b border-border/50 pb-3 gap-6 font-medium text-sm mb-6">
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "todo" }}
          className="pb-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          À faire
        </Link>
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "voyage" }}
          className="pb-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          Voyage
        </Link>
        <Link
          to="/trips/$tripId/invite"
          params={{ tripId }}
          className="pb-1 border-b-2 border-primary text-foreground font-semibold transition-colors"
        >
          Groupe
        </Link>
      </nav>

      {/* Heading */}
      <div className="space-y-1">
        <h1 className="font-display text-[38px] sm:text-[48px] font-normal leading-tight tracking-tight text-foreground">
          Groupe
        </h1>
        <p className="text-sm text-muted-foreground">
          Gère les participants, les invitations et les réponses du groupe.
        </p>
        <p className="text-xs font-semibold text-primary font-mono pt-1">
          {totalPlanned} personnes prévues · {realJoinedCount} ont rejoint
        </p>
      </div>

      {/* 1. PARTICIPANTS LIST FIRST */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
          <h2 className="font-display text-2xl font-normal text-foreground flex items-center gap-2">
            <Users className="size-5 text-primary" /> Membres du groupe
          </h2>
          <Badge variant="secondary" className="font-mono text-xs font-normal">
            {progress?.answered ?? 0}/{totalPlanned} ont renseigné leurs préférences
          </Badge>
        </div>
        <div className="divide-y divide-border/50">
          {participants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Personne n’a encore rejoint le groupe.</p>
          ) : (
            participants.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-foreground">{p.display_name ?? p.email}</span>
                    {p.user_id === trip.owner_id ? (
                      <Badge variant="sun" className="gap-1 px-1.5 py-0 text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20">
                        <Crown className="size-2.5" /> Organisateur·rice
                      </Badge>
                    ) : p.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId) ? (
                      <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
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
                  {p.email ? <p className="text-xs text-muted-foreground">{p.email}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.status === "accepte" ? "success" : "muted"} className="font-normal">{p.status === "accepte" ? "Participe" : p.status}</Badge>
                  {data.isCreator && p.user_id && !p.placeholder && !p.isStar && p.user_id !== "star-virtual-uid" && p.user_id !== trip.owner_id ? (
                    p.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive hover:bg-destructive/5 h-8 px-2 font-normal"
                        disabled={setCoOrgMutation.isPending}
                        onClick={() => setCoOrgMutation.mutate({ coOrganizerId: null })}
                      >
                        Retirer co-org
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 h-8 px-2 font-normal"
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
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => removeMutation.mutate(p.id)}>
                      Retirer
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 2. INVITATION & RELANCE */}
      <section className="rounded-[24px] bg-sage/8 border border-sage/20 p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Link2 className="size-4 text-primary" /> Inviter de nouveaux membres
        </div>
        <p className="break-all rounded-xl border border-border/60 bg-background/90 px-3.5 py-2.5 font-mono text-xs text-foreground">
          {shareUrl || "…"}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            className="rounded-xl"
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                toast.success("Lien copié");
                setTimeout(() => setCopied(false), 2000);
              } catch {
                toast.error("Impossible de copier le lien.");
              }
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copié" : "Copier le lien"}
          </Button>
          <Button
            type="button"
            className="bg-[#25D366] text-white hover:bg-[#1ebe57] border-transparent rounded-xl"
            onClick={() => {
              const text = `Salut ! On organise « ${trip.name} » avec KREW ✈️\n\nRejoins le groupe et indique tes disponibilités et tes préférences :\n👉 ${shareUrl}`;
              shareOnWhatsApp(text);
            }}
          >
            Inviter via WhatsApp
          </Button>
        </div>

        {data.isOwner ? (
          <div className="pt-4 border-t border-border/40 space-y-3">
            <Label className="text-xs text-muted-foreground">Ajouter par adresse e-mail</Label>
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
                className="shrink-0 rounded-xl"
              >
                {inviteMutation.isPending ? <Loader2 className="animate-spin" /> : "Inviter"}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {/* 3. RÉGLAGES STAR SI APPLICABLES */}
      {trip.has_star || trip.celebrated_person || STAR_EVENT_TYPES.has(trip.event_type) ? (
        <section className="rounded-3xl border border-border bg-card p-5 space-y-4">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <Star className="size-4 text-primary" /> Rôle de la Star ({trip.celebrated_person || "Star"})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!data.isOwner}
              onClick={() => setStarMode("secret")}
              className={cn(
                "rounded-2xl border p-4 text-left text-sm transition-all",
                starMode === "secret"
                  ? "border-primary bg-primary/10 text-foreground font-semibold"
                  : "border-border bg-surface/30 text-muted-foreground hover:border-primary/45",
              )}
            >
              <span className="block text-base">🤫 Mode Secret</span>
              <span className="mt-1 block text-xs text-muted-foreground font-normal leading-relaxed">
                La Star ne voit pas l'organisation pour préserver la surprise.
              </span>
            </button>
            <button
              type="button"
              disabled={!data.isOwner}
              onClick={() => setStarMode("participant")}
              className={cn(
                "rounded-2xl border p-4 text-left text-sm transition-all",
                starMode === "participant"
                  ? "border-primary bg-primary/10 text-foreground font-semibold"
                  : "border-border bg-surface/30 text-muted-foreground hover:border-primary/45",
              )}
            >
              <span className="block text-base">🎂 Mode Participant</span>
              <span className="mt-1 block text-xs text-muted-foreground font-normal leading-relaxed">
                La Star est invitée et répond comme les autres.
              </span>
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
