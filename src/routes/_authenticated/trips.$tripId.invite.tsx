import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Crown, Loader2, MoreHorizontal, Shield } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewIcon } from "@/components/krew/visual-language";
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

const FORM_INPUT_CLASS =
  "h-11 rounded-[10px] border-border/70 bg-background px-3 text-[15px] shadow-none transition-colors focus-visible:border-primary/55 focus-visible:ring-2 focus-visible:ring-primary/10";

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
      <main className="mx-auto w-full max-w-[820px] space-y-4 px-4 py-10 text-center sm:px-6 lg:px-8">
        <h1 className="font-display text-[30px] font-normal text-foreground">Impossible de charger l’invitation</h1>
        <p className="text-sm text-muted-foreground">Les détails du voyage ne sont pas disponibles pour le moment.</p>
        <Button onClick={() => { refetch(); refetchProgress(); }}>Réessayer</Button>
      </main>
    );
  }

  if (isLoading || !data) {
    return (
      <main className="mx-auto w-full max-w-[820px] px-4 py-10 sm:px-6 lg:px-8">
        <KrewThinkingState context="generic" customMessage="Chargement de l’invitation…" delayMs={0} />
      </main>
    );
  }

  const trip = data.trip as any;
  const rawParticipants = (data.participants ?? []) as any[];
  const celebratedPerson = trip?.celebrated_person;
  const starUid = trip?.star_user_id || "star-virtual-uid";
  const hasStar = Boolean(trip?.has_star || celebratedPerson);
  const inviteStepCompleted = Boolean(
    (trip?.group_logistics as any)?.inviteStepCompleted ||
    (trip?.group_logistics as any)?.invite_step_completed ||
    (trip as any)?.invite_step_completed,
  );

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

  function shareInvitation() {
    const text = `Salut ! On organise « ${trip.name} » avec KREW ✈️\n\nRejoins le groupe et indique tes disponibilités et tes préférences :\n👉 ${shareUrl}`;
    shareOnWhatsApp(text);
  }

  function remindGroup() {
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
  }

  return (
    <main className="mx-auto w-full max-w-[820px] space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-primary"
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
          {inviteStepCompleted ? "La team est réunie. Tu peux relancer doucement les réponses qui manquent." : "Partage le lien, invite la team et vois en un coup d’œil qui doit encore répondre."}
        </p>
      </KrewJourneyPageHeader>

      {data.isOwner ? (
        <section className="border-b border-border/45 pb-5">
          <button type="button" onClick={shareInvitation} className="inline-flex min-h-10 items-center gap-2 text-[14px] font-semibold text-primary underline-offset-4 hover:underline"><KrewIcon name="invite" tone="plum" size="sm" className="size-4" />Inviter via WhatsApp <span aria-hidden="true">→</span></button>
        </section>
      ) : null}

      {data.isOwner ? (
        <section className="space-y-4 border-b border-border/55 pb-7">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 font-display text-[25px] font-normal text-foreground sm:text-[28px]">
              <KrewIcon name="plus" tone="plum" size="sm" className="size-5" />
              Ajouter quelqu’un
            </h2>
            <p className="text-[14px] text-muted-foreground">Invite directement une personne avec son adresse e-mail.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-email" className="text-[13px] font-medium text-foreground">Adresse e-mail</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                placeholder="ami@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={FORM_INPUT_CLASS}
              />
              <Button
                disabled={!email.trim() || inviteMutation.isPending}
                onClick={() => inviteMutation.mutate()}
                className="w-full shrink-0 sm:w-auto"
              >
                {inviteMutation.isPending ? <Loader2 className="animate-spin" /> : <KrewIcon name="invite" tone="cream" size="sm" className="size-4" />}
                Inviter
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/45 pb-2">
          <h2 className="flex items-center gap-2 font-display text-[26px] font-normal text-foreground sm:text-[29px]">
            <KrewIcon name="group" tone="plum" size="sm" className="size-5" />
            La team
          </h2>
          <p className="font-mono text-[12px] text-muted-foreground sm:text-[13px]">{answered}/{total} ont renseigné leurs préférences</p>
        </div>

        <div className="divide-y divide-border/45">
          {participants.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Personne n’a encore rejoint le groupe.</p>
          ) : (
            participants.map((p) => {
              const canChangeRole = Boolean(
                data.isCreator &&
                p.user_id &&
                !p.placeholder &&
                !p.isStar &&
                p.user_id !== "star-virtual-uid" &&
                p.user_id !== trip.owner_id,
              );
              const canRemove = Boolean(data.isOwner && !p.placeholder);
              const showMenu = canChangeRole || canRemove;
              const isCoOrg = p.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId);

              return (
                <div key={p.id} className="grid gap-2 py-2.5 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-medium text-foreground sm:text-base">{p.display_name ?? p.email}</span>
                      {p.user_id === trip.owner_id ? (
                        <Badge variant="sun" className="gap-1 border-primary/15 bg-primary/[0.07] px-2 py-0.5 text-[12px] text-primary">
                          <Crown className="size-3" /> Organisateur·rice
                        </Badge>
                      ) : isCoOrg ? (
                        <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[12px]">
                          <Shield className="size-3" /> Co-organisateur·rice
                        </Badge>
                      ) : null}
                      {p.isStar ? (
                        <Badge variant="sun" className="gap-1 border-primary/15 bg-primary/[0.07] px-2 py-0.5 text-[12px] text-primary">
                          <KrewIcon name="favorite" tone="plum" size="sm" className="size-3" /> Star
                        </Badge>
                      ) : null}
                    </div>
                    {p.email && !p.display_name ? <p className="break-all text-[12px] text-muted-foreground">{p.email}</p> : null}
                  </div>

                  <div className="flex items-center gap-2 sm:justify-end">
                    <Badge variant={p.status === "accepte" ? "success" : "muted"} className="gap-1 font-normal">
                      {p.status === "accepte" ? <KrewIcon name="check" tone="sage" size="sm" className="size-3" /> : null}
                      {p.status === "accepte" ? "Participe" : p.status}
                    </Badge>

                    {showMenu ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Plus d’options pour ${p.display_name ?? p.email ?? "ce participant"}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[190px]">
                          {canChangeRole ? (
                            <DropdownMenuItem
                              disabled={setCoOrgMutation.isPending}
                              onSelect={() => setCoOrgMutation.mutate({ coOrganizerId: isCoOrg ? null : p.user_id || null })}
                            >
                              {isCoOrg ? "Retirer le rôle de co-org" : "Nommer co-organisateur·rice"}
                            </DropdownMenuItem>
                          ) : null}
                          {canChangeRole && canRemove ? <DropdownMenuSeparator /> : null}
                          {canRemove ? (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              disabled={removeMutation.isPending}
                              onSelect={() => removeMutation.mutate(p.id)}
                            >
                              Retirer du voyage
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {data.isOwner && missingParticipants.length > 0 ? (
          <div className="flex flex-col gap-1 border-t border-border/45 pt-4 text-[14px] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              On avance bien : {missingParticipants.length} personne{missingParticipants.length > 1 ? "s" : ""} doivent encore répondre.
            </p>
            <button
              type="button"
              onClick={remindGroup}
              className="inline-flex min-h-10 items-center gap-1.5 self-start font-semibold text-primary underline-offset-4 hover:underline sm:self-auto"
            >
              <KrewIcon name="message" tone="plum" size="sm" className="size-4" />
              Relancer gentiment via WhatsApp <span aria-hidden="true" className="ml-1">→</span>
            </button>
          </div>
        ) : null}
      </section>

      {trip.has_star || trip.celebrated_person || STAR_EVENT_TYPES.has(trip.event_type) ? (
        <section className="space-y-5 border-t border-border/55 pt-7">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 font-display text-[25px] font-normal text-foreground sm:text-[28px]">
              <KrewIcon name="favorite" tone="plum" size="sm" className="size-5" />
              Rôle de la Star ({trip.celebrated_person || "Star"})
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">Choisis simplement si l’organisation doit rester secrète pour la Star.</p>
          </div>

          <fieldset className="divide-y divide-border/45" disabled={!data.isOwner}>
            <legend className="sr-only">Mode de participation de la Star</legend>
            <label className="grid cursor-pointer grid-cols-[24px_minmax(0,1fr)] gap-3 py-4 first:pt-0">
              <input
                type="radio"
                name="star-mode"
                value="secret"
                checked={starMode === "secret"}
                onChange={() => setStarMode("secret")}
                className="mt-1 size-4 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-foreground">Mode secret</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">La Star ne voit pas l’organisation et tu renseignes ses préférences à sa place.</span>
              </span>
            </label>
            <label className="grid cursor-pointer grid-cols-[24px_minmax(0,1fr)] gap-3 py-4">
              <input
                type="radio"
                name="star-mode"
                value="participant"
                checked={starMode === "participant"}
                onChange={() => setStarMode("participant")}
                className="mt-1 size-4 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-foreground">Mode participant</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">La Star rejoint le groupe et répond comme les autres participants.</span>
              </span>
            </label>
          </fieldset>

          <div className="border-t border-border/45 pt-4">
            <Label className="text-[14px] font-semibold text-foreground">La Star participe aux frais</Label>
            <div className="mt-3 inline-flex rounded-[10px] border border-border/65 p-1" role="group" aria-label="Participation de la Star aux frais">
              <button
                type="button"
                disabled={!data.isOwner}
                aria-pressed={starPaysShare}
                onClick={() => setStarPaysShare(true)}
                className={cn(
                  "min-h-9 rounded-[8px] px-3 text-[13px] font-semibold transition-colors",
                  starPaysShare ? "bg-sage/20 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Oui
              </button>
              <button
                type="button"
                disabled={!data.isOwner}
                aria-pressed={!starPaysShare}
                onClick={() => setStarPaysShare(false)}
                className={cn(
                  "min-h-9 rounded-[8px] px-3 text-[13px] font-semibold transition-colors",
                  !starPaysShare ? "bg-sage/20 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Non, sa part est répartie
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {data.isOwner ? (
        <section className="space-y-3 border-t border-primary/20 pt-7">
          <div>
            <h3 className="flex items-center gap-2 font-display text-[24px] font-normal text-foreground">
              <KrewIcon name="check" tone="sage" size="sm" className="size-5" />
              Tout est prêt ?
            </h3>
            <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">Enregistre les choix de la Star puis retourne au voyage pour poursuivre l’organisation.</p>
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={finishInviteMutation.isPending}
            onClick={() => finishInviteMutation.mutate()}
          >
            {finishInviteMutation.isPending ? <Loader2 className="animate-spin" /> : <KrewIcon name="check" tone="cream" size="sm" className="size-4" />}
            {inviteStepCompleted ? "Enregistrer et revenir au voyage" : "Accéder au tableau de bord du voyage"}
          </Button>
        </section>
      ) : (
        <div className="flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center">
          <Link
            to="/trips/$tripId"
            params={{ tripId }}
            className="inline-flex min-h-10 items-center text-[14px] font-semibold text-muted-foreground hover:text-primary"
          >
            Voir le hub
          </Link>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/trips/$tripId/availability" params={{ tripId }}>Continuer → disponibilités</Link>
          </Button>
        </div>
      )}
    </main>
  );
}
