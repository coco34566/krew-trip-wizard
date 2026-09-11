import type { Tables } from "@/integrations/supabase/types";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Heart } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KrewJourneyErrorState, KrewJourneyLoadingState } from "@/components/krew/KrewJourneyAsyncState";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewJourneyStatusPanel } from "@/components/krew/KrewJourneyStatusPanel";
import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { KrewPhotoFallback } from "@/components/krew/KrewPhotoFallback";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewNote } from "@/components/krew/visual-language";
import { formatEuro } from "@/lib/krew/constants";
import {
  getTripDetail,
  proposeStayAndTransport,
  setBookingStatus,
  voteHotel,
} from "@/lib/trips.functions";
import { cn } from "@/lib/utils";

const ACCOMMODATION_CONCEPT_LABELS: Record<string, string> = {
  central_hotel: "Au cœur de l'action",
  comfort_hotel: "Confort sans compromis",
  aparthotel: "Autonomes, mais bien installés",
  entire_city_home: "Notre chez-nous en ville",
  group_house: "Tous ensemble",
  nature_stay: "Au vert",
  exceptional_property: "L’hébergement fait le voyage",
  wellness_property: "Parenthèse bien-être",
};

export function TripAccommodationPage({ tripId }: { tripId: string }) {
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const proposeLogistics = useServerFn(proposeStayAndTransport);
  const vote = useServerFn(voteHotel);
  const setBooking = useServerFn(setBookingStatus);

  const detailQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    queryClient.invalidateQueries({ queryKey: ["cost-split", tripId] });
  };

  const searchMutation = useMutation({
    mutationFn: () => proposeLogistics({ data: { tripId, refreshExternal: true, includeTransport: false } }),
    onSuccess: refresh,
    onError: (error) => {
      console.error("Impossible de rechercher des hébergements:", error);
      toast.error("Impossible de rechercher des hébergements pour le moment.");
    },
  });

  const voteMutation = useMutation({
    mutationFn: (hotelId: string) => vote({ data: { tripId, hotelId } }),
    onSuccess: refresh,
    onError: (error) => {
      console.error("Impossible d’enregistrer le vote hébergement:", error);
      toast.error("Impossible d’enregistrer ton vote pour le moment.");
    },
  });

  const bookingMutation = useMutation({
    mutationFn: () => setBooking({ data: { tripId, type: "hotel", status: "réservé" } }),
    onSuccess: refresh,
    onError: (error) => {
      console.error("Impossible de marquer l’hébergement comme réservé:", error);
      toast.error("Impossible de mettre à jour le statut de l’hébergement pour le moment.");
    },
  });

  if (detailQuery.isLoading) {
    return <KrewJourneyLoadingState context="accommodations" />;
  }

  if (!detailQuery.data || detailQuery.isError) {
    return (
      <KrewJourneyErrorState
        tripId={tripId}
        title="Impossible de charger les hébergements"
        description="Les informations d’hébergement ne sont pas disponibles pour le moment."
        retrying={detailQuery.isFetching}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const data = detailQuery.data as any;
  const trip = data.trip as Tables<"trips">;
  const logistics = (trip.group_logistics ?? {}) as any;
  const hotels = (logistics.hotels ?? []) as any[];
  const votes = (logistics.hotelVotes ?? []) as any[];
  const isOwner = Boolean(data.isOwner);
  const canManageBooking = Boolean(
    isOwner ||
      (data.userId &&
        (trip.co_organizer_id === data.userId || trip.coOrganizerId === data.userId)),
  );
  const selectedDestination = (data.recommendations ?? []).find(
    (recommendation: any) => recommendation.is_selected,
  );
  const destinationSelected = Boolean(selectedDestination);
  const selectedHotelId = logistics.selectedHotelId as string | null;
  const selectedHotel = hotels.find((hotel) => hotel.id === selectedHotelId) ?? null;
  const reserved = logistics.hotelBookingStatus === "réservé";

  return (
    <KrewPageShell size="standard" className="space-y-[var(--krew-journey-content-gap)] py-8 sm:py-10">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        search={{ view: "voyage" }}
        className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour au parcours
      </Link>

      <KrewJourneyPageHeader
        tripName={trip.name ?? "Voyage"}
        title="Hébergement"
        otterSrc="/brand/otter-states/accommodation.png"
        annotation={
          <KrewNote variant="tape" tone="sage" rotation={-1} size="xs" className="hidden sm:inline-block">
            Où on dort
          </KrewNote>
        }
      >
        <p>Des options adaptées au groupe, au séjour et à la destination retenue.</p>
      </KrewJourneyPageHeader>

      {!destinationSelected ? (
        <KrewJourneyStatusPanel
          title="Destination à choisir"
          icon="attention"
          tone="locked"
          action={
            <Button asChild size="sm">
              <Link to="/trips/$tripId/destination" params={{ tripId }}>Choisir la destination</Link>
            </Button>
          }
        >
          <p>Choisis d’abord la destination du groupe pour débloquer les hébergements.</p>
        </KrewJourneyStatusPanel>
      ) : (
        <>
          {reserved ? (
            <KrewJourneyStatusPanel
              title="Hébergement réservé"
              icon="check"
              tone="complete"
              action={
                <Button asChild size="sm">
                  <Link
                    to="/trips/$tripId"
                    params={{ tripId }}
                    search={{ view: "voyage", section: "transport" }}
                  >
                    Voir le transport
                  </Link>
                </Button>
              }
            >
              <p>{selectedHotel?.name ?? "L’hébergement retenu"} est marqué comme réservé pour le groupe.</p>
            </KrewJourneyStatusPanel>
          ) : selectedHotel ? (
            <KrewJourneyStatusPanel title="Hébergement retenu" icon="check" tone="complete">
              <p>{selectedHotel.name} est en tête pour la suite de l’organisation. La réservation reste à confirmer.</p>
            </KrewJourneyStatusPanel>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {selectedDestination?.destinations?.name
                ? `Destination : ${selectedDestination.destinations.name}.`
                : "Destination choisie."}
            </p>
            {isOwner ? (
              <KrewStatefulButton
                className="w-full sm:w-auto"
                idleLabel={hotels.length ? "Actualiser les offres" : "Rechercher des hébergements"}
                loadingLabel="Recherche en cours…"
                successLabel="Hébergements actualisés"
                errorLabel="Réessayer"
                resetAfterMs={1400}
                onAction={() => searchMutation.mutateAsync()}
              />
            ) : null}
          </div>

          {logistics.hotelVoteTodo ? (
            <KrewJourneyStatusPanel title="Vote du groupe en cours" icon="attention" tone="info">
              <p>{logistics.hotelVoteTodo}</p>
            </KrewJourneyStatusPanel>
          ) : null}

          {logistics.accommodationGeneration?.status === "rate_limited" ? (
            <KrewJourneyStatusPanel
              title="Recherche momentanément indisponible"
              icon="attention"
              tone="info"
              role="alert"
            >
              <p>{logistics.accommodationGeneration.userMessage || "Réessaie un peu plus tard."}</p>
            </KrewJourneyStatusPanel>
          ) : null}

          {searchMutation.isPending ? (
            <KrewThinkingState context="accommodations" />
          ) : hotels.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {isOwner
                ? "Lance la recherche pour proposer des hébergements."
                : "L’organisateur·rice proposera bientôt des hébergements."}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {hotels.map((hotel) => {
                const hotelVotes = votes.filter((voteItem) => voteItem.hotelId === hotel.id);
                const iVoted = hotelVotes.some(
                  (voteItem) => voteItem.hotelId === hotel.id && voteItem.userId === data.userId,
                );
                const isTop = selectedHotelId === hotel.id && hotelVotes.length > 0;

                return (
                  <article
                    key={hotel.id}
                    className={cn(
                      "rounded-2xl border bg-card p-4 shadow-2xs",
                      isTop
                        ? reserved
                          ? "border-sage/50 bg-sage/10 ring-1 ring-sage/20"
                          : "border-primary/35 bg-primary/5 ring-1 ring-primary/10"
                        : "border-border",
                    )}
                  >
                    {hotel.imageUrl && /^https:\/\//i.test(hotel.imageUrl) ? (
                      <img
                        src={hotel.imageUrl}
                        alt=""
                        className="mb-3 h-40 w-full rounded-xl object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <KrewPhotoFallback
                        className="mb-3 h-40 w-full"
                        type="accommodation"
                        aspectRatio="4/3"
                      />
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="font-semibold text-base text-foreground">{hotel.name}</h2>
                        <p className="text-xs text-muted-foreground">
                          {ACCOMMODATION_CONCEPT_LABELS[hotel.krewConcept] ?? "Sélection KREW"}
                          {hotel.rating ? ` · ★ ${Number(hotel.rating).toFixed(1)}` : ""}
                        </p>
                        {hotel.location?.area || hotel.location?.city ? (
                          <p className="text-xs text-muted-foreground">
                            {[hotel.location.area, hotel.location.city].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                      </div>
                      {isTop ? (
                        reserved ? <Badge variant="success">Réservé</Badge> : <Badge variant="muted">Top votes</Badge>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm">
                      {hotel.pricePerPerson != null ? (
                        <>
                          <span className="font-mono font-semibold">{formatEuro(hotel.pricePerPerson)}</span>
                          <span> / pers. pour le séjour</span>
                          <span className="text-muted-foreground">
                            {hotel.priceStatus === "verified" ? " · Prix vérifié" : " · Prix indicatif"}
                          </span>
                        </>
                      ) : (
                        "Prix à vérifier"
                      )}
                    </p>

                    {hotel.capacity != null || hotel.bedrooms != null ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {hotel.capacity != null ? `${hotel.capacity} personnes` : ""}
                        {hotel.capacity != null && hotel.bedrooms != null ? " · " : ""}
                        {hotel.bedrooms != null ? `${hotel.bedrooms} chambres` : ""}
                      </p>
                    ) : null}

                    {hotel.matchReasons?.length ? (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {hotel.matchReasons.slice(0, 3).map((reason: string) => <li key={reason}>• {reason}</li>)}
                      </ul>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant={iVoted ? "lagoon" : "outline"}
                        disabled={voteMutation.isPending}
                        onClick={() => voteMutation.mutate(hotel.id)}
                      >
                        <Heart className={cn("size-3.5", iVoted && "fill-current")} />
                        {iVoted ? "Mon vote" : "Voter"} · {hotelVotes.length}
                      </Button>
                      {hotel.url ? (
                        <a
                          href={hotel.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-10 items-center text-xs font-medium text-primary hover:underline"
                        >
                          Voir l’hébergement →
                        </a>
                      ) : null}
                    </div>

                    {hotel.configs?.length ? (
                      <div className="mt-4 space-y-2 border-t border-border/40 pt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Configurations de couchage recommandées
                        </p>
                        {hotel.configs.map((config: any) => (
                          <div
                            key={config.id}
                            className="rounded-xl border border-border/40 bg-muted/40 p-2.5 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2 font-medium">
                              <span>{config.name}</span>
                              <span className="font-mono font-semibold text-primary">
                                {formatEuro(config.pricePerPerson)} / pers.
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {config.bedrooms} ch. · {config.beds} lits · {config.bathrooms} SDB · Total : {formatEuro(config.totalCost)} (frais inclus)
                            </p>
                            {config.explanation ? (
                              <p className="mt-1 text-[11px] italic leading-snug text-muted-foreground">
                                {config.explanation}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}

          {canManageBooking && hotels.length > 0 && !reserved ? (
            <div className="border-t border-border/45 pt-4">
              <KrewStatefulButton
                idleLabel="Marquer comme réservé"
                loadingLabel="Enregistrement…"
                successLabel="Hébergement réservé"
                errorLabel="Réessayer"
                onAction={() => bookingMutation.mutateAsync()}
              />
            </div>
          ) : null}
        </>
      )}
    </KrewPageShell>
  );
}
