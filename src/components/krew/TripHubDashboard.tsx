import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  Copy,
  Check,
  MapPin,
  Sparkles,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TripHubNav, ComingSoonGrid } from "@/components/krew/TripHubNav";
import { buildTripSteps } from "@/lib/krew/availability";
import { eventTypeLabel, formatEuro } from "@/lib/krew/constants";
import { cn } from "@/lib/utils";

type Props = {
  tripId: string;
  trip: any;
  isOwner: boolean;
  participantsCount: number;
  progressAnswered: number;
  progressTotal: number;
  availabilityAnswered: number;
  availabilityExpected: number;
  provisionalStart?: string | null;
  provisionalCoverage?: number | null;
  hasRecommendations: boolean;
  destinationSelected: boolean;
  topScores?: { name: string; score: number }[];
  children?: React.ReactNode;
};

function getJoinUrl(tripId: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/join/${tripId}`;
}

export function TripHubDashboard({
  tripId,
  trip,
  isOwner,
  participantsCount,
  progressAnswered,
  progressTotal,
  availabilityAnswered,
  availabilityExpected,
  provisionalStart,
  provisionalCoverage,
  hasRecommendations,
  destinationSelected,
  topScores = [],
  children,
}: Props) {
  const [inviteCopied, setInviteCopied] = useState(false);

  const steps = buildTripSteps({
    tripId,
    participantsJoined: participantsCount,
    participantsExpected: trip.participants_count || 1,
    availabilityAnswered,
    questionnaireAnswered: progressAnswered,
    hasRecommendations,
    destinationSelected,
  });

  const theme = eventTypeLabel(trip.event_type);

  async function handleInviteClick() {
    const url = getJoinUrl(tripId);
    try {
      if (url) {
        await navigator.clipboard.writeText(url);
        setInviteCopied(true);
        toast.success("Lien d'invitation copié", { description: url });
        setTimeout(() => setInviteCopied(false), 2000);
      }
    } catch {
      toast.message("Lien d'invitation", { description: url || `/join/${tripId}` });
    }
    // Scroller vers la section invite en bas de la page hub
    const el = document.getElementById("invite-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // Si on n'est pas sur le hub, aller sur le hub avec ancre
      window.location.href = `/trips/${tripId}#invite-section`;
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero thème */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-lagoon/10 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-primary/20 blur-3xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{theme}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {trip.name}
        </h1>
        {trip.celebrated_person ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Star className="size-4 text-amber-500" /> Pour {trip.celebrated_person}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/60 px-3 py-1">
            <Users className="size-3.5" /> {trip.participants_count} pers.
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/60 px-3 py-1">
            <Wallet className="size-3.5" /> {formatEuro(Number(trip.budget_per_person))} / pers.
          </span>
          {provisionalStart ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-lagoon/40 bg-lagoon/10 px-3 py-1">
              <CalendarDays className="size-3.5" />
              {availabilityAnswered < availabilityExpected ? "Date provisoire · " : "Date · "}
              {new Date(provisionalStart).toLocaleDateString("fr-FR")}
              {provisionalCoverage != null
                ? ` · ${Math.round(provisionalCoverage * 100)} %`
                : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/60 px-3 py-1 text-muted-foreground">
              <CalendarDays className="size-3.5" /> Date à définir
            </span>
          )}
          <Badge variant={trip.status === "valide" ? "success" : "lagoon"}>
            {trip.status}
          </Badge>
        </div>
      </header>

      {/* Progression */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Parcours du groupe
        </h2>
        <TripHubNav tripId={tripId} steps={steps} onInviteClick={handleInviteClick} />
      </section>

      {/* Cartes d'accès rapide */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Inviter = copie le lien + scroll vers la section */}
        <button
          type="button"
          onClick={handleInviteClick}
          className="group rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-glow"
        >
          {inviteCopied ? (
            <Check className="size-5 text-lagoon" />
          ) : (
            <Users className="size-5 text-primary" />
          )}
          <p className="mt-3 font-semibold group-hover:text-primary">
            {inviteCopied ? "Lien copié !" : "Inviter"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {inviteCopied
              ? "Colle-le dans WhatsApp / SMS"
              : `${participantsCount} rejoint(s) · copie le lien`}
          </p>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-primary/80">
            <Copy className="size-3" /> /join/{tripId.slice(0, 8)}…
          </p>
        </button>

        {[
          {
            to: "availability" as const,
            title: "Disponibilités",
            desc: `${availabilityAnswered}/${availabilityExpected} réponses`,
            icon: CalendarDays,
          },
          {
            to: "questionnaire" as const,
            title: "Préférences",
            desc: `${progressAnswered}/${progressTotal || trip.participants_count} questionnaires`,
            icon: ClipboardList,
          },
          {
            to: "star" as const,
            title: "Star",
            desc: trip.celebrated_person || "Si applicable",
            icon: Star,
            hide: !(
              trip.celebrated_person ||
              ["evg", "evjf", "anniversaire", "retraite"].includes(String(trip.event_type))
            ),
          },
        ]
          .filter((c) => !c.hide)
          .map((c) => (
            <Link
              key={c.to}
              to={`/trips/$tripId/${c.to}` as any}
              params={{ tripId }}
              className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-glow"
            >
              <c.icon className="size-5 text-primary" />
              <p className="mt-3 font-semibold group-hover:text-primary">{c.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.desc}</p>
            </Link>
          ))}
      </section>

      {/* Scores live */}
      {topScores.length > 0 ? (
        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="font-semibold">Propositions en cours</h2>
            <span className="text-xs text-muted-foreground">évoluent avec les réponses</span>
          </div>
          <ul className="mt-4 space-y-2">
            {topScores.map((s, i) => (
              <li
                key={s.name}
                className={cn(
                  "flex items-center justify-between rounded-2xl border px-4 py-3",
                  i === 0 ? "border-primary/30 bg-primary/5" : "border-border/70 bg-surface/30",
                )}
              >
                <span className="font-medium">
                  {i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : ""}
                  {s.name}
                </span>
                <span className="text-lg font-bold tabular-nums text-primary">
                  {Math.round(s.score)} %
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <Link to="/trips/$tripId" params={{ tripId }} hash="hub-destination">
                <MapPin className="size-3.5" /> Voir le détail
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {children}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Après la destination</h2>
        <p className="text-sm text-muted-foreground">
          Le hub reste le centre de vie du voyage. Modules prêts à activer.
        </p>
        <ComingSoonGrid />
      </section>
    </div>
  );
}
