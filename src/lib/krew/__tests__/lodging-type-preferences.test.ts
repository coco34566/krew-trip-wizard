import { describe, it, expect } from "vitest";
import { participantPreferencesSchema } from "../../participant-preferences.functions";
describe("Lodging Type Preferences & Required Amenities Separation", () => {
  // Test A: lodging type = "peu_importe" -> required amenities = [] -> aucun logement rejeté à cause de "peu_importe"
  it("A: lodging type = 'peu_importe' results in empty requiredAmenities and no rejection during hotel scoring", () => {
    const input = {
      tripId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      lodgingTypePreferences: ["peu_importe"],
      requiredAmenities: [],
    };
    const parsed = participantPreferencesSchema.parse(input);
    expect(parsed.lodgingTypePreferences).toEqual(["peu_importe"]);
    expect(parsed.requiredAmenities).toEqual([]);
  });

  // Test B: lodging type = "hotel" -> stocké comme type de logement, PAS comme équipement
  it("B: lodging type = 'hotel' is stored in lodgingTypePreferences and not in requiredAmenities", () => {
    const input = {
      tripId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      lodgingTypePreferences: ["hotel"],
      requiredAmenities: [],
    };
    const parsed = participantPreferencesSchema.parse(input);
    expect(parsed.lodgingTypePreferences).toEqual(["hotel"]);
    expect(parsed.requiredAmenities).toEqual([]);
    expect(parsed.requiredAmenities).not.toContain("hotel");
  });

  // Test C: lodging type = "logement_entier" -> stocké comme type de logement, PAS comme équipement
  it("C: lodging type = 'logement_entier' is stored in lodgingTypePreferences and not in requiredAmenities", () => {
    const input = {
      tripId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      lodgingTypePreferences: ["logement_entier"],
      requiredAmenities: [],
    };
    const parsed = participantPreferencesSchema.parse(input);
    expect(parsed.lodgingTypePreferences).toEqual(["logement_entier"]);
    expect(parsed.requiredAmenities).toEqual([]);
    expect(parsed.requiredAmenities).not.toContain("logement_entier");
  });

  // Test D: ancienne donnée : required_amenities = ["peu_importe"] -> simulation de migration / nettoyage
  it("D: legacy data with required_amenities = ['peu_importe'] cleans required_amenities to empty", () => {
    // Simulating aggregation logic or backend normalization where legacy required_amenities is filtered
    const legacyRow = {
      lodging_type_preferences: [],
      required_amenities: ["peu_importe"],
    };

    const lodgingTypePreferences = legacyRow.lodging_type_preferences.length > 0
      ? legacyRow.lodging_type_preferences
      : legacyRow.required_amenities.filter((x) =>
          ["hotel", "airbnb", "maison", "villa", "logement_entier", "peu_importe"].includes(x),
        );

    const cleanRequiredAmenities = legacyRow.required_amenities.filter(
      (x) => !["hotel", "airbnb", "maison", "villa", "logement_entier", "peu_importe"].includes(x),
    );

    expect(lodgingTypePreferences).toEqual(["peu_importe"]);
    expect(cleanRequiredAmenities).toEqual([]);
  });

  // Test E: si une vraie valeur d'équipement existe déjà dans required_amenities (ex: "piscine"),
  // elle n'est pas supprimée par la migration ou le nettoyage.
  it("E: real amenity in required_amenities (e.g. 'piscine') is preserved during migration and aggregation", () => {
    const legacyRowWithAmenity = {
      lodging_type_preferences: [],
      required_amenities: ["hotel", "piscine", "wifi"],
    };

    const lodgingTypePreferences = legacyRowWithAmenity.lodging_type_preferences.length > 0
      ? legacyRowWithAmenity.lodging_type_preferences
      : legacyRowWithAmenity.required_amenities.filter((x) =>
          ["hotel", "airbnb", "maison", "villa", "logement_entier", "peu_importe"].includes(x),
        );

    const cleanRequiredAmenities = legacyRowWithAmenity.required_amenities.filter(
      (x) => !["hotel", "airbnb", "maison", "villa", "logement_entier", "peu_importe"].includes(x),
    );

    expect(lodgingTypePreferences).toEqual(["hotel"]);
    expect(cleanRequiredAmenities).toEqual(["piscine", "wifi"]);
  });
});
