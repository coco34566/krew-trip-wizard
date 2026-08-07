import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Copy, Link2, Loader2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getTripDetail, inviteParticipant, removeParticipant } from "@/lib/trips.functions";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
import { eventTypeLabel } from "@/lib/krew/constants";

export const Route = createFileRoute("/_authenticated/trips/$tripId/invite")({
  head: () => ({
    meta: [{ title: "Inviter le groupe — Krew" }],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { tripId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const fetchProgress = useServerFn(getParticipantsProgress);
  const invite = useServerFn(inviteParticipant);
  const removeGuest = useServerFn(removeParticipant);

  const { data, isLoading } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });
  const { data: progress } = useQuery({
    queryKey: ["trip-progress", tripId],
    queryFn: () => fetchProgress({ data: { tripId } }),
  });

  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

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

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-3xl" />
      </main>
    );
  }

  const trip = data.trip as any;
  const participants = (data.participants ?? []) as {
    id: string;
    email: string;
    display_name: string | null;
    status: string;
  }[];
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
        <Button
          className="mt-3 w-full sm:w-auto"
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
      </section>

      {data.isOwner ? (
        <section className="mt-6 rounded-3xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <UserPlus className="size-4" /> Ajouter par email
          </h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder="ami@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              disabled={!email.trim() || inviteMutation.isPending}
              onClick={() => inviteMutation.mutate()}
            >
              {inviteMutation.isPending ? <Loader2 className="animate-spin" /> : "Inviter"}
            </Button>
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
                <div>
                  <p className="text-sm font-medium">{p.display_name ?? p.email}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.status === "accepte" ? "success" : "muted"}>{p.status}</Badge>
                  {data.isOwner ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMutation.mutate(p.id)}
                    >
                      Retirer
                    </Button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

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
    </main>
  );
}
