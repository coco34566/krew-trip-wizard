import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KrewOrganicBlob } from "@/components/krew/visual-language/KrewOrganicBlob";
import { KrewIcon, KrewMark } from "@/components/krew/visual-language";

type TripHubMembersSectionProps = {
  trip: any;
  participants: any[];
  logistics: any;
  progress: any;
  viewerUserId: string | null | undefined;
  isCreator: boolean;
  isOwner: boolean;
  starUid: string;
  isEditingCount: boolean;
  countInput: number;
  updateCountPending: boolean;
  setCoOrgPending: boolean;
  onEditingCountChange: (editing: boolean) => void;
  onCountInputChange: (count: number) => void;
  onUpdateCount: (count: number) => void;
  onDeclareStatus: (status: "accepte" | "absent") => void;
  onSetCoOrganizer: (coOrganizerId: string | null) => void;
  onRemoveParticipant: (participantId: string) => void;
  onRemind: () => void;
};

export function TripHubMembersSection({
  trip,
  participants,
  logistics,
  progress,
  viewerUserId,
  isCreator,
  isOwner,
  starUid,
  isEditingCount,
  countInput,
  updateCountPending,
  setCoOrgPending,
  onEditingCountChange,
  onCountInputChange,
  onUpdateCount,
  onDeclareStatus,
  onSetCoOrganizer,
  onRemoveParticipant,
  onRemind,
}: TripHubMembersSectionProps) {
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
        <KrewMark type="underline-wave" tone="sage" size="sm" className="krew-group-title-underline mt-1 opacity-90 pointer-events-none" />
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
              progress?.participants?.find((item: any) => item.user_id === participant.user_id)
                ?.departure_city ||
              participant.departure_city ||
              userPick?.city ||
              null;
            const participantIsOwner = Boolean(
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
              transportMode.includes("flight") || transportMode.includes("plane") || transportMode.includes("avion")
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
                        {participant.user_id === viewerUserId ? (
                          <span className="font-normal text-[11px] text-muted-foreground ml-1.5 shrink-0">
                            (Moi)
                          </span>
                        ) : null}
                      </p>
                      {participantIsOwner ? (
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
                            <span>Départ : <strong className="text-foreground font-normal">{city}</strong></span>
                          </span>
                        ) : null}
                        {userPick ? (
                          <span className="inline-flex items-center gap-1">
                            <KrewIcon name={transportIconName} tone="muted" size="sm" className="size-3" />
                            <span>Trajet : <strong className="text-foreground font-normal">{userPick.modeLabel || userPick.mode}</strong></span>
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
                    <span className="text-muted-foreground whitespace-nowrap capitalize">{participant.status}</span>
                  )}

                  {participant.user_id === viewerUserId ? (
                    <button
                      type="button"
                      className="text-xs text-primary font-medium hover:underline ml-2 whitespace-nowrap"
                      onClick={() =>
                        onDeclareStatus(
                          (participant.status as string) === "absent" ? "accepte" : "absent",
                        )
                      }
                    >
                      {(participant.status as string) === "absent"
                        ? "Participer à nouveau"
                        : "Indiquer mon absence"}
                    </button>
                  ) : null}

                  {isCreator &&
                  participant.user_id &&
                  !participant.placeholder &&
                  !participant.isStar &&
                  participant.user_id !== "star-virtual-uid" &&
                  participant.user_id !== trip.owner_id ? (
                    participant.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId) ? (
                      <button
                        type="button"
                        className="text-xs text-destructive/80 hover:underline"
                        disabled={setCoOrgPending}
                        onClick={() => onSetCoOrganizer(null)}
                      >
                        Retirer le rôle de co-organisateur·rice
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        disabled={setCoOrgPending}
                        onClick={() => onSetCoOrganizer(participant.user_id || null)}
                      >
                        Nommer co-organisateur·rice
                      </button>
                    )
                  ) : null}

                  {isOwner && !participant.placeholder && !participant.isStar ? (
                    <button
                      type="button"
                      aria-label={`Retirer ${participant.email || participant.display_name}`}
                      className="text-muted-foreground/70 hover:text-destructive p-1"
                      onClick={() => onRemoveParticipant(participant.id)}
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
          {isOwner ? (
            isEditingCount ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (countInput >= 2 && countInput <= 25) {
                    onUpdateCount(countInput);
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
                  value={countInput}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => onCountInputChange(Number(event.target.value))}
                  className="w-16 h-7 text-xs font-mono"
                />
                <button
                  type="submit"
                  className="text-xs font-semibold text-primary hover:underline"
                  disabled={updateCountPending}
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => onEditingCountChange(false)}
                >
                  Annuler
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="text-sm text-primary font-medium hover:underline ml-1"
                onClick={() => {
                  onCountInputChange(Number(trip.participants_count || 2));
                  onEditingCountChange(true);
                }}
              >
                Modifier
              </button>
            )
          ) : null}
        </div>
      </div>

      {isOwner ? (
        <div className="pt-4 border-t border-border/40">
          <Button type="button" variant="ghost" className="w-auto justify-start" onClick={onRemind}>
            <KrewIcon name="group" tone="plum" size="sm" className="size-4 shrink-0" />
            <span>Relancer le groupe</span>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
