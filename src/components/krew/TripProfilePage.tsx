import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { KrewJourneyErrorState, KrewJourneyLoadingState } from "@/components/krew/KrewJourneyAsyncState";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewJourneyStatusPanel } from "@/components/krew/KrewJourneyStatusPanel";
import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewHighlight, KrewMark, KrewNote } from "@/components/krew/visual-language";
import { Button } from "@/components/ui/button";
import {
  PROFILE_DESCRIPTIONS,
  PROFILE_LABELS,
  type StayConcept,
  type StayProfileId,
} from "@/lib/krew/stay-profiles";
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
        disabled
          ? "cursor-default"
          : "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
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
  const [editingValidatedProfile, setEditingValidatedProfile] = useState(false);

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
      setEditingValidatedProfile(false);
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
    },
    onError: (error) => {
      console.error("Impossible d’enregistrer le Profil du voyage:", error);
      toast.error("Impossible d’enregistrer le Profil du voyage pour le moment.");
    },
  });

  if (detailQuery.isLoading || readinessQuery.isLoading) {
    return <KrewJourneyLoadingState message="Chargement du Profil du voyage…" />;
  }

  if (!data || detailQuery.isError || readinessQuery.isError) {
    const retrying = detailQuery.isFetching || readinessQuery.isFetching;
    return (
      <KrewJourneyErrorState
        tripId={tripId}
        title="Impossible de charger le Profil du voyage"
        description="Les informations nécessaires au Profil du voyage ne sont pas disponibles pour le moment."
        retrying={retrying}
        onRetry={() => {
          void detailQuery.refetch();
          void readinessQuery.refetch();
        }}
      />
    );
  }

  const isAdmin = Boolean(data.isOwner);
  const readiness = readinessQuery.data as any;
  const concepts = profile?.calculatedConcepts?.length
    ? profile.calculatedConcepts
    : readiness?.profile?.calculatedConcepts ?? [];
  const validated = Boolean(profile?.validated);
  const destinationSelected = Boolean(
    (data.recommendations ?? []).some((recommendation: any) => recommendation.is_selected),
  );
  const editingAllowed = isAdmin && validated && !destinationSelected;
  const effectivelyValidated = validated && !editingValidatedProfile;

  return (
    <KrewPageShell data-krew-profile-page size="standard" className="space-y-[var(--krew-journey-content-gap)] py-8 sm:py-10">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        search={{ view: "voyage" }}
        className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour au parcours
      </Link>

      <KrewJourneyPageHeader
        tripName={data.trip?.name ?? "Voyage"}
        title="Profil du voyage"
        otterSrc="/brand/otter-states/trip-progress.png"
        annotation={
          <KrewNote variant="tape" tone="sage" rotation={-2} size="xs" className="hidden sm:inline-block">
            Style et ambiance
          </KrewNote>
        }
      >
        <p>
          {isAdmin
            ? effectivelyValidated
              ? "Voici le Profil du voyage retenu."
              : "Choisis 1 à 3 options pour définir le Profil du voyage."
            : validated
              ? "Voici le Profil du voyage retenu par l’organisateur·rice."
              : "L’organisateur·rice choisira le Profil du voyage à partir des réponses du groupe."}
        </p>
      </KrewJourneyPageHeader>

      {effectivelyValidated ? (
        <KrewJourneyStatusPanel
          title="Profil du voyage enregistré"
          icon="check"
          tone="complete"
          action={
            !destinationSelected ? (
              <>
                {editingAllowed ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedConceptIds(profile?.selectedConcepts?.map((concept) => concept.id) ?? []);
                      setEditingValidatedProfile(true);
                    }}
                  >
                    Modifier le Profil du voyage
                  </Button>
                ) : null}
                <Button asChild size="sm">
                  <Link to="/trips/$tripId/destination" params={{ tripId }}>
                    {isAdmin ? "Choisir la destination" : "Voir la destination"}
                  </Link>
                </Button>
              </>
            ) : undefined
          }
        >
          <p>Le Profil est validé et les destinations sont maintenant disponibles.</p>
        </KrewJourneyStatusPanel>
      ) : null}

      <section className="space-y-5 rounded-[20px] bg-surface/30 p-5 sm:p-7">
        {concepts.length ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {concepts.slice(0, 3).map((concept: StayConcept) => {
              const profileId = concept.id as StayProfileId;
              const label = PROFILE_LABELS[profileId] || concept.title;
              const selected = effectivelyValidated
                ? Boolean(profile?.selectedConcepts?.some((item) => item.id === concept.id))
                : selectedConceptIds.includes(concept.id);
              return (
                <ProfileConceptCard
                  key={concept.id}
                  conceptId={concept.id}
                  label={label}
                  rationale={PROFILE_DESCRIPTIONS[profileId] || concept.rationale}
                  selected={selected}
                  disabled={!isAdmin || effectivelyValidated}
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

        {!effectivelyValidated && isAdmin && (readiness?.profile?.questionnairesReady || profile?.legacyBypass) ? (
          <div className="flex flex-wrap items-center gap-2">
            {editingValidatedProfile ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedConceptIds(profile?.selectedConcepts?.map((concept) => concept.id) ?? []);
                  setEditingValidatedProfile(false);
                }}
              >
                Annuler
              </Button>
            ) : null}
            <KrewStatefulButton
              className="max-w-full"
              idleLabel={editingValidatedProfile ? "Enregistrer les modifications" : "Enregistrer le Profil du voyage"}
              loadingLabel="Enregistrement…"
              successLabel="Profil enregistré"
              errorLabel="Réessayer"
              disabled={selectedConceptIds.length < 1}
              onAction={() => validateMutation.mutateAsync()}
            />
          </div>
        ) : null}
      </section>
    </KrewPageShell>
  );
}
