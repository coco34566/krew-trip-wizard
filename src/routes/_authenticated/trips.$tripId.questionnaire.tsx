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
  DIETARY_OPTIONS,
  TIME_SLOTS,
  TRAVEL_PACE,
  formatEuro,
} from "@/lib/krew/constants";
import { cn } from "@/lib/utils";
import { CityAutocomplete } from "@/components/krew/CityAutocomplete";

export const Route = createFileRoute("/_authenticated/trips/$tripId/questionnaire")({
  head: () => ({
    meta: [{ title: "Mon questionnaire — Krew" }],
  }),
  component: ParticipantQuestionnaire,
});

const LODGING_TYPES = [
  { value: "hotel", label: "Hôtel" },
  { value: "airbnb", label: "Airbnb" },
  { value: "maison", label: "Maison / villa" },
  { value: "peu_importe", label: "Peu importe" },
] as const;

const ROOM_TYPES = [
  { value: "solo", label: "Chambre solo" },
  { value: "double", label: "Chambre à deux" },
  { value: "dortoir", label: "Dortoir" },
  { value: "peu_importe", label: "Peu importe" },
] as const;

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
  /** True si l'utilisateur connecté a déjà une ligne de préférences (édition). */
  const [isEditing, setIsEditing] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [tripName, setTripName] = useState("");
  const [defaultDeparture, setDefaultDeparture] = useState("Paris");

  const [ambiances, setAmbiances] = useState<string[]>([]);
  const [dealBreakerAmbiances, setDealBreakerAmbiances] = useState<string[]>([]);
  const [departureAirportOrStation, setDepartureAirportOrStation] = useState("");
  const [transportModeAccepted, setTransportModeAccepted] = useState<string[]>(["peu importe"]);
  const [maxTravelDurationHours, setMaxTravelDurationHours] = useState(6);
  const [accessibilityNeeds, setAccessibilityNeeds] = useState(false);
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

  const [lodgingTypes, setLodgingTypes] = useState<string[]>(["peu_importe"]);
  const [roomType, setRoomType] = useState<string>("peu_importe");

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
          setIsEditing(true);
          setLastSavedAt(
            preferences.updated_at || preferences.submitted_at || null,
          );
          setAmbiances(preferences.ambiances ?? []);
          setDealBreakerAmbiances((preferences as any).deal_breaker_ambiances ?? []);
          setDepartureAirportOrStation((preferences as any).departure_airport_or_station ?? "");
          setTransportModeAccepted((preferences as any).transport_mode_accepted?.length ? (preferences as any).transport_mode_accepted : ["peu importe"]);
          setMaxTravelDurationHours(Number((preferences as any).max_travel_duration_hours) || 6);
          setAccessibilityNeeds(Boolean((preferences as any).accessibility_needs));
          setActivityCategories(preferences.activity_categories ?? []);
          setBudgetMax(Number(preferences.budget_max ?? 400));
          setBudgetPriority(
            (preferences.budget_priority as (typeof BUDGET_PRIORITIES)[number]["value"]) ??
              "preference",
          );
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
          setRoomType((preferences as any).room_type_preference || (preferences.accepts_shared_room ? "double" : "solo"));
          {
            const am = preferences.required_amenities ?? [];
            const known = am.filter((x: string) =>
              ["hotel", "airbnb", "maison", "peu_importe"].includes(x),
            );
            setLodgingTypes(known.length ? known : ["peu_importe"]);
          }
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
          departureAirportOrStation: departureAirportOrStation.trim() || undefined,
          transportModeAccepted,
          maxTravelDurationHours,
          accessibilityNeeds,
          budgetPriority,
          activityCategories,
          budgetMax,
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
          acceptsSharedRoom: roomType === "double" || roomType === "dortoir" || roomType === "peu_importe",
          roomTypePreference: roomType,
          requiredAmenities: lodgingTypes,
          minAccommodationRating: undefined,
          travelPace: travelPace as "plein_programme" | "equilibre" | "chill",
          preferredTimeSlots,
        },
      });
      setIsEditing(true);
      setLastSavedAt(new Date().toISOString());
      if (res.autoGenerated) {
        toast.success(
          res.isUpdate
            ? "Réponses mises à jour — suggestions Krew régénérées !"
            : "Tout le monde a répondu — les suggestions Krew sont prêtes !",
        );
      } else if (res.isUpdate) {
        toast.success("Tes réponses ont été mises à jour.");
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

      <h1 className="mt-4 text-2xl font-semibold">
        {isEditing ? "Modifier mes réponses" : "Ton questionnaire"} pour « {tripName} »
      </h1>
      {isEditing ? (
        <p className="mt-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
          Tu as déjà répondu
          {lastSavedAt
            ? ` (dernière enreg. ${new Date(lastSavedAt).toLocaleString("fr-FR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })})`
            : ""}
          . Tu peux modifier uniquement <strong>tes</strong> réponses — elles restent liées à ton
          compte.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Ces réponses sont enregistrées sur ton compte et ne sont visibles que dans ce voyage.
        </p>
      )}
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
          hint="Choisis une vraie ville (ou un code postal) pour que les API vols / trains la reconnaissent."
        >
          <div>
            <Label htmlFor="departure">Ville de départ * (ou code postal)</Label>
            <div className="mt-2">
              <CityAutocomplete
                id="departure"
                value={departureCity}
                onChange={setDepartureCity}
                onSelect={(sel) => {
                  setDepartureCity(sel.city);
                  if (sel.airportIata) {
                    setDepartureAirportOrStation(sel.airportIata);
                  } else {
                    setDepartureAirportOrStation("");
                  }
                }}
                placeholder={defaultDeparture || "Ex. Lyon, 69001, Paris…"}
              />
            </div>
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


        {departureAirportOrStation ? (
          <div className="rounded-xl border border-lagoon/30 bg-lagoon/5 px-3 py-2 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Aéroport de départ (auto)
            </span>
            <p className="font-medium">{departureAirportOrStation}</p>
            <p className="text-xs text-muted-foreground">
              Rempli automatiquement selon ta ville — utilisé par les API vols.
            </p>
          </div>
        ) : null}
        <div>
          <Label className="mb-2 block">Modes de transport acceptés</Label>
          <div className="flex flex-wrap gap-2">
            {["avion", "train", "peu importe"].map((m) => (
              <Chip
                key={m}
                active={transportModeAccepted.includes(m)}
                onClick={() => {
                  setTransportModeAccepted((prev) => {
                    if (m === "peu importe") return ["peu importe"];
                    const without = prev.filter((x) => x !== "peu importe" && x !== m);
                    const next = prev.includes(m) ? without : [...without, m];
                    return next.length ? next : ["peu importe"];
                  });
                }}
              >
                {m}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <Label className="mb-2 block">Durée de trajet max : {maxTravelDurationHours} h</Label>
          <Slider
            min={2}
            max={12}
            step={1}
            value={[maxTravelDurationHours]}
            onValueChange={([v]) => setMaxTravelDurationHours(v ?? 6)}
          />
        </div>
        <div>
          <Label className="mb-2 block">Priorité budget</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { v: "preference", l: "Souhait (flexible)" },
              { v: "veto", l: "Veto (ne pas dépasser)" },
            ].map((o) => (
              <Chip key={o.v} active={budgetPriority === o.v} onClick={() => setBudgetPriority(o.v)}>
                {o.l}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAccessibilityNeeds(!accessibilityNeeds)}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm",
              accessibilityNeeds
                ? "border-primary bg-primary/15"
                : "border-border bg-surface/60 text-muted-foreground",
            )}
          >
            {accessibilityNeeds ? "Besoin d'accessibilité PMR" : "Pas de besoin PMR particulier"}
          </button>
        </div>
        <Section
          title="4. Hébergement"
          hint="Simple : type de logement + type de chambre pour filtrer les API."
        >
          <div>
            <Label className="mb-2 block">Type de logement</Label>
            <div className="flex flex-wrap gap-2">
              {LODGING_TYPES.map((a) => (
                <Chip
                  key={a.value}
                  active={lodgingTypes.includes(a.value)}
                  onClick={() => {
                    if (a.value === "peu_importe") {
                      setLodgingTypes(["peu_importe"]);
                      return;
                    }
                    setLodgingTypes((prev) => {
                      const without = prev.filter((x) => x !== "peu_importe");
                      if (without.includes(a.value)) {
                        const next = without.filter((x) => x !== a.value);
                        return next.length ? next : ["peu_importe"];
                      }
                      return [...without, a.value];
                    });
                  }}
                >
                  {a.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Chambre</Label>
            <div className="flex flex-wrap gap-2">
              {ROOM_TYPES.map((a) => (
                <Chip
                  key={a.value}
                  active={roomType === a.value}
                  onClick={() => setRoomType(a.value)}
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
          {isEditing ? "Enregistrer mes modifications" : "Envoyer mes réponses"}
        </Button>
      </div>
    </div>
  );
}
