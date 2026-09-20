import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aggregateParticipantPreferences } from "@/lib/krew/trip-service";
import { resolveActivityResourceUrl, resolveActivityResourceForPlace } from "@/lib/krew/activity-ai.server";
import { STAY_PROFILE_IDS, type StayProfileId } from "@/lib/krew/stay-profiles";
import { assertNotRateLimited } from "@/lib/krew/rate-limit.server";
import { isTripAdmin } from "@/lib/krew/engine";
import { buildFinalItinerarySlot, isSameSuggestedPlace } from "./helpers";

export const generateGroupItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), force: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const tripRes = await supabase.from("trips").select("*").eq("id", data.tripId).maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    const trip = tripRes.data as any;
    if (!isTripAdmin(trip, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut générer le planning",
      );
    }

    // Réserve le quota seulement après autorisation, pour qu'un tiers ne puisse pas l'épuiser.
    const isForced = data.force === true && process.env["ALLOW_FORCE_GENERATION"] === "true";
    if (!isForced) {
      const tripWindow = Number(process.env["RATE_LIMIT_ITINERARY_WINDOW_SEC"]) || 300;
      const tripMax = Number(process.env["RATE_LIMIT_ITINERARY_MAX"]) || 1;
      await assertNotRateLimited(supabase, {
        tripId: data.tripId,
        userId,
        kind: "itinerary",
        windowSeconds: tripWindow,
        maxCalls: tripMax,
      });
    }

    const [partsRes, timePrefsRes] = await Promise.all([
      supabase.from("trip_participants").select("*").eq("trip_id", data.tripId),
      supabase
        .from("trip_transport_time_prefs")
        .select("participant_id, earliest_departure_time, latest_return_time")
        .eq("trip_id", data.tripId),
    ]);
    const participants = (partsRes.data ?? []).filter((p: any) => p.status !== "absent");

    const selected = await supabase
      .from("recommendations")
      .select("id, destination_id, activity_ids, match_reasons, score, budget, destinations(name, country)")
      .eq("trip_id", data.tripId)
      .eq("is_selected", true)
      .maybeSingle();
    if (selected.error) throw selected.error;
    if (!selected.data) {
      throw new Error("Valide d'abord une destination avant de générer les activités");
    }

    const destName =
      (selected.data as any).destinations?.name || trip.desired_destination || "Destination";
    const destCountry = (selected.data as any).destinations?.country || null;

    const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);

    let nights = Number(trip.duration_nights) || 2;
    if (trip.start_date && trip.end_date) {
      const ms =
        new Date(trip.end_date + "T12:00:00Z").getTime() -
        new Date(trip.start_date + "T12:00:00Z").getTime();
      const d = Math.round(ms / (24 * 3600 * 1000));
      if (d >= 1) nights = d;
    }

    // Labels depuis activités catalogue liées à la reco
    const activityIds = ((selected.data as any).activity_ids ?? []) as string[];
    let seedLabels: string[] = [];
    if (activityIds.length) {
      const acts = await supabase.from("activities").select("name, category").in("id", activityIds);
      seedLabels = (acts.data ?? []).map((a: any) => a.name).filter(Boolean);
    }

    const recoRow = selected.data as any;
    const matchReasons = Array.isArray(recoRow.match_reasons)
      ? recoRow.match_reasons.map(String)
      : [];
    const { generateItineraryWithAi, aggregateMajorityTimePreference } =
      await import("@/lib/krew/activity-ai.server");
    const logistics = (trip.group_logistics || {}) as any;
    const picks = Array.isArray(logistics.transportPicks) ? logistics.transportPicks : [];
    // Les horaires de transport retenus priment. À défaut, le calcul part des
    // contraintes de départ/retour et de la durée porte-à-porte conservée.
    const arrivals = picks.map((p: any) => p.arrivalTime || p.time).filter(Boolean) as string[];
    const departures = picks.map((p: any) => p.departureTime).filter(Boolean) as string[];

    let latestArrival: string | null = null;
    let earliestReturn: string | null = null;

    if (arrivals.length > 0) {
      const sortedArrivals = [...arrivals].sort();
      latestArrival = sortedArrivals.at(-1) || null;
    }

    if (departures.length > 0) {
      const sortedDepartures = [...departures].sort();
      earliestReturn = sortedDepartures[0] || null;
    }

    const { getEffectiveParticipantsCount } = await import("@/lib/krew/trip-service");
    const effCount = getEffectiveParticipantsCount(trip, participants);

    // Ordinary answers are collective preferences: KREW uses the group
    // median/majority, not a value compatible with every respondent.
    // Planning initial window relies strictly on explicit group destination times or official 18:30 / 16:30 fallbacks.
    const activeParticipantIds = new Set(participants.map((p: any) => p.id));
    const activeTimePrefs = (timePrefsRes.data ?? []).filter((row: any) =>
      row.participant_id ? activeParticipantIds.has(row.participant_id) : true,
    );
    const groupEarliestDeparture = aggregateMajorityTimePreference(
      activeTimePrefs.map((row: any) => row.earliest_departure_time),
    );
    const groupLatestReturnHome = aggregateMajorityTimePreference(
      activeTimePrefs.map((row: any) => row.latest_return_time),
    );
    const retainedDurations = picks
      .map((pick: any) => Number(pick.durationHours))
      .filter((duration: number) => Number.isFinite(duration) && duration > 0);
    const transportDurationHours = retainedDurations.length ? Math.max(...retainedDurations) : null;
    const tripProfile =
      aggregated.stayConcepts?.[0]?.title ?? aggregated.stayProfileAffinities?.[0]?.id ?? null;

    let knownAccommodationPerPerson: number | null = null;
    const selectedHotelId = logistics.selectedHotelId;
    const hotelsList = Array.isArray(logistics.hotels) ? logistics.hotels : [];
    if (selectedHotelId) {
      const matchHotel = hotelsList.find((h: any) => h.id === selectedHotelId);
      if (
        matchHotel &&
        matchHotel.pricePerPerson != null &&
        Number.isFinite(Number(matchHotel.pricePerPerson)) &&
        matchHotel.priceStatus !== "unknown"
      ) {
        knownAccommodationPerPerson = Number(matchHotel.pricePerPerson);
      }
    }
    if (
      knownAccommodationPerPerson == null &&
      recoRow.budget?.accommodation != null &&
      Number.isFinite(Number(recoRow.budget.accommodation)) &&
      Number(recoRow.budget.accommodation) > 0
    ) {
      knownAccommodationPerPerson = Number(recoRow.budget.accommodation);
    }

    const hasStar = Boolean(trip.has_star && (trip.star_user_id || logistics.star_mode));
    const starPaysShare = logistics.star_pays_share !== false;

    let knownTransportPerPerson: number | null = null;
    if (picks.length > 0) {
      const validPickPrices = picks
        .map((p: any) => Number(p.pricePerPerson))
        .filter((p: number) => Number.isFinite(p) && p > 0);
      if (validPickPrices.length > 0) {
        knownTransportPerPerson = Math.round(
          validPickPrices.reduce((a: number, b: number) => a + b, 0) / validPickPrices.length,
        );
      }
    }
    if (
      knownTransportPerPerson == null &&
      recoRow.budget?.transport != null &&
      Number.isFinite(Number(recoRow.budget.transport)) &&
      Number(recoRow.budget.transport) > 0
    ) {
      knownTransportPerPerson = Number(recoRow.budget.transport);
    }

    const activityInput: import("@/lib/krew/activity-ai.server").ActivityAiInput = {
      destination: destName,
      country: destCountry,
      startDate: trip.start_date,
      endDate: trip.end_date,
      nights,
      participants: effCount,
      budgetPerPerson:
        Number(aggregated.aggregatedBudget) || Number(trip.budget_per_person) || 400,
      accommodationPerPerson: knownAccommodationPerPerson,
      transportPerPerson: knownTransportPerPerson,
      hasStar,
      starPaysShare,
      eventType: trip.event_type,
      tripProfile,
      ambiances: aggregated.ambiances ?? [],
      activityCategories: aggregated.activityCategories ?? [],
      starWanted: aggregated.starWantedActivities ?? [],
      dietaryConstraints: aggregated.dietaryConstraints ?? [],
      travelPace: aggregated.medianTravelPace,
      preferredTimeSlots: aggregated.preferredTimeSlots ?? [],
      matchReasons,
      destinationScore: recoRow.score != null ? Number(recoRow.score) : null,
      scoredActivityLabels: seedLabels,
      latestGroupArrival: latestArrival,
      earliestGroupDeparture: earliestReturn,
      latestReturnHome: groupLatestReturnHome,
      earliestOutboundDeparture: groupEarliestDeparture,
      transportDurationHours,
      forceDiscoveryRefresh: data.force === true,
      transportPicksSummary: picks.slice(0, 12).map((p: any) => ({
        city: p.city,
        mode: p.modeLabel || p.mode,
        outboundDeparture: p.outboundDepartureTime,
        arrival: p.arrivalTime || p.time,
        departure: p.departureTime,
        returnArrival: p.returnArrivalTime,
        durationHours: p.durationHours,
      })),
      individualPreferences: aggregated.individualPreferences,
      groupAgeRange: aggregated.groupAgeRange ?? null,
      groupAccommodationRole: aggregated.groupAccommodationRole ?? null,
      starWantedEnvType: aggregated.starWantedEnvType ?? null,
      wantedEnvTypes: aggregated.wantedEnvTypes ?? [],
      activityCategoryFrequencies: aggregated.activityCategoryFrequencies,
      ambianceFrequencies: aggregated.ambianceFrequencies,
      dealBreakerAmbiances: aggregated.dealBreakerAmbiances,
      starDealBreakers: aggregated.starDealBreakers,
      validatedTripProfiles: (() => {
        const selected = (trip.stay_concepts_selected ?? []) as any[];
        if (Array.isArray(selected) && selected.length > 0) {
          const extractedIds = selected
            .flatMap((c: any) => (Array.isArray(c.profiles) ? c.profiles : [c.id]))
            .filter((id: any): id is StayProfileId =>
              (STAY_PROFILE_IDS as readonly string[]).includes(id),
            );
          const uniqueIds = [...new Set(extractedIds)];
          if (uniqueIds.length > 0) return uniqueIds;
        }
        return (STAY_PROFILE_IDS as readonly string[]).includes(tripProfile as any)
          ? [tripProfile as StayProfileId]
          : [];
      })(),
      localMobility: aggregated.groupLocalMobility,
      accessibilityRequired: (aggregated.individualPreferences ?? []).some(
        (preference: any) => preference?.accessibilityRequired === true,
      ),
    };

    const { buildKrewSkeleton, geminiEnrichSkeleton } = await import(
      "@/lib/krew/activity-ai.server"
    );
    const {
      determineSearchRadiusMeters,
    } = await import("@/lib/krew/geoapify.server");

    // 1. Build deterministic KREW Skeleton
    const krewSkeleton = buildKrewSkeleton(activityInput);

    // 2. Single Gemini call to enrich skeleton
    const enrichResult = await geminiEnrichSkeleton(krewSkeleton, activityInput);
    const enrichedSkeleton = enrichResult.enrichedSkeleton;

    // Resolve reference coordinates (accommodation when centerpiece/part_of_stay, else destination)
    let refLat: number | null = null;
    let refLon: number | null = null;
    let accLat: number | null = null;
    let accLon: number | null = null;

    let verifiedAmenities: string[] = [];
    const accRole = aggregated.groupAccommodationRole;
    const selectedAccId = logistics.selectedHotelId;

    if (selectedAccId) {
      const accRes = await supabase
        .from("accommodations")
        .select("latitude, longitude, amenities")
        .eq("id", selectedAccId)
        .maybeSingle();

      if (accRes.data) {
        if (accRes.data.latitude != null && accRes.data.longitude != null) {
          accLat = Number(accRes.data.latitude);
          accLon = Number(accRes.data.longitude);
          if (accRole === "centerpiece" || accRole === "part_of_stay") {
            refLat = accLat;
            refLon = accLon;
          }
        }
        if (Array.isArray(accRes.data.amenities)) {
          verifiedAmenities = accRes.data.amenities.map(String).filter(Boolean);
        } else if (typeof accRes.data.amenities === "string") {
          verifiedAmenities = [accRes.data.amenities].filter(Boolean);
        }
      }
    }

    activityInput.verifiedLodgingAmenities = verifiedAmenities;

    if (refLat == null || refLon == null) {
      if (recoRow.destination_id) {
        const destRes = await supabase
          .from("destinations")
          .select("latitude, longitude")
          .eq("id", recoRow.destination_id)
          .maybeSingle();
        if (destRes.data?.latitude != null && destRes.data?.longitude != null) {
          refLat = Number(destRes.data.latitude);
          refLon = Number(destRes.data.longitude);
        }
      }
    }
    // Fallback geocoding if coordinates not in DB
    if (refLat == null || refLon == null) {
      try {
        const { geocodeDestination } = await import(
          "@/integrations/external/geo-weather.server"
        );
        const geo = await geocodeDestination(
          destCountry ? `${destName}, ${destCountry}` : destName,
        );
        if (geo) {
          refLat = geo.latitude;
          refLon = geo.longitude;
        }
      } catch {
        /* geocoding optional */
      }
    }

    const radiusMeters = determineSearchRadiusMeters(
      aggregated.groupLocalMobility,
      tripProfile,
    );

    // 3. Collect place_required needs and build Geoapify place pools via buildGeoapifyPlacePools
    const {
      searchGeoapifyPlaces,
      convertIntentToPlaceRequirements,
      buildBasePoolKey,
      buildPoolKey,
      buildGeoapifyPlacePools,
      rankGeoapifyCandidates,
      mergeUniquePlacesById,
      fetchPlaceDetails,
      resolveSearchIntentLocation,
      tryResolveGeminiProposedPlace,
      buildVerifiedPlaceFallbackUrl,
    } = await import("@/lib/krew/geoapify.server");

    let intentResolutionCalls = 0;
    let intentResolutionHits = 0;
    let intentCenteredSearches = 0;
    let basePoolSearches = 0;
    let intentSupplementSearches = 0;
    let geoapifyPlacesCalls = 0;
    let geoapifyDetailsCalls = 0;

    const requirementsList: import("@/lib/krew/geoapify.server").PlaceRequirements[] = [];

    for (const day of enrichedSkeleton.days) {
      for (const slot of day.slots) {
        if (slot.kind === "place_required") {
          const intentCenter = await resolveSearchIntentLocation(
            slot.searchIntent,
            destName,
            refLat,
            refLon,
            {
              get intentResolutionCalls() { return intentResolutionCalls; },
              set intentResolutionCalls(v) { intentResolutionCalls = v; },
              get intentResolutionHits() { return intentResolutionHits; },
              set intentResolutionHits(v) { intentResolutionHits = v; },
            },
          );

          const req = convertIntentToPlaceRequirements(
            slot.venueFamily || "local_experience",
            slot.category,
            slot.searchIntent,
            aggregated.dietaryConstraints,
            Boolean(activityInput.accessibilityRequired),
            activityInput.individualPreferences?.map((p: any) => p?.mobilityNotes).filter(Boolean) || [],
            intentCenter,
            slot.suggestedPlace || slot.label,
            destName,
          );

          requirementsList.push(req);
        }
      }
    }

    const placePoolsTelemetry = {
      get basePoolSearches() { return basePoolSearches; },
      set basePoolSearches(v) { basePoolSearches = v; },
      get intentSupplementSearches() { return intentSupplementSearches; },
      set intentSupplementSearches(v) { intentSupplementSearches = v; },
      get intentCenteredSearches() { return intentCenteredSearches; },
      set intentCenteredSearches(v) { intentCenteredSearches = v; },
      get geoapifyPlacesCalls() { return geoapifyPlacesCalls; },
      set geoapifyPlacesCalls(v) { geoapifyPlacesCalls = v; },
    };

    const placePools = await buildGeoapifyPlacePools({
      requirementsList,
      destinationCenter: refLat != null && refLon != null ? { latitude: refLat, longitude: refLon } : null,
      radiusMeters,
      telemetry: placePoolsTelemetry,
    });

    // 5. Match Geoapify places to place_required slots from persisted pools
    const usedCandidateIdsSet = new Set<string>();
    const daysPlans: import("@/lib/krew/activity-ai.server").ItineraryDayPlan[] = [];

    let poolHits = 0;
    let poolMisses = 0;
    let candidatesRejectedOpeningHours = 0;
    let candidatesRejectedGeography = 0;
    let candidatesRejectedRequirements = 0;
    let placeRequiredResolved = 0;
    let placeRequiredUnresolved = 0;
    let placeRequiredBypassed = 0;
    let fallbackMapLinks = 0;

    for (const day of enrichedSkeleton.days) {
      let lastSlotCoords: { latitude?: number | null; longitude?: number | null } | null =
        refLat != null && refLon != null ? { latitude: refLat, longitude: refLon } : null;

      const slots: import("@/lib/krew/activity-ai.server").ActivitySlot[] = [];

      for (const s of day.slots) {
        const mode = (await import("@/lib/krew/activity-ai.server")).classifyActivityMode({
          kind: s.kind,
          category: s.category,
          venueFamily: s.venueFamily,
          searchIntent: s.searchIntent,
          label: s.label,
        });

        const { shouldResolveWithPlaceProvider } = await import("@/lib/krew/activity-ai.server");
        const resolveWithPlaceProvider = shouldResolveWithPlaceProvider({
          kind: s.kind,
          activityMode: mode,
        });

        if (!resolveWithPlaceProvider) {
          let ideasUrl: string | null = null;
          let ideasKind: "ideas" | null = null;

          if (
            mode === "self_guided_group" &&
            s.kind !== "place_required" &&
            s.type !== "resto" &&
            s.category !== "repas" &&
            s.locationContext !== "external"
          ) {
            const { findIdeasResourceForActivity } = await import("@/lib/krew/activity-discovery.server");
            const foundUrl = await findIdeasResourceForActivity({
              label: s.label,
              searchIntent: s.searchIntent,
              eventType: trip.event_type,
              kind: s.kind,
              type: s.type,
              category: s.category,
              locationContext: s.locationContext,
            });
            if (foundUrl) {
              const resLink = resolveActivityResourceUrl(foundUrl, { kindHint: "ideas" });
              ideasUrl = resLink.url;
              ideasKind = resLink.resourceKind === "ideas" ? "ideas" : null;
            }
          }

          slots.push({
            moment: s.moment,
            time: s.time,
            endTime: s.endTime,
            durationMinutes: s.durationMinutes,
            type: s.type,
            category: s.category,
            label: s.label,
            detail: s.detail,
            locationContext: s.locationContext,
            activityMode: mode === "free_exploration" ? "free_exploration" : "self_guided_group",
            verified: false,
            source: "krew",
            url: ideasUrl,
            resourceKind: ideasKind,
            estimatedPriceMinPerPerson: (s as any).estimatedPriceMinPerPerson ?? null,
            estimatedPriceMaxPerPerson: (s as any).estimatedPriceMaxPerPerson ?? null,
            estimatedPriceCurrency: (s as any).estimatedPriceCurrency ?? null,
          });

          // Reset spatial reference to lodging ONLY when locationContext === "lodging"
          if (accLat != null && accLon != null && s.locationContext === "lodging") {
            lastSlotCoords = { latitude: accLat, longitude: accLon };
          }
          continue;
        }

        const intentCenter = await resolveSearchIntentLocation(
          s.searchIntent,
          destName,
          refLat,
          refLon,
          {
            get intentResolutionCalls() { return intentResolutionCalls; },
            set intentResolutionCalls(v) { intentResolutionCalls = v; },
            get intentResolutionHits() { return intentResolutionHits; },
            set intentResolutionHits(v) { intentResolutionHits = v; },
          },
        );

        const req = convertIntentToPlaceRequirements(
          s.venueFamily || "local_experience",
          s.category,
          s.searchIntent,
          aggregated.dietaryConstraints,
          Boolean(activityInput.accessibilityRequired),
          activityInput.individualPreferences?.map((p: any) => p?.mobilityNotes).filter(Boolean) || [],
          intentCenter,
          (s as any).suggestedPlace || s.label,
          destName,
        );
        const poolKey = buildPoolKey(req);
        let pool = placePools[poolKey] || [];

        const telemetryObj = {
          candidatesRejectedRequirements: 0,
          candidatesRejectedGeography: 0,
          candidatesRejectedOpeningHours: 0,
          detailsCalls: geoapifyDetailsCalls,
          fallbackMapLinks: 0,
        };

        const { selectGeoapifyCandidate } = await import("@/lib/krew/geoapify.server");

        let matchedPlace = null;
        let matchedSource: string = "geoapify";

        // Step A & B: Try resolving Gemini's proposed place first if provided and concrete
        if (s.kind === "place_required") {
          const proposedCandidate = await tryResolveGeminiProposedPlace({
            suggestedPlace: (s as any).suggestedPlace,
            label: s.label,
            suggestedUrl: (s as any).suggestedUrl,
            searchIntent: s.searchIntent,
            venueFamily: s.venueFamily,
            destination: destName,
            refLat: intentCenter?.latitude ?? refLat,
            refLon: intentCenter?.longitude ?? refLon,
          });
          const sp = (s as any).suggestedPlace;
          if (proposedCandidate && isSameSuggestedPlace(sp, proposedCandidate.name)) {
            matchedPlace = proposedCandidate;
            matchedSource = "gemini_geoapify";
            poolHits++;
          }
        }

        // Step C: Fallback to Geoapify candidate pool
        if (!matchedPlace && s.kind === "place_required") {
          const candidate = await selectGeoapifyCandidate({
            candidates: pool,
            req,
            usedCandidateIdsSet,
            refCoords: lastSlotCoords,
            maxKm: 50,
            date: day.date,
            time: s.time,
            durationMinutes: s.durationMinutes ?? 90,
            accessibilityRequired: Boolean(activityInput.accessibilityRequired),
            telemetry: telemetryObj,
          });

          const sp = (s as any).suggestedPlace;
          if (candidate && isSameSuggestedPlace(sp, candidate.name)) {
            matchedPlace = candidate;
            poolHits++;
            matchedSource = "geoapify";
          } else if (refLat != null && refLon != null) {
            poolMisses++;
            geoapifyPlacesCalls++;
            const newPlaces = await searchGeoapifyPlaces({
              categories: req.categories,
              latitude: refLat,
              longitude: refLon,
              radiusMeters: radiusMeters * 1.5,
              limit: 15,
              conditions: req.accessibility || [],
            });
            if (newPlaces.length > 0) {
              placePools[poolKey] = mergeUniquePlacesById(pool, newPlaces);
              pool = placePools[poolKey]!;
              const searchCandidate = await selectGeoapifyCandidate({
                candidates: pool,
                req,
                usedCandidateIdsSet,
                refCoords: lastSlotCoords,
                maxKm: 50,
                date: day.date,
                time: s.time,
                durationMinutes: s.durationMinutes ?? 90,
                accessibilityRequired: Boolean(activityInput.accessibilityRequired),
                telemetry: telemetryObj,
              });
              if (searchCandidate && isSameSuggestedPlace(sp, searchCandidate.name)) {
                matchedPlace = searchCandidate;
                matchedSource = "geoapify";
              }
            }
          }
        }

        if (s.kind === "place_required") {
          if (matchedPlace) {
            placeRequiredResolved++;
          } else {
            placeRequiredUnresolved++;
          }
        }

        // Rejection counters and details calls are ALWAYS accumulated after selection attempt regardless of matchedPlace
        candidatesRejectedRequirements += telemetryObj.candidatesRejectedRequirements;
        candidatesRejectedGeography += telemetryObj.candidatesRejectedGeography;
        candidatesRejectedOpeningHours += telemetryObj.candidatesRejectedOpeningHours;
        geoapifyDetailsCalls = telemetryObj.detailsCalls;

        if (matchedPlace) {
          usedCandidateIdsSet.add(matchedPlace.id);
          if (matchedPlace.latitude != null && matchedPlace.longitude != null) {
            lastSlotCoords = { latitude: matchedPlace.latitude, longitude: matchedPlace.longitude };
          }

          const resolvedResource = resolveActivityResourceForPlace(matchedPlace, destName, { telemetry: telemetryObj });
          fallbackMapLinks += telemetryObj.fallbackMapLinks;

          slots.push(
            buildFinalItinerarySlot({
              slot: s,
              matchedPlace,
              matchedSource,
              mode,
              resolvedResource,
            }),
          );
        } else {
          const { findWebResourceForComplexActivity } = await import(
            "@/lib/krew/activity-discovery.server"
          );

          const webUrl = await findWebResourceForComplexActivity({
            label: (s as any).suggestedPlace || s.label,
            searchIntent: s.searchIntent,
            destination: destName,
            category: s.category,
            venueFamily: s.venueFamily,
            eventType: trip.event_type,
          });

          if (webUrl) {
            slots.push(
              buildFinalItinerarySlot({
                slot: s,
                webUrl,
              }),
            );
          } else {
            const fallbackMapUrl = buildVerifiedPlaceFallbackUrl(
              { name: s.label, address: destName },
              destName,
            );

            slots.push(
              buildFinalItinerarySlot({
                slot: s,
                fallbackMapUrl,
              }),
            );
          }
        }
      }

      daysPlans.push({
        day: day.day,
        date: day.date ?? null,
        slots,
      });
    }

    const { adjustItineraryTransferTimes } = await import(
      "@/lib/krew/activity-ai.server"
    );
    const timeCoherentDays = adjustItineraryTransferTimes(daysPlans, activityInput);

    const telemetry = {
      geminiCalls: enrichResult.geminiCalled ? 1 : (enrichResult.usedLlm ? 1 : 0),
      geoapifyPlacesCalls,
      geoapifyDetailsCalls,
      poolHits,
      poolMisses,
      candidatesRejectedOpeningHours,
      candidatesRejectedGeography,
      candidatesRejectedRequirements,
      placeRequiredResolved,
      placeRequiredUnresolved,
      placeRequiredBypassed,
      intentResolutionCalls,
      intentResolutionHits,
      intentCenteredSearches,
      basePoolSearches,
      intentSupplementSearches,
      fallbackMapLinks,
    };

    console.info("krew-planning-telemetry", telemetry);

    const rawItinerary: import("@/lib/krew/activity-ai.server").GroupItinerary = {
      destination: destName,
      nights,
      days: timeCoherentDays,
      source: "ai",
      provider: "krew_geoapify",
      generatedAt: new Date().toISOString(),
      placePools,
      usedCandidateIds: Array.from(usedCandidateIdsSet),
      skeleton: enrichedSkeleton,
      telemetry,
    };

    const { enrichGroupItineraryWithGetYourGuide } = await import(
      "@/lib/krew/getyourguide.server"
    );
    const affiliateItinerary = enrichGroupItineraryWithGetYourGuide(rawItinerary);
    const { normalizeItineraryPricesToEur } = await import("@/lib/krew/currency.server");
    const finalItinerary = await normalizeItineraryPricesToEur(affiliateItinerary);

    const { error } = await supabase
      .from("trips")
      .update({
        group_itinerary: finalItinerary,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId);
    if (error) throw error;

    return {
      ok: true,
      usedLlm: enrichResult.usedLlm,
      error: enrichResult.error,
      itinerary: finalItinerary,
    };
  });

export const regenerateItinerarySlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        day: z.number().int().min(1).max(21),
        slotIndex: z.number().int().min(0).max(20),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [tripRes, partsRes] = await Promise.all([
      supabase
        .from("trips")
        .select(
          "id, owner_id, co_organizer_id, group_itinerary, group_logistics, start_date, end_date, duration_nights, participants_count, budget_per_person, event_type, celebrated_person, has_star, star_user_id",
        )
        .eq("id", data.tripId)
        .maybeSingle(),
      supabase.from("trip_participants").select("*").eq("trip_id", data.tripId),
    ]);
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    if (!isTripAdmin(tripRes.data, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut régénérer un créneau",
      );
    }
    const participants = (partsRes.data ?? []).filter((p: any) => p.status !== "absent");

    const itinerary = (tripRes.data as any).group_itinerary as {
      destination?: string;
      nights?: number;
      days?: { day: number; date?: string | null; slots: any[] }[];
      source?: string;
      generatedAt?: string;
      placePools?: Record<string, any[]>;
      usedCandidateIds?: string[];
      skeleton?: import("@/lib/krew/activity-ai.server").KrewSkeleton;
    } | null;
    if (!itinerary?.days?.length) {
      throw new Error("Aucun planning à modifier — génère d'abord les activités");
    }

    const dayPlan = itinerary.days.find((d) => d.day === data.day) || itinerary.days[data.day - 1];
    if (!dayPlan?.slots?.[data.slotIndex]) {
      throw new Error("Créneau introuvable");
    }
    const current = dayPlan.slots[data.slotIndex];
    const avoidLabels = dayPlan.slots.map((s) => s.label).filter(Boolean);
    const usedIdsSet = new Set<string>(itinerary.usedCandidateIds ?? []);

    if (current.candidateId) {
      usedIdsSet.add(current.candidateId);
    }

    const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);

    const isAccessibilityRequired = (aggregated.individualPreferences ?? []).some(
      (preference: any) => preference?.accessibilityRequired === true,
    );

    const {
      convertIntentToPlaceRequirements,
      buildPoolKey,
      searchGeoapifyPlaces,
      determineSearchRadiusMeters,
      selectGeoapifyCandidate,
      mergeUniquePlacesById,
    } = await import("@/lib/krew/geoapify.server");

    // 1. Build PlaceRequirements & canonical pool key
    const req = convertIntentToPlaceRequirements(
      current.venueFamily || "local_experience",
      current.category,
      current.searchIntent || current.label,
      aggregated.dietaryConstraints,
      isAccessibilityRequired,
      aggregated.individualPreferences?.map((p: any) => p?.mobilityNotes).filter(Boolean) || [],
      null,
      current.suggestedPlace || current.label,
      itinerary.destination || null,
    );
    const poolKey = buildPoolKey(req);

    if (!itinerary.placePools) {
      itinerary.placePools = {};
    }
    let pool = itinerary.placePools[poolKey] || [];

    // 2. Resolve coordinate reference hierarchy
    const logistics = ((tripRes.data as any).group_logistics || {}) as any;
    const accRole = aggregated.groupAccommodationRole;
    let refLat: number | null = null;
    let refLon: number | null = null;

    // Hierarchy: 1. Previous slot with coordinates in same day
    const prevSlots = dayPlan.slots.slice(0, data.slotIndex);
    for (let i = prevSlots.length - 1; i >= 0; i--) {
      const pSlot = prevSlots[i];
      if (pSlot?.latitude != null && pSlot?.longitude != null) {
        refLat = Number(pSlot.latitude);
        refLon = Number(pSlot.longitude);
        break;
      }
    }

    // 2. Selected accommodation coordinates (if centerpiece/part_of_stay)
    if (refLat == null || refLon == null) {
      if ((accRole === "centerpiece" || accRole === "part_of_stay") && logistics.selectedHotelId) {
        const accRes = await supabase
          .from("accommodations")
          .select("latitude, longitude")
          .eq("id", logistics.selectedHotelId)
          .maybeSingle();
        if (accRes.data?.latitude != null && accRes.data?.longitude != null) {
          refLat = Number(accRes.data.latitude);
          refLon = Number(accRes.data.longitude);
        }
      }
    }

    // 3. Selected destination coordinates
    if (refLat == null || refLon == null) {
      const recoRes = await supabase
        .from("recommendations")
        .select("destination_id, destinations(name, country, latitude, longitude)")
        .eq("trip_id", data.tripId)
        .eq("is_selected", true)
        .maybeSingle();

      const destData = (recoRes.data as any)?.destinations;
      if (destData?.latitude != null && destData?.longitude != null) {
        refLat = Number(destData.latitude);
        refLon = Number(destData.longitude);
      }

      // 4. Geocoding fallback
      if ((refLat == null || refLon == null) && destData?.name) {
        try {
          const { geocodeDestination } = await import(
            "@/integrations/external/geo-weather.server"
          );
          const geo = await geocodeDestination(
            destData.country ? `${destData.name}, ${destData.country}` : destData.name,
          );
          if (geo) {
            refLat = geo.latitude;
            refLon = geo.longitude;
          }
        } catch {
          /* geocoding optional */
        }
      }
    }

    const refCoords = refLat != null && refLon != null ? { latitude: refLat, longitude: refLon } : null;

    // 3. First selection pass on existing persisted pool via shared selector
    let matchedCandidate = await selectGeoapifyCandidate({
      candidates: pool,
      req,
      usedCandidateIdsSet: usedIdsSet,
      avoidList: avoidLabels,
      refCoords,
      maxKm: 50,
      date: dayPlan.date,
      time: current.time,
      durationMinutes: current.durationMinutes ?? 90,
      accessibilityRequired: isAccessibilityRequired,
    });

    // 4. If no candidate found, perform exactly 1 targeted Geoapify search (0 Gemini calls)
    if (!matchedCandidate && refLat != null && refLon != null) {
      const tripProfile = aggregated.stayConcepts?.[0]?.title ?? aggregated.stayProfileAffinities?.[0]?.id ?? null;
      const radiusMeters = determineSearchRadiusMeters(
        aggregated.groupLocalMobility,
        tripProfile,
      );

      const newPlaces = await searchGeoapifyPlaces({
        categories: req.categories,
        latitude: refLat,
        longitude: refLon,
        radiusMeters: radiusMeters * 1.5,
        limit: 15,
        conditions: req.accessibility || [],
      });

      if (newPlaces.length > 0) {
        pool = mergeUniquePlacesById(pool, newPlaces);
        itinerary.placePools[poolKey] = pool;

        matchedCandidate = await selectGeoapifyCandidate({
          candidates: pool,
          req,
          usedCandidateIdsSet: usedIdsSet,
          avoidList: avoidLabels,
          refCoords,
          maxKm: 50,
          date: dayPlan.date,
          time: current.time,
          durationMinutes: current.durationMinutes ?? 90,
          accessibilityRequired: isAccessibilityRequired,
        });
      }
    }

    let updatedSlot: any;

    if (matchedCandidate) {
      usedIdsSet.add(matchedCandidate.id);
      itinerary.usedCandidateIds = Array.from(usedIdsSet);

      updatedSlot = {
        ...current,
        label: matchedCandidate.name,
        detail: current.detail || current.searchIntent || "Lieu sélectionné par KREW",
        address: matchedCandidate.address || current.address || null,
        ...resolveActivityResourceForPlace(matchedCandidate, itinerary.destination),
        activityMode: "bookable",
        candidateId: matchedCandidate.id,
        verified: true,
        source: "geoapify",
        latitude: matchedCandidate.latitude,
        longitude: matchedCandidate.longitude,
      };
    } else {
      updatedSlot = {
        ...current,
        label: `${current.label || "Créneau"} — lieu à choisir`,
        detail: "Toutes les alternatives locales disponibles ont été consultées",
      };
    }

    dayPlan.slots[data.slotIndex] = updatedSlot;
    itinerary.generatedAt = new Date().toISOString();

    const { enrichGroupItineraryWithGetYourGuide } = await import(
      "@/lib/krew/getyourguide.server"
    );
    const affiliateItinerary = enrichGroupItineraryWithGetYourGuide(
      itinerary as import("@/lib/krew/activity-ai.server").GroupItinerary,
    );
    const { normalizeItineraryPricesToEur } = await import("@/lib/krew/currency.server");
    const enrichedItinerary = await normalizeItineraryPricesToEur(affiliateItinerary);

    const { error } = await supabase
      .from("trips")
      .update({
        group_itinerary: enrichedItinerary,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId);
    if (error) throw error;

    return { ok: true, usedLlm: false, slot: dayPlan.slots[data.slotIndex], itinerary: enrichedItinerary };
  });
