import { Link } from "@tanstack/react-router";
import { Car, CheckCircle2, TrainFront, Plane, AlertCircle } from "lucide-react";

import { KrewIcon } from "@/components/krew/visual-language";
import {
  buildTransportDashboardSummary,
  isCarMode,
  type TransportParticipantLike,
  type TransportPickLike,
} from "@/lib/krew/transport-groups";

function modeIcon(mode: string) {
  const value = mode.toLocaleLowerCase("fr-FR");
  if (isCarMode(value)) return <Car className="size-4 text-primary" />;
  if (value.includes("train")) return <TrainFront className="size-4 text-primary" />;
  if (value.includes("avion") || value.includes("plane") || value.includes("flight")) {
    return <Plane className="size-4 text-primary" />;
  }
  return <KrewIcon name="transport" tone="plum" size="sm" className="size-4" />;
}

export function TransportGroupsSummary({
  tripId,
  participants,
  picks,
  expectedCount,
}: {
  tripId: string;
  participants: TransportParticipantLike[];
  picks: TransportPickLike[];
  expectedCount: number;
}) {
  const summary = buildTransportDashboardSummary({ participants, picks, expectedCount });
  if (!picks.length && !participants.length) return null;

  const pending = Math.max(0, summary.expected - summary.organized);
  const visibleGroups = summary.groups.slice(0, 3);

  return (
    <section className="rounded-3xl border border-border/70 bg-card/90 p-4 shadow-2xs sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <KrewIcon name="transport" tone="plum" size="sm" className="size-5" />
            <h2 className="font-display text-xl font-normal text-foreground sm:text-2xl">
              Comment on y va
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.organized}/{summary.expected || expectedCount} personne{summary.expected > 1 ? "s" : ""} organisée{summary.organized > 1 ? "s" : ""}
            {pending > 0 ? ` · ${pending} à régler` : " · tout le monde a un trajet"}
          </p>
        </div>
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "voyage", section: "transport" }}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Voir tous les trajets
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {visibleGroups.map((group) => (
          <div key={group.id} className="rounded-2xl bg-background/65 px-3.5 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {modeIcon(group.mode)}
              <span className="truncate">
                {group.city ? `${group.city} · ` : ""}{group.mode}
                {group.outboundDepartureTime ? ` ${group.outboundDepartureTime}` : ""}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {group.members.map((member) => member.displayName || "Participant").join(" · ")}
            </p>
            {group.driver ? (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                <Car className="size-3.5" />
                {group.seatsLeft && group.seatsLeft > 0
                  ? `${group.seatsLeft} place${group.seatsLeft > 1 ? "s" : ""} libre${group.seatsLeft > 1 ? "s" : ""}`
                  : "Voiture complète"}
              </div>
            ) : null}
          </div>
        ))}

        {summary.missing.length > 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-3.5 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <AlertCircle className="size-4 text-primary" />
              À organiser
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.missing
                .slice(0, 4)
                .map((participant) => participant.display_name || participant.email?.split("@")[0] || "Participant")
                .join(" · ")}
              {summary.missing.length > 4 ? ` · +${summary.missing.length - 4}` : ""}
            </p>
          </div>
        ) : summary.organized > 0 ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CheckCircle2 className="size-4 text-primary" />
            Les transports du groupe sont organisés.
          </div>
        ) : null}
      </div>
    </section>
  );
}
