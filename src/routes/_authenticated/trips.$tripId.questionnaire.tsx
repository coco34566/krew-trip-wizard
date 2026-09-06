import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { KrewIcon, KrewHighlight } from "@/components/krew/visual-language";
import { KrewJourneyErrorState, KrewJourneyLoadingState } from "@/components/krew/KrewJourneyAsyncState";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewJourneyStatusPanel } from "@/components/krew/KrewJourneyStatusPanel";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
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
    meta: [{ title: "Mes préférences — KREW" }],
  }),
  component: ParticipantQuestionnaire,
});

const LODGING_TYPES = [
  { value: "hotel", label: "Hôtel" },
  { value: "logement_entier", label: "Maison ou appartement entier" },
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

function SelectableOption({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-[14px] border p-4 text-left text-sm sm:text-base font-medium transition-colors select-none",
        active
          ? "border-primary/40 bg-primary/5 text-foreground"
          : "border-border/50 bg-background text-foreground/80 hover:border-primary/25 hover:bg-primary/[0.02]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  hint,
  bgClass,
  children,
}: {
  title: string;
  hint?: string;
  bgClass?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("pb-6 mb-6 space-y-4", bgClass ? `${bgClass} rounded-[20px] p-5 sm:p-6` : "border-b border-border/50")}>
      <div>
        <h2 className="font-display text-2xl sm:text-3xl font-normal text-foreground">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-muted-foreground font-sans">{hint}</p> : null}
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
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
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    fetchMine({ data: { tripId } })
      .then(({ trip, preferences }: any) => {
        if (cancelled) return;
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
          setIsEditing(false);
          setLastSavedAt(null);
          setDepartureCity(dep);
        }
      })
      .catch((e: any) => {
        if (cancelled) return;
        if (typeof e?.message === "string" && e.message.startsWith("403 Forbidden")) {
          toast.error("Tu n’as pas accès à ces préférences.");
          navigate({ to: "/dashboard" });
          return;
        }
        console.error("Impossible de charger les préférences:", e);
        setLoadError("Impossible de charger tes préférences pour le moment.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, loadAttempt]);

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  function validate(): string | null {
    if (ambiances.length === 0) return "Choisis au moins une ambiance.";
    if (activityCategories.length === 0) return "Choisis au moins une catégorie d'activités.";
    if (!departureCity.trim()) return "Indique ta ville de départ (nécessaire pour les vols).";
    if (budgetMax < 50) return "Le budget minimum est de 50 €.";
    if (wantedEnvTypes.length === 0)
      return "Choisis au moins un environnement recherché.";
    return null;
  }

  async function handleSubmit() {
    const error = validate();
    if (error) {
      toast.error(error);
      throw new Error(error);
    }
    try {
      const excluded = excludedDestinations
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);

      await submit({
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
      navigate({ to: "/trips/$tripId", params: { tripId } });
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "");
      if (msg.includes("403 Forbidden")) {
        toast.error("Tu n’as pas accès à ces préférences.");
        navigate({ to: "/dashboard" });
        throw e;
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
        toast.error("Impossible d’enregistrer tes réponses. Réessaie dans un instant.");
        throw e;
      }
      console.error("Erreur enregistrement préférences:", e);
      toast.error("Impossible d’enregistrer tes réponses. Réessaie dans un instant.");
      throw e;
    }
  }

  if (loading) {
    return (
      <KrewJourneyLoadingState
        maxWidthClassName="max-w-[820px]"
        message="Chargement de tes préférences…"
      />
    );
  }

  if (loadError) {
    return (
      <KrewJourneyErrorState
        tripId={tripId}
        maxWidthClassName="max-w-[820px]"
        returnLabel="Retour au voyage"
        title="Impossible de charger tes préférences"
        description={`${loadError} Tes réponses déjà enregistrées sont conservées.`}
        onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-[820px] space-y-8 px-5 py-8 sm:px-7 sm:py-10 lg:px-8">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour au voyage
      </Link>

      <KrewJourneyPageHeader
        tripName={tripName}
        title="Préférences"
        otterSrc="/brand/otter-states/preferences.png"
      >
        <p>
          Ces infos permettent à KREW de comprendre tes envies pour proposer au groupe un voyage qui lui correspond.
        </p>
        {!isEditing ? (
          <p>Tes réponses individuelles ne sont pas visibles par les autres participants.</p>
        ) : null}
      </KrewJourneyPageHeader>

      {isEditing ? (
        <KrewJourneyStatusPanel title="Préférences enregistrées" icon="check" tone="complete">
          <p>
            Tu as déjà répondu
            {lastSavedAt
              ? ` (mise à jour le ${new Date(lastSavedAt).toLocaleString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })})`
              : ""}
            . Tu peux modifier uniquement <strong>tes</strong> réponses — elles restent liées à ton compte.
          </p>
        </KrewJourneyStatusPanel>
      ) : null}

      <div>
        <Section
          title="Envies et ambiance"
          hint="Choisis les envies et l’ambiance qui te correspondent."
        >
          <div className="space-y-2">
            <Label className="font-semibold block text-base text-foreground">Ambiances *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {AMBIANCES.map((a) => (
                <SelectableOption
                  key={a.value}
                  active={ambiances.includes(a.value)}
                  onClick={() => toggle(ambiances, setAmbiances, a.value)}
                >
                  <span className="mr-1.5">{a.emoji}</span> {a.label}
                </SelectableOption>
              ))}
            </div>
            <div className="mt-6 space-y-2">
              <Label className="font-semibold block text-base text-foreground">
                Ambiances que tu refuses
              </Label>
              <p className="text-xs text-muted-foreground">
                Si une destination correspond trop à l’une de ces ambiances, elle sera écartée même
                si elle plaît au reste du groupe.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                {AMBIANCES.map((a) => (
                  <SelectableOption
                    key={`db-${a.value}`}
                    active={dealBreakerAmbiances.includes(a.value)}
                    onClick={() => {
                      if (!dealBreakerAmbiances.includes(a.value) && ambiances.includes(a.value)) {
                        setAmbiances((prev) => prev.filter((x) => x !== a.value));
                      }
                      toggle(dealBreakerAmbiances, setDealBreakerAmbiances, a.value);
                    }}
                  >
                    <span className="mr-1.5">{a.emoji}</span> {a.label}
                  </SelectableOption>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <Label className="font-semibold block text-base text-foreground">Activités *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ACTIVITY_CATEGORIES.map((a) => (
                <SelectableOption
                  key={a.value}
                  active={activityCategories.includes(a.value)}
                  onClick={() => toggle(activityCategories, setActivityCategories, a.value)}
                >
                  <span className="mr-1.5">{a.emoji}</span> {a.label}
                </SelectableOption>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <Label className="font-semibold block text-base text-foreground">Rythme du séjour</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TRAVEL_PACE.map((p) => (
                <SelectableOption
                  key={p.value}
                  active={travelPace === p.value}
                  onClick={() => setTravelPace(p.value)}
                >
                  {p.label}
                </SelectableOption>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <Label className="font-semibold block text-base text-foreground">Moments de la journée préférés</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {TIME_SLOTS.map((t) => (
                <SelectableOption
                  key={t.value}
                  active={preferredTimeSlots.includes(t.value)}
                  onClick={() => toggle(preferredTimeSlots, setPreferredTimeSlots, t.value)}
                >
                  {t.label}
                </SelectableOption>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title="Destination et cadre"
          hint="Indique les destinations et le cadre qui te correspondent."
        >
          <div className="space-y-2">
            <Label htmlFor="destination" className="font-semibold block text-base text-foreground">Destination rêvée (optionnel)</Label>
            <Input
              id="destination"
              value={desiredDestination}
              onChange={(e) => setDesiredDestination(e.target.value)}
              placeholder="Ex : Lisbonne, Barcelone…"
              className="h-12 rounded-xl border-border focus-visible:ring-primary text-base"
            />
            <p className="text-xs text-muted-foreground">
              Si plusieurs personnes indiquent la même ville, KREW la priorise.
            </p>
          </div>
          <div className="space-y-2 pt-2">
            <Label htmlFor="excluded" className="font-semibold block text-base text-foreground">Destinations à éviter (optionnel)</Label>
            <Input
              id="excluded"
              value={excludedDestinations}
              onChange={(e) => setExcludedDestinations(e.target.value)}
              placeholder="Ex : Ibiza, Marrakech (séparées par des virgules)"
              className="h-12 rounded-xl border-border focus-visible:ring-primary text-base"
            />
          </div>
          <div className="space-y-3 pt-4">
            <Label className="font-semibold block text-base text-foreground">
              Environnement recherché *
            </Label>
            <p className="text-xs text-muted-foreground">Tu peux en choisir plusieurs.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { v: "Centre-ville / urbain", label: "🏢 Centre-ville / urbain" },
                { v: "Quartier animé", label: "🍻 Quartier animé" },
                { v: "Bord de mer", label: "🌊 Bord de mer" },
                { v: "Nature / pleine nature", label: "🌳 Nature / pleine nature" },
                { v: "Village de charme", label: "🏡 Village de charme" },
                { v: "Montagne", label: "🏔️ Montagne" },
                { v: "Lac / rivière", label: "🚣 Lac / rivière" },
              ].map((env) => (
                <SelectableOption
                  key={env.v}
                  active={wantedEnvTypes.includes(env.v)}
                  onClick={() => toggle(wantedEnvTypes, setWantedEnvTypes, env.v)}
                >
                  {env.label}
                </SelectableOption>
              ))}
            </div>
          </div>
          <div className="space-y-3 pt-4">
            <Label className="font-semibold block text-base text-foreground">
              Quelle importance accordes-tu à la météo pour ce voyage ?
            </Label>
            <div className="grid grid-cols-1 gap-3">
              {[
                {
                  v: 2,
                  label:
                    "☀️ Je veux privilégier une destination avec de bonnes chances de beau temps",
                },
                { v: 1, label: "🌤️ C’est un plus, mais ce n’est pas déterminant" },
                { v: 0, label: "🌍 La météo n’est pas un critère pour moi" },
              ].map((opt) => (
                <SelectableOption
                  key={opt.v}
                  active={weatherPreference === opt.v}
                  onClick={() => setWeatherPreference(opt.v)}
                >
                  {opt.label}
                </SelectableOption>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title="Budget"
          hint="Indique le budget qui te convient pour ce voyage."
        >
          <div className="space-y-3">
            <Label className="font-semibold block text-base text-foreground">
              Budget max par personne:{" "}
              <KrewHighlight tone="sage" className="font-mono text-primary px-2 py-0.5">
                {formatEuro(budgetMax)}
              </KrewHighlight>{" "}
              *
            </Label>
            <Slider
              min={150}
              max={1500}
              step={25}
              value={[budgetMax]}
              onValueChange={([v]) => setBudgetMax(v ?? budgetMax)}
              className="py-2"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[250, 400, 600, 900].map((n) => (
                <SelectableOption key={n} active={budgetMax === n} onClick={() => setBudgetMax(n)} className="text-center font-mono">
                  {n} €
                </SelectableOption>
              ))}
            </div>
          </div>
          <div className="space-y-3 pt-4">
            <Label className="font-semibold block text-base text-foreground">Ce budget, c&apos;est plutôt…</Label>
            <div className="grid grid-cols-1 gap-3">
              {BUDGET_PRIORITIES.map((p) => (
                <SelectableOption
                  key={p.value}
                  active={budgetPriority === p.value}
                  onClick={() => setBudgetPriority(p.value)}
                >
                  {p.label}
                </SelectableOption>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title="Hébergement"
          hint="Tes préférences aident KREW à proposer l’hébergement le plus adapté au groupe."
        >
          <div className="space-y-3">
            <Label className="font-semibold block text-base text-foreground">Type d’hébergement</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LODGING_TYPES.map((a) => (
                <SelectableOption
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
                </SelectableOption>
              ))}
            </div>
          </div>
          <div className="space-y-3 pt-4">
            <Label className="font-semibold block text-base text-foreground">L’hébergement, pour toi, c’est plutôt…</Label>
            <div className="grid grid-cols-1 gap-3">
              {[["base_only", "Un point de chute"], ["part_of_stay", "Un lieu où on aime aussi passer du temps"], ["centerpiece", "Une vraie partie du voyage"]].map(([value, label]) => (
                <SelectableOption key={value} active={accommodationRole === value} onClick={() => setAccommodationRole(value as typeof accommodationRole)}>
                  {label}
                </SelectableOption>
              ))}
            </div>
          </div>
          <div className="space-y-3 pt-4">
            <Label className="font-semibold block text-base text-foreground">Chambre</Label>
            <div className="grid grid-cols-1 gap-3">
              {ROOM_TYPES.map((a) => (
                <SelectableOption
                  key={a.value}
                  active={roomType === a.value}
                  onClick={() => setRoomType(a.value)}
                >
                  {a.label}
                </SelectableOption>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title="Transport"
          hint="Indique ton point de départ et tes contraintes : les trajets seront proposés pour chacun selon sa situation."
        >
          <div className="space-y-2">
            <Label htmlFor="departure" className="font-semibold block text-base text-foreground">Ville de départ * (ou code postal)</Label>
            <CityAutocomplete
              id="departure"
              value={departureCity}
              onChange={setDepartureCity}
              onSelect={(sel) => setDepartureCity(sel.city)}
              placeholder={defaultDeparture || "Ex. Lyon, 69001, Paris…"}
            />
          </div>
          <div className="space-y-3 pt-4">
            <Label className="font-semibold block text-base text-foreground">Modes de transport acceptés</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {["avion", "train", "voiture", "peu importe"].map((m) => (
                <SelectableOption
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
                  className="text-center"
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </SelectableOption>
              ))}
            </div>
          </div>
          <div className="space-y-3 pt-4">
            <Label className="font-semibold block text-base text-foreground">
              Durée de trajet max : <span className="font-mono text-primary">{maxTravelDurationHours} h</span>
            </Label>
            <Slider
              min={2}
              max={12}
              step={1}
              value={[maxTravelDurationHours]}
              onValueChange={([v]) => setMaxTravelDurationHours(v ?? 6)}
              className="py-2"
            />
          </div>
          <div className="pt-2">
            <SelectableOption
              active={accessibilityNeeds}
              onClick={() => setAccessibilityNeeds(!accessibilityNeeds)}
            >
              {accessibilityNeeds ? "Besoin d'accessibilité PMR" : "Pas de besoin PMR particulier"}
            </SelectableOption>
          </div>
          <div className="space-y-3 pt-4">
            <Label className="font-semibold block text-base text-foreground">Sur place, tu préfères…</Label>
            <div className="grid grid-cols-1 gap-3">
              {[["walk_transit", "Tout faire à pied / transports"], ["car_if_worth_it", "Une voiture si ça vaut vraiment le coup"], ["car_ok", "Aucun problème pour se déplacer en voiture"]].map(([value, label]) => (
                <SelectableOption key={value} active={localMobility === value} onClick={() => setLocalMobility(value as typeof localMobility)}>
                  {label}
                </SelectableOption>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Contraintes et précisions">
          <div className="space-y-3">
            <Label className="font-semibold block text-base text-foreground">Alimentation</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {DIETARY_OPTIONS.map((d) => (
                <SelectableOption
                  key={d}
                  active={dietaryConstraints.includes(d)}
                  onClick={() => toggle(dietaryConstraints, setDietaryConstraints, d)}
                >
                  {d}
                </SelectableOption>
              ))}
            </div>
          </div>
          <div className="space-y-2 pt-4">
            <Label htmlFor="mobility" className="font-semibold block text-base text-foreground">Mobilité / accessibilité</Label>
            <Textarea
              id="mobility"
              value={mobilityNotes}
              onChange={(e) => setMobilityNotes(e.target.value)}
              placeholder="Ex : éviter trop de marche, besoin d'ascenseur…"
              className="min-h-[120px] rounded-xl border-border focus-visible:ring-primary text-base"
            />
          </div>
          <div className="space-y-2 pt-4">
            <Label htmlFor="free" className="font-semibold block text-base text-foreground">Autre chose à préciser ?</Label>
            <Textarea
              id="free"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Envies particulières, contraintes de dates perso…"
              className="min-h-[120px] rounded-xl border-border focus-visible:ring-primary text-base"
            />
          </div>
        </Section>

        <div className="pt-2 pb-12">
          <KrewStatefulButton
            className="max-w-full"
            idleLabel={isEditing ? "Enregistrer mes modifications" : "Enregistrer mes réponses"}
            loadingLabel="Enregistrement…"
            successLabel="Réponses enregistrées"
            errorLabel="Réessayer"
            onAction={handleSubmit}
          />
        </div>
      </div>
    </main>
  );
}
