import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTrip } from "@/lib/trips.functions";
import {
  EVENT_TYPES,
  PARTICIPANTS_DEFAULT,
  PARTICIPANTS_MAX,
  PARTICIPANTS_MIN,
  STAR_EVENT_TYPES,
  getTripTypeImage,
} from "@/lib/krew/constants";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { cn } from "@/lib/utils";

function clampParticipants(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return PARTICIPANTS_DEFAULT;
  return Math.min(PARTICIPANTS_MAX, Math.max(PARTICIPANTS_MIN, n));
}

export const Route = createFileRoute("/_authenticated/trips/new")({
  head: () => ({
    meta: [
      { title: "Créer un voyage — KREW" },
      {
        name: "description",
        content: "Crée ton voyage de groupe : nom, type d'événement, participants.",
      },
    ],
  }),
  component: NewTripPage,
});

function NewTripPage() {
  const navigate = useNavigate();
  const create = useServerFn(createTrip);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("weekend");
  const [participantsInput, setParticipantsInput] = useState(String(PARTICIPANTS_DEFAULT));
  const participants = clampParticipants(participantsInput);
  const [celebratedPerson, setCelebratedPerson] = useState("");
  const [organizerFirstName, setOrganizerFirstName] = useState("");
  const [durationDaysInput, setDurationDaysInput] = useState("3");
  const [groupAgeRange, setGroupAgeRange] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeEventTypes = EVENT_TYPES.filter((t) =>
    ["evg", "evjf", "anniversaire", "weekend"].includes(t.value),
  );
  const upcomingEventTypes = EVENT_TYPES.filter((t) =>
    ["voyage_groupe", "famille", "seminaire", "retraite"].includes(t.value),
  );

  const needsStar = STAR_EVENT_TYPES.has(eventType as any);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Donne un nom au voyage (2 caractères minimum).");
      return;
    }
    if (!organizerFirstName.trim()) {
      toast.error("Indique ton prénom.");
      return;
    }
    if (needsStar && !celebratedPerson.trim()) {
      toast.error("Indique le prénom de la Star.");
      return;
    }
    if (!groupAgeRange) {
      toast.error("Indique la tranche d’âge du groupe.");
      return;
    }
    setSubmitting(true);
    try {
      const days = Math.max(2, Number(durationDaysInput) || 3);
      const durationNights = Math.max(1, days - 1);
      const trip = await create({
        data: {
          name: name.trim(),
          eventType: eventType as any,
          participants,
          organizerFirstName: organizerFirstName.trim(),
          celebratedPerson: celebratedPerson.trim() || undefined,
          budgetPerPerson: 400,
          groupAgeRange: groupAgeRange as "18-25" | "25-35" | "35-45" | "45-60" | "60+",
          ambiances: [],
          activityCategories: [],
          letKrewDecide: true,
          maxDistanceKm: 2000,
          excludedCountries: [],
          durationNights,
          needsCityCenter: true,
          dietaryConstraints: [],
        },
      });

      const id = (trip as any).tripId ?? (trip as any).id;
      if (!id) throw new Error("Le voyage a été créé mais son identifiant est introuvable.");

      queryClient.invalidateQueries({ queryKey: ["my-trips"] });
      toast.success("Voyage créé — invite ton groupe");
      await navigate({ to: "/trips/$tripId/invite", params: { tripId: id } });
    } catch (err: any) {
      console.error("Impossible de créer le voyage:", err);
      toast.error("Impossible de créer le voyage pour le moment. Réessaie dans un instant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-[820px] px-5 sm:px-7 py-6 sm:py-8 space-y-6 sm:space-y-8">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="size-4" /> Mes voyages
      </Link>

      <div className="space-y-2 relative">
        <div className="flex items-start justify-between gap-4">
          <div className="relative inline-block flex-1">
            <h1 className="font-display text-[34px] sm:text-[44px] font-normal leading-[0.98] tracking-tight text-foreground">
              Créer un voyage
            </h1>
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="md"
              className="absolute left-0 -bottom-2 w-[140px] pointer-events-none"
            />
          </div>
          <img
            src="/brand/otter-states/lets-go.png"
            alt=""
            className="w-[72px] sm:w-[88px] h-auto object-contain filter drop-shadow-2xs opacity-90 shrink-0 pointer-events-none"
          />
        </div>
        <p className="text-sm text-muted-foreground font-sans pt-1">Juste l'essentiel pour démarrer.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-8 pt-2">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-base font-semibold text-foreground">
            Nom du voyage
          </Label>
          <Input
            id="name"
            className="h-12 rounded-xl border-border focus-visible:ring-primary text-base"
            placeholder="Ex. Week-end d'été / EVG de Jules"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="orga" className="text-base font-semibold text-foreground">
            Ton prénom
          </Label>
          <Input
            id="orga"
            className="h-12 rounded-xl border-border focus-visible:ring-primary text-base"
            placeholder="Ex. Camille"
            value={organizerFirstName}
            onChange={(e) => setOrganizerFirstName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Pour que le groupe sache qui organise, et pour te reconnaître dans les réponses.
          </p>
        </div>

        <div className="space-y-4">
          <Label className="flex items-center gap-2 text-base font-semibold text-foreground">
            <KrewIcon name="party" tone="plum" size="sm" className="size-4.5 shrink-0" />
            Type d'événement
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {activeEventTypes.map((t) => {
              const imgUrl = getTripTypeImage(t.value);
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setEventType(t.value)}
                  className={cn(
                    "group relative overflow-hidden rounded-[14px] border text-left transition-all cursor-pointer",
                    imgUrl ? "p-0 min-h-[110px] flex flex-col justify-end" : "p-4",
                    eventType === t.value
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : "border-border bg-background hover:border-primary/25 text-foreground/80",
                  )}
                >
                  {imgUrl ? (
                    <>
                      <img
                        src={imgUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
                      <div className="relative p-3.5 z-10 text-white">
                        <span className="font-semibold text-sm leading-tight block text-white drop-shadow-sm">
                          {t.label}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="font-medium text-sm leading-tight block">{t.label}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2 space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
              À venir
            </span>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {upcomingEventTypes.map((t) => (
                <span
                  key={t.value}
                  className="inline-flex items-center rounded-full bg-surface/60 px-2.5 py-1 text-muted-foreground/80"
                >
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {needsStar ? (
          <div className="space-y-2 pt-1">
            <Label htmlFor="star" className="flex items-center gap-2 text-base font-semibold text-foreground">
              <KrewIcon name="favorite" tone="plum" size="sm" className="size-4.5 shrink-0" />
              Prénom de la Star
            </Label>
            <Input
              id="star"
              className="h-12 rounded-xl border-border focus-visible:ring-primary text-base"
              placeholder="Prénom"
              value={celebratedPerson}
              onChange={(e) => setCelebratedPerson(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ses préférences compteront davantage dans les recommandations.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="n" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <KrewIcon name="group" tone="sage" size="sm" className="size-4.5 shrink-0" />
            Nombre estimé de participants
          </Label>
          <Input
            id="n"
            type="number"
            min={PARTICIPANTS_MIN}
            max={PARTICIPANTS_MAX}
            className="h-12 rounded-xl border-border focus-visible:ring-primary text-base font-mono"
            value={participantsInput}
            onChange={(e) => setParticipantsInput(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={() => setParticipantsInput(String(clampParticipants(participantsInput)))}
          />
          <p className="text-xs text-muted-foreground">
            {needsStar
              ? `Compte bien la Star ${celebratedPerson ? `(${celebratedPerson})` : ""} dans le nombre total de participants.`
              : `Entre ${PARTICIPANTS_MIN} et ${PARTICIPANTS_MAX} — tu pourras inviter le groupe ensuite.`}
          </p>
        </div>

        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-base font-semibold text-foreground">
            <KrewIcon name="group" tone="plum" size="sm" className="size-4.5 shrink-0" />
            Tranche d’âge du groupe
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {["18-25", "25-35", "35-45", "45-60", "60+"].map((age) => (
              <button
                key={age}
                type="button"
                onClick={() => setGroupAgeRange(age)}
                className={cn(
                  "rounded-[14px] p-4 border text-center font-medium text-sm transition-all",
                  groupAgeRange === age
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-background hover:border-primary/40 text-foreground/80",
                )}
              >
                {age} ans
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="durationDays" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <KrewIcon name="calendar" tone="sage" size="sm" className="size-4.5 shrink-0" />
            Durée du voyage (en jours)
          </Label>
          <Input
            id="durationDays"
            type="number"
            min={2}
            max={31}
            className="h-12 rounded-xl border-border focus-visible:ring-primary text-base font-mono"
            value={durationDaysInput}
            onChange={(e) => setDurationDaysInput(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={() => {
              const val = Math.max(2, Number(durationDaysInput) || 3);
              setDurationDaysInput(String(val));
            }}
          />
          <p className="text-xs text-muted-foreground">
            La durée commune à tout le groupe. Par exemple, 3 jours correspondent à 2 nuits.
          </p>
        </div>

        <div className="pt-4">
          <Button type="submit" size="lg" className="w-full sm:w-auto min-h-[48px] h-auto rounded-xl text-base font-medium px-6 sm:px-8 py-2.5 whitespace-normal text-center leading-tight" disabled={submitting}>
            {submitting ? (
              <Loader2 className="animate-spin size-4 shrink-0" />
            ) : (
              <KrewIcon name="invite" tone="plum" size="sm" className="size-4 shrink-0" />
            )}
            Créer et inviter le groupe
          </Button>
        </div>
      </form>
    </main>
  );
}
