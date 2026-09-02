import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Crown, Shield } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewIcon } from "@/components/krew/visual-language";
import { getTripInviteLink, rotateTripInviteLink } from "@/lib/join.functions";
import { shareOnWhatsApp } from "@/lib/krew/whatsapp";
import { trackProductEvent } from "@/lib/product-analytics";
import {
  finalizeInvitationStep,
  getTripDetail,
  inviteParticipant,
  removeParticipant,
  setCoOrganizer,
} from "@/lib/trips.functions";

export function responseMissingCopy(availabilityMissing: number, preferencesMissing: number) {
  if (availabilityMissing > 0 && preferencesMissing > 0) {
    return `${availabilityMissing} disponibilité${availabilityMissing > 1 ? "s" : ""} et ${preferencesMissing} préférence${preferencesMissing > 1 ? "s" : ""} manquent encore.`;
  }
  if (availabilityMissing > 0) {
    return `${availabilityMissing} disponibilité${availabilityMissing > 1 ? "s" : ""} manque${availabilityMissing > 1 ? "nt" : ""} encore.`;
  }
  if (preferencesMissing > 0) {
    return `${preferencesMissing} préférence${preferencesMissing > 1 ? "s" : ""} manque${preferencesMissing > 1 ? "nt" : ""} encore.`;
  }
  return "Toutes les réponses attendues sont renseignées.";
}

export function TripInvitePage({ tripId }: { tripId: string }) {
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const fetchInviteLink = useServerFn(getTripInviteLink);
  const rotateInviteLink = useServerFn(rotateTripInviteLink);
  const invite = useServerFn(inviteParticipant);
  const remove = useServerFn(removeParticipant);
  const setCoOrg = useServerFn(setCoOrganizer);
  const finalize = useServerFn(finalizeInvitationStep);
  const [email, setEmail] = useState("");

  const detailQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });
  const inviteLinkQuery = useQuery({
    queryKey: ["trip-invite-link", tripId],
    queryFn: () => fetchInviteLink({ data: { tripId } }),
    enabled: Boolean((detailQuery.data as any)?.isOwner),
    retry: 2,
  });

  const data = detailQuery.data as any;
  const trip = data?.trip as any;
  const savedStarMode = trip?.group_logistics?.star_mode === "participant" ? "participant" : "secret";
  const savedStarPaysShare = trip?.group_logistics?.star_pays_share !== false;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["trip", tripId] });

  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: { tripId, email: email.trim() } }),
    onSuccess: () => {
      setEmail("");
      void trackProductEvent("participant_invited", {
        trip_id: tripId,
        role: data?.isCreator ? "organizer" : "co_organizer",
        trip_type: trip?.event_type,
        group_size: Number(trip?.participants_count ?? 0),
      });
      refresh();
    },
    onError: () => toast.error("Cette adresse e-mail est invalide ou a déjà été invitée."),
  });
  const rotateMutation = useMutation({
    mutationFn: () => rotateInviteLink({ data: { tripId } }),
    onSuccess: (next) => queryClient.setQueryData(["trip-invite-link", tripId], next),
    onError: () => toast.error("Impossible de renouveler le lien pour le moment."),
  });
  const removeMutation = useMutation({
    mutationFn: (participantId: string) => remove({ data: { participantId } }),
    onSuccess: refresh,
  });
  const roleMutation = useMutation({
    mutationFn: (coOrganizerId: string | null) => setCoOrg({ data: { tripId, coOrganizerId } }),
    onSuccess: refresh,
    onError: () => toast.error("Impossible de mettre à jour ce rôle pour le moment."),
  });
  const finalizeMutation = useMutation({
    mutationFn: () =>
      finalize({
        data: {
          tripId,
          starMode: savedStarMode,
          starPaysShare: savedStarPaysShare,
          inviteStepCompleted: true,
        },
      }),
    onSuccess: refresh,
    onError: () => toast.error("Impossible d’enregistrer les invitations pour le moment."),
  });

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !inviteLinkQuery.data?.token) return "";
    return `${window.location.origin}/join/${tripId}?token=${encodeURIComponent(inviteLinkQuery.data.token)}`;
  }, [inviteLinkQuery.data?.token, tripId]);

  function shareInvitation() {
    if (!shareUrl || !trip) {
      toast.error("Le lien d’invitation n’est pas encore disponible.");
      return;
    }
    shareOnWhatsApp(
      `Salut ! On organise « ${trip.name} » avec KREW ✈️\n\nRejoins le groupe et indique tes disponibilités et tes préférences :\n👉 ${shareUrl}`,
    );
  }

  async function copyInvitationLink() {
    if (!shareUrl) {
      toast.error("Le lien d’invitation n’est pas encore disponible.");
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
  }

  if (detailQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-[820px] px-4 py-10">
        <KrewThinkingState context="generic" customMessage="Chargement des invitations…" delayMs={0} />
      </main>
    );
  }
  if (!data || !trip || detailQuery.isError) {
    return <main className="mx-auto max-w-[820px] px-4 py-10 text-sm text-muted-foreground">Impossible de charger les invitations.</main>;
  }

  const rawParticipants = (data.participants ?? []) as any[];
  const occupiedSlots = rawParticipants.length;
  const placeholders = Array.from(
    { length: Math.max(0, Number(trip.participants_count || 0) - occupiedSlots) },
    (_, index) => ({
      id: `placeholder-${index}`,
      user_id: null,
      display_name: `Participant ${occupiedSlots + index + 1}`,
      status: "à inviter",
      placeholder: true,
    }),
  );
  const displayedParticipants = [...rawParticipants, ...placeholders];

  return (
    <main className="mx-auto w-full max-w-[820px] space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour au voyage
      </Link>

      <header>
        <h1 className="font-display text-[32px] font-normal text-foreground sm:text-[38px]">Inviter le groupe</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Partage l’invitation à la team. Chacun pourra rejoindre le voyage et répondre ensuite à son rythme.
        </p>
      </header>

      {data.isOwner ? (
        <section className="space-y-4 border-b border-border/50 pb-6">
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-normal text-foreground">Fais entrer la Krew</h2>
            <p className="text-sm text-muted-foreground">Un petit message, le lien du voyage, et chacun peut rejoindre la team directement.</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Button type="button" disabled={!shareUrl} onClick={shareInvitation} className="gap-2">
              <KrewIcon name="message" tone="cream" size="sm" className="size-4" />
              Inviter via WhatsApp
            </Button>
            <KrewStatefulButton
              variant="outline"
              idleLabel="Copier le lien d’invitation"
              loadingLabel="Copie…"
              successLabel="Lien copié"
              errorLabel="Réessayer"
              disabled={!shareUrl}
              onAction={copyInvitationLink}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>Le lien reste valable tant que tu ne le renouvelles pas.</span>
            <button
              type="button"
              disabled={rotateMutation.isPending}
              onClick={() => rotateMutation.mutate()}
              className="font-medium underline underline-offset-3 hover:text-primary disabled:opacity-50"
            >
              {rotateMutation.isPending ? "Renouvellement…" : "Renouveler le lien"}
            </button>
          </div>
          <div className="space-y-2 pt-1">
            <Label htmlFor="invite-email">Adresse e-mail</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ami@email.com" />
              <KrewStatefulButton
                idleLabel="Inviter"
                loadingLabel="Invitation…"
                successLabel="Invitation envoyée"
                errorLabel="Réessayer"
                disabled={!email.trim()}
                onAction={() => inviteMutation.mutateAsync()}
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="divide-y divide-border/45">
          {displayedParticipants.map((participant) => {
            const isOwner = Boolean(participant.user_id && participant.user_id === trip.owner_id);
            const isCoOrg = Boolean(participant.user_id && participant.user_id === trip.co_organizer_id);
            return (
              <div key={participant.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{participant.display_name || participant.email || "Participant"}</span>
                  {isOwner ? <Badge variant="sun"><Crown className="mr-1 size-3" />Organisateur·rice</Badge> : null}
                  {isCoOrg ? <Badge variant="secondary"><Shield className="mr-1 size-3" />Co-organisateur·rice</Badge> : null}
                  {participant.isStar ? <Badge variant="sun">Star</Badge> : null}
                  {participant.placeholder ? <Badge variant="muted">À inviter</Badge> : null}
                </div>
                {data.isCreator && participant.user_id && !isOwner && !participant.isStar ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => roleMutation.mutate(isCoOrg ? null : participant.user_id)}>
                      {isCoOrg ? "Retirer le rôle" : "Nommer co-organisateur·rice"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeMutation.mutate(participant.id)}>Retirer</Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {data.isOwner ? (
        <section className="border-t border-border/50 pt-6">
          <KrewStatefulButton
            idleLabel="Enregistrer les invitations"
            loadingLabel="Enregistrement…"
            successLabel="Invitations enregistrées"
            errorLabel="Réessayer"
            onAction={() => finalizeMutation.mutateAsync()}
          />
        </section>
      ) : (
        <p className="border-t border-border/50 pt-6 text-sm text-muted-foreground">Tu peux consulter le groupe ici. Les invitations et les rôles sont gérés par l’organisateur·rice.</p>
      )}
    </main>
  );
}
