export type PackingItem = {
  label: string;
  category: "vetements" | "documents" | "sante" | "divers";
  essential: boolean;
};

export type PackingListInput = {
  avgTemp?: number | null;
  rainProb?: number | null;
  isNautical?: boolean;
  isCold?: boolean;
  durationDays?: number;
  activities?: string[]; // categories or names
  eventType?: string | null;
};

/**
 * Génère une liste de valise adaptée aux conditions météo et activités.
 */
export function buildPackingList(input: PackingListInput): PackingItem[] {
  const items: PackingItem[] = [];
  const days = input.durationDays || 2;

  // --- DOCUMENTS ---
  items.push({ label: "Carte d'identité ou Passeport", category: "documents", essential: true });
  items.push({ label: "Carte Vitale / Européenne d'assurance maladie", category: "documents", essential: true });
  items.push({ label: "Confirmations de réservation (transports, hôtel)", category: "documents", essential: true });

  // --- SANTÉ ---
  items.push({ label: "Médicaments personnels & ordonnances", category: "sante", essential: true });
  items.push({ label: "Pansements & analgésiques (Doliprane)", category: "sante", essential: false });
  items.push({ label: "Gel hydroalcoolique", category: "sante", essential: false });

  // --- DIVERS ---
  items.push({ label: "Trousse de toilette (brosse à dents, dentifrice, etc.)", category: "divers", essential: true });
  items.push({ label: "Chargeur de téléphone", category: "divers", essential: true });
  items.push({ label: "Gourde réutilisable", category: "divers", essential: false });

  // --- VÊTEMENTS (Base selon durée) ---
  const qtyText = days > 1 ? ` (x${days})` : "";
  items.push({
    label: `Sous-vêtements & chaussettes${qtyText}`,
    category: "vetements",
    essential: true,
  });

  // Détermination de la météo
  const temp = input.avgTemp;
  const isCold = input.isCold || (temp !== undefined && temp !== null && temp < 15);
  const isHot = !isCold && ((temp !== undefined && temp !== null && temp >= 22) || (temp === undefined && !input.isCold)); // hot by default if not cold or explicitly hot
  const rainProb = input.rainProb || 0;
  const hasRain = rainProb > 30;

  if (isCold) {
    items.push({ label: "Manteau chaud ou doudoune", category: "vetements", essential: true });
    items.push({ label: "Pull chaud ou sweat", category: "vetements", essential: true });
    items.push({ label: "Pantalons longs", category: "vetements", essential: true });
    items.push({ label: "Bonnet, écharpe & gants", category: "vetements", essential: false });
  } else if (isHot) {
    items.push({ label: "T-shirts légers & débardeurs", category: "vetements", essential: true });
    items.push({ label: "Shorts & jupes", category: "vetements", essential: true });
    items.push({ label: "Lunettes de soleil", category: "vetements", essential: true });
    items.push({ label: "Chapeau ou casquette", category: "divers", essential: false });
    items.push({ label: "Crème solaire respectueuse de l'environnement", category: "sante", essential: true });
  } else {
    // Températures douces / tempérées
    items.push({ label: "Veste légère", category: "vetements", essential: true });
    items.push({ label: "T-shirts & vêtements de demi-saison", category: "vetements", essential: true });
    items.push({ label: "Jeans / Pantalons", category: "vetements", essential: true });
  }

  if (hasRain) {
    items.push({ label: "Parapluie pliant ou K-Way", category: "vetements", essential: true });
  }

  // Activités & événements spécifiques
  const activityList = (input.activities || []).map((a) => a.toLowerCase());
  const isNautical =
    input.isNautical ||
    activityList.some((act) =>
      ["nautique", "plage", "surf", "baignade", "piscine", "spa", "jacuzzi", "beach"].some((k) =>
        act.includes(k)
      )
    );

  if (isNautical) {
    items.push({ label: "Maillot de bain", category: "vetements", essential: true });
    items.push({ label: "Serviette de plage en microfibre", category: "divers", essential: true });
    items.push({ label: "Tongs ou sandales de plage", category: "vetements", essential: false });
  }

  const isSporty = activityList.some((act) =>
    ["sport", "randonnee", "randonnée", "trek", "escalade", "velo", "vélo", "aventure", "nature"].some((k) =>
      act.includes(k)
    )
  );

  if (isSporty) {
    items.push({ label: "Chaussures de marche ou de sport adaptées", category: "vetements", essential: true });
    items.push({ label: "Tenue de sport respirante", category: "vetements", essential: false });
  }

  const isUrbanOrNight =
    activityList.some((act) =>
      ["visite", "musee", "musée", "monument", "culturel", "shopping", "urbain"].some((k) =>
        act.includes(k)
      )
    ) ||
    activityList.some((act) =>
      ["bar", "boite", "boîte", "club", "fete", "fête", "resto", "restaurant", "soiree", "soirée"].some((k) =>
        act.includes(k)
      )
    ) ||
    ["evg", "evjf", "anniversaire"].includes(String(input.eventType).toLowerCase());

  if (isUrbanOrNight) {
    items.push({ label: "Chaussures confortables pour marcher en ville", category: "vetements", essential: true });
    items.push({ label: "Tenue habillée pour les soirées", category: "vetements", essential: false });
  }

  return items;
}
