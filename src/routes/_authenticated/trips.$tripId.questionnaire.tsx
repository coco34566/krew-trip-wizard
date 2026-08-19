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
    meta: [{ title: "Mon questionnaire — KREW" }],
  }),
  component: ParticipantQuestionnaire,
});

const LODGING_TYPES = [
  { value: "hotel", label: "Hôtel" },
  { value: "logement_entier", label: "Logement entier" },
  { value: "peu_importe", label: "Peu importe" },
] as const;

const ROOM_TYPES = [
  { value: "solo", label: "Je veux absolument une chambre individuelle" },
  { value: "shared_ok", label: "Partager ma chambre ne me dérange pas" },
] as const;

const BUDGET_PRIORITIES = [
  { value: "must_have", label: "Incontournable pour moi" },
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
        "cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 py-4 border-b border-border/50 last:border-b-0">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
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
  const [defaultDeparture, setDefaultDeparture] = useState("");

  const [ambiances, setAmbiances] = useState<string[]>([]);
  const [dealBreakerAmbiances, setDealBreakerAmbiances] = useState<string[]>([]);
  const [transportModeAccepted, setTransportModeAccepted] = useState<string[]>(["peu importe"]);
  const [maxTravelDurationHours, setMaxTravelDurationHours] = useState(6);
  const [accessibilityNeeds, setAccessibilityNeeds] = useState(false);
  const [activityCategories, setActivityCategories] = useState<string[]>([]);
  const [travelPace, setTravelPace] = useState<string>("equilibre");
  const [preferredTimeSlots, setPreferredTimeSlots] = useState<string[]>([]);

  const [budgetMax, setBudgetMax] = useState(400);
  const [budgetPriority, setBudgetPriority] =
    useState<(typeof BUDGET_PRIORITIES)[number]["value"]>("nice_to_have");

  const [departureCity, setDepartureCity] = useState("");
  const [desiredDestination, setDesiredDestination] = useState("");
  const [excludedDestinations, setExcludedDestinations] = useState("");

  const [lodgingTypes, setLodgingTypes] = useState<string[]>(["peu_importe"]);
  const [roomType, setRoomType] = useState<string>("peu_importe");
  const [minAccommodationRating, setMinAccommodationRating] = useState<number>(3.5);

  const [dietaryConstraints, setDietaryConstraints] = useState<string[]>([]);
  const [mobilityNotes, setMobilityNotes] = useState("");
  const [freeText, setFreeText] = useState("");

  const [wantedEnvTypes, setWantedEnvTypes] = useState<string[]>([]);
  const [weatherPreference, setWeatherPreference] = useState<number>(1);
  const [localMobility, setLocalMobility] = useState<
    "walk_transit" | "car_if_worth_it" | "car_ok" | null
  >(null);
  const [accommodationRole, setAccommodationRole] = useState<
    "base_only" | "part_of_stay" | "centerpiece" | null
  >(null);

  useEffect(() => {
    fetchMine({ data: { tripId } })
      .then(({ trip, preferences }: any) => {
        setTripName(trip.name);
        const dep = trip.departure_city || "";
        setDefaultDeparture(dep);
        if (preferences) {
          setIsEditing(true);
          setLastSavedAt(preferences.updated_at || preferences.submitted_at || null);
          setWantedEnvTypes(
            (preferences as any).wanted_env_type
              ? (preferences as any).wanted_env_type.split(", ")
              : [],
          );
          setWeatherPreference(preferences.weather_preference ?? 1);
          setLocalMobility(preferences.local_mobility ?? null);
          setAccommodationRole(preferences.accommodation_role ?? null);
          setAmbiances(preferences.ambiances ?? []);
          setDealBreakerAmbiances((preferences as any).deal_breaker_ambiances ?? []);
          setTransportModeAccepted(
            (preferences as any).transport_mode_accepted?.length
              ? (preferences as any).transport_mode_accepted
              : ["peu importe"],
          );
          setMaxTravelDurationHours(Number((preferences as any).max_travel_duration_hours) || 6);
          setAccessibilityNeeds(Boolean((preferences as any).accessibility_needs));
          setActivityCategories(preferences.activity_categories ?? []);
          setBudgetMax(Number(preferences.budget_max ?? 400));
          const dbPriority = preferences.budget_priority;
          let resolvedPriority: (typeof BUDGET_PRIORITIES)[number]["value"] = "nice_to_have";
          if (
            dbPriority === "must_have" ||
            dbPriority === "veto" ||
            dbPriority === "high_priority"
          ) {
            resolvedPriority = "must_have";
          }
          setBudgetPriority(resolvedPriority);
          setDesiredDestination(preferences.desired_destination ?? "");
          setExcludedDestinations((preferences.excluded_destinations ?? []).join(", "));
          setDietaryConstraints(preferences.dietary_constraints ?? []);
          setMobilityNotes(preferences.mobility_notes ?? "");
          setFreeText(preferences.free_text ?? "");
          setDepartureCity(preferences.departure_city ?? dep);
          setRoomType(preferences.accepts_shared_room ? "shared_ok" : "solo");
          {
            const ltp = (preferences as any).lodging_type_preferences ?? [];
            const am = preferences.required_amenities ?? [];
            const source = ltp.length > 0 ? ltp : am.filter((x: string) =>
              ["hotel", "airbnb", "maison", "villa", "logement_entier", "peu_importe"].includes(x),
            );
            setLodgingTypes(
              source.length
                ? [
                    ...new Set<string>(
                      source.map((x: string) =>
                        ["airbnb", "maison", "villa"].includes(x) ? "logement_entier" : x,
                      ),
                    ),
                  ]
                : ["peu_importe"],
            );
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
          toast.error("Tu n'es pas autorisé·e à accéder à ce questionnaire.");
          navigate({ to: "/dashboard" });
          return;
        }
        console.error("Impossible de charger le questionnaire:", e);
        toast.error("Une erreur est survenue lors du chargement, réessaie dans un instant.");
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
    if (wantedEnvTypes.length === 0)
      return "Choisis au moins un type de lieu / environnement recherché.";
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
          transportModeAccepted,
          maxTravelDurationHours,
          accessibilityNeeds,
          budgetPriority,
          activityCategories,
          budgetMax,
          desiredDestination: desiredDestination.trim() || undefined,
          excludedDestinations: excluded,
          dietaryConstraints,
          mobilityNotes: mobilityNotes.trim() || undefined,
          freeText: freeText.trim() || undefined,
          departureCity: departureCity.trim(),
          departureFlexKm: 0,
          dateFlexDays: 0,
          acceptsSharedRoom: roomType !== "solo",
          roomTypePreference: roomType === "solo" ? "solo" : "peu_importe",
          lodgingTypePreferences: lodgingTypes,
          requiredAmenities: [],
          minAccommodationRating: undefined,
          travelPace: travelPace as "plein_programme" | "equilibre" | "chill",
          preferredTimeSlots,
          wantedEnvType: wantedEnvTypes.join(", ") || undefined,
          weatherPreference,
          localMobility,
          accommodationRole,
        },
      });
      setIsEditing(true);
      setLastSavedAt(new Date().toISOString());
      if (res.isUpdate) {
        toast.success("Tes réponses ont été mises à jour.");
      } else {
        toast.success(
          `Tes réponses sont enregistrées ! (${res.progress.answered}/${res.progress.total} ont répondu) · prochaine étape : profil du voyage`,
        );
      }
      navigate({ to: "/trips/$tripId", params: { tripId } });
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "");
      if (msg.includes("403 Forbidden")) {
        toast.error("Tu n'es pas autorisé·e à soumettre ce questionnaire.");
        navigate({ to: "/dashboard" });
        return;
      }
      if (
        msg.includes("trip_participant_preferences") ||
        msg.includes("schema cache") ||
        msg.includes("SQL")
      ) {
        console.error(
          "Base incomplète : exécute le SQL « trip_participant_preferences » dans l'éditeur Supabase.",
          msg,
        );
        toast.error("Une erreur est survenue, réessaie dans un instant.");
        return;
      }
      console.error("Erreur enregistrement questionnaire:", e);
      toast.error("Une erreur est survenue lors de l'enregistrement, réessaie dans un instant.");
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
          Tes réponses individuelles ne sont pas visibles par les autres participants.
        </p>
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        Ces infos permettent à KREW de comprendre tes envies pour vous proposer le voyage qui
        correspond le mieux au groupe.
      </p>

      <div className="mt-8 space-y-5">
        <Section
          title="Envies & ambiance"
          hint="Choisis les envies et l’ambiance qui te correspondent."
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
              <Label className="mb-1 block">
                Deal-breakers — ambiances que tu refuses absolument
              </Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Exclusion dure : une destination trop typée sur ces ambiances sera écartée, même si
                le reste du groupe les veut.
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
                <Chip
                  key={p.value}
                  active={travelPace === p.value}
                  onClick={() => setTravelPace(p.value)}
                >
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
          title="Destination & cadre"
          hint="Indique les destinations et le cadre qui te correspondent."
        >
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
              Si plusieurs personnes indiquent la même ville, KREW la priorise.
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
          <div className="space-y-2 pt-2 border-t border-border/40">
            <Label className="font-semibold block text-sm">
              Type de lieu / environnement recherché * (plusieurs choix possibles)
            </Label>
            <div className="flex flex-wrap gap-2">
              {[
                { v: "Centre-ville / urbain", label: "🏢 Centre-ville / urbain" },
                { v: "Quartier animé", label: "🍻 Quartier animé" },
                { v: "Bord de mer", label: "🌊 Bord de mer" },
                { v: "Nature / pleine nature", label: "🌳 Nature / pleine nature" },
                { v: "Village de charme", label: "🏡 Village de charme" },
                { v: "Montagne", label: "🏔️ Montagne" },
                { v: "Lac / rivière", label: "🚣 Lac / rivière" },
              ].map((env) => (
                <Chip
                  key={env.v}
                  active={wantedEnvTypes.includes(env.v)}
                  onClick={() => toggle(wantedEnvTypes, setWantedEnvTypes, env.v)}
                >
                  {env.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-border/40">
            <Label className="font-semibold block text-sm">
              Quelle importance accordes-tu à la météo pour ce voyage ?
            </Label>
            <div className="flex flex-col gap-2">
              {[
                {
                  v: 2,
                  label:
                    "☀️ Je veux privilégier une destination avec de bonnes chances de beau temps",
                },
                { v: 1, label: "🌤️ C’est un plus, mais ce n’est pas déterminant" },
                { v: 0, label: "🌍 La météo n’est pas un critère pour moi" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setWeatherPreference(opt.v)}
                  className={cn(
                    "rounded-xl border px-4 py-2.5 text-left text-sm transition-colors cursor-pointer",
                    weatherPreference === opt.v
                      ? "border-primary bg-primary/15 text-foreground shadow-glow"
                      : "border-border bg-surface/60 text-muted-foreground hover:border-primary/50",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title="Budget"
          hint="Indique le budget qui te convient pour ce voyage."
        >
          <div>
            <Label className="mb-2 block">
              Budget max par personne : {formatEuro(budgetMax)} *
            </Label>
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
        </Section>

        <Section
          title="Hébergement"
          hint="Tes préférences nous aident à proposer l’hébergement le plus adapté au groupe."
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
            <Label className="mb-2 block">Le logement, pour toi, c’est plutôt…</Label>
            <div className="flex flex-col gap-2">
              {[["base_only", "Un point de chute"], ["part_of_stay", "Un lieu où on aime aussi passer du temps"], ["centerpiece", "Une vraie partie du voyage"]].map(([value, label]) => (
                <Chip key={value} active={accommodationRole === value} onClick={() => setAccommodationRole(value as typeof accommodationRole)}>{label}</Chip>
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

        <Section title="Transport" hint="Indique ton point de départ et tes contraintes : les trajets seront proposés pour chacun selon sa situation.">
          <div>
            <Label htmlFor="departure">Ville de départ * (ou code postal)</Label>
            <div className="mt-2">
              <CityAutocomplete
                id="departure"
                value={departureCity}
                onChange={setDepartureCity}
                onSelect={(sel) => setDepartureCity(sel.city)}
                placeholder={defaultDeparture || "Ex. Lyon, 69001, Paris…"}
              />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Modes de transport acceptés</Label>
            <div className="flex flex-wrap gap-2">
              {["avion", "train", "voiture", "peu importe"].map((m) => (
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
                  {m.charAt(0).toUpperCase() + m.slice(1)}
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
          <div>
            <Label className="mb-2 block">Sur place, tu préfères…</Label>
            <div className="flex flex-col gap-2">
              {[["walk_transit", "Tout faire à pied / transports"], ["car_if_worth_it", "Une voiture si ça vaut vraiment le coup"], ["car_ok", "Aucun problème pour se déplacer en voiture"]].map(([value, label]) => (
                <Chip key={value} active={localMobility === value} onClick={() => setLocalMobility(value as typeof localMobility)}>{label}</Chip>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Contraintes & précisions">
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
