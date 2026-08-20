import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
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
      toast.error("Donne un nom au voyage (2 caractères min.)");
      return;
    }
    if (!organizerFirstName.trim()) {
      toast.error("Indique ton prénom (organisateur)");
      return;
    }
    if (needsStar && !celebratedPerson.trim()) {
      toast.error("Indique le prénom de la personne principale (Star)");
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
      toast.success("Voyage créé — invite ton groupe !");
      await navigate({ to: "/trips/$tripId/invite", params: { tripId: id } });
    } catch (err: any) {
      toast.error(err?.message?.slice?.(0, 140) ?? "Création impossible");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-[820px] space-y-8">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="size-4" /> Dashboard
      </Link>

      <div className="space-y-2">
        <h1 className="font-display text-[38px] sm:text-[48px] font-normal leading-[0.95] tracking-tight text-foreground">
          Créer un voyage
        </h1>
        <p className="text-sm text-muted-foreground">Juste l'essentiel pour démarrer.</p>
      </div>

      <form onSubmit={onSubmit} className="pt-4">
        {/* Question 1: Nom du voyage */}
        <div className="border-b border-border/50 pb-8 mb-8 space-y-2">
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

        {/* Question 2: Prénom organisateur */}
        <div className="border-b border-border/50 pb-8 mb-8 space-y-2">
          <Label htmlFor="orga" className="text-base font-semibold text-foreground">
            Ton prénom (organisateur)
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

        {/* Question 3: Type d'événement */}
        <div className="border-b border-border/50 pb-8 mb-8 space-y-4">
          <Label className="text-base font-semibold text-foreground block">Type d'événement</Label>
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
                      ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20"
                      : "border-border bg-background hover:border-primary/40 text-foreground/80",
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
                        <span className="text-base block mb-0.5">{t.emoji}</span>
                        <span className="font-semibold text-sm leading-tight block text-white drop-shadow-sm">
                          {t.label}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-xl block mb-1">{t.emoji}</span>
                      <span className="font-medium text-sm leading-tight block">{t.label}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              À venir
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {upcomingEventTypes.map((t) => (
                <div
                  key={t.value}
                  aria-disabled="true"
                  className="rounded-[14px] p-4 border border-border/50 bg-muted/30 text-muted-foreground/70 opacity-60 cursor-not-allowed select-none"
                >
                  <span className="text-xl block mb-1 opacity-70">{t.emoji}</span>
                  <span className="font-medium text-sm leading-tight block">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Question 4 (conditionnelle): Star */}
        {needsStar ? (
          <div className="border-b border-border/50 pb-8 mb-8 space-y-2">
            <Label htmlFor="star" className="text-base font-semibold text-foreground">
              Personne principale (Star)
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

        {/* Question 5: Nombre estimé */}
        <div className="border-b border-border/50 pb-8 mb-8 space-y-2">
          <Label htmlFor="n" className="text-base font-semibold text-foreground">
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
              ? `Inclus bien la star ${celebratedPerson ? `(${celebratedPerson})` : ""} dans ce nombre total de participant·e·s.`
              : `Entre ${PARTICIPANTS_MIN} et ${PARTICIPANTS_MAX} — tu pourras inviter ensuite.`}
          </p>
        </div>

        {/* Question 6: Tranche d'âge */}
        <div className="border-b border-border/50 pb-8 mb-8 space-y-3">
          <Label className="text-base font-semibold text-foreground block">
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

        {/* Question 7: Durée du voyage */}
        <div className="border-b border-border/50 pb-8 mb-8 space-y-2">
          <Label htmlFor="durationDays" className="text-base font-semibold text-foreground">
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
            La durée du voyage commune à tout le groupe (ex : 3 jours correspond à 2 nuits).
          </p>
        </div>

        {/* Actions */}
        <div className="pt-2">
          <Button type="submit" size="lg" className="w-full h-12 rounded-xl text-base font-medium" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Sparkles className="size-4" />}
            Créer et inviter le groupe
          </Button>
        </div>
      </form>
    </main>
  );
}
