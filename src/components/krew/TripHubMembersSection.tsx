import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KrewIcon, KrewMark } from "@/components/krew/visual-language";
import { KrewOrganicBlob } from "@/components/krew/visual-language/KrewOrganicBlob";
import type { TripHubActions } from "@/hooks/useTripHubActions";
import type { TripHubData } from "@/hooks/useTripHubData";

export function TripHubMembersSection({
  hub,
  actions,
  onRemind,
}: {
  hub: TripHubData;
  actions: TripHubActions;
  onRemind: () => void;
}) {
  const data = hub.data;
  const trip = hub.trip;
  if (!data || !trip) return null;

  const participants = hub.participants;
  const logistics = hub.logistics;
  const progress = hub.progress;
  const starUid = hub.starUid;

  return (
    <section id="group-section" className="mt-12 space-y-4 scroll-mt-24 relative">
      <div className="absolute top-0 right-0 z-10 pointer-events-none">
        <img
          src="/brand/otter-states/trip-progress.png"
          alt=""
          className="w-[52px] sm:w-[60px] h-auto object-contain filter drop-shadow-2xs opacity-90"
          loading="lazy"
        />
      </div>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-14 sm:pr-16">
          <div className="relative inline-flex items-center gap-2 py-0.5 px-1">
            <KrewOrganicBlob
              tone="plum"
              variant="sweep"
              className="absolute -top-2 -left-3 w-[220px] sm:w-[250px] h-[46px] sm:h-[48px] pointer-events-none text-primary opacity-25 z-0"
            />
            <KrewIcon name="group" tone="plum" size="sm" className="size-[22px] shrink-0 relative z-10" />
            <h2 className="font-display text-[28px] sm:text-[30px] font-normal leading-[1.02] text-foreground relative z-10">
              Membres du groupe
            </h2>
          </div>
        </div>
        <KrewMark
          type="underline-wave"
          tone="sage"
          size="sm"
          className="krew-group-title-underline mt-1 opacity-90 pointer-events-none"
        />
      </div>

      <ul className="divide-y divide-border/40 pt-1">
        {participants.length === 0 ? (
          <li className="text-sm text-muted-foreground py-4">
            Personne n’a encore rejoint le groupe.
          </li>
        ) : (
          participants.map((participant) => {
            const picks = (logistics.transportPicks ?? []) as any[];
            const userPick = participant.user_id
              ? picks.find((pick: any) => pick.userId === participant.user_id)
              : null;
            const city =
              progress?.participants?.find((progressParticipant: any) => progressParticipant.user_id === participant.user_id)
                ?.departure_city ||
              participant.departure_city ||
              userPick?.city ||
              null;
            const isOwner = Boolean(
              participant.user_id &&
                !participant.placeholder &&
                participant.user_id === trip.owner_id,
            );
            const isCoOrganizer = Boolean(
              participant.user_id &&
                !participant.placeholder &&
                participant.user_id !== starUid &&
                participant.user_id !== trip.owner_id &&
                participant.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId),
            );
            const transportMode = userPick?.mode ? String(userPick.mode).toLowerCase() : "";
            const transportIconName: "plane" | "train" | "car" | "transport" =
              transportMode.includes("flight") ||
              transportMode.includes("plane") ||
              transportMode.includes("avion")
                ? "plane"
                : transportMode.includes("train")
                  ? "train"
                  : transportMode.includes("car") || transportMode.includes("voiture")
                    ? "car"
                    : "transport";
            const initial = String(participant.display_name || participant.email || "P")
              .trim()
              .charAt(0)
              .toUpperCase();

            return (
              <li
                key={participant.id}
                className="flex flex-row items-center justify-between min-h-[48px] py-2.5 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sage/16 text-primary font-mono text-xs font-semibold">
                    {initial}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground text-sm truncate flex items-center">
                        <span>{participant.display_name ?? participant.email}</span>
                        {participant.user_id === data.userId ? (
                          <span className="font-normal text-[11px] text-muted-foreground ml-1.5 shrink-0">
                            (Moi)
                          </span>
                        ) : null}
                      </p>
                      {isOwner ? (
                        <span className="text-[11px] font-medium text-primary whitespace-nowrap">
                          Organisateur·rice
                        </span>
                      ) : isCoOrganizer ? (
                        <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                          Co-organisateur·rice
                        </span>
                      ) : null}
                      {participant.isStar ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary whitespace-nowrap">
                          <KrewIcon name="favorite" tone="sage" size="sm" className="size-3" />
                          <span>Star</span>
                        </span>
                      ) : null}
                    </div>

                    {city || userPick ? (
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {city ? (
                          <span className="inline-flex items-center gap-1">
                            <KrewIcon name="destination" tone="muted" size="sm" className="size-3" />
                            <span>
                              Départ : <strong className="text-foreground font-normal">{city}</strong>
                            </span>
                          </span>
                        ) : null}
                        {userPick ? (
                          <span className="inline-flex items-center gap-1">
                            <KrewIcon name={transportIconName} tone="muted" size="sm" className="size-3" />
                            <span>
                              Trajet :{" "}
                              <strong className="text-foreground font-normal">
                                {userPick.modeLabel || userPick.mode}
                              </strong>
                            </span>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-xs">
                  {participant.status === "accepte" ? (
                    <span className="inline-flex items-center gap-1 font-medium text-primary whitespace-nowrap">
                      <KrewIcon name="check" tone="sage" size="sm" className="size-3.5" />
                      <span>Participe</span>
                    </span>
                  ) : participant.status === "absent" ? (
                    <span className="text-muted-foreground italic whitespace-nowrap">Absent</span>
                  ) : (
                    <span className="text-muted-foreground whitespace-nowrap capitalize">
                      {participant.status}
                    </span>
                  )}

                  {participant.user_id === data.userId ? (
                    <button
                      type="button"
                      className="text-xs text-primary font-medium hover:underline ml-2 whitespace-nowrap"
                      onClick={() => {
                        const nextStatus =
                          (participant.status as string) === "absent" ? "accepte" : "absent";
                        actions.declareStatusMutation.mutate(nextStatus);
                      }}
                    >
                      {(participant.status as string) === "absent"
                        ? "Participer à nouveau"
                        : "Indiquer mon absence"}
                    </button>
                  ) : null}

                  {data.isCreator &&
                  participant.user_id &&
                  !participant.placeholder &&
                  !participant.isStar &&
                  participant.user_id !== "star-virtual-uid" &&
                  participant.user_id !== trip.owner_id ? (
                    participant.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId) ? (
                      <button
                        type="button"
                        className="text-xs text-destructive/80 hover:underline"
                        disabled={actions.setCoOrgMutation.isPending}
                        onClick={() => actions.setCoOrgMutation.mutate({ coOrganizerId: null })}
                      >
                        Retirer le rôle de co-organisateur·rice
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        disabled={actions.setCoOrgMutation.isPending}
                        onClick={() =>
                          actions.setCoOrgMutation.mutate({
                            coOrganizerId: participant.user_id || null,
                          })
                        }
                      >
                        Nommer co-organisateur·rice
                      </button>
                    )
                  ) : null}

                  {data.isOwner && !participant.placeholder && !participant.isStar ? (
                    <button
                      type="button"
                      aria-label={`Retirer ${participant.email || participant.display_name}`}
                      className="text-muted-foreground/70 hover:text-destructive p-1"
                      onClick={() => actions.removeMutation.mutate(participant.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>

      <div className="mt-4 border-t-2 border-sage/35 pt-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-sans text-muted-foreground">
          <span className="font-sans text-foreground font-semibold">
            Total : <span className="font-mono">{trip.participants_count || 2}</span>
          </span>{" "}
          participants
          {data.isOwner ? (
            actions.isEditingCount ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (actions.countInput >= 2 && actions.countInput <= 25) {
                    actions.updateCountMutation.mutate(actions.countInput);
                  } else {
                    toast.error("Le nombre de participants doit être entre 2 et 25");
                  }
                }}
                className="inline-flex items-center gap-1.5 ml-2"
              >
                <Input
                  type="number"
                  min={2}
                  max={25}
                  value={actions.countInput}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => actions.setCountInput(Number(event.target.value))}
                  className="w-16 h-7 text-xs font-mono"
                />
                <button
                  type="submit"
                  className="text-xs font-semibold text-primary hover:underline"
                  disabled={actions.updateCountMutation.isPending}
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => actions.setIsEditingCount(false)}
                >
                  Annuler
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="text-sm text-primary font-medium hover:underline ml-1"
                onClick={() => {
                  actions.setCountInput(Number(trip.participants_count || 2));
                  actions.setIsEditingCount(true);
                }}
              >
                Modifier
              </button>
            )
          ) : null}
        </div>
      </div>

      {data.isOwner ? (
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border/40">
          <Button asChild variant="outline" className="w-auto justify-start">
            <Link
              to="/trips/$tripId"
              params={{ tripId: trip.id }}
              search={{ view: "feedback" }}
            >
              <KrewIcon name="preferences" tone="plum" size="sm" className="size-4 shrink-0" />
              <span>Voir les retours du groupe</span>
            </Link>
          </Button>
          <Button type="button" variant="ghost" className="inline-flex w-auto items-center justify-start gap-2 text-left" onClick={onRemind}>
            <KrewIcon name="group" tone="plum" size="sm" className="size-4 shrink-0" />
            <span>Relancer le groupe</span>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
