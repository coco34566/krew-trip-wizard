import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { createTrip, generateRecommendations } from "@/lib/trips.functions";
import {
  ACTIVITY_CATEGORIES,
  AMBIANCES,
  DIETARY_OPTIONS,
  EVENT_TYPES,
  formatEuro,
} from "@/lib/krew/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trips/new")({
  head: () => ({
    meta: [
      { title: "Créer un voyage — Krew" },
      {
        name: "description",
        content: "Le questionnaire Krew : profil du groupe, préférences, activités et contraintes pour générer votre voyage.",
      },
      { property: "og:title", content: "Créer un voyage — Krew" },
      { property: "og:description", content: "Questionnaire intelligent pour construire votre voyage de groupe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewTripWizard,
});

const STEP_TITLES = ["Le voyage", "Profil du groupe", "Préférences", "Activités", "Contraintes"];

type FormState = {
  name: string;
  eventType: string;
  celebratedPerson: string;
  startDate: string;
  endDate: string;
  participants: number;
  budgetPerPerson: number;
  departureCity: string;
  averageAge: number;
  relation: string;
  ambiances: string[];
  activityCategories: string[];
  desiredDestination: string;
  letKrewDecide: boolean;
  maxDistanceKm: number;
  excludedCountries: string;
  durationNights: number;
  needsCityCenter: boolean;
  mobilityNotes: string;
  dietaryConstraints: string[];
  availabilityNotes: string;
};

const INITIAL: FormState = {
  name: "",
  eventType: "evg",
  celebratedPerson: "",
  startDate: "",
  endDate: "",
  participants: PARTICIPANTS_DEFAULT,
  budgetPerPerson: 400,
  departureCity: "Paris",
  averageAge: 30,
  relation: "Amis proches",
  ambiances: ["fete"],
  activityCategories: ["soirees", "gastronomie"],
  desiredDestination: "",
  letKrewDecide: true,
  maxDistanceKm: 1500,
  excludedCountries: "",
  durationNights: 3,
  needsCityCenter: true,
  mobilityNotes: "",
  dietaryConstraints: [],
  availabilityNotes: "",
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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

function NewTripWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const save = useServerFn(createTrip);
  const generate = useServerFn(generateRecommendations);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggle = (key: "ambiances" | "activityCategories" | "dietaryConstraints", value: string) =>
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((v) => v !== value) : [...prev[key], value],
    }));

  const canContinue = step !== 0 || form.name.trim().length >= 2;

  async function submit() {
    setSubmitting(true);
    try {
      const { tripId } = await save({
        data: {
          name: form.name.trim(),
          eventType: form.eventType as "evg",
          celebratedPerson: form.celebratedPerson || undefined,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          participants: form.participants,
          budgetPerPerson: form.budgetPerPerson,
          departureCity: form.departureCity,
          averageAge: form.averageAge,
          relation: form.relation || undefined,
          ambiances: form.ambiances,
          activityCategories: form.activityCategories,
          desiredDestination: form.letKrewDecide ? undefined : form.desiredDestination || undefined,
          letKrewDecide: form.letKrewDecide,
          maxDistanceKm: form.maxDistanceKm,
          excludedCountries: form.excludedCountries
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
          durationNights: form.durationNights,
          needsCityCenter: form.needsCityCenter,
          mobilityNotes: form.mobilityNotes || undefined,
          dietaryConstraints: form.dietaryConstraints,
          availabilityNotes: form.availabilityNotes || undefined,
        },
      });
      await generate({ data: { tripId } });
      toast.success("Vos propositions Krew sont prêtes !");
      navigate({ to: "/trips/$tripId", params: { tripId } });
    } catch (error) {
      console.error(error);
      toast.error("Impossible de générer le voyage. Réessayez dans un instant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm text-muted-foreground">
        Étape {step + 1} / {STEP_TITLES.length}
      </p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{STEP_TITLES[step]}</h1>
      <Progress value={((step + 1) / STEP_TITLES.length) * 100} className="mt-5 h-2" />

      <div className="mt-8 space-y-8 rounded-3xl border border-border bg-card p-6 shadow-elevated sm:p-8">
        {step === 0 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l'événement</Label>
              <Input
                id="name"
                placeholder="EVG de Thomas"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type d'événement</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((t) => (
                  <Chip key={t.value} active={form.eventType === t.value} onClick={() => set("eventType", t.value)}>
                    {t.emoji} {t.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start">Date de départ souhaitée *</Label>
                <Input id="start" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Nécessaire pour cotations hôtels &amp; vols en temps réel.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Date de retour *</Label>
                <Input id="end" type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ville de départ des participants *</Label>
              <Input id="city" value={form.departureCity} onChange={(e) => set("departureCity", e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Utilisée pour les vols (Kayak / Kiwi) depuis cette ville.</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-8">
            <div className="space-y-3">
              <Label>Nombre de participants : {form.participants}</Label>
              <p className="text-xs text-muted-foreground">
                Typiquement 4 à 10 pour un EVG / week-end — max {PARTICIPANTS_MAX}.
              </p>
              <Slider
                min={PARTICIPANTS_MIN}
                max={PARTICIPANTS_MAX}
                step={1}
                value={[form.participants]}
                onValueChange={([v]) => set("participants", v ?? PARTICIPANTS_MIN)}
              />
              <div className="flex flex-wrap gap-2">
                {[4, 6, 8, 10, 12, 15].map((n) => (
                  <Chip key={n} active={form.participants === n} onClick={() => set("participants", n)}>
                    {n}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Âge moyen du groupe : {form.averageAge} ans</Label>
              <Slider
                min={18}
                max={70}
                step={1}
                value={[form.averageAge]}
                onValueChange={([v]) => set("averageAge", v ?? 18)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="celebrated">Personne célébrée</Label>
              <Input
                id="celebrated"
                placeholder="Thomas"
                value={form.celebratedPerson}
                onChange={(e) => set("celebratedPerson", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relation">Relation avec la personne célébrée</Label>
              <Input
                id="relation"
                placeholder="Amis de fac, collègues, famille…"
                value={form.relation}
                onChange={(e) => set("relation", e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label>Ambiance recherchée</Label>
              <div className="flex flex-wrap gap-2">
                {AMBIANCES.map((a) => (
                  <Chip key={a.value} active={form.ambiances.includes(a.value)} onClick={() => toggle("ambiances", a.value)}>
                    {a.emoji} {a.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            <div className="flex items-center justify-between rounded-2xl border border-border bg-surface/50 p-4">
              <div>
                <p className="font-medium">Laisser Krew choisir la destination</p>
                <p className="text-sm text-muted-foreground">Recommandé : le moteur compare tout le catalogue.</p>
              </div>
              <Switch checked={form.letKrewDecide} onCheckedChange={(v) => set("letKrewDecide", v)} />
            </div>
            {!form.letKrewDecide && (
              <div className="space-y-2">
                <Label htmlFor="dest">Destination souhaitée</Label>
                <Input
                  id="dest"
                  placeholder="Barcelone, Portugal…"
                  value={form.desiredDestination}
                  onChange={(e) => set("desiredDestination", e.target.value)}
                />
              </div>
            )}
            <div className="space-y-3">
              <Label>Zone de recherche : {form.maxDistanceKm} km max</Label>
              <p className="text-xs text-muted-foreground">
                Filtre les destinations et évite les vols trop longs pour le budget.
              </p>
              <div className="flex flex-wrap gap-2">
                {DISTANCE_PRESETS.map((d) => (
                  <Chip
                    key={d.value}
                    active={form.maxDistanceKm === d.value}
                    onClick={() => set("maxDistanceKm", d.value)}
                  >
                    {d.label}
                  </Chip>
                ))}
              </div>
              <Slider
                min={200}
                max={3000}
                step={100}
                value={[form.maxDistanceKm]}
                onValueChange={([v]) => set("maxDistanceKm", v ?? 200)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="excluded">Pays refusés (séparés par une virgule)</Label>
              <Input
                id="excluded"
                placeholder="Maroc, Pologne"
                value={form.excludedCountries}
                onChange={(e) => set("excludedCountries", e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label>Durée du séjour : {form.durationNights} nuit(s)</Label>
              <p className="text-xs text-muted-foreground">
                Sert aux dates check-in / check-out hôtels (Booking, Hotels.com…).
              </p>
              <div className="flex flex-wrap gap-2">
                {[2, 3, 4, 5, 7].map((n) => (
                  <Chip key={n} active={form.durationNights === n} onClick={() => set("durationNights", n)}>
                    {n} nuit{n > 1 ? "s" : ""}
                  </Chip>
                ))}
              </div>
              <Slider
                min={1}
                max={10}
                step={1}
                value={[form.durationNights]}
                onValueChange={([v]) => set("durationNights", v ?? 1)}
              />
            </div>
            <div className="space-y-3">
              <Label>Budget max / personne (tout compris) : {formatEuro(form.budgetPerPerson)}</Label>
              <p className="text-xs text-muted-foreground">
                Vols + hébergement + activités + resto — utilisé pour filtrer les offres API.
              </p>
              <div className="flex flex-wrap gap-2">
                {BUDGET_PRESETS.map((b) => (
                  <Chip
                    key={b.value}
                    active={form.budgetPerPerson === b.value}
                    onClick={() => set("budgetPerPerson", b.value)}
                  >
                    {b.label} ({b.hint})
                  </Chip>
                ))}
              </div>
              <Slider
                min={150}
                max={1500}
                step={25}
                value={[form.budgetPerPerson]}
                onValueChange={([v]) => set("budgetPerPerson", v ?? 150)}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Label>Quelles activités recherchez-vous ?</Label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_CATEGORIES.map((c) => (
                <Chip
                  key={c.value}
                  active={form.activityCategories.includes(c.value)}
                  onClick={() => toggle("activityCategories", c.value)}
                >
                  {c.emoji} {c.label}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-8">
            <div className="flex items-center justify-between rounded-2xl border border-border bg-surface/50 p-4">
              <div>
                <p className="font-medium">Logement proche du centre</p>
                <p className="text-sm text-muted-foreground">Priorise les hébergements à proximité de l'animation.</p>
              </div>
              <Switch checked={form.needsCityCenter} onCheckedChange={(v) => set("needsCityCenter", v)} />
            </div>
            <div className="space-y-3">
              <Label>Contraintes alimentaires</Label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map((d) => (
                  <Chip
                    key={d}
                    active={form.dietaryConstraints.includes(d)}
                    onClick={() => toggle("dietaryConstraints", d)}
                  >
                    {d}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobility">Mobilité / accessibilité</Label>
              <Textarea
                id="mobility"
                placeholder="Une personne en béquilles, éviter les longues marches…"
                value={form.mobilityNotes}
                onChange={(e) => set("mobilityNotes", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="availability">Disponibilités particulières</Label>
              <Textarea
                id="availability"
                placeholder="Départ possible uniquement le vendredi soir…"
                value={form.availabilityNotes}
                onChange={(e) => set("availabilityNotes", e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="glass" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting}>
          <ArrowLeft /> Retour
        </Button>
        {step < STEP_TITLES.length - 1 ? (
          <Button variant="hero" size="lg" onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
            Continuer <ArrowRight />
          </Button>
        ) : (
          <Button variant="hero" size="lg" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {submitting ? "Krew analyse…" : "Générer mon voyage"}
          </Button>
        )}
      </div>
    </main>
  );
}