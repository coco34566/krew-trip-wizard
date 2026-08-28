import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Copy, Crown, Loader2, Shield, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewIcon, KrewMark } from "@/components/krew/visual-language";
import { cn } from "@/lib/utils";
import {
  finalizeInvitationStep,
  getTripDetail,
  inviteParticipant,
  removeParticipant,
  setCoOrganizer,
} from "@/lib/trips.functions";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
import { STAR_EVENT_TYPES } from "@/lib/krew/constants";
import { shareOnWhatsApp } from "@/lib/krew/whatsapp";

export const Route = createFileRoute("/_authenticated/trips/$tripId/invite")({
  head: () => ({ meta: [{ title: "Inviter le groupe — KREW" }] }),
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
  const { data: progress, refetch: refetchProgress } = useQuery({
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
    if (savedMode === "secret" || savedMode === "participant") setStarMode(savedMode);
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip", tripId] }),
  });

  const setCoOrgMutation = useMutation({
    mutationFn: ({ coOrganizerId }: { coOrganizerId: string | null }) =>
      setCoOrg({ data: { tripId, coOrganizerId } }),
    onSuccess: (_, variables) => {
      toast.success(
        variables.coOrganizerId
          ? "Co-organisateur·rice nommé·e !"
          : "Rôle co-organisateur·rice retiré.",
      );
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
        data: { tripId, starMode, inviteStepCompleted: true, starPaysShare },
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
      <main className="mx-auto max-w-[820px] space-y-4 px-4 py-10 text-center sm:px-6">
        <h1 className="font-display text-[30px] font-normal text-foreground">Impossible de charger l’invitation</h1>
        <p className="text-sm text-muted-foreground">Les détails du voyage ne sont pas disponibles pour le moment.</p>
        <Button onClick={() => { refetch(); refetchProgress(); }}>Réessayer</Button>
      </main>
    );
  }

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-[820px] px-4 py-10 sm:px-6">
        <KrewThinkingState context="generic" customMessage="Chargement de l’invitation…" delayMs={0} />
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
    const starExists = rawParticipants.some((p: any) => Boolean(p.user_id && starUid && p.user_id === starUid));
    if (starExists) {
      return rawParticipants.map((p) =>
        p.user_id && p.user_id === starUid ? { ...p, isStar: true } : p,
      );
    }
    return [
      ...rawParticipants,
      {
        id: "star-virtual-id",
        trip_id: tripId,
        user_id: starUid,
        email: null,
        display_name: celebratedPerson || "La Star",
        status: "accepte",
        role: "membre",
        isStar: true,
        created_at: new Date().toISOString(),
      },
    ];
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
  const missingParticipants =
    progress?.participants?.filter((p) => !p.hasAnswered || !p.hasAnsweredAvailability) || [];

  return (
    <main className="space-y-8">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour au voyage
      </Link>

      <KrewJourneyPageHeader
        tripName={trip.name}
        title="Inviter le groupe"
        otterSrc="/brand/otter-states/next-action.png"
        waveClassName="w-[140px]"
      >
        <p className="max-w-[42rem] text-[15px] leading-[1.55] text-muted-foreground sm:text-[16px]">
          Partage le lien, invite la team et vois en un coup d’œil qui doit encore répondre.
        </p>
      </KrewJourneyPageHeader>

      <section className="space-y-3 border-y border-sage/25 bg-sage/[0.05] px-4 py-5 sm:px-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <KrewIcon name="invite" tone="plum" size="sm" className="size-4" />
          Lien d’invitation
        </div>
        <p className="break-all font-mono text-[12px] leading-relaxed text-foreground sm:text-[13px]">{shareUrl || "…"}</p>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
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
          {copied ? <KrewMark type="check" tone="sage" size="sm" className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copié" : "Copier le lien"}
        </Button>
      </section>

      {data.isOwner ? (
        <section className="space-y-5 border-b border-border/60 pb-7">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 font-display text-[24px] font-normal text-foreground sm:text-[27px]">
              <KrewIcon name="plus" tone="plum" size="sm" className="size-5" />
              Ajouter ou relancer la team
            </h2>
            <p className="text-sm text-muted-foreground">Un email pour inviter directement, ou WhatsApp pour partager le lien au groupe.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">Ajouter une adresse e-mail</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                placeholder="ami@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-10"
              />
              <Button
                disabled={!email.trim() || inviteMutation.isPending}
                onClick={() => inviteMutation.mutate()}
                className="shrink-0"
              >
                {inviteMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Inviter
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const text = `Salut ! On organise « ${trip.name} » avec KREW ✈️\n\nRejoins le groupe et indique tes disponibilités et tes préférences :\n👉 ${shareUrl}`;
                shareOnWhatsApp(text);
              }}
            >
              Inviter via WhatsApp
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={missingParticipants.length === 0}
              onClick={() => {
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
            >
              Relancer sur WhatsApp
            </Button>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/50 pb-3">
          <h2 className="flex items-center gap-2 font-display text-[26px] font-normal text-foreground sm:text-[29px]">
            <KrewIcon name="group" tone="plum" size="sm" className="size-5" />
            Participants
          </h2>
          <p className="font-mono text-[12px] text-muted-foreground sm:text-[13px]">{answered}/{total} ont renseigné leurs préférences</p>
        </div>

        <div className="divide-y divide-border/50">
          {participants.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Personne n’a encore rejoint le groupe.</p>
          ) : (
            participants.map((p) => (
              <div key={p.id} className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-medium text-foreground">{p.display_name ?? p.email}</span>
                    {p.user_id === trip.owner_id ? (
                      <Badge variant="sun" className="gap-1 px-2 py-0.5 text-[12px] bg-amber-500/10 text-amber-700 border-amber-500/20">
                        <Crown className="size-3" /> Organisateur·rice
                      </Badge>
                    ) : p.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId) ? (
                      <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[12px]">
                        <Shield className="size-3" /> Co-organisateur·rice
                      </Badge>
                    ) : null}
                    {p.isStar ? (
                      <Badge variant="sun" className="gap-1 px-2 py-0.5 text-[12px] bg-amber-500/10 text-amber-700 border-amber-500/20">
                        <Star className="size-3 fill-amber-500 text-amber-500" /> Star
                      </Badge>
                    ) : null}
                  </div>
                  {p.email ? <p className="break-all text-[13px] text-muted-foreground">{p.email}</p> : null}
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Badge variant={p.status === "accepte" ? "success" : "muted"} className="font-normal">
                    {p.status === "accepte" ? "Participe" : p.status}
                  </Badge>
                  {data.isCreator && p.user_id && !p.placeholder && !p.isStar && p.user_id !== "star-virtual-uid" && p.user_id !== trip.owner_id ? (
                    p.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId) ? (
                      <Button
                        variant="ghost"
                        className="text-[13px] font-normal text-destructive hover:bg-destructive/5"
                        disabled={setCoOrgMutation.isPending}
                        onClick={() => setCoOrgMutation.mutate({ coOrganizerId: null })}
                      >
                        Retirer co-org
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        className="text-[13px] font-normal text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        disabled={setCoOrgMutation.isPending}
                        onClick={() => setCoOrgMutation.mutate({ coOrganizerId: p.user_id || null })}
                      >
                        Nommer co-org
                      </Button>
                    )
                  ) : null}
                  {data.isOwner && !p.placeholder ? (
                    <Button
                      variant="ghost"
                      className="text-[13px]"
                      onClick={() => removeMutation.mutate(p.id)}
                    >
                      Retirer
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {trip.has_star || trip.celebrated_person || STAR_EVENT_TYPES.has(trip.event_type) ? (
        <section className="space-y-4 border-t border-border/60 pt-6">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 font-display text-[24px] font-normal text-foreground sm:text-[27px]">
              <Star className="size-5 text-primary" /> Rôle de la Star ({trip.celebrated_person || "Star"})
            </h2>
            <p className="text-sm text-muted-foreground">Choisis simplement si l’organisation doit rester secrète pour la Star.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!data.isOwner}
              onClick={() => setStarMode("secret")}
              className={cn(
                "min-h-[96px] rounded-[16px] border px-4 py-3 text-left transition-colors",
                starMode === "secret"
                  ? "border-primary/45 bg-primary/[0.06] text-foreground"
                  : "border-border/70 bg-background text-foreground hover:border-primary/30",
              )}
            >
              <span className="block text-base font-semibold">🤫 Mode secret</span>
              <span className="mt-1 block text-[13px] font-normal leading-relaxed text-muted-foreground">La Star ne voit pas l’organisation et tu renseignes ses préférences à sa place.</span>
            </button>
            <button
              type="button"
              disabled={!data.isOwner}
              onClick={() => setStarMode("participant")}
              className={cn(
                "min-h-[96px] rounded-[16px] border px-4 py-3 text-left transition-colors",
                starMode === "participant"
                  ? "border-primary/45 bg-primary/[0.06] text-foreground"
                  : "border-border/70 bg-background text-foreground hover:border-primary/30",
              )}
            >
              <span className="block text-base font-semibold">🎂 Mode participant</span>
              <span className="mt-1 block text-[13px] font-normal leading-relaxed text-muted-foreground">La Star rejoint le groupe et répond comme les autres participants.</span>
            </button>
          </div>

          <div className="border-t border-border/40 pt-4">
            <Label className="text-sm">La Star participe aux frais</Label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant={starPaysShare ? "default" : "outline"} onClick={() => setStarPaysShare(true)}>Oui</Button>
              <Button type="button" variant={!starPaysShare ? "default" : "outline"} onClick={() => setStarPaysShare(false)}>Non, sa part est répartie entre les autres</Button>
            </div>
          </div>
        </section>
      ) : null}

      {data.isOwner ? (
        <section className="space-y-3 border-t border-primary/20 pt-6">
          <div>
            <h3 className="font-display text-[24px] font-normal text-foreground">Tout est prêt ?</h3>
            <p className="mt-1 text-sm text-muted-foreground">Une fois le lien partagé et le rôle de la Star configuré, retourne au voyage pour poursuivre l’organisation.</p>
          </div>
          <Button
            size="lg"
            className="w-full sm:w-auto"
            disabled={finishInviteMutation.isPending}
            onClick={() => finishInviteMutation.mutate()}
          >
            {finishInviteMutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles className="size-4" />}
            Accéder au tableau de bord du voyage
          </Button>
        </section>
      ) : (
        <div className="flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row">
          <Button asChild variant="outline" className="flex-1"><Link to="/trips/$tripId" params={{ tripId }}>Voir le hub</Link></Button>
          <Button asChild className="flex-1"><Link to="/trips/$tripId/availability" params={{ tripId }}>Continuer → disponibilités</Link></Button>
        </div>
      )}
    </main>
  );
}
