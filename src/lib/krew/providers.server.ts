/**
 * Couche d'accès aux données voyage (serveur uniquement).
 *
 * Architecture volontairement "provider based" : le catalogue interne
 * (tables `destinations` / `activities` / `accommodations`) est la source par
 * défaut, et chaque fournisseur externe (Amadeus, Booking, GetYourGuide,
 * OpenWeather…) peut être branché ici sans toucher au moteur ni à l'UI.
 *
 * Pour brancher une API réelle :
 *   1. ajouter la clé via les secrets du projet (ex. AMADEUS_API_KEY) ;
 *   2. implémenter un `TravelDataProvider` ci-dessous ;
 *   3. l'ajouter à `activeProviders()` — les résultats sont fusionnés au
 *      catalogue avant scoring, et peuvent être persistés en base (upsert sur
 *      `source` + `external_id`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TravelCatalog } from "./engine";

export type CatalogQuery = {
  maxDistanceKm: number;
  excludedCountries: string[];
  participants: number;
  nights: number;
  startDate?: string | null;
};

export interface TravelDataProvider {
  name: string;
  /** Renvoie un catalogue partiel à fusionner avec les autres sources. */
  fetchCatalog(query: CatalogQuery): Promise<Partial<TravelCatalog>>;
}

/** Source interne : base Krew (alimentée par seed puis par les synchronisations). */
export function createInternalProvider(supabase: SupabaseClient): TravelDataProvider {
  return {
    name: "krew_internal",
    async fetchCatalog(query) {
      const [destinations, activities, accommodations] = await Promise.all([
        supabase
          .from("destinations")
          .select("*")
          .lte("distance_from_paris_km", Math.round(query.maxDistanceKm * 1.15)),
        supabase.from("activities").select("*"),
        supabase.from("accommodations").select("*"),
      ]);
      if (destinations.error) throw destinations.error;
      return {
        destinations: (destinations.data ?? []) as TravelCatalog["destinations"],
        activities: (activities.data ?? []) as TravelCatalog["activities"],
        accommodations: (accommodations.data ?? []) as TravelCatalog["accommodations"],
      };
    },
  };
}

/**
 * Emplacements réservés aux fournisseurs externes. Ils restent inactifs tant
 * que la clé d'API correspondante n'est pas configurée, ce qui permet de
 * livrer une v1 fonctionnelle puis d'ajouter les données live sans refonte.
 */
export function externalProviders(): TravelDataProvider[] {
  const providers: TravelDataProvider[] = [];
  // Vols / trains / transferts (ex. Amadeus, Kiwi, SNCF Connect)
  if (process.env["AMADEUS_API_KEY"]) {
    providers.push({
      name: "amadeus_transport",
      async fetchCatalog() {
        // TODO: appeler l'API vols/trains et enrichir le coût transport.
        return {};
      },
    });
  }
  // Hébergements (ex. Booking, Expedia Rapid, Airbnb partner)
  if (process.env["BOOKING_API_KEY"]) {
    providers.push({
      name: "booking_accommodations",
      async fetchCatalog() {
        return {};
      },
    });
  }
  // Activités (ex. GetYourGuide, Viator, Musement)
  if (process.env["GETYOURGUIDE_API_KEY"]) {
    providers.push({
      name: "gyg_activities",
      async fetchCatalog() {
        return {};
      },
    });
  }
  return providers;
}

/** Fusionne toutes les sources actives en un catalogue unique. */
export async function loadTravelCatalog(
  supabase: SupabaseClient,
  query: CatalogQuery,
): Promise<TravelCatalog> {
  const providers = [createInternalProvider(supabase), ...externalProviders()];
  const results = await Promise.all(
    providers.map(async (p) => {
      try {
        return await p.fetchCatalog(query);
      } catch (error) {
        console.error(`[krew] provider ${p.name} failed`, error);
        return {} as Partial<TravelCatalog>;
      }
    }),
  );
  return {
    destinations: results.flatMap((r) => r.destinations ?? []),
    activities: results.flatMap((r) => r.activities ?? []),
    accommodations: results.flatMap((r) => r.accommodations ?? []),
  };
}