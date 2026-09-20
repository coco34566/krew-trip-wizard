import type { ReactNode } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewIcon, KrewMark } from "@/components/krew/visual-language";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrganizerQuestionnaireFeedback } from "@/lib/organizer-questionnaire-feedback.functions";

const listText = (values: string[] | null | undefined) =>
  values?.length ? values.join(" · ") : null;

const formatDate = (value: string) =>
  new Date(value + (value.length === 10 ? "T12:00:00" : "")).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });

function AnswerLine({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid grid-cols-[minmax(112px,0.42fr)_minmax(0,1fr)] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

function ParticipantBlock({ participant }: { participant: any }) {
  const accommodationParts = [
    listText(participant.accommodation?.lodgingTypes),
    participant.accommodation?.roomType,
    participant.accommodation?.role,
    participant.accommodation?.acceptsSharedRoom === true
      ? "chambre partagée OK"
      : participant.accommodation?.acceptsSharedRoom === false
        ? "pas de chambre partagée"
        : null,
    participant.accommodation?.requiredAmenities?.length
      ? `équipements : ${participant.accommodation.requiredAmenities.join(", ")}`
      : null,
  ].filter(Boolean);

  const constraintParts = [
    participant.constraints?.dietary?.length
      ? `alimentation : ${participant.constraints.dietary.join(", ")}`
      : null,
    participant.constraints?.excludedDestinations?.length
      ? `exclusions : ${participant.constraints.excludedDestinations.join(", ")}`
      : null,
    participant.constraints?.dealBreakerAmbiances?.length
      ? `ambiances refusées : ${participant.constraints.dealBreakerAmbiances.join(", ")}`
      : null,
    participant.constraints?.dealBreakers?.length
      ? `deal-breakers : ${participant.constraints.dealBreakers.join(", ")}`
      : null,
    participant.constraints?.accessibility ? "besoin d’accessibilité" : null,
  ].filter(Boolean);

  const dateParts = [
    participant.dates?.available?.length
      ? `Dispo : ${participant.dates.available.map(formatDate).join(", ")}`
      : null,
    participant.dates?.blocked?.length
      ? `Indispo : ${participant.dates.blocked.map(formatDate).join(", ")}`
      : null,
    participant.dates?.flexDays != null
      ? `flexibilité ±${participant.dates.flexDays} j`
      : null,
  ].filter(Boolean);

  return (
    <article className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sage/16 font-mono text-xs font-semibold text-primary">
          {String(participant.name || "P").trim().charAt(0).toUpperCase()}
        </span>
        <h3 className="font-display text-xl font-normal text-foreground">{participant.name}</h3>
        {participant.isStar ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <KrewIcon name="favorite" tone="sage" size="sm" className="size-3.5" />
            Star
          </span>
        ) : null}
      </div>

      <dl className="divide-y divide-border/35">
        <AnswerLine label="Départ">{participant.departureCity}</AnswerLine>
        <AnswerLine label="Avion">
          {participant.flightAccepted === true
            ? "Accepté"
            : participant.flightAccepted === false
              ? "Refusé"
              : null}
        </AnswerLine>
        <AnswerLine label="Durée max">
          {participant.maxTravelHours != null ? `${participant.maxTravelHours} h` : null}
        </AnswerLine>
        <AnswerLine label="Budget">
          {participant.budgetMax != null ? `${Math.round(participant.budgetMax)} € / pers.` : null}
        </AnswerLine>
        <AnswerLine label="Hébergement">
          {accommodationParts.length ? accommodationParts.join(" · ") : null}
        </AnswerLine>
        <AnswerLine label="Contraintes">
          {constraintParts.length ? constraintParts.join(" · ") : null}
        </AnswerLine>
        <AnswerLine label="Envies">
          {participant.wishes?.length ? participant.wishes.join(" · ") : null}
        </AnswerLine>
        <AnswerLine label="Ambiance">
          {[listText(participant.ambiances), participant.wantedEnvironment]
            .filter(Boolean)
            .join(" · ") || null}
        </AnswerLine>
        <AnswerLine label="Dates">{dateParts.length ? dateParts.join(" · ") : null}</AnswerLine>
      </dl>
    </article>
  );
}

export function TripParticipantFeedbackPage({ tripId }: { tripId: string }) {
  const fetchFeedback = useServerFn(getOrganizerQuestionnaireFeedback);
  const query = useQuery({
    queryKey: ["organizer-questionnaire-feedback", tripId],
    queryFn: () => fetchFeedback({ data: { tripId } }),
    retry: false,
  });

  if (query.isLoading) {
    return (
      <KrewPageShell
        size="standard"
        gutter="compact"
        className="space-y-[var(--krew-journey-content-gap)] py-8 sm:py-10"
      >
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-52 rounded-3xl" />
        <Skeleton className="h-52 rounded-3xl" />
      </KrewPageShell>
    );
  }

  if (query.isError) {
    const message = String((query.error as Error)?.message || "");
    if (message.includes("403")) {
      return <Navigate to="/trips/$tripId" params={{ tripId }} search={{ view: "todo" }} replace />;
    }
  }

  const data = query.data as any;
  if (!data) {
    return (
      <KrewPageShell size="standard" gutter="compact" className="py-10">
        <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Impossible de charger les retours du groupe.
        </div>
      </KrewPageShell>
    );
  }

  return (
    <KrewPageShell
      size="standard"
      gutter="compact"
      className="space-y-[var(--krew-journey-content-gap)] py-8 sm:py-10"
    >
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        search={{ view: "todo" }}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Retour au groupe
      </Link>

      <KrewJourneyPageHeader
        tripName={data.trip.name}
        title="Retours du groupe"
        otterSrc="/brand/otter-states/trip-progress.png"
      >
        <p>
          Toutes les réponses soumises, réunies au même endroit pour préparer la suite du voyage.
        </p>
      </KrewJourneyPageHeader>

      <section className="rounded-3xl border border-sage/30 bg-sage/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Questionnaires soumis</p>
            <p className="mt-1 font-display text-3xl font-normal text-primary">
              <span className="font-mono">{data.progress.answered}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="font-mono">{data.progress.total}</span>
            </p>
          </div>
          <KrewMark type="check" tone="sage" size="md" className="size-8 opacity-80" />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-[28px] font-normal leading-tight text-foreground">
            Résumé des préférences
          </h2>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="sm"
            className="mt-1 h-2 w-28 opacity-80"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Avion
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {data.aggregate.flightDeclared > 0
                ? `${data.aggregate.flightAccepted}/${data.aggregate.flightDeclared} l’acceptent`
                : "Aucune réponse déclarée"}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Budget médian
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {data.aggregate.medianBudget != null
                ? `${data.aggregate.medianBudget} € / pers.`
                : "Non renseigné"}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contraintes
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {data.aggregate.constraintCount > 0
                ? `${data.aggregate.constraintCount} réponse${data.aggregate.constraintCount > 1 ? "s" : ""} à vérifier`
                : "Aucune signalée"}
            </p>
          </div>
        </div>

        {data.submitted.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.submitted.map((participant: any) => (
              <ParticipantBlock key={participant.id} participant={participant} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Aucun questionnaire n’a encore été soumis.
          </div>
        )}
      </section>

      {data.pending.length || data.unjoinedExpected > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-normal text-foreground">En attente</h2>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            {data.pending.length ? (
              <ul className="divide-y divide-border/35">
                {data.pending.map((participant: any) => (
                  <li key={participant.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="font-medium text-foreground">{participant.name}</span>
                    <span className="text-muted-foreground">Questionnaire non soumis</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {data.unjoinedExpected > 0 ? (
              <p className="border-t border-border/35 pt-3 text-sm text-muted-foreground">
                {data.unjoinedExpected} participant{data.unjoinedExpected > 1 ? "s" : ""} attendu
                {data.unjoinedExpected > 1 ? "s" : ""} n’a pas encore rejoint le voyage.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-normal text-foreground">Commentaires</h2>
        {data.comments.length ? (
          <div className="divide-y divide-border/40 rounded-2xl border border-border/60 bg-card px-4 sm:px-5">
            {data.comments.map((comment: any) => (
              <article key={comment.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{comment.author}</p>
                  <time className="text-xs text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                  {comment.text}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">
            Aucun commentaire libre pour le moment.
          </div>
        )}
      </section>
    </KrewPageShell>
  );
}
