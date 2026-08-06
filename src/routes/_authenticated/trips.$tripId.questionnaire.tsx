import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  getMyParticipantPreferences,
  submitParticipantPreferences,
} from "@/lib/participant-preferences.functions";
import { ACTIVITY_CATEGORIES, AMBIANCES, DIETARY_OPTIONS, formatEuro } from "@/lib/krew/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trips/$tripId/questionnaire")({
  head: () => ({
    meta: [{ title: "Mon questionnaire — Krew" }],
  }),
  component: ParticipantQuestionnaire,
});

const BUDGET_PRIORITIES = [
  { value: "veto", label: "Bloquant — je ne peux vraiment pas dépasser" },
  { value: "must_have", label: "Incontournable pour moi" },
  { value: "high_priority", label: "Important" },
  { value: "preference", label: "Une préférence, sans plus" },
  { value: "nice_to_have", label: "Peu importe, je m'adapte" },
] as const;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-2xl border px-4 py-2.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary/15 text-foreground shadow-glow"
          : "border-border bg-surface/60 text-muted-foreground hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

function ParticipantQuestionnaire() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const fetchMine = useServerFn(getMyParticipantPreferences);
  const submit = useServerFn(submitParticipantPreferences);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tripName, setTripName] = useState("");

  const [ambiances, setAmbiances] = useState<string[]>([]);
  const [activityCategories, setActivityCategories] = useState<string[]>([]);
  const [budgetMax, setBudgetMax] = useState(400);
  const [budgetPriority, setBudgetPriority] = useState<(typeof BUDGET_PRIORITIES)[number]["value"]>("preference");
  const [durationNights, setDurationNights] = useState<[number, number]>([2, 3]);
  const [desiredDestination, setDesiredDestination] = useState("");
  const [dietaryConstraints, setDietaryConstraints] = useState<string[]>([]);
  const [mobilityNotes, setMobilityNotes] = useState("");
  const [freeText, setFreeText] = useState("");

  useEffect(() => {
    fetchMine({ data: { tripId } })
      .then(({ trip, preferences }) => {
        setTripName(trip.name);
        if (preferences) {
          setAmbiances(preferences.ambiances ?? []);
          setActivityCategories(preferences.activity_categories ?? []);
          setBudgetMax(preferences.budget_max ?? 400);
          setBudgetPriority((preferences.budget_priority as typeof budgetPriority) ?? "preference");
          setDurationNights([
            preferences.duration_nights_min ?? 2,
            preferences.duration_nights_max ?? 3,
          ]);
          setDesiredDestination(preferences.desired_destination ?? "");
          setDietaryConstraints(preferences.dietary_constraints ?? []);
          setMobilityNotes(preferences.mobility_notes ?? "");
          setFreeText(preferences.free_text ?? "");
        }
      })
      .catch((e) => toast.error(e.message ?? "Impossible de charger le questionnaire"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await submit({
        data: {
          tripId,
          ambiances,
          activityCategories,
          budgetMax,
          budgetPriority,
          durationNightsMin: durationNights[0],
          durationNightsMax: durationNights[1],
          desiredDestination: desiredDestination || undefined,
          excludedDestinations: [],
          dietaryConstraints,
          mobilityNotes: mobilityNotes || undefined,
          freeText: freeText || undefined,
        },
      });
      toast.success("Tes réponses sont enregistrées !");
      navigate({ to: "/trips/$tripId", params: { tripId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/trips/$tripId", params: { tripId } })}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Retour au voyage
      </Button>

      <h1 className="mt-4 text-2xl font-semibold">Ton questionnaire pour « {tripName} »</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Réponds pour toi-même — tes réponses individuelles ne sont pas visibles par les autres participantes.
      </p>

      <div className="mt-8 space-y-8">
        <div>
          <Label className="mb-3 block">Quelles ambiances te font envie ?</Label>
          <div className="flex flex-wrap gap-2">
            {AMBIANCES.map((a) => (
              <Chip key={a.value} active={ambiances.includes(a.value)} onClick={() => toggle(ambiances, setAmbiances, a.value)}>
                {a.emoji} {a.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-3 block">Quelles activités t'intéressent ?</Label>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_CATEGORIES.map((a) => (
              <Chip
                key={a.value}
                active={activityCategories.includes(a.value)}
                onClick={() => toggle(activityCategories, setActivityCategories, a.value)}
              >
                {a.emoji} {a.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-3 block">Ton budget maximum : {formatEuro(budgetMax)}</Label>
          <Slider min={100} max={3000} step={50} value={[budgetMax]} onValueChange={([v]) => setBudgetMax(v)} />
        </div>

        <div>
          <Label className="mb-3 block">Ce budget, c'est plutôt...</Label>
          <div className="flex flex-col gap-2">
            {BUDGET_PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setBudgetPriority(p.value)}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-left text-sm transition-colors",
                  budgetPriority === p.value
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-surface/60 text-muted-foreground hover:border-primary/50",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="destination">Une destination dont tu rêves ? (optionnel)</Label>
          <Input
            id="destination"
            value={desiredDestination}
            onChange={(e) => setDesiredDestination(e.target.value)}
            placeholder="Ex : Lisbonne"
            className="mt-2"
          />
        </div>

        <div>
          <Label className="mb-3 block">Contraintes alimentaires</Label>
          <div className="flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map((d) => (
              <Chip key={d} active={dietaryConstraints.includes(d)} onClick={() => toggle(dietaryConstraints, setDietaryConstraints, d)}>
                {d}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="mobility">Contraintes de mobilité (optionnel)</Label>
          <Textarea
            id="mobility"
            value={mobilityNotes}
            onChange={(e) => setMobilityNotes(e.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="free">Autre chose à préciser ?</Label>
          <Textarea id="free" value={freeText} onChange={(e) => setFreeText(e.target.value)} className="mt-2" />
        </div>

        <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Envoyer mes réponses
        </Button>
      </div>
    </div>
  );
}
