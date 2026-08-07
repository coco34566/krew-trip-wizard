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
import { TripHubNav } from "@/components/krew/TripHubNav";
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
  /** L'utilisateur connecté a déjà soumis ses dispos */
  myAvailabilityDone?: boolean;
  /** L'utilisateur connecté a déjà soumis ses préférences */
  myPreferencesDone?: boolean;
  /** Questionnaire star rempli */
  starDone?: boolean;
  topScores?: { name: string; score: number }[];
  children?: React.ReactNode;
};

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
  myAvailabilityDone = false,
  myPreferencesDone = false,
  starDone = false,
  topScores = [],
  children,
}: Props) {

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

  
  return (
    <div className="space-y-8">
      {/* Hero image + titre */}
      <header className="relative overflow-hidden rounded-3xl border border-border shadow-elevated">
        <div className="relative h-44 sm:h-56 md:h-64">
          <img
            src={heroImageForEvent(trip.event_type)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
          <div className="relative z-10 flex h-full flex-col justify-end p-5 sm:p-7 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
              {theme}
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl">
              {trip.name}
            </h1>
            {trip.celebrated_person ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-white/90">
                <Star className="size-4 fill-amber-400 text-amber-400" /> Pour{" "}
                {trip.celebrated_person}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border/60 bg-card/95 px-5 py-3.5 sm:px-7">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-sm">
            <Users className="size-3.5 text-primary" /> {trip.participants_count} pers.
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-sm">
            <Wallet className="size-3.5 text-primary" />{" "}
            {formatEuro(Number(trip.budget_per_person))} / pers.
          </span>
          {provisionalStart ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-lagoon/40 bg-lagoon/10 px-3 py-1 text-sm">
              <CalendarDays className="size-3.5" />
              {availabilityAnswered < availabilityExpected ? "Date provisoire · " : "Date · "}
              {new Date(provisionalStart).toLocaleDateString("fr-FR")}
              {provisionalCoverage != null
                ? ` · ${Math.round(provisionalCoverage * 100)} %`
                : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-sm text-muted-foreground">
              <CalendarDays className="size-3.5" /> Date à définir
            </span>
          )}
          <Badge variant={trip.status === "valide" ? "success" : "lagoon"}>{trip.status}</Badge>
        </div>
      </header>

      {/* Progression */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Parcours du groupe
        </h2>
        <TripHubNav tripId={tripId} steps={steps} />
      </section>

      {/* Résumé des retours x/N */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          État des réponses · groupe de {trip.participants_count || participantsCount}
        </h2>
        <ul className="mt-4 space-y-3 text-sm">
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
            <span className="font-medium">Lien d&apos;invitation ouvert</span>
            <span className="tabular-nums">
              <strong>{participantsCount}</strong>/{trip.participants_count || participantsCount}
              {(trip.participants_count || participantsCount) - participantsCount > 0 ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  · {Math.max((trip.participants_count || participantsCount) - participantsCount, 0)} n&apos;ont pas rejoint
                </span>
              ) : (
                <span className="ml-2 text-xs text-lagoon">· tout le monde a rejoint</span>
              )}
            </span>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
            <span className="font-medium">Disponibilités</span>
            <span className="tabular-nums">
              <strong>{availabilityAnswered}</strong>/{availabilityExpected}
              {availabilityExpected - availabilityAnswered > 0 ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  · {availabilityExpected - availabilityAnswered} n&apos;ont pas répondu
                </span>
              ) : (
                <span className="ml-2 text-xs text-lagoon">· tout le monde a répondu</span>
              )}
            </span>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
            <span className="font-medium">Préférences</span>
            <span className="tabular-nums">
              <strong>{progressAnswered}</strong>/{progressTotal || trip.participants_count}
              {(progressTotal || trip.participants_count) - progressAnswered > 0 ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  · {(progressTotal || trip.participants_count) - progressAnswered} n&apos;ont pas répondu
                </span>
              ) : (
                <span className="ml-2 text-xs text-lagoon">· tout le monde a répondu</span>
              )}
            </span>
          </li>
        </ul>
      </section>

      {/* Cartes d'accès rapide */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            to: "/trips/$tripId/availability" as const,
            title: "Disponibilités",
            desc: myAvailabilityDone
              ? `Toi OK · groupe ${availabilityAnswered}/${availabilityExpected} · manque ${Math.max(availabilityExpected - availabilityAnswered, 0)}`
              : `À faire · ${availabilityAnswered}/${availabilityExpected} · manque ${Math.max(availabilityExpected - availabilityAnswered, 0)}`,
            icon: CalendarDays,
            mineDone: myAvailabilityDone,
          },
          {
            to: "/trips/$tripId/questionnaire" as const,
            title: "Préférences",
            desc: myPreferencesDone
              ? `Toi OK · groupe ${progressAnswered}/${progressTotal || trip.participants_count} · manque ${Math.max((progressTotal || trip.participants_count) - progressAnswered, 0)}`
              : `À faire · ${progressAnswered}/${progressTotal || trip.participants_count} · manque ${Math.max((progressTotal || trip.participants_count) - progressAnswered, 0)}`,
            icon: ClipboardList,
            mineDone: myPreferencesDone,
          },
          {
            to: "/trips/$tripId/star" as const,
            title: "Préférences de la star",
            desc: starDone
              ? trip.celebrated_person
                ? `Rempli · ${trip.celebrated_person} · poids ×2.5+ dans le scoring`
                : "Rempli · poids renforcé dans le scoring"
              : trip.celebrated_person
                ? `À compléter · ${trip.celebrated_person}`
                : "Questionnaire dédié · pondération renforcée",
            icon: Star,
            mineDone: starDone,
            hide: !(
              trip.celebrated_person ||
              ["evg", "evjf", "anniversaire", "retraite"].includes(String(trip.event_type))
            ),
          },
        ]
          .filter((c) => !c.hide)
          .map((c) => {
            const href =
              c.to === "/trips/$tripId/availability"
                ? `/trips/${tripId}/availability`
                : c.to === "/trips/$tripId/questionnaire"
                  ? `/trips/${tripId}/questionnaire`
                  : c.to === "/trips/$tripId/star"
                    ? `/trips/${tripId}/star`
                    : `/trips/${tripId}`;
            return (
              <a
                key={c.to}
                href={href}
                className={cn(
                  "group rounded-2xl border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-glow",
                  c.mineDone ? "border-lagoon/40 bg-lagoon/5" : "border-border",
                )}
              >
                <c.icon className="size-5 text-primary" />
                <p className="mt-3 font-semibold group-hover:text-primary">{c.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.desc}</p>
              </a>
            );
          })}
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

    </div>
  );
}
