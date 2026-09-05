import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Utensils,
  Wine,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewIcon, KrewMark, KrewNote } from "@/components/krew/visual-language";
import { computeItineraryActivitiesCost } from "@/lib/krew/cost-split";
import { formatEuro } from "@/lib/krew/constants";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import {
  generateGroupItinerary,
  getTripDetail,
  regenerateItinerarySlot,
} from "@/lib/trips.functions.entry";

export function planningTypeLabel(type: string | null | undefined) {
  const normalized = String(type ?? "").trim().toLowerCase();
  const labels: Record<string, string> = {
    activite: "Activité",
    activité: "Activité",
    resto: "Restaurant",
    restaurant: "Restaurant",
    bar: "Bar",
    libre: "Temps libre",
    transport: "Transport",
    hotel: "Hébergement",
  };
  return labels[normalized] ?? (type ? String(type).replace(/_/g, " ").replace(/^./, (char) => char.toUpperCase()) : "");
}

export function planningLinkForSlot(slot: any, destination?: string | null) {
  if (!slot || slot.type === "transport" || slot.type === "hotel") return null;

  if (slot.booking?.provider === "getyourguide" && slot.booking?.url) {
    return {
      url: slot.booking.url as string,
      label:
        slot.booking.type === "exact_product"
          ? "Voir les disponibilités sur GetYourGuide →"
          : "Voir les activités sur GetYourGuide →",
    };
  }

  if (!slot.url) return null;

  if (slot.resourceKind === "booking") {
    return { url: slot.url as string, label: "Voir / réserver →" };
  }
  if (slot.resourceKind === "ideas") {
    return { url: slot.url as string, label: "Voir les idées →" };
  }

  if (slot.resourceKind === "maps" && slot.verified !== true && slot.label) {
    const query = [String(slot.label).trim(), String(destination || "").trim()]
      .filter(Boolean)
      .join(", ");
    if (query) {
      return {
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
        label: "Rechercher ce lieu →",
      };
    }
  }

  return { url: slot.url as string, label: "Voir le lieu →" };
}

export function TripPlanningPage({ tripId }: { tripId: string }) {
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const generatePlanning = useServerFn(generateGroupItinerary);
  const regenerateSlot = useServerFn(regenerateItinerarySlot);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });

  const generateMutation = useMutation({
    mutationFn: () => generatePlanning({ data: { tripId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (error: any) => toast.error(error?.message || "Impossible de générer le planning"),
  });

  const regenerateMutation = useMutation({
    mutationFn: ({ day, slotIndex }: { day: number; slotIndex: number }) =>
      regenerateSlot({ data: { tripId, day, slotIndex } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (error: any) => toast.error(error?.message || "Impossible de proposer une autre option"),
  });

  if (isLoading) {
    return <KrewThinkingState message="Krew prépare ton planning…" />;
  }

  if (isError || !data?.trip) {
    return <div className="py-8 text-sm text-muted-foreground">Impossible de charger le planning.</div>;
  }

  const trip = data.trip as any;
  const lifecycleState = getTripLifecycleState({
    status: trip.status,
    startDate: trip.start_date ?? null,
    endDate: trip.end_date ?? null,
  });
  const isCompleted = lifecycleState === "completed";
  const days = (trip.group_itinerary?.days ?? []) as any[];
  const destination = String(
    trip.group_itinerary?.destination || trip.group_logistics?.destination || "",
  ).trim();
  const activityCost = computeItineraryActivitiesCost(days);
  const priceStatusLabel =
    activityCost.priceStatus === "verified"
      ? "Prix vérifiés"
      : activityCost.priceStatus === "mixed"
        ? "Prix vérifiés + estimés"
        : "Budget estimé";

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="mt-0.5 shrink-0">
          <Link to="/trips/$tripId" params={{ tripId }}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <KrewIcon name="planning" tone="plum" size="sm" />
            <h1 className="font-display text-2xl font-normal text-foreground">Planning</h1>
            <KrewMark type="sparkle" tone="sage" size="sm" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Un programme cohérent avec vos horaires, votre destination et le rythme du groupe.
          </p>
        </div>
      </div>

      {days.length === 0 ? (
        <KrewNote tone="cream" className="space-y-3">
          <p className="text-sm text-foreground">Le planning n’a pas encore été généré.</p>
          {!isCompleted ? (
            <KrewStatefulButton
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              loading={generateMutation.isPending}
              idleLabel="Générer le planning"
              loadingLabel="Krew construit le planning…"
              successLabel="Planning généré"
            />
          ) : null}
        </KrewNote>
      ) : (
        <>
          {activityCost.totalPerPerson > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{priceStatusLabel}</span>
              <span>{formatEuro(activityCost.totalPerPerson)} / personne</span>
            </div>
          ) : null}

          <div className="space-y-5">
            {days.map((day: any) => (
              <section key={`${day.day}-${day.date || ""}`} className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary" />
                  <h2 className="font-display text-xl font-normal">Jour {day.day}</h2>
                  {day.date ? <span className="text-xs text-muted-foreground">{day.date}</span> : null}
                </div>

                <div className="space-y-2">
                  {(day.slots ?? []).map((slot: any, slotIndex: number) => {
                    const Icon =
                      slot.type === "resto"
                        ? Utensils
                        : slot.type === "bar"
                          ? Wine
                          : slot.type === "libre"
                            ? Camera
                            : CalendarDays;
                    const directPrice = Number(slot.pricePerPerson ?? slot.priceHint);
                    const hasDirectPrice = Number.isFinite(directPrice) && directPrice >= 0;
                    const typeLabel = planningTypeLabel(slot.type);
                    const slotLink = planningLinkForSlot(slot, destination);

                    return (
                      <div
                        key={`${day.day}-${slot.time}-${slotIndex}`}
                        className="rounded-xl border border-border/55 bg-background/65 px-3.5 py-3"
                      >
                        <div className="flex gap-3">
                          <div className="w-12 shrink-0 pt-0.5 font-mono text-xs font-semibold text-primary">
                            {slot.time}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                  <p className="font-medium text-foreground">{slot.label}</p>
                                  {typeLabel ? (
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                      {typeLabel}
                                    </span>
                                  ) : null}
                                </div>
                                {slot.detail ? (
                                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                                    {slot.detail}
                                  </p>
                                ) : null}
                                {slot.address ? (
                                  <p className="mt-1 text-xs text-muted-foreground">{slot.address}</p>
                                ) : null}
                                {hasDirectPrice ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {formatEuro(directPrice)} / personne
                                  </p>
                                ) : null}

                                {slotLink ? (
                                  <a
                                    href={slotLink.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex min-h-9 items-center text-xs font-medium text-primary hover:underline"
                                  >
                                    {slotLink.label}
                                  </a>
                                ) : null}
                              </div>
                            </div>

                            {!isCompleted && slot.type !== "libre" ? (
                              <button
                                type="button"
                                className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                                disabled={regenerateMutation.isPending}
                                onClick={() => regenerateMutation.mutate({ day: Number(day.day), slotIndex })}
                              >
                                Proposer autre chose
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
