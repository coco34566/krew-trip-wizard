export type ItemMode = "personal" | "group";
export type QuantityRule =
  { type: "per_person" } | { type: "one_for_group" } | { type: "fixed_quantity"; quantity: number };
export type SuggestionSource =
  "base" | "event" | "activity" | "destination" | "accommodation" | "manual";

export type PackingItem = {
  id: string;
  label: string;
  category: "vetements" | "documents" | "sante" | "divers";
  essential: boolean;
  mode: ItemMode;
  quantity: QuantityRule;
  sources: SuggestionSource[];
  reasons: string[];
  purchasable?: boolean;
  manual?: boolean;
};

export type GroceryItem = { id: string; label: string; optional?: boolean; reasons: string[] };
export type PreparationTask = { id: string; label: string; reasons: string[] };
export type TripPreparation = {
  personal: PackingItem[];
  group: PackingItem[];
  groceries: GroceryItem[];
  tasks: PreparationTask[];
};

export type PackingListInput = {
  avgTemp?: number | null;
  rainProb?: number | null;
  isNautical?: boolean;
  isCold?: boolean;
  durationDays?: number;
  activities?: string[];
  eventType?: string | null;
  accommodation?: string | null;
  accommodationAmenities?: string[];
  transport?: string[];
  dietaryRestrictions?: string[];
  manualItems?: PackingItem[];
};

export function isFinalTripPreparationReady(input: {
  destinationSelected: boolean;
  hasItinerary: boolean;
  selectedActivityIds?: string[] | null;
}): boolean {
  return Boolean(
    input.destinationSelected && input.hasItinerary && (input.selectedActivityIds?.length ?? 0) > 0,
  );
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const contains = (haystack: string[], words: string[]) =>
  haystack.some((value) => words.some((word) => normalize(value).includes(normalize(word))));

/** Moteur déterministe unique des quatre sorties de préparation du voyage. */
export function buildTripPreparation(input: PackingListInput): TripPreparation {
  const packing = new Map<string, PackingItem>();
  const groceries = new Map<string, GroceryItem>();
  const tasks = new Map<string, PreparationTask>();
  const activities = input.activities ?? [];
  const accommodation = normalize(input.accommodation ?? "");
  const days = input.durationDays || 2;

  const addPacking = (
    item: Omit<PackingItem, "sources" | "reasons">,
    source: SuggestionSource,
    reason: string,
  ) => {
    const found = packing.get(item.id);
    if (found) {
      if (!found.sources.includes(source)) found.sources.push(source);
      if (!found.reasons.includes(reason)) found.reasons.push(reason);
    } else packing.set(item.id, { ...item, sources: [source], reasons: [reason] });
  };
  const addGrocery = (id: string, label: string, reason: string, optional = false) => {
    const found = groceries.get(id);
    if (found) {
      if (!found.reasons.includes(reason)) found.reasons.push(reason);
    } else groceries.set(id, { id, label, reasons: [reason], optional });
  };
  const addTask = (id: string, label: string, reason: string) => {
    const found = tasks.get(id);
    if (found) {
      if (!found.reasons.includes(reason)) found.reasons.push(reason);
    } else tasks.set(id, { id, label, reasons: [reason] });
  };
  const personal = (
    id: string,
    label: string,
    category: PackingItem["category"],
    essential: boolean,
    source: SuggestionSource,
    reason: string,
  ) =>
    addPacking(
      { id, label, category, essential, mode: "personal", quantity: { type: "per_person" } },
      source,
      reason,
    );
  const group = (
    id: string,
    label: string,
    source: SuggestionSource,
    reason: string,
    purchasable = false,
  ) =>
    addPacking(
      {
        id,
        label,
        category: "divers",
        essential: false,
        mode: "group",
        quantity: { type: "one_for_group" },
        purchasable,
      },
      source,
      reason,
    );

  personal(
    "identity_documents",
    "Carte d'identité ou Passeport",
    "documents",
    true,
    "base",
    "Indispensable du voyage",
  );
  personal(
    "health_card",
    "Carte Vitale / Européenne d'assurance maladie",
    "documents",
    true,
    "base",
    "Indispensable du voyage",
  );
  personal(
    "personal_medication",
    "Médicaments personnels & ordonnances",
    "sante",
    true,
    "base",
    "Besoins personnels",
  );
  personal(
    "toiletry_bag",
    "Trousse de toilette (brosse à dents, dentifrice, etc.)",
    "divers",
    true,
    "base",
    "Hygiène personnelle",
  );
  personal(
    "phone_charger",
    "Chargeur de téléphone",
    "divers",
    true,
    "base",
    "Indispensable du voyage",
  );
  personal(
    "underwear",
    `Sous-vêtements & chaussettes${days > 1 ? ` (x${days})` : ""}`,
    "vetements",
    true,
    "base",
    `Séjour de ${days} jour(s)`,
  );

  // Socle de base "Pour le groupe" (objets collectifs partagés)
  group("speaker", "Enceinte Bluetooth", "base", "Socle collectif pour le groupe", true);
  group("card_game", "Jeu de cartes", "base", "Socle collectif pour le groupe", true);
  group("power_strip", "Multiprise / rallonge", "base", "Socle collectif pour le groupe", false);

  const cold = Boolean(input.isCold || (input.avgTemp != null && input.avgTemp < 15));
  if (cold) {
    personal(
      "warm_coat",
      "Manteau chaud ou doudoune",
      "vetements",
      true,
      "destination",
      "Températures fraîches",
    );
    personal(
      "warm_layer",
      "Pull chaud ou sweat",
      "vetements",
      true,
      "destination",
      "Températures fraîches",
    );
  } else if (input.avgTemp == null || input.avgTemp >= 22) {
    personal(
      "light_clothes",
      "T-shirts légers & débardeurs",
      "vetements",
      true,
      "destination",
      "Météo douce ou chaude",
    );
  } else
    personal("light_jacket", "Veste légère", "vetements", true, "destination", "Météo tempérée");
  if ((input.rainProb ?? 0) > 30)
    personal(
      "rain_protection",
      "Parapluie pliant ou K-Way",
      "vetements",
      true,
      "destination",
      "Risque de pluie",
    );

  const water = Boolean(
    input.isNautical ||
    contains(activities, [
      "bateau",
      "plage",
      "piscine",
      "spa",
      "surf",
      "baignade",
      "nautique",
      "jacuzzi",
    ]),
  );
  if (water) {
    const reason =
      activities.find((a) =>
        contains(
          [a],
          ["bateau", "plage", "piscine", "spa", "surf", "baignade", "nautique", "jacuzzi"],
        ),
      ) || "Activité aquatique";
    personal("swimsuit", "Maillot de bain", "vetements", true, "activity", reason);
    personal("sun_protection", "Crème solaire", "sante", true, "activity", reason);
    personal("sunglasses", "Lunettes de soleil", "vetements", false, "activity", reason);
    personal("flip_flops", "Tongs ou sandales", "vetements", false, "activity", reason);
    if (!contains(input.accommodationAmenities ?? [], ["serviettes fournies", "towels included"]))
      personal(
        "beach_towel",
        "Serviette de plage en microfibre",
        "divers",
        false,
        "accommodation",
        "Non indiquée comme fournie",
      );
  }
  if (contains(activities, ["randonnee", "trek", "escalade", "outdoor", "nature", "velo"])) {
    personal(
      "walking_shoes",
      "Chaussures de marche ou de sport adaptées",
      "vetements",
      true,
      "activity",
      "Activité outdoor",
    );
    personal("water_bottle", "Gourde réutilisable", "divers", true, "activity", "Activité outdoor");
    personal(
      "weather_protection",
      "Protection météo",
      "vetements",
      false,
      "activity",
      "Activité outdoor",
    );
  }
  if (contains(activities, ["restaurant chic", "gastronomique", "soiree", "club", "bar"]))
    personal(
      "evening_outfit",
      "Tenue adaptée pour la soirée",
      "vetements",
      false,
      "activity",
      activities.find((a) => contains([a], ["restaurant", "soiree", "club", "bar"])) ||
        "Soirée prévue",
    );
  if (contains(activities, ["visite", "musee", "monument", "restaurant", "urbain"]))
    personal(
      "city_shoes",
      "Chaussures confortables pour marcher en ville",
      "vetements",
      true,
      "activity",
      "Sortie en ville",
    );
  if (contains(activities, ["deguise", "deguisement", "costume", "theme"]))
    personal(
      "fancy_dress",
      "Article de déguisement ou accessoire à thème",
      "divers",
      true,
      "activity",
      "Soirée à thème prévue",
    );
  if (contains(activities, ["jeu de cartes", "cartes"]))
    group("card_game", "Jeu de cartes", "activity", "Jeu du planning", true);
  if (contains(activities, ["papier", "stylos", "quiz", "defi"]))
    group("paper_pens", "Papier et stylos", "activity", "Matériel du jeu prévu");
  if (contains(activities, ["soiree au logement", "fete au logement", "party at accommodation"]))
    group("speaker", "Enceinte", "activity", "Soirée au logement", true);

  const event = normalize(input.eventType ?? "");
  if (
    ["evjf", "evg"].includes(event) &&
    contains(activities, ["accessoire", "decoration", "photo", "polaroid", "jeu", "defi"])
  ) {
    if (contains(activities, ["accessoire", "decoration"]))
      group(
        "event_accessory_kit",
        `Pack ${event.toUpperCase()}`,
        "event",
        `Type d'événement ${event.toUpperCase()} et activité prévue`,
        true,
      );
    if (contains(activities, ["photo", "polaroid"]))
      group("polaroid", "Polaroid", "activity", "Moment photo prévu", true);
    if (contains(activities, ["jeu", "defi"]))
      addTask("prepare_game", "Préparer le jeu", "Jeu prévu au planning");
  }

  const dinnerHome = contains(activities, [
    "diner au logement",
    "dîner au logement",
    "diner maison",
    "repas au logement",
  ]);
  const aperitifHome = contains(activities, ["apero au logement", "apéro au logement"]);
  const breakfastHome = contains(activities, [
    "petit-dejeuner au logement",
    "petit déjeuner au logement",
  ]);
  if (
    (dinnerHome || aperitifHome || breakfastHome) &&
    contains([accommodation], ["maison", "villa", "appartement", "logement"])
  ) {
    addTask("do_groceries", "Faire les courses", "Repas prévu au logement");
    if (dinnerHome) {
      addGrocery("dinner_ingredients", "Ingrédients simples pour le dîner", "Dîner au logement");
      addTask("choose_meal", "Définir le repas", "Dîner au logement");
    }
    if (aperitifHome) {
      addGrocery("water", "Eau", "Apéro au logement");
      addGrocery("soft_drinks", "Softs et alternatives sans alcool", "Apéro au logement");
      addGrocery("snacks", "Snacks / apéritif", "Apéro au logement");
      addGrocery("alcohol", "Boissons alcoolisées", "Apéro au logement", true);
    }
    if (breakfastHome)
      ["Café / thé", "Lait ou alternative", "Pain / viennoiseries"].forEach((label, i) =>
        addGrocery(`breakfast_${i}`, label, "Petit-déjeuner au logement"),
      );
  }
  if (contains(activities, ["restaurant"]))
    addTask(
      "book_restaurant",
      "Réserver le restaurant",
      activities.find((a) => normalize(a).includes("restaurant")) || "Restaurant du planning",
    );
  if (contains(activities, ["reservation requise", "a reserver", "à réserver"]))
    addTask("book_activity", "Réserver l'activité", "Activité nécessitant une réservation");

  for (const manual of input.manualItems ?? [])
    addPacking({ ...manual, manual: true }, "manual", manual.reasons[0] ?? "Ajout manuel");
  const all = [...packing.values()];
  return {
    personal: all.filter((i) => i.mode === "personal"),
    group: all.filter((i) => i.mode === "group"),
    groceries: [...groceries.values()],
    tasks: [...tasks.values()],
  };
}

/** Compatibilité avec les consommateurs historiques. */
export function buildPackingList(input: PackingListInput): PackingItem[] {
  const result = buildTripPreparation(input);
  return [...result.personal, ...result.group];
}
