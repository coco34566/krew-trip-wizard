import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Clock, Plane } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { KrewJourneyErrorState, KrewJourneyLoadingState } from "@/components/krew/KrewJourneyAsyncState";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { TransportTimePrefsCard } from "@/components/krew/TransportTimePrefsCard";
import { KrewMark, KrewNote } from "@/components/krew/visual-language";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
import {
  getGroupTransportTimeWindow,
  getTripDetail,
  pickTransport,
  proposeStayAndTransport,
  setBookingStatus,
} from "@/lib/trips.functions";
import { formatEuro } from "@/lib/krew/constants";
import { cn } from "@/lib/utils";

function normalizeCity(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("fr-FR");
}

export function TripTransportPage({ tripId }: { tripId: string }) {
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const fetchProgress = useServerFn(getParticipantsProgress);
  const fetchGroupWindow = useServerFn(getGroupTransportTimeWindow);
  const proposeTransport = useServerFn(proposeStayAndTransport);
  const chooseTransport = useServerFn(pickTransport);
  const setBooking = useServerFn(setBookingStatus);

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
    onSuccess: () => {
      refresh();
    },
    onError: (error) => {
      console.error("Impossible d’enregistrer le trajet:", error);
      toast.error("Impossible d’enregistrer ton trajet pour le moment.");
    },
  });

  const bookingMutation = useMutation({
    mutationFn: (userId: string) =>
      setBooking({ data: { tripId, type: "transport", status: "réservé", userId } }),
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
  const trip = data.trip as any;
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

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 sm:px-7 sm:py-10 lg:px-8">
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
                        <li key={pick.userId} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <span className="font-medium text-foreground">{pick.displayName}</span>
                            {" · "}{pick.modeLabel || pick.mode}
                            {pick.arrivalTime || pick.time ? ` · arrivée ${pick.arrivalTime || pick.time}` : ""}
                            {pick.departureTime ? ` · retour ${pick.departureTime}` : ""}
                            <span className="ml-1 italic text-[10px] font-semibold">({pick.status || "estimé"})</span>
                          </div>
                          {isAdmin && !reserved ? (
                            <KrewStatefulButton
                              size="sm"
                              variant="ghost"
                              className="h-8 self-start text-[11px] text-primary sm:self-auto"
                              idleLabel="Marquer comme réservé"
                              loadingLabel="Enregistrement…"
                              successLabel="Réservé"
                              errorLabel="Réessayer"
                              onAction={() => bookingMutation.mutateAsync(pick.userId)}
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Personne au départ de {city} n’a encore choisi son trajet.</p>
                )}

                <ul className="mt-3 space-y-2">
                  {options.map((transport: any, index: number) => {
                    const isMine = Boolean(
                      myPick &&
                        normalizeCity(myPick.city) === normalizeCity(transport.city) &&
                        myPick.mode === transport.mode &&
                        myPick.label === transport.label,
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
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {canChooseForCity ? (
                            <KrewStatefulButton
                              size="sm"
                              variant={isMine ? "default" : "outline"}
                              idleLabel={isMine ? "Mon trajet" : "Choisir ce trajet"}
                              loadingLabel="Enregistrement…"
                              successLabel="Trajet choisi"
                              errorLabel="Réessayer"
                              onAction={() =>
                                pickMutation.mutateAsync({
                                  city: transport.city,
                                  mode: transport.mode,
                                  modeLabel: transport.modeLabel,
                                  label: transport.label,
                                  pricePerPerson: transport.pricePerPerson,
                                  url: transport.url,
                                  arrivalTime: transport.providerOffer?.outboundArrivalTime || undefined,
                                  departureTime: transport.providerOffer?.returnDepartureTime || undefined,
                                  durationHours: transport.durationHours,
                                  outboundDepartureTime: transport.providerOffer?.outboundTime || undefined,
                                  returnArrivalTime:
                                    transport.providerOffer?.returnArrivalTime ||
                                    transport.providerOffer?.returnTime ||
                                    undefined,
                                  time: transport.providerOffer?.outboundArrivalTime || undefined,
                                })
                              }
                            />
                          ) : null}
                          {(transport.links ?? []).slice(0, 1).map((link: any) => (
                            <a
                              key={link.url}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-9 items-center text-xs font-semibold text-primary hover:underline"
                            >
                              {link.label} →
                            </a>
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
              to="/trips/$tripId"
              params={{ tripId }}
              search={{ view: "voyage", section: "planning" }}
            >
              Voir le planning <KrewMark type="arrow-right" tone="plum" size="sm" className="ml-1 size-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    </main>
  );
}
