import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Crown, MoreHorizontal, Shield } from "lucide-react";
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
import {
  finalizeInvitationStep,
  getTripDetail,
  inviteParticipant,
  removeParticipant,
  setCoOrganizer,
} from "@/lib/trips.functions";
import { getTripInviteLink, rotateTripInviteLink } from "@/lib/join.functions";
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
  const invite = useServerFn(inviteParticipant);
  const removeGuest = useServerFn(removeParticipant);
  const setCoOrg = useServerFn(setCoOrganizer);
  const finishInvite = useServerFn(finalizeInvitationStep);
  const fetchInviteLink = useServerFn(getTripInviteLink);
  const rotateInviteLink = useServerFn(rotateTripInviteLink);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
    retry: 3,
    retryDelay: 1000,
  });
  const {
    data: inviteLink,
    isLoading: inviteLinkLoading,
    isError: inviteLinkError,
  } = useQuery({
    queryKey: ["trip-invite-link", tripId],
    queryFn: () => fetchInviteLink({ data: { tripId } }),
    enabled: Boolean(data?.isOwner),
    retry: 2,
  });

  const [email, setEmail] = useState("");

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !inviteLink?.token) return "";
    return `${window.location.origin}/join/${tripId}?token=${encodeURIComponent(inviteLink.token)}`;
  }, [tripId, inviteLink?.token]);

  const rotateLinkMutation = useMutation({
    mutationFn: () => rotateInviteLink({ data: { tripId } }),
    onSuccess: (nextLink) => {
      queryClient.setQueryData(["trip-invite-link", tripId], nextLink);
    },
    onError: (err) => {
      console.error("Impossible de renouveler le lien d'invitation:", err);
      toast.error("Impossible de renouveler le lien pour le moment.");
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: { tripId, email: email.trim() } }),
    onSuccess: () => {
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (err) => {
      console.error("Impossible d'envoyer l'invitation:", err);
      toast.error("Cette adresse e-mail est invalide ou a déjà été invitée.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (participantId: string) => removeGuest({ data: { participantId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip", tripId] }),
    onError: (err) => {
      console.error("Impossible de retirer le participant:", err);
      toast.error("Impossible de retirer cette personne du voyage pour le moment.");
    },
  });

  const setCoOrgMutation = useMutation({
    mutationFn: ({ coOrganizerId }: { coOrganizerId: string | null }) =>
      setCoOrg({ data: { tripId, coOrganizerId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (err) => {
      console.error("Impossible de mettre à jour le rôle:", err);
      toast.error("Impossible de mettre à jour ce rôle pour le moment.");
    },
  });

  const finishInviteMutation = useMutation({
    mutationFn: () => {
      const logistics = (data?.trip?.group_logistics ?? {}) as any;
      const existingStarMode = logistics.star_mode === "participant" ? "participant" : "secret";
      const existingStarPaysShare = logistics.star_pays_share !== false;
      return finishInvite({
        data: {
          tripId,
          starMode: existingStarMode,
          inviteStepCompleted: true,
          starPaysShare: existingStarPaysShare,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      navigate({ to: "/trips/$tripId", params: { tripId } });
    },
    onError: (err: any) => {
      console.error("Impossible d'enregistrer les invitations:", err);
      toast.error("Impossible d’enregistrer les invitations pour le moment. Réessaie dans un instant.");
    },
  });

  if (isError && !data) {
    return (
      <main className="mx-auto w-full max-w-[820px] space-y-4 px-4 py-10 text-center sm:px-6 lg:px-8">
        <h1 className="font-display text-[30px] font-normal text-foreground">Impossible de charger les invitations</h1>
        <p className="text-sm text-muted-foreground">Les informations du voyage ne sont pas disponibles pour le moment.</p>
        <Button onClick={() => refetch()}>Réessayer</Button>
      </main>
    );
  }

  if (isLoading || !data) {
    return (
      <main className="mx-auto w-full max-w-[820px] px-4 py-10 sm:px-6 lg:px-8">
        <KrewThinkingState context="generic" customMessage="Chargement des invitations…" delayMs={0} />
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

  function shareInvitation() {
    if (!shareUrl) {
      toast.error("Le lien d’invitation n’est pas encore disponible.");
      return;
    }
    const text = `Salut ! On organise « ${trip.name} » avec KREW ✈️\n\nRejoins le groupe et indique tes disponibilités et tes préférences :\n👉 ${shareUrl}`;
    shareOnWhatsApp(text);
  }

  async function copyInvitationLink() {
    if (!shareUrl) {
      toast.error("Le lien d’invitation n’est pas encore disponible.");
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (err) {
      console.error("Impossible de copier le lien d'invitation:", err);
      toast.error("Impossible de copier le lien pour le moment.");
      throw err;
    }
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
          Partage l’invitation à la team. Chacun pourra rejoindre le voyage et répondre ensuite à son rythme.
        </p>
      </KrewJourneyPageHeader>

      {data.isOwner ? (
        <section className="space-y-3 border-b border-border/45 pb-6">
          <div className="space-y-1">
            <h2 className="font-display text-[25px] font-normal text-foreground sm:text-[28px]">Fais entrer la Krew</h2>
            <p className="max-w-[38rem] text-[14px] leading-[1.5] text-muted-foreground">
              Un petit message, le lien du voyage, et chacun peut rejoindre la team directement.
            </p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Button type="button" onClick={shareInvitation} disabled={!shareUrl || inviteLinkLoading} className="min-h-11 justify-center">
              <KrewIcon name="message" tone="cream" size="sm" className="size-4" />
              Inviter via WhatsApp
            </Button>
            <KrewStatefulButton
              variant="outline"
              className="justify-center"
              idleLabel="Copier le lien d’invitation"
              loadingLabel="Copie…"
              successLabel="Lien copié"
              errorLabel="Réessayer"
              disabled={!shareUrl || inviteLinkLoading}
              onAction={copyInvitationLink}
            />
          </div>

          {inviteLinkError ? (
            <p className="text-[13px] text-destructive">Impossible de préparer le lien d’invitation pour le moment.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
              <span>Le lien reste valable tant que tu ne le renouvelles pas.</span>
              <button type="button" disabled={inviteLinkLoading || rotateLinkMutation.isPending} onClick={() => rotateLinkMutation.mutate()} className="font-medium underline underline-offset-3 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
                {rotateLinkMutation.isPending ? "Renouvellement…" : "Renouveler le lien"}
              </button>
            </div>
          )}
        </section>
      ) : null}

      {data.isOwner ? (
        <section className="space-y-4 border-b border-border/55 pb-7">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 font-display text-[25px] font-normal text-foreground sm:text-[28px]"><KrewIcon name="plus" tone="plum" size="sm" className="size-5" />Ajouter quelqu’un</h2>
            <p className="text-[14px] text-muted-foreground">Invite directement une personne avec son adresse e-mail.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-email" className="text-[13px] font-medium text-foreground">Adresse e-mail</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input id="invite-email" type="email" autoComplete="email" placeholder="ami@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={FORM_INPUT_CLASS} />
              <KrewStatefulButton className="w-full shrink-0 sm:w-auto" idleLabel="Inviter" loadingLabel="Invitation…" successLabel="Invitation envoyée" errorLabel="Réessayer" disabled={!email.trim()} onAction={() => inviteMutation.mutateAsync()} />
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="border-b border-border/45 pb-2">
          <h2 className="flex items-center gap-2 font-display text-[26px] font-normal text-foreground sm:text-[29px]"><KrewIcon name="group" tone="plum" size="sm" className="size-5" />Le groupe</h2>
        </div>
        <div className="divide-y divide-border/45">
          {participants.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Personne n’a encore rejoint le groupe.</p>
          ) : (
            participants.map((p) => {
              const canChangeRole = Boolean(data.isCreator && p.user_id && !p.placeholder && !p.isStar && p.user_id !== "star-virtual-uid" && p.user_id !== trip.owner_id);
              const canRemove = Boolean(data.isOwner && !p.placeholder);
              const showMenu = canChangeRole || canRemove;
              const isCoOrg = p.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId);
              return (
                <div key={p.id} className="grid gap-2 py-2.5 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-medium text-foreground sm:text-base">{p.display_name ?? p.email}</span>
                      {p.user_id === trip.owner_id ? <Badge variant="sun" className="gap-1 border-primary/15 bg-primary/[0.07] px-2 py-0.5 text-[12px] text-primary"><Crown className="size-3" /> Organisateur·rice</Badge> : isCoOrg ? <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[12px]"><Shield className="size-3" /> Co-organisateur·rice</Badge> : null}
                      {p.isStar ? <Badge variant="sun" className="gap-1 border-primary/15 bg-primary/[0.07] px-2 py-0.5 text-[12px] text-primary"><KrewIcon name="favorite" tone="plum" size="sm" className="size-3" /> Star</Badge> : null}
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
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Plus d’options pour ${p.display_name ?? p.email ?? "ce participant"}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[190px]">
                          {canChangeRole ? <DropdownMenuItem disabled={setCoOrgMutation.isPending} onSelect={() => setCoOrgMutation.mutate({ coOrganizerId: isCoOrg ? null : p.user_id || null })}>{isCoOrg ? "Retirer le rôle de co-organisateur·rice" : "Nommer co-organisateur·rice"}</DropdownMenuItem> : null}
                          {canChangeRole && canRemove ? <DropdownMenuSeparator /> : null}
                          {canRemove ? <DropdownMenuItem className="text-destructive focus:text-destructive" disabled={removeMutation.isPending} onSelect={() => removeMutation.mutate(p.id)}>Retirer du voyage</DropdownMenuItem> : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {data.isOwner ? (
        <section className="space-y-3 border-t border-primary/20 pt-7">
          <div>
            <h3 className="flex items-center gap-2 font-display text-[24px] font-normal text-foreground"><KrewIcon name="check" tone="sage" size="sm" className="size-5" />Tout est prêt ?</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">Enregistre les invitations puis retourne au voyage pour poursuivre l’organisation. Les choix concernant la Star se font dans son questionnaire dédié.</p>
          </div>
          <KrewStatefulButton className="max-w-full" idleLabel={inviteStepCompleted ? "Enregistrer et revenir au voyage" : "Enregistrer les invitations"} loadingLabel="Enregistrement…" successLabel="Invitations enregistrées" errorLabel="Réessayer" onAction={() => finishInviteMutation.mutateAsync()} />
        </section>
      ) : (
        <div className="flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center">
          <Link to="/trips/$tripId" params={{ tripId }} className="inline-flex min-h-10 items-center text-[14px] font-semibold text-muted-foreground hover:text-primary">Voir le voyage</Link>
          <Button asChild className="w-full sm:w-auto"><Link to="/trips/$tripId/availability" params={{ tripId }}>Indiquer mes disponibilités</Link></Button>
        </div>
      )}
    </main>
  );
}