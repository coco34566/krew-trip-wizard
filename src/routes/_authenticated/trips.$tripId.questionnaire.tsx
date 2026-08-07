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
import {
  ACTIVITY_CATEGORIES,
  AMBIANCES,
  AMENITIES,
  DIETARY_OPTIONS,
  TIME_SLOTS,
  TRAVEL_PACE,
  formatEuro,
} from "@/lib/krew/constants";
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

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border/60 bg-surface/40 p-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
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
  const [defaultDeparture, setDefaultDeparture] = useState("Paris");

  const [ambiances, setAmbiances] = useState<string[]>([]);
  const [dealBreakerAmbiances, setDealBreakerAmbiances] = useState<string[]>([]);
  const [activityCategories, setActivityCategories] = useState<string[]>([]);
  const [travelPace, setTravelPace] = useState<string>("equilibre");
  const [preferredTimeSlots, setPreferredTimeSlots] = useState<string[]>([]);

  const [budgetMax, setBudgetMax] = useState(400);
  const [budgetPriority, setBudgetPriority] =
    useState<(typeof BUDGET_PRIORITIES)[number]["value"]>("preference");
  const [durationNights, setDurationNights] = useState<[number, number]>([2, 3]);
  const [dateFlexDays, setDateFlexDays] = useState(2);

  const [departureCity, setDepartureCity] = useState("");
  const [desiredDestination, setDesiredDestination] = useState("");
  const [excludedDestinations, setExcludedDestinations] = useState("");

  const [acceptsSharedRoom, setAcceptsSharedRoom] = useState(false);
  const [requiredAmenities, setRequiredAmenities] = useState<string[]>([]);
  const [minAccommodationRating, setMinAccommodationRating] = useState(3.5);

  const [dietaryConstraints, setDietaryConstraints] = useState<string[]>([]);
  const [mobilityNotes, setMobilityNotes] = useState("");
  const [freeText, setFreeText] = useState("");

  useEffect(() => {
    fetchMine({ data: { tripId } })
      .then(({ trip, preferences }: any) => {
        setTripName(trip.name);
        const dep = trip.departure_city || "Paris";
        setDefaultDeparture(dep);
        if (preferences) {
          setAmbiances(preferences.ambiances ?? []);
          setDealBreakerAmbiances((preferences as any).deal_breaker_ambiances ?? []);
          setActivityCategories(preferences.activity_categories ?? []);
          setBudgetMax(Number(preferences.budget_max ?? 400));
          setBudgetPriority((preferences.budget_priority as typeof budgetPriority) ?? "preference");
          setDurationNights([
            preferences.duration_nights_min ?? 2,
            preferences.duration_nights_max ?? 3,
          ]);
          setDesiredDestination(preferences.desired_destination ?? "");
          setExcludedDestinations((preferences.excluded_destinations ?? []).join(", "));
          setDietaryConstraints(preferences.dietary_constraints ?? []);
          setMobilityNotes(preferences.mobility_notes ?? "");
          setFreeText(preferences.free_text ?? "");
          setDepartureCity(preferences.departure_city ?? dep);
          setDateFlexDays(preferences.date_flex_days ?? 2);
          setAcceptsSharedRoom(Boolean(preferences.accepts_shared_room));
          setRequiredAmenities(preferences.required_amenities ?? []);
          setMinAccommodationRating(Number(preferences.min_accommodation_rating ?? 3.5));
          setTravelPace(preferences.travel_pace ?? "equilibre");
          setPreferredTimeSlots(preferences.preferred_time_slots ?? []);
        } else {
          setDepartureCity(dep);
        }
      })
      .catch((e: any) => {
        if (typeof e?.message === "string" && e.message.startsWith("403 Forbidden")) {
          toast.error("Vous n'êtes pas autorisé·e à accéder à ce questionnaire.");
          navigate({ to: "/dashboard" });
          return;
        }
        toast.error(e?.message ?? "Impossible de charger le questionnaire");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  function validate(): string | null {
    if (ambiances.length === 0) return "Choisis au moins une ambiance.";
    if (activityCategories.length === 0) return "Choisis au moins une catégorie d'activités.";
    if (!departureCity.trim()) return "Indique ta ville de départ (nécessaire pour les vols).";
    if (budgetMax < 50) return "Le budget minimum est de 50 €.";
    if (durationNights[0] > durationNights[1]) return "La durée min ne peut pas dépasser la durée max.";
    return null;
  }

  async function handleSubmit() {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setSubmitting(true);
    try {
      const excluded = excludedDestinations
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await submit({
        data: {
          tripId,
          ambiances,
          dealBreakerAmbiances,
          activityCategories,
          budgetMax,
          budgetPriority,
          durationNightsMin: durationNights[0],
          durationNightsMax: durationNights[1],
          desiredDestination: desiredDestination.trim() || undefined,
          excludedDestinations: excluded,
          dietaryConstraints,
          mobilityNotes: mobilityNotes.trim() || undefined,
          freeText: freeText.trim() || undefined,
          departureCity: departureCity.trim(),
          departureFlexKm: 0,
          dateFlexDays,
          acceptsSharedRoom,
          requiredAmenities,
          minAccommodationRating,
          travelPace: travelPace as "plein_programme" | "equilibre" | "chill",
          preferredTimeSlots,
        },
      });
      if (res.autoGenerated) {
        toast.success("Tout le monde a répondu — les suggestions Krew sont prêtes !");
      } else {
        toast.success(
          `Tes réponses sont enregistrées ! (${res.progress.answered}/${res.progress.total} ont répondu)`,
        );
      }
      navigate({ to: "/trips/$tripId", params: { tripId } });
    } catch (e: any) {
      if (typeof e?.message === "string" && e.message.startsWith("403 Forbidden")) {
        toast.error("Vous n'êtes pas autorisé·e à soumettre ce questionnaire.");
        navigate({ to: "/dashboard" });
        return;
      }
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: "/trips/$tripId", params: { tripId } })}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Retour au voyage
      </Button>

      <h1 className="mt-4 text-2xl font-semibold">Ton questionnaire pour « {tripName} »</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ces infos permettent à Krew de chercher des vols, hôtels et activités à jour. Tes réponses
        individuelles ne sont pas visibles par les autres.
      </p>

      <div className="mt-8 space-y-5">
        <Section
          title="1. Envies & ambiance"
          hint="Obligatoire — sert à scorer les destinations et les activités."
        >
          <div>
            <Label className="mb-2 block">Ambiances *</Label>
            <div className="flex flex-wrap gap-2">
              {AMBIANCES.map((a) => (
                <Chip
                  key={a.value}
                  active={ambiances.includes(a.value)}
                  onClick={() => toggle(ambiances, setAmbiances, a.value)}
                >
                  {a.emoji} {a.label}
                </Chip>
              ))}
            </div>
            <div className="mt-6">
              <Label className="mb-1 block">Deal-breakers — ambiances que tu refuses absolument</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Exclusion dure : une destination trop typée sur ces ambiances sera écartée, même si le reste du groupe les veut.
              </p>
              <div className="flex flex-wrap gap-2">
                {AMBIANCES.map((a) => (
                  <Chip
                    key={`db-${a.value}`}
                    active={dealBreakerAmbiances.includes(a.value)}
                    onClick={() => {
                      // ne pas sélectionner à la fois comme envie et deal-breaker
                      if (!dealBreakerAmbiances.includes(a.value) && ambiances.includes(a.value)) {
                        setAmbiances((prev) => prev.filter((x) => x !== a.value));
                      }
                      toggle(dealBreakerAmbiances, setDealBreakerAmbiances, a.value);
                    }}
                  >
                    🚫 {a.emoji} {a.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Activités *</Label>
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
            <Label className="mb-2 block">Rythme du séjour</Label>
            <div className="flex flex-wrap gap-2">
              {TRAVEL_PACE.map((p) => (
                <Chip key={p.value} active={travelPace === p.value} onClick={() => setTravelPace(p.value)}>
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Moments de la journée préférés</Label>
            <div className="flex flex-wrap gap-2">
              {TIME_SLOTS.map((t) => (
                <Chip
                  key={t.value}
                  active={preferredTimeSlots.includes(t.value)}
                  onClick={() => toggle(preferredTimeSlots, setPreferredTimeSlots, t.value)}
                >
                  {t.label}
                </Chip>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title="2. Budget & durée"
          hint="Le budget agrégé du groupe filtre les destinations et les offres hôtels."
        >
          <div>
            <Label className="mb-2 block">Budget max par personne : {formatEuro(budgetMax)} *</Label>
            <Slider
              min={150}
              max={1500}
              step={25}
              value={[budgetMax]}
              onValueChange={([v]) => setBudgetMax(v ?? budgetMax)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[250, 400, 600, 900].map((n) => (
                <Chip key={n} active={budgetMax === n} onClick={() => setBudgetMax(n)}>
                  {n} €
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Ce budget, c&apos;est plutôt…</Label>
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
            <Label className="mb-2 block">
              Durée souhaitée : {durationNights[0]} – {durationNights[1]} nuit(s)
            </Label>
            <Slider
              min={1}
              max={10}
              step={1}
              value={durationNights}
              onValueChange={(v) => {
                if (v.length >= 2) setDurationNights([v[0] ?? 1, v[1] ?? 2]);
              }}
            />
          </div>
          <div>
            <Label className="mb-2 block">
              Flexibilité sur les dates : ± {dateFlexDays} jour(s)
            </Label>
            <Slider
              min={0}
              max={14}
              step={1}
              value={[dateFlexDays]}
              onValueChange={([v]) => setDateFlexDays(v ?? 0)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Utile pour les recherches de vols et d&apos;hôtels autour des dates du voyage.
            </p>
          </div>
        </Section>

        <Section
          title="3. Départ & destination"
          hint="La ville de départ est indispensable pour cotation Kayak / Kiwi."
        >
          <div>
            <Label htmlFor="departure">Ville de départ *</Label>
            <Input
              id="departure"
              value={departureCity}
              onChange={(e) => setDepartureCity(e.target.value)}
              placeholder={defaultDeparture || "Paris"}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="destination">Destination rêvée (optionnel)</Label>
            <Input
              id="destination"
              value={desiredDestination}
              onChange={(e) => setDesiredDestination(e.target.value)}
              placeholder="Ex : Lisbonne, Barcelone…"
              className="mt-2"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Si plusieurs personnes indiquent la même ville, Krew la priorise.
            </p>
          </div>
          <div>
            <Label htmlFor="excluded">Destinations à éviter (optionnel)</Label>
            <Input
              id="excluded"
              value={excludedDestinations}
              onChange={(e) => setExcludedDestinations(e.target.value)}
              placeholder="Ex : Ibiza, Marrakech (séparées par des virgules)"
              className="mt-2"
            />
          </div>
        </Section>

        <Section
          title="4. Hébergement"
          hint="Transmis aux recherches Booking / Hotels.com / Expedia."
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAcceptsSharedRoom(!acceptsSharedRoom)}
              className={cn(
                "rounded-xl border px-4 py-2 text-sm",
                acceptsSharedRoom
                  ? "border-primary bg-primary/15"
                  : "border-border bg-surface/60 text-muted-foreground",
              )}
            >
              {acceptsSharedRoom ? "OK chambre partagée" : "Préfère chambre individuelle"}
            </button>
          </div>
          <div>
            <Label className="mb-2 block">
              Note mini hébergement : {minAccommodationRating.toFixed(1)} / 5
            </Label>
            <Slider
              min={0}
              max={5}
              step={0.5}
              value={[minAccommodationRating]}
              onValueChange={([v]) => setMinAccommodationRating(v ?? 3.5)}
            />
          </div>
          <div>
            <Label className="mb-2 block">Équipements souhaités</Label>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((a) => (
                <Chip
                  key={a.value}
                  active={requiredAmenities.includes(a.value)}
                  onClick={() => toggle(requiredAmenities, setRequiredAmenities, a.value)}
                >
                  {a.label}
                </Chip>
              ))}
            </div>
          </div>
        </Section>

        <Section title="5. Contraintes & précisions">
          <div>
            <Label className="mb-2 block">Alimentation</Label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map((d) => (
                <Chip
                  key={d}
                  active={dietaryConstraints.includes(d)}
                  onClick={() => toggle(dietaryConstraints, setDietaryConstraints, d)}
                >
                  {d}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="mobility">Mobilité / accessibilité</Label>
            <Textarea
              id="mobility"
              value={mobilityNotes}
              onChange={(e) => setMobilityNotes(e.target.value)}
              placeholder="Ex : éviter trop de marche, besoin d'ascenseur…"
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="free">Autre chose à préciser ?</Label>
            <Textarea
              id="free"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Envies particulières, contraintes de dates perso…"
              className="mt-2"
            />
          </div>
        </Section>

        <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Envoyer mes réponses
        </Button>
      </div>
    </div>
  );
}
