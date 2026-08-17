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
      { title: "Créer un voyage — Krew" },
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
    <main className="mx-auto max-w-xl px-4 py-10">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Dashboard
      </Link>
      <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Créer un voyage</h1>
        <p className="mt-2 text-sm text-muted-foreground">Juste l'essentiel pour démarrer.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          <div>
            <Label htmlFor="name">Nom du voyage</Label>
            <Input
              id="name"
              className="mt-1.5"
              placeholder="Ex. Week-end d'été / EVG de Jules"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="orga">Ton prénom (organisateur)</Label>
            <Input
              id="orga"
              className="mt-1.5"
              placeholder="Ex. Camille"
              value={organizerFirstName}
              onChange={(e) => setOrganizerFirstName(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Pour que le groupe sache qui organise, et pour te reconnaître dans les réponses.
            </p>
          </div>
          <div>
            <Label className="mb-2 block">Type d'événement</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setEventType(t.value)}
                  className={cn(
                    "rounded-2xl border px-3 py-3 text-left text-sm transition-colors",
                    eventType === t.value
                      ? "border-primary bg-primary/15 shadow-glow"
                      : "border-border bg-surface/50 hover:border-primary/40",
                  )}
                >
                  <span className="text-base">{t.emoji}</span>
                  <span className="mt-1 block font-medium leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          {needsStar ? (
            <div>
              <Label htmlFor="star">Personne principale (Star)</Label>
              <Input
                id="star"
                className="mt-1.5"
                placeholder="Prénom"
                value={celebratedPerson}
                onChange={(e) => setCelebratedPerson(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Ses préférences compteront davantage dans les recommandations.
              </p>
            </div>
          ) : null}
          <div>
            <Label htmlFor="n">Nombre estimé de participants</Label>
            <Input
              id="n"
              type="number"
              min={PARTICIPANTS_MIN}
              max={PARTICIPANTS_MAX}
              className="mt-1.5"
              value={participantsInput}
              onChange={(e) => setParticipantsInput(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={() => setParticipantsInput(String(clampParticipants(participantsInput)))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {needsStar
                ? `Inclus bien la star ${celebratedPerson ? `(${celebratedPerson})` : ""} dans ce nombre total de participant·e·s.`
                : `Entre ${PARTICIPANTS_MIN} et ${PARTICIPANTS_MAX} — tu pourras inviter ensuite.`}
            </p>
          </div>
          <div>
            <Label className="mb-2 block">Tranche d’âge du groupe</Label>
            <div className="flex flex-wrap gap-2">
              {["18-25", "25-35", "35-45", "45-60", "60+"].map((age) => (
                <button
                  key={age}
                  type="button"
                  onClick={() => setGroupAgeRange(age)}
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-sm",
                    groupAgeRange === age ? "border-primary bg-primary/15" : "border-border",
                  )}
                >
                  {age} ans
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="durationDays">Durée du voyage (en jours)</Label>
            <Input
              id="durationDays"
              type="number"
              min={2}
              max={31}
              className="mt-1.5"
              value={durationDaysInput}
              onChange={(e) => setDurationDaysInput(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={() => {
                const val = Math.max(2, Number(durationDaysInput) || 3);
                setDurationDaysInput(String(val));
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              La durée du voyage commune à tout le groupe (ex : 3 jours correspond à 2 nuits).
            </p>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Sparkles className="size-4" />}
            Créer et inviter le groupe
          </Button>
        </form>
      </div>
    </main>
  );
}
