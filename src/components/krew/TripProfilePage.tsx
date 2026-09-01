import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { KrewHighlight, KrewIcon, KrewMark, KrewNote } from "@/components/krew/visual-language";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { PROFILE_LABELS, type StayConcept, type StayProfileId } from "@/lib/krew/stay-profiles";
import { getGenerationReadiness, getTripDetail, validateStayProfile } from "@/lib/trips.functions";
import { cn } from "@/lib/utils";

function normalizeAccessibleText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");
}

export function ProfileConceptCard({
  conceptId,
  label,
  rationale,
  selected,
  disabled,
  onToggle,
}: {
  conceptId: string;
  label: string;
  rationale: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const descriptionId = `profile-${conceptId}-description`;
  const duplicateRationale = Boolean(
    rationale?.trim() && normalizeAccessibleText(rationale) === normalizeAccessibleText(label),
  );
  const hasDistinctDescription = Boolean(rationale?.trim() && !duplicateRationale);

  return (
    <button
      type="button"
      aria-label={label}
      aria-describedby={hasDistinctDescription ? descriptionId : undefined}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative rounded-2xl border bg-background p-4.5 text-left font-sans transition-all",
        selected
          ? "border-primary/60 shadow-xs"
          : "border-border/60 text-foreground/80 hover:border-primary/40",
        disabled ? "cursor-default" : "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-[18px] font-normal text-foreground sm:text-[20px]">
          {selected ? (
            <KrewHighlight tone="sage" className="px-1.5 py-0.5 font-normal">
              {label}
            </KrewHighlight>
          ) : (
            label
          )}
        </p>
        {selected ? <KrewMark type="check" tone="plum" size="sm" className="size-4 shrink-0" /> : null}
      </div>
      {rationale ? (
        <p
          id={hasDistinctDescription ? descriptionId : undefined}
          aria-hidden={duplicateRationale ? "true" : undefined}
          className="mt-2 text-sm leading-relaxed text-muted-foreground"
        >
          {rationale}
        </p>
      ) : null}
    </button>
  );
}

export function TripProfilePage({ tripId }: { tripId: string }) {
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const fetchReadiness = useServerFn(getGenerationReadiness);
  const validateProfile = useServerFn(validateStayProfile);
  const [selectedConceptIds, setSelectedConceptIds] = useState<string[]>([]);

  const detailQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });
  const readinessQuery = useQuery({
    queryKey: ["generation-readiness", tripId],
    queryFn: () => fetchReadiness({ data: { tripId } }),
    retry: false,
  });

  const data = detailQuery.data as any;
  const profile = data?.profile as
    | {
        calculatedConcepts?: StayConcept[];
        selectedConcepts?: StayConcept[];
        validated?: boolean;
        legacyBypass?: boolean;
      }
    | undefined;

  useEffect(() => {
    if (!profile) return;
    const initial = profile.selectedConcepts?.length
      ? profile.selectedConcepts.map((concept) => concept.id)
      : (profile.calculatedConcepts ?? []).slice(0, 3).map((concept) => concept.id);
    setSelectedConceptIds((current) => (current.length ? current : initial));
  }, [profile]);

  const validateMutation = useMutation({
    mutationFn: () => validateProfile({ data: { tripId, selectedConceptIds } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
    },
    onError: (error) => {
      console.error("Impossible d’enregistrer le Profil du voyage:", error);
      toast.error("Impossible d’enregistrer le Profil du voyage pour le moment.");
    },
  });

  if (detailQuery.isLoading || readinessQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <KrewThinkingState context="generic" customMessage="Chargement du Profil du voyage…" delayMs={0} />
      </main>
    );
  }

  if (!data || detailQuery.isError) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-10">
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "voyage" }}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Retour au voyage
        </Link>
        <p className="text-sm text-muted-foreground">Impossible de charger le Profil du voyage pour le moment.</p>
      </main>
    );
  }

  const isAdmin = Boolean(data.isOwner);
  const readiness = readinessQuery.data as any;
  const concepts = profile?.calculatedConcepts?.length
    ? profile.calculatedConcepts
    : readiness?.profile?.calculatedConcepts ?? [];
  const validated = Boolean(profile?.validated);
  const destinationSelected = Boolean((data.recommendations ?? []).some((recommendation: any) => recommendation.is_selected));

  return (
    <main className="mx-auto w-full max-w-5xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        search={{ view: "voyage" }}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour au parcours
      </Link>

      <section className="relative space-y-5 overflow-hidden rounded-[20px] bg-surface/30 p-5 sm:p-7">
        <img
          src="/brand/otter-states/trip-progress.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-3 w-[64px] object-contain opacity-90 sm:w-[84px]"
        />
        <header className="pr-[68px] sm:pr-[92px]">
          <div className="flex items-center gap-3">
            <h1 className="flex items-center gap-2 font-display text-2xl font-normal text-foreground sm:text-3xl">
              <KrewIcon name="profile" tone="plum" size="sm" className="size-5" />
              Profil du voyage
            </h1>
            <KrewNote variant="tape" tone="sage" rotation={-2} className="hidden px-2.5 py-1 text-xs sm:inline-block">
              Style et ambiance
            </KrewNote>
          </div>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            {isAdmin
              ? validated
                ? "Voici le Profil du voyage retenu."
                : "Choisis 1 à 3 options pour définir le Profil du voyage."
              : validated
                ? "Voici le Profil du voyage retenu par l’organisateur·rice."
                : "L’organisateur·rice choisira le Profil du voyage à partir des réponses du groupe."}
          </p>
        </header>

        {concepts.length ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {concepts.slice(0, 3).map((concept: StayConcept) => {
              const label = PROFILE_LABELS[concept.id as StayProfileId] || concept.title;
              const selected = validated
                ? Boolean(profile?.selectedConcepts?.some((item) => item.id === concept.id))
                : selectedConceptIds.includes(concept.id);
              return (
                <ProfileConceptCard
                  key={concept.id}
                  conceptId={concept.id}
                  label={label}
                  rationale={concept.rationale}
                  selected={selected}
                  disabled={!isAdmin || validated}
                  onToggle={() =>
                    setSelectedConceptIds((ids) =>
                      ids.includes(concept.id)
                        ? ids.filter((id) => id !== concept.id)
                        : ids.length < 3
                          ? [...ids, concept.id]
                          : ids,
                    )
                  }
                />
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
            Le Profil du voyage apparaîtra quand suffisamment de préférences auront été renseignées.
          </p>
        )}

        {validated ? (
          <div className="space-y-3 pt-1">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              <KrewIcon name="check" tone="sage" size="sm" className="size-4" />
              Profil du voyage enregistré — les destinations sont disponibles.
            </p>
            {!destinationSelected ? (
              <div>
                <Button asChild className="rounded-xl font-medium">
                  <Link
                    to="/trips/$tripId"
                    params={{ tripId }}
                    search={{ view: "voyage", section: "destination" }}
                  >
                    {isAdmin ? "Choisir la destination" : "Voir la destination"}
                    <KrewMark type="arrow-right" tone="ink" size="sm" className="ml-1.5 size-4" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        ) : isAdmin && (readiness?.profile?.questionnairesReady || profile?.legacyBypass) ? (
          <KrewStatefulButton
            className="max-w-full"
            idleLabel="Enregistrer le Profil du voyage"
            loadingLabel="Enregistrement…"
            successLabel="Profil enregistré"
            errorLabel="Réessayer"
            disabled={selectedConceptIds.length < 1}
            onAction={() => validateMutation.mutateAsync()}
          />
        ) : null}
      </section>
    </main>
  );
}
