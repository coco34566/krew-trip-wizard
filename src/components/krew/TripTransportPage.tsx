import type { Tables } from "@/integrations/supabase/types";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Car, Clock, Plane, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { KrewJourneyErrorState, KrewJourneyLoadingState } from "@/components/krew/KrewJourneyAsyncState";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { TransportTimePrefsCard } from "@/components/krew/TransportTimePrefsCard";
import { KrewMark, KrewNote } from "@/components/krew/visual-language";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
import { getStarTransportContext, setTransportPickStatusAtomic } from "@/lib/trips-logistics-atomic.functions";
import { groupTransportPicks, isCarMode, transportShareKey } from "@/lib/krew/transport-groups";
import { SafeExternalLink } from "@/components/krew/SafeExternalLink";
import {
  getGroupTransportTimeWindow,
  getTripDetail,
  pickTransport,
  proposeStayAndTransport,
} from "@/lib/trips.functions";
import { formatEuro } from "@/lib/krew/constants";
import { cn } from "@/lib/utils";

function normalizeCity(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("fr-FR");
}

function buildTransportPayload(transport: any, extra: Record<string, unknown> = {}) {
  return {
    city: transport.city,
    mode: transport.mode,
    modeLabel: transport.modeLabel,
    label: transport.label,
    pricePerPerson: transport.pricePerPerson,
    url: transport.url,
    arrivalTime:
      transport.providerOffer?.outboundArrivalTime ||
      transport.trainJourney?.outbound?.arrivalTime ||
      transport.arrivalTime ||
      undefined,
    departureTime:
      transport.providerOffer?.returnDepartureTime ||
      transport.trainJourney?.return?.departureTime ||
      transport.departureTime ||
      undefined,
    durationHours: transport.durationHours,
    outboundDepartureTime:
      transport.providerOffer?.outboundTime ||
      transport.trainJourney?.outbound?.departureTime ||
      transport.outboundDepartureTime ||
      undefined,
    returnArrivalTime:
      transport.providerOffer?.returnArrivalTime ||
      transport.providerOffer?.returnTime ||
      transport.trainJourney?.return?.arrivalTime ||
      transport.returnArrivalTime ||
      undefined,
    time:
      transport.providerOffer?.outboundArrivalTime ||
      transport.trainJourney?.outbound?.arrivalTime ||
      transport.arrivalTime ||
      transport.time ||
      undefined,
    ...extra,
  };
}

export function TripTransportPage({ tripId }: { tripId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const fetchProgress = useServerFn(getParticipantsProgress);
  const fetchGroupWindow = useServerFn(getGroupTransportTimeWindow);
  const fetchStarContext = useServerFn(getStarTransportContext);
  const proposeTransport = useServerFn(proposeStayAndTransport);
  const chooseTransport = useServerFn(pickTransport);
  const setTransportStatus = useServerFn(setTransportPickStatusAtomic);

  const detailQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });
  const progressQuery = useQuery({
    queryKey: ["trip-progress", tripId],
    queryFn: () => fetchProgress({ data: { tripId } }),
  });
  const groupWindowQuery = useQuery({
    queryKey: ["group-time-window", tripId],
    queryFn: () => fetchGroupWindow({ data: { tripId } }),
    retry: false,
  });

  const starContextQuery = useQuery({
    queryKey: ["star-transport-context", tripId],
    queryFn: () => fetchStarContext({ data: { tripId } }),
    retry: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    queryClient.invalidateQueries({ queryKey: ["trip-progress", tripId] });
    queryClient.invalidateQueries({ queryKey: ["cost-split", tripId] });
    queryClient.invalidateQueries({ queryKey: ["group-time-window", tripId] });
  };

  const searchMutation = useMutation({
    mutationFn: () => proposeTransport({ data: { tripId, refreshExternal: true } }),
    onSuccess: () => {
      refresh();
    },
    onError: (error) => {
      console.error("Impossible de rechercher les trajets:", error);
      toast.error("Impossible de rechercher les trajets pour le moment.");
    },
  });

  const pickMutation = useMutation({
    mutationFn: (payload: any) => chooseTransport({ data: { tripId, ...payload } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trip", tripId] }),
        queryClient.invalidateQueries({ queryKey: ["trip-progress", tripId] }),
        queryClient.invalidateQueries({ queryKey: ["cost-split", tripId] }),
        queryClient.invalidateQueries({ queryKey: ["group-time-window", tripId] }),
      ]);
      navigate({ to: "/trips/$tripId", params: { tripId } });
    },
    onError: (error) => {
      console.error("Impossible d’enregistrer le trajet:", error);
      toast.error("Impossible d’enregistrer ton trajet pour le moment.");
    },
  });

  const bookingMutation = useMutation({
    mutationFn: (participantId: string) =>
      setTransportStatus({ data: { tripId, participantId, status: "réservé" } }),
    onSuccess: () => {
      refresh();
    },
    onError: (error) => {
      console.error("Impossible de marquer le trajet comme réservé:", error);
      toast.error("Impossible de mettre à jour ce trajet pour le moment.");
    },
  });

  if (detailQuery.isLoading || progressQuery.isLoading) {
    return <KrewJourneyLoadingState context="transport" />;
  }

  if (!detailQuery.data || detailQuery.isError || progressQuery.isError) {
    const retrying = detailQuery.isFetching || progressQuery.isFetching;
    return (
      <KrewJourneyErrorState
        tripId={tripId}
        title="Impossible de charger les trajets"
        description="Les informations de transport du groupe ne sont pas disponibles pour le moment."
        retrying={retrying}
        onRetry={() => {
          void detailQuery.refetch();
          void progressQuery.refetch();
        }}
      />
    );
  }

  const data = detailQuery.data as any;
  const trip = data.trip as Tables<"trips">;
  const logistics = (trip.group_logistics || {}) as any;
  const transports = (logistics.transports ?? []) as any[];
  const picks = (logistics.transportPicks ?? []) as any[];
  const rawParticipants = (data.participants ?? []) as any[];
  const isAdmin = Boolean(data.isOwner);
  const userId = data.userId as string;
  const myParticipant = rawParticipants.find((participant) => participant.user_id === userId);
  const myProgress = progressQuery.data?.participants?.find(
    (participant: any) => participant.user_id === userId,
  );
  const myPick = picks.find((pick: any) => pick.userId === userId);
  const myDepartureCity = String(
    myProgress?.departure_city || myParticipant?.departure_city || myPick?.city || "",
  ).trim();
  const cities = [...new Set(transports.map((transport) => String(transport.city || "").trim()).filter(Boolean))];
  const groupWindow = groupWindowQuery.data as any;
  const transportGroups = groupTransportPicks(picks);
  const starContext = starContextQuery.data as any;

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
        title="Transport"
        otterSrc="/brand/otter-states/transport.png"
        annotation={
          <KrewNote variant="tape" tone="cream" rotation={2} size="xs" className="hidden sm:inline-block">
            Comment on vient
          </KrewNote>
        }
      >
        <p>
          Chacun choisit son trajet depuis sa propre ville de départ. Les choix du groupe restent visibles pour faciliter les départs ensemble.
        </p>
      </KrewJourneyPageHeader>

      <TransportTimePrefsCard tripId={tripId} />

      {groupWindow && (groupWindow.majorityArrival || groupWindow.majorityDeparture) ? (
        <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs">
          <div className="flex items-center gap-2 font-medium text-primary">
            <Clock className="size-4" /> Horaires du groupe
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
            <span>La majorité du groupe arrive vers <strong className="text-foreground">{groupWindow.majorityArrival || "—"}</strong></span>
            <KrewMark type="connector-curve" tone="sage" size="sm" className="hidden h-5 w-12 opacity-70 sm:block" />
            <span>et repart vers <strong className="text-foreground">{groupWindow.majorityDeparture || "—"}</strong>.</span>
          </div>
        </div>
      ) : null}

      {!myDepartureCity ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-foreground">Renseigne d’abord ta ville de départ</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            KREW doit connaître ton point de départ avant de te proposer un trajet personnel. Les options des autres villes restent visibles, mais tu ne peux pas les choisir pour toi.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/trips/$tripId/questionnaire" params={{ tripId }}>
              Renseigner ma ville de départ
            </Link>
          </Button>
        </div>
      ) : (
        <p className="text-sm text-foreground">
          Ton départ : <strong>{myDepartureCity}</strong>
        </p>
      )}

      {searchMutation.isPending ? (
        <KrewThinkingState context="transport" />
      ) : transports.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <p>{isAdmin ? "Lance la recherche pour proposer les trajets du groupe." : "L’organisateur·rice proposera bientôt les trajets du groupe."}</p>
          {isAdmin ? (
            <KrewStatefulButton
              className="mt-4 w-full sm:w-auto"
              idleLabel="Trouver les trajets"
              loadingLabel="Recherche en cours…"
              successLabel="Trajets trouvés"
              errorLabel="Réessayer"
              onAction={() => searchMutation.mutateAsync()}
            />
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          {cities.map((city) => {
            const options = transports.filter(
              (transport) => normalizeCity(transport.city) === normalizeCity(city),
            );
            const cityPicks = picks.filter(
              (pick: any) => normalizeCity(pick.city) === normalizeCity(city),
            );
            const canChooseForCity = Boolean(
              myDepartureCity && normalizeCity(myDepartureCity) === normalizeCity(city),
            );

            const cityGroups = transportGroups.filter(
              (group) => normalizeCity(group.city) === normalizeCity(city),
            );
            const joinableCars = cityGroups.filter(
              (group) =>
                group.driver &&
                typeof group.seatsLeft === "number" &&
                group.seatsLeft > 0 &&
                !group.members.some((member: any) => member.userId === userId),
            );
            const canChooseForStar = Boolean(
              isAdmin &&
                starContext?.canManage &&
                starContext?.departureCity &&
                normalizeCity(starContext.departureCity) === normalizeCity(city),
            );

            return (
              <section key={city} className="rounded-3xl border border-border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
                    <Plane className="size-4 text-primary" /> Depuis {city}
                  </h2>
                  {canChooseForCity ? (
                    <span className="rounded-full bg-sage/15 px-2.5 py-1 text-[11px] font-semibold text-primary">
                      Ton départ
                    </span>
                  ) : null}
                </div>

                {cityPicks.length > 0 ? (
                  <ul className="mt-3 divide-y divide-border/30 rounded-xl bg-surface/50 px-3 text-xs text-muted-foreground">
                    {cityPicks.map((pick: any) => {
                      const reserved = pick.status === "réservé";
                      return (
                        <li key={pick.participantId || pick.userId} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <span className="font-medium text-foreground">{pick.displayName}</span>
                            {" · "}{pick.modeLabel || pick.mode}
                            {pick.arrivalTime || pick.time ? ` · arrivée ${pick.arrivalTime || pick.time}` : ""}
                            {pick.departureTime ? ` · retour ${pick.departureTime}` : ""}
                            <span className="ml-1 italic text-[10px] font-semibold">({pick.status || "estimé"})</span>
                          </div>
                          {(isAdmin || pick.userId === userId) && !reserved && pick.participantId ? (
                            <KrewStatefulButton
                              size="sm"
                              variant="ghost"
                              className="h-8 self-start text-[11px] text-primary sm:self-auto"
                              idleLabel="Marquer comme réservé"
                              loadingLabel="Enregistrement…"
                              successLabel="Réservé"
                              errorLabel="Réessayer"
                              onAction={() => bookingMutation.mutateAsync(pick.participantId)}
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Personne au départ de {city} n’a encore choisi son trajet.</p>
                )}

                {canChooseForCity && joinableCars.length > 0 ? (
                  <div className="mt-3 space-y-2 rounded-2xl border border-sage/30 bg-sage/8 p-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Car className="size-4 text-primary" /> Places disponibles
                    </p>
                    {joinableCars.map((group) => {
                      const driver = group.driver as any;
                      return (
                        <div key={group.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">
                            Voiture de <strong className="text-foreground">{driver.displayName}</strong>
                            {group.seatsLeft != null ? ` · ${group.seatsLeft} place${group.seatsLeft > 1 ? "s" : ""} libre${group.seatsLeft > 1 ? "s" : ""}` : ""}
                          </span>
                          <KrewStatefulButton
                            size="sm"
                            variant="outline"
                            idleLabel="Rejoindre"
                            loadingLabel="Enregistrement…"
                            successLabel="Place confirmée"
                            errorLabel="Réessayer"
                            onAction={() =>
                              pickMutation.mutateAsync(
                                buildTransportPayload(driver, {
                                  sharedGroupId: group.id,
                                  driverParticipantId: driver.participantId,
                                  driverDisplayName: driver.displayName,
                                }),
                              )
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <ul className="mt-3 space-y-2">
                  {options.map((transport: any, index: number) => {
                    const isMine = Boolean(
                      myPick &&
                        normalizeCity(myPick.city) === normalizeCity(transport.city) &&
                        myPick.mode === transport.mode &&
                        myPick.label === transport.label,
                    );
                    const shareKey = transportShareKey(buildTransportPayload(transport) as any);
                    const sameTripMembers = cityPicks.filter(
                      (pick: any) => transportShareKey(pick) === shareKey,
                    );
                    const starIsOnThisTrip = sameTripMembers.some(
                      (pick: any) => pick.participantId === `star:${tripId}`,
                    );
                    return (
                      <li
                        key={`${city}-${transport.mode}-${index}`}
                        className={cn(
                          "flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                          isMine ? "border-primary bg-primary/5" : "border-border bg-background/40",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{transport.modeLabel || transport.mode} · {transport.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            ~{formatEuro(transport.pricePerPerson)} / pers. A/R
                            {transport.durationHours ? ` · ~${transport.durationHours} h` : ""}
                          </p>
                          {sameTripMembers.length > 0 ? (
                            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-primary">
                              <Users className="size-3.5" />
                              {sameTripMembers.length} personne{sameTripMembers.length > 1 ? "s" : ""} sur ce trajet
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {canChooseForCity ? (
                            <KrewStatefulButton
                              size="sm"
                              variant={isMine ? "default" : "outline"}
                              idleLabel={
                                isMine
                                  ? "Mon trajet"
                                  : sameTripMembers.length > 0
                                    ? "Rejoindre ce trajet"
                                    : "Choisir ce trajet"
                              }
                              loadingLabel="Enregistrement…"
                              successLabel="Trajet choisi"
                              errorLabel="Réessayer"
                              onAction={() => pickMutation.mutateAsync(buildTransportPayload(transport))}
                            />
                          ) : null}
                          {canChooseForStar && !starIsOnThisTrip ? (
                            <KrewStatefulButton
                              size="sm"
                              variant="ghost"
                              idleLabel={isMine ? `Ajouter ${starContext.name} avec moi` : `Choisir pour ${starContext.name}`}
                              loadingLabel="Enregistrement…"
                              successLabel="Trajet attribué"
                              errorLabel="Réessayer"
                              onAction={() =>
                                pickMutation.mutateAsync(
                                  buildTransportPayload(transport, { target: "star" }),
                                )
                              }
                            />
                          ) : null}
                          {canChooseForCity && isMine && isCarMode(transport.mode) ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {[1, 2, 3, 4].map((seats) => (
                                <KrewStatefulButton
                                  key={seats}
                                  size="sm"
                                  variant="ghost"
                                  idleLabel={`Je conduis · +${seats}`}
                                  loadingLabel="…"
                                  successLabel={`+${seats} places`}
                                  errorLabel="Réessayer"
                                  onAction={() =>
                                    pickMutation.mutateAsync(
                                      buildTransportPayload(transport, {
                                        isDriver: true,
                                        passengerCapacity: seats,
                                      }),
                                    )
                                  }
                                />
                              ))}
                            </div>
                          ) : null}
                          {(transport.links ?? []).slice(0, 1).map((link: any) => (
                            <SafeExternalLink
                              key={link.url}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-9 items-center text-xs font-semibold text-primary hover:underline"
                            >
                              {link.label} →
                            </SafeExternalLink>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border/45 pt-4 sm:flex-row sm:items-center sm:justify-end">
        {isAdmin && transports.length > 0 ? (
          <KrewStatefulButton
            className="w-full sm:w-auto"
            idleLabel="Actualiser les trajets"
            loadingLabel="Actualisation…"
            successLabel="Trajets actualisés"
            errorLabel="Réessayer"
            onAction={() => searchMutation.mutateAsync()}
          />
        ) : null}
        {transports.length > 0 ? (
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link
              to="/trips/$tripId/planning"
              params={{ tripId }}
              
            >
              Voir le planning <KrewMark type="arrow-right" tone="plum" size="sm" className="ml-1 size-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    </KrewPageShell>
  );
}
