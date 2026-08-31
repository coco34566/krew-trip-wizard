import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Crown, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewIcon } from "@/components/krew/visual-language";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
import { getTripInviteLink, rotateTripInviteLink } from "@/lib/join.functions";
import { STAR_EVENT_TYPES } from "@/lib/krew/constants";
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
  const fetchProgress = useServerFn(getParticipantsProgress);
  const fetchInviteLink = useServerFn(getTripInviteLink);
  const rotateInviteLink = useServerFn(rotateTripInviteLink);
  const invite = useServerFn(inviteParticipant);
  const remove = useServerFn(removeParticipant);
  const setCoOrg = useServerFn(setCoOrganizer);
  const finalize = useServerFn(finalizeInvitationStep);
  const [email, setEmail] = useState("");
  const [starMode, setStarMode] = useState<"secret" | "participant">("secret");
  const [starPaysShare, setStarPaysShare] = useState(true);

  const detailQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });
  const progressQuery = useQuery({
    queryKey: ["trip-progress", tripId],
    queryFn: () => fetchProgress({ data: { tripId } }),
  });
  const inviteLinkQuery = useQuery({
    queryKey: ["trip-invite-link", tripId],
    queryFn: () => fetchInviteLink({ data: { tripId } }),
    enabled: Boolean((detailQuery.data as any)?.isOwner),
    retry: 2,
  });

  const data = detailQuery.data as any;
  const trip = data?.trip as any;
  const progress = progressQuery.data as any;
  const savedMode = trip?.group_logistics?.star_mode;
  useEffect(() => {
    if (savedMode === "secret" || savedMode === "participant") setStarMode(savedMode);
    setStarPaysShare(trip?.group_logistics?.star_pays_share !== false);
  }, [savedMode, trip?.group_logistics?.star_pays_share]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    queryClient.invalidateQueries({ queryKey: ["trip-progress", tripId] });
  };

  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: { tripId, email: email.trim() } }),
    onSuccess: () => {
      setEmail("");
      toast.success("Invitation ajoutée");
      void trackProductEvent("participant_invited", {
        trip_id: tripId,
        role: data?.isCreator ? "organizer" : "co_organizer",
        trip_type: trip?.event_type,
        group_size: Number(progress?.preferencesExpected ?? progress?.total ?? trip?.participants_count ?? 0),
      });
      refresh();
    },
    onError: () => toast.error("Cette adresse e-mail est invalide ou a déjà été invitée."),
  });
  const rotateMutation = useMutation({
    mutationFn: () => rotateInviteLink({ data: { tripId } }),
    onSuccess: (next) => {
      queryClient.setQueryData(["trip-invite-link", tripId], next);
      toast.success("Nouveau lien créé");
    },
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
    mutationFn: () => finalize({ data: { tripId, starMode, starPaysShare, inviteStepCompleted: true } }),
    onSuccess: () => {
      toast.success("Invitations enregistrées");
      refresh();
    },
    onError: () => toast.error("Impossible d’enregistrer les invitations pour le moment."),
  });

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !inviteLinkQuery.data?.token) return "";
    return `${window.location.origin}/join/${tripId}?token=${encodeURIComponent(inviteLinkQuery.data.token)}`;
  }, [inviteLinkQuery.data?.token, tripId]);

  if (detailQuery.isLoading || progressQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-[820px] px-4 py-10">
        <KrewThinkingState context="generic" customMessage="Chargement des invitations…" delayMs={0} />
      </main>
    );
  }
  if (!data || !trip || detailQuery.isError || progressQuery.isError) {
    return <main className="mx-auto max-w-[820px] px-4 py-10 text-sm text-muted-foreground">Impossible de charger les invitations.</main>;
  }

  const rawParticipants = (data.participants ?? []) as any[];
  const hasStar = Boolean(trip.has_star || trip.celebrated_person || STAR_EVENT_TYPES.has(trip.event_type));
  const secretStarAlreadyListed = Boolean(
    trip.star_user_id && rawParticipants.some((participant) => participant.user_id === trip.star_user_id),
  );
  const virtualSecretStar =
    hasStar && starMode === "secret" && !secretStarAlreadyListed
      ? {
          id: "star-secret-slot",
          user_id: null,
          display_name: trip.celebrated_person || "La Star",
          status: "participe",
          isStar: true,
          secretStar: true,
        }
      : null;
  const occupiedSlots = rawParticipants.length + (virtualSecretStar ? 1 : 0);
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
  const displayedParticipants = [
    ...rawParticipants,
    ...(virtualSecretStar ? [virtualSecretStar] : []),
    ...placeholders,
  ];
  const availabilityAnswered = Number(progress?.availabilityAnswered ?? 0);
  const availabilityExpected = Number(progress?.availabilityExpected ?? progress?.total ?? 0);
  const preferencesAnswered = Number(progress?.answered ?? 0);
  const preferencesExpected = Number(progress?.preferencesExpected ?? progress?.total ?? 0);
  const availabilityMissing = Math.max(availabilityExpected - availabilityAnswered, 0);
  const preferencesMissing = Math.max(preferencesExpected - preferencesAnswered, 0);
  const groupFullyIdentified = placeholders.length === 0;
  const inviteStepCompleted = Boolean(
    trip.group_logistics?.inviteStepCompleted || trip.group_logistics?.invite_step_completed || trip.invite_step_completed,
  );

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
          {inviteStepCompleted && groupFullyIdentified
            ? "Le groupe est réuni. Tu peux relancer les réponses qui manquent."
            : placeholders.length > 0
              ? `${placeholders.length} personne${placeholders.length > 1 ? "s" : ""} reste${placeholders.length > 1 ? "nt" : ""} à inviter.`
              : "Le groupe est identifié. Les réponses peuvent encore arriver séparément."}
        </p>
      </header>

      {data.isOwner ? (
        <section className="space-y-4 border-b border-border/50 pb-6">
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={!shareUrl}
              onClick={() => shareOnWhatsApp(`Rejoins « ${trip.name} » sur KREW : ${shareUrl}`)}
            >
              Inviter via WhatsApp
            </Button>
            <Button type="button" variant="ghost" disabled={rotateMutation.isPending} onClick={() => rotateMutation.mutate()}>
              {rotateMutation.isPending ? "Renouvellement…" : "Renouveler le lien"}
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Adresse e-mail</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ami@email.com" />
              <Button disabled={!email.trim() || inviteMutation.isPending} onClick={() => inviteMutation.mutate()}>
                {inviteMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Inviter
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="grid gap-2 rounded-2xl border border-border/60 bg-surface/30 p-4 sm:grid-cols-2">
          <p className="text-sm"><strong>{availabilityAnswered}/{availabilityExpected}</strong> ont indiqué leurs disponibilités</p>
          <p className="text-sm"><strong>{preferencesAnswered}/{preferencesExpected}</strong> ont renseigné leurs préférences</p>
        </div>
        {(availabilityMissing > 0 || preferencesMissing > 0) ? (
          <p className="text-sm text-muted-foreground">{responseMissingCopy(availabilityMissing, preferencesMissing)}</p>
        ) : null}

        <div className="divide-y divide-border/45">
          {displayedParticipants.map((participant) => {
            const isOwner = Boolean(participant.user_id && participant.user_id === trip.owner_id);
            const isCoOrg = Boolean(participant.user_id && participant.user_id === trip.co_organizer_id);
            return (
              <div key={participant.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{participant.display_name || participant.email || "Participant"}</span>
                    {isOwner ? <Badge variant="sun"><Crown className="mr-1 size-3" />Organisateur·rice</Badge> : null}
                    {isCoOrg ? <Badge variant="secondary"><Shield className="mr-1 size-3" />Co-organisateur·rice</Badge> : null}
                    {participant.isStar ? <Badge variant="sun">Star</Badge> : null}
                    {participant.placeholder ? <Badge variant="muted">À inviter</Badge> : null}
                  </div>
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

      {hasStar ? (
        <section className="space-y-4 border-t border-border/50 pt-6">
          <h2 className="font-display text-2xl font-normal text-foreground">Rôle de la Star ({trip.celebrated_person || "Star"})</h2>
          <fieldset disabled={!data.isOwner} className="space-y-3">
            <label className="flex gap-3">
              <input type="radio" name="star-mode" checked={starMode === "secret"} onChange={() => setStarMode("secret")} />
              <span><strong>Mode secret</strong><span className="block text-sm text-muted-foreground">L’organisateur renseigne ses réponses à sa place.</span></span>
            </label>
            <label className="flex gap-3">
              <input type="radio" name="star-mode" checked={starMode === "participant"} onChange={() => setStarMode("participant")} />
              <span><strong>Mode participant</strong><span className="block text-sm text-muted-foreground">La Star rejoint le groupe et répond comme les autres.</span></span>
            </label>
          </fieldset>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">La Star participe aux frais</span>
            <Button size="sm" variant={starPaysShare ? "default" : "outline"} disabled={!data.isOwner} onClick={() => setStarPaysShare(true)}>Oui</Button>
            <Button size="sm" variant={!starPaysShare ? "default" : "outline"} disabled={!data.isOwner} onClick={() => setStarPaysShare(false)}>Non</Button>
          </div>
        </section>
      ) : null}

      {data.isOwner ? (
        <section className="border-t border-border/50 pt-6">
          <Button disabled={finalizeMutation.isPending} onClick={() => finalizeMutation.mutate()}>
            {finalizeMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <KrewIcon name="check" tone="sage" size="sm" className="size-4" />}
            Enregistrer les invitations
          </Button>
        </section>
      ) : (
        <p className="border-t border-border/50 pt-6 text-sm text-muted-foreground">Tu peux consulter le groupe ici. Les invitations et les rôles sont gérés par l’organisateur.</p>
      )}
    </main>
  );
}
