import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeExternalUrl } from "@/lib/safe-url";
import { aggregateParticipantPreferences } from "@/lib/krew/trip-service";
import { assertNotRateLimited } from "@/lib/krew/rate-limit.server";
import { isTripAdmin, scoreTransportOption } from "@/lib/krew/engine";

export const proposeStayAndTransport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        refreshExternal: z.boolean().optional(),
        includeTransport: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const tripRes = await supabase.from("trips").select("*").eq("id", data.tripId).maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    const trip = tripRes.data as any;

    const generateHotels = data.includeTransport === false;
    const generateTransport = !generateHotels;

    // Fetch active participants at the top so bedding config can use it
    const partsRes = await supabase
      .from("trip_participants")
      .select("id, user_id, email, display_name, status")
      .eq("trip_id", data.tripId);
    if (partsRes.error) throw partsRes.error;
    const participants = (partsRes.data ?? []).filter((p: any) => p.status !== "absent");
    const isActiveMember = participants.some((p: any) => p.user_id === userId);
    if (generateHotels && !isTripAdmin(trip, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut chercher les hébergements",
      );
    }
    if (generateTransport && !isTripAdmin(trip, userId) && !isActiveMember) {
      throw new Error(
        "403 Forbidden: seuls les participants du voyage peuvent chercher les transports",
      );
    }

    // Réserve le quota seulement après autorisation, pour qu'un tiers ne puisse pas l'épuiser.
    const tripWindow = Number(process.env["RATE_LIMIT_LOGISTICS_WINDOW_SEC"]) || 120;
    const tripMax = Number(process.env["RATE_LIMIT_LOGISTICS_MAX"]) || 1;
    await assertNotRateLimited(supabase, {
      tripId: data.tripId,
      userId,
      kind: "logistics",
      windowSeconds: tripWindow,
      maxCalls: tripMax,
    });

    const selected = await supabase
      .from("recommendations")
      .select(
        "id, accommodation_id, destination_id, destinations(id, name, country, distance_from_paris_km)",
      )
      .eq("trip_id", data.tripId)
      .eq("is_selected", true)
      .maybeSingle();
    if (selected.error) throw selected.error;
    if (!selected.data) throw new Error("Valide d'abord une destination");

    const dest = (selected.data as any).destinations;
    const destName = String(dest?.name || "Destination");
    const destCountry = String(dest?.country || "");
    const destId = dest?.id || (selected.data as any).destination_id;
    const distanceKm = Number(dest?.distance_from_paris_km) || 800;

    const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const aggregated = await aggregateParticipantPreferences(supabaseAdmin, data.tripId);

    const providerErrors: string[] = [];
    const budget = Number(aggregated.aggregatedBudget) || Number(trip.budget_per_person) || 400;
    const nights = (() => {
      if (trip.start_date && trip.end_date) {
        const days = Math.round(
          (new Date(trip.end_date + "T12:00:00Z").getTime() -
            new Date(trip.start_date + "T12:00:00Z").getTime()) /
            86400000,
        );
        if (days >= 1) return days;
      }
      return Number(trip.duration_nights) || 2;
    })();
    const checkin =
      (trip.start_date as string) ||
      new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
    const checkout =
      (trip.end_date as string) ||
      new Date(new Date(checkin).getTime() + nights * 86400000).toISOString().slice(0, 10);
    const { getEffectiveParticipantsCount } = await import("@/lib/krew/trip-service");
    const effCount = getEffectiveParticipantsCount(trip, participants);
    const adults = Math.min(Math.max(1, effCount), 8);
    let topHotels: any[] = [];

    let accommodationMeta: import("@/lib/krew/accommodation-ai.server").AccommodationGenerationMeta | undefined;

    if (generateHotels) {
      const concepts = await import("@/lib/krew/accommodation-concepts");
      const accAi = await import("@/lib/krew/accommodation-ai.server");
      const singleRooms = aggregated.individualPreferences.filter((preference: any) => {
        const room = String(preference.roomTypePreference ?? "").toLowerCase();
        return (
          preference.acceptsSharedRoom === false ||
          room.includes("individuelle") ||
          room.includes("single")
        );
      }).length;
      const roomConfiguration = concepts.calculateRoomConfiguration(effCount, singleRooms);
      const conceptScores = concepts.scoreAccommodationConcepts({
        affinities: aggregated.stayProfileAffinities ?? [],
        ageRange: aggregated.groupAgeRange,
        groupSize: effCount,
        needsCityCenter: (aggregated as any).needsCityCenter,
      });
      const selectedStrategies = concepts.selectAccommodationStrategies(conceptScores);
      const allocation = concepts.resultsAllocation(selectedStrategies.length);
      const topProfiles = [...(aggregated.stayProfileAffinities ?? [])]
        .sort((a: any, b: any) => b.score - a.score)
        .map((profile: any) => profile.id);
      const locationMode = concepts.resolveAccommodationLocationIntent({
        topProfiles,
        localMobility: aggregated.groupLocalMobility ?? null,
        accommodationRole:
          aggregated.individualPreferences.find((preference: any) => preference.accommodationRole)
            ?.accommodationRole ?? null,
        needsCityCenter: (aggregated as any).needsCityCenter,
      });
      const requiredAmenities = aggregated.requiredAmenities ?? [];
      const hardBase = aggregated.hasBudgetVeto
        ? aggregated.vetoBudgetMax
        : aggregated.minGroupBudget;
      const specification: import("@/lib/krew/accommodation-ai.server").AccommodationSearchSpecification =
        {
          destination: { name: destName, country: destCountry },
          dates: { checkIn: checkin, checkOut: checkout, nights },
          group: {
            size: effCount,
            targetBedrooms: roomConfiguration.targetBedrooms,
            singleRooms: roomConfiguration.singleRooms,
            sharedRoomsOrEquivalent: roomConfiguration.doubleRooms,
          },
          budget: {
            targetPerPersonStay: budget * 0.35,
            hardMaxPerPersonStay: hardBase != null ? Number(hardBase) * 0.35 : null,
          },
          searchStrategies: selectedStrategies.map((strategy, index) => ({
            concept: strategy.concept,
            score: strategy.score,
            priority: index + 1,
            resultsWanted: allocation[index] ?? 1,
            propertyTypes: concepts.ACCOMMODATION_PROPERTY_TYPES[strategy.concept],
            mustHave: requiredAmenities,
            preferred: [],
          })),
          locationIntent: {
            mode: locationMode,
            priority: (aggregated as any).needsCityCenter === true ? "required" : "preferred",
            carAccepted: ["car_ok", "car_if_worth_it"].includes(
              aggregated.groupLocalMobility ?? "",
            ),
          },
          minimumRating: Number(aggregated.minAccommodationRating) || null,
          requiredAmenities,
          accessibilityRequired: aggregated.individualPreferences.some(
            (preference: any) => preference.accessibilityRequired === true,
          ),
        };

      const currentLogistics = (trip.group_logistics as any) || {};
      const reqHash = accAi.computeAccommodationRequestHash(data.tripId, specification);
      const currentMeta = currentLogistics.accommodationGeneration;
      const existingHotels = Array.isArray(currentLogistics.hotels) ? currentLogistics.hotels : [];

      const COOLDOWN_MS = 5 * 60 * 1000;
      let geminiCalled = false;

      const isRecentSame429 =
        currentMeta &&
        currentMeta.requestHash === reqHash &&
        currentMeta.status === "rate_limited" &&
        Date.now() - new Date(currentMeta.attemptedAt).getTime() < COOLDOWN_MS;

      const isRecentValidHash =
        currentMeta &&
        currentMeta.requestHash === reqHash &&
        currentMeta.status === "success" &&
        existingHotels.length > 0;

      if (isRecentValidHash) {
        topHotels = existingHotels;
        accommodationMeta = {
          ...currentMeta,
          completedAt: new Date().toISOString(),
        };
      } else if (isRecentSame429) {
        topHotels = existingHotels;
        accommodationMeta = {
          ...currentMeta,
          userMessage: "Recherche de logements momentanément indisponible. Réessaie un peu plus tard.",
        };
        providerErrors.push("Gemini accommodation rate limit cooldown active");
      } else {
        // Atomic acquisition via Supabase RPC function (fail-closed on error)
        let lockAcquired = false;
        let rpcGeneration: any = null;
        try {
          const rpcRes = await supabase.rpc("acquire_accommodation_generation_lock" as any, {
            p_trip_id: data.tripId,
            p_request_hash: reqHash,
            p_stale_after_seconds: 120,
          });
          const rpcData = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data;
          if (rpcData) {
            lockAcquired = Boolean(rpcData.acquired);
            rpcGeneration = rpcData.generation;
          }
        } catch (rpcErr) {
          console.warn("acquire_accommodation_generation_lock RPC call failed:", rpcErr);
          lockAcquired = false; // FAIL-CLOSED: No lock acquired = NO Gemini call
        }

        if (!lockAcquired) {
          topHotels = existingHotels;
          accommodationMeta = {
            ...(rpcGeneration || currentMeta),
            status: (rpcGeneration?.status as any) || "error",
            userMessage: rpcGeneration?.userMessage || "Recherche de logements momentanément indisponible. Réessaie un peu plus tard.",
          };
        } else {
          const attemptedAt = new Date().toISOString();
          try {
            geminiCalled = true;
            topHotels = await accAi.searchAccommodationsWithGemini(specification);
            accommodationMeta = {
              status: topHotels.length > 0 ? "success" : "empty",
              requestHash: reqHash,
              attemptedAt,
              completedAt: new Date().toISOString(),
              userMessage: topHotels.length === 0 ? "Aucun logement disponible pour ces critères." : null,
            };

            // Upsert valid candidates with HTTPS booking URL to the accommodations table using canonical external IDs
            const validHotelsForDb = topHotels.filter(
              (hotel) => hotel.url && typeof hotel.url === "string" && hotel.url.startsWith("https://"),
            );
            if (validHotelsForDb.length > 0) {
              try {
                const accsToUpsert = validHotelsForDb.map((hotel) => ({
                  external_id: accAi.buildCanonicalAccommodationExternalId(destName, hotel),
                  name: hotel.name,
                  destination_id: destId,
                  type: hotel.propertyType || "hotel",
                  rating: hotel.rating,
                  review_count: hotel.reviewCount,
                  price_per_night: hotel.pricePerPerson,
                  booking_url: safeExternalUrl(hotel.url),
                  image_url: hotel.imageUrl,
                  krew_concept: hotel.krewConcept,
                  source: hotel.source || "gemini_grounded",
                  updated_at: new Date().toISOString(),
                }));
                const { data: upsertedAccs } = await supabase
                  .from("accommodations")
                  .upsert(accsToUpsert, { onConflict: "external_id" })
                  .select("id, external_id, name");

                if (upsertedAccs) {
                  const accMap = new Map(upsertedAccs.map((a: any) => [a.external_id, a.id]));
                  topHotels = topHotels.map((hotel) => {
                    const extId = accAi.buildCanonicalAccommodationExternalId(destName, hotel);
                    const dbId = accMap.get(extId);
                    if (dbId) {
                      return {
                        ...hotel,
                        id: dbId, // Map canonical Supabase UUID as primary hotel.id
                        accommodation_id: dbId,
                      };
                    }
                    return hotel;
                  });
                }
              } catch (accErr) {
                console.warn("Accommodations database upsert skipped:", accErr);
              }
            }
          } catch (error) {
            const errStr = String(error);
            const is429 = errStr.includes("rate_limited") || errStr.includes("429");
            providerErrors.push(errStr.slice(0, 180));
            accommodationMeta = {
              status: is429 ? "rate_limited" : "error",
              requestHash: reqHash,
              attemptedAt,
              completedAt: new Date().toISOString(),
              userMessage: is429
                ? "Recherche de logements momentanément indisponible. Réessaie un peu plus tard."
                : "Erreur lors de la recherche des logements.",
            };
          }
        }
      }

      console.info("[Accommodation generation]", {
        workflow: "accommodation",
        tripId: data.tripId,
        requestHash: reqHash,
        geminiCalls: geminiCalled ? 1 : 0,
        cacheHit: Boolean(isRecentValidHash),
        status: accommodationMeta?.status,
        resultCount: topHotels.length,
      });
    }

    // ——— A/R multi-modes ———
    const tripOrigin = (trip.departure_city as string) || "Paris";
    const planeRefused = Boolean((aggregated as any).planeRefused);

    // Fetch trip participant preferences for departure cities and travel options
    const prefsRes = await supabase
      .from("trip_participant_preferences")
      .select(
        "user_id, departure_city, max_travel_duration_hours, transport_mode_accepted, room_type_preference, accepts_shared_room",
      )
      .eq("trip_id", data.tripId);
    const prefsList = prefsRes.data ?? [];

    // Fetch transport time preferences
    const timePrefsRes = await supabase
      .from("trip_transport_time_prefs")
      .select(
        "participant_id, earliest_departure_time, latest_return_time, latest_arrival_time, earliest_return_departure_time",
      )
      .eq("trip_id", data.tripId);
    const timePrefsList = timePrefsRes.data ?? [];

    const norm = (s: string) => s.trim().toLowerCase();

    // Map each active participant to their configuration
    const participantConfigs = participants.map((p: any) => {
      const pref = prefsList.find((pr: any) => pr.user_id === p.user_id);
      const tp = timePrefsList.find((t: any) => t.participant_id === p.id);

      const departureCity = (pref?.departure_city || tripOrigin).trim();
      const earliestDepartureTime = tp?.earliest_departure_time || null;
      const latestArrivalTime = tp?.latest_arrival_time || null;
      const earliestReturnDepartureTime = tp?.earliest_return_departure_time || null;
      const latestReturnTime = tp?.latest_return_time || null;
      const maxTravelDurationHours =
        pref?.max_travel_duration_hours != null ? Number(pref.max_travel_duration_hours) : null;
      const transportModeAccepted = Array.isArray(pref?.transport_mode_accepted)
        ? pref.transport_mode_accepted
        : ["peu importe"];

      return {
        participantId: p.id,
        displayName: p.display_name || p.email?.split("@")[0] || "Ami",
        departureCity,
        earliestDepartureTime,
        latestArrivalTime,
        earliestReturnDepartureTime,
        latestReturnTime,
        maxTravelDurationHours,
        transportModeAccepted,
      };
    });

    // Group participants into homogeneous sub-groups sharing departure city and constraints
    const subGroups: {
      key: string;
      departureCity: string;
      earliestDepartureTime: string | null;
      latestArrivalTime: string | null;
      earliestReturnDepartureTime: string | null;
      latestReturnTime: string | null;
      maxTravelDurationHours: number | null;
      transportModeAccepted: string[];
      participants: { participantId: string; displayName: string }[];
    }[] = [];

    for (const conf of participantConfigs) {
      const modesKey = [...conf.transportModeAccepted].sort().join(",");
      const key = `${norm(conf.departureCity)}|${conf.earliestDepartureTime || ""}|${conf.latestArrivalTime || ""}|${conf.earliestReturnDepartureTime || ""}|${conf.latestReturnTime || ""}|${conf.maxTravelDurationHours || ""}|${modesKey}`;

      let grp = subGroups.find((g) => g.key === key);
      if (!grp) {
        grp = {
          key,
          departureCity: conf.departureCity,
          earliestDepartureTime: conf.earliestDepartureTime,
          latestArrivalTime: conf.latestArrivalTime,
          earliestReturnDepartureTime: conf.earliestReturnDepartureTime,
          latestReturnTime: conf.latestReturnTime,
          maxTravelDurationHours: conf.maxTravelDurationHours,
          transportModeAccepted: conf.transportModeAccepted,
          participants: [],
        };
        subGroups.push(grp);
      }
      grp.participants.push({ participantId: conf.participantId, displayName: conf.displayName });
    }

    if (subGroups.length === 0) {
      subGroups.push({
        key: "fallback",
        departureCity: tripOrigin,
        earliestDepartureTime: null,
        latestArrivalTime: null,
        earliestReturnDepartureTime: null,
        latestReturnTime: null,
        maxTravelDurationHours: null,
        transportModeAccepted: ["peu importe"],
        participants: [{ participantId: "fallback", displayName: "Groupe" }],
      });
    }

    const { searchTransportRoundTrip, estimateTransportFromDistance } =
      await import("@/integrations/external/transport.server");
    const { buildKiwiAffiliateLink, cityToIataOrName } = await import("@/lib/krew/deep-links");

    const baseFlight = estimateTransportFromDistance(distanceKm);
    const priceForMode = (mode: string): number => {
      switch (mode) {
        case "flight":
          return Math.round(baseFlight);
        case "train":
          return Math.round(
            baseFlight * (distanceKm <= 500 ? 0.85 : distanceKm <= 900 ? 1.05 : 1.25),
          );
        case "bus":
          return Math.round(baseFlight * 0.45);
        case "car":
          return Math.round(Math.max(35, distanceKm * 0.12 * 2) / Math.max(2, adults / 2));
        case "covoiturage":
          return Math.round((Math.max(35, distanceKm * 0.12 * 2) / Math.max(2, adults / 2)) * 0.85);
        case "ferry":
          return Math.round(baseFlight * 0.7);
        default:
          return Math.round(baseFlight);
      }
    };

    const estimateDurationForMode = (mode: string, dist: number): number => {
      switch (mode) {
        case "flight":
          return Math.round((dist / 750 + 3.0) * 10) / 10;
        case "train":
          return Math.round((dist / 200 + 1.0) * 10) / 10;
        case "bus":
          return Math.round((dist / 75 + 1.5) * 10) / 10;
        case "car":
        case "covoiturage":
          return Math.round((dist / 100 + 1.0) * 10) / 10;
        case "ferry":
          return Math.round((dist / 35 + 2.0) * 10) / 10;
        default:
          return Math.round((dist / 100 + 1.5) * 10) / 10;
      }
    };

    const linksForMode = (mode: string, from: string, to: string, groupSize: number) => {
      const f = encodeURIComponent(from);
      const d = encodeURIComponent(to);
      const gAdults = Math.min(Math.max(1, groupSize), 9);
      if (mode === "flight") {
        const kiwi = buildKiwiAffiliateLink({
          originCode: cityToIataOrName(from),
          destinationCode: cityToIataOrName(to),
          departDate: checkin,
          returnDate: checkout,
          subId: "krew-transport",
        });
        if (kiwi) return [{ label: "Kiwi", url: kiwi }];
        return [
          {
            label: "Google Flights",
            url: `https://www.google.com/travel/flights?q=${encodeURIComponent(`Vols de ${from} à ${to} le ${checkin} retour ${checkout}`)}`,
          },
        ];
      }
      if (mode === "train") {
        return [
          {
            label: "SNCF Connect",
            url: `https://www.sncf-connect.com/app/home/search/?originLabel=${f}&destinationLabel=${d}&outwardDate=${checkin}&inwardDate=${checkout}&passengers=${gAdults}`,
          },
          {
            label: "Trainline",
            url: `https://www.thetrainline.com/search/${f}/${d}/${checkin}/${checkout}`,
          },
        ];
      }
      if (mode === "covoiturage") {
        return [
          {
            label: "Voir l’aller",
            url: `https://www.blablacar.fr/search?fn=${f}&tn=${d}&db=${checkin}`,
          },
          {
            label: "Voir le retour",
            url: `https://www.blablacar.fr/search?fn=${d}&tn=${f}&db=${checkout}`,
          },
        ];
      }
      // default / car / others
      return [
        {
          label: "Google Maps",
          url: `https://www.google.com/maps/dir/${f}/${d}`,
        },
      ];
    };

    type TransportCard = {
      city: string;
      count: number;
      pricePerPerson: number;
      mode: string;
      modeLabel: string;
      label: string;
      url: string | null;
      searchUrl?: string | null;
      provider?: string | null;
      note?: string;
      links: { label: string; url: string }[];
      durationHours: number;
      subGroupKey?: string;
      participantIds?: string[];
      earliestDepartureTime?: string | null;
      latestArrivalTime?: string | null;
      earliestReturnDepartureTime?: string | null;
      latestReturnTime?: string | null;
      respectedConstraints?: string[];
      dataKind?: "provider_offer" | "public_fare" | "external_search" | "krew_estimate";
      providerOffer?: import("@/integrations/external/transport.server").TransportQuote | null;
      trainJourney?: import("@/integrations/external/navitia-trains.server").NavitiaTrainRoundTrip | null;
      score?: number;
      matchReasons?: string[];
    };

    const modeMeta: { mode: string; modeLabel: string; enabled: boolean }[] = [
      { mode: "flight", modeLabel: "Avion", enabled: !planeRefused && distanceKm >= 250 },
      // Providers futurs : ne pas matérialiser une estimation de distance comme une offre réelle.
      { mode: "train", modeLabel: "Train", enabled: distanceKm <= 1200 },
      { mode: "car", modeLabel: "Voiture", enabled: distanceKm <= 1000 },
      { mode: "covoiturage", modeLabel: "Covoiturage", enabled: distanceKm <= 800 },
      { mode: "ferry", modeLabel: "Ferry", enabled: false },
    ];

    const transports: TransportCard[] = [];

    for (const group of generateTransport ? subGroups : []) {
      const from = group.departureCity;
      const acceptedModes = group.transportModeAccepted.map((m) => m.toLowerCase().trim());
      const hasModeFilter = acceptedModes.length > 0 && !acceptedModes.includes("peu importe");

      let flightApiQuote: import("@/integrations/external/transport.server").TransportQuote | null =
        null;
      let trainFare: import("@/integrations/external/sncf-fares.server").SncfRoundTripFares | null =
        null;
      let trainJourney: import("@/integrations/external/navitia-trains.server").NavitiaTrainRoundTrip | null =
        null;
      let navitiaTrainFailed = false;
      const navitiaConfigured = Boolean(process.env["SNCF_KEY_API"]?.trim());
      const isFlightAllowed =
        !planeRefused &&
        (!hasModeFilter || acceptedModes.some((m) => m.includes("avion") || m.includes("flight")));

      if (isFlightAllowed && distanceKm >= 250) {
        try {
          const apiQuote = await searchTransportRoundTrip({
            originCity: from,
            destinationCity: destName,
            departDate: checkin,
            returnDate: checkout,
            adults: Math.min(Math.max(1, group.participants.length), 9),
            distanceKm,
            earliestDepartureTime: group.earliestDepartureTime,
            latestArrivalTime: group.latestArrivalTime,
            earliestReturnDepartureTime: group.earliestReturnDepartureTime,
            latestReturnTime: group.latestReturnTime,
          });
          if (apiQuote?.pricePerPerson > 0) {
            const hasImperativeTimeConstraint = Boolean(
              group.earliestDepartureTime ||
              group.latestArrivalTime ||
              group.earliestReturnDepartureTime ||
              group.latestReturnTime,
            );
            if (!(apiQuote.dataKind === "krew_estimate" && hasImperativeTimeConstraint))
              flightApiQuote = apiQuote;
          }
        } catch (e) {
          providerErrors.push(`transport ${from}: ${String(e).slice(0, 80)}`);
        }
      }
      const isTrainAllowed =
        (!hasModeFilter || acceptedModes.some((m) => m.includes("train"))) &&
        distanceKm <= 1200;
      if (isTrainAllowed) {
        if (navitiaConfigured) {
          try {
            const { searchNavitiaTrainRoundTrip } =
              await import("@/integrations/external/navitia-trains.server");
            trainJourney = await searchNavitiaTrainRoundTrip({
              originCity: from,
              destinationCity: destName,
              departDate: checkin,
              returnDate: checkout,
              earliestDepartureTime: group.earliestDepartureTime,
              latestArrivalTime: group.latestArrivalTime,
              earliestReturnDepartureTime: group.earliestReturnDepartureTime,
              latestReturnTime: group.latestReturnTime,
              maxTravelDurationHours: group.maxTravelDurationHours,
            });
          } catch (e) {
            navitiaTrainFailed = true;
            providerErrors.push(`Navitia train ${from}: ${String(e).slice(0, 80)}`);
          }
        }

        try {
          const { searchSncfRoundTripFares } =
            await import("@/integrations/external/sncf-fares.server");
          trainFare = await searchSncfRoundTripFares(from, destName);
        } catch (e) {
          providerErrors.push(`SNCF Open Data ${from}: ${String(e).slice(0, 80)}`);
        }
      }

      for (const m of modeMeta) {
        if (!m.enabled) continue;

        if (hasModeFilter) {
          const matched = acceptedModes.some((am) => {
            if (m.mode === "flight") return am.includes("avion") || am.includes("flight");
            if (m.mode === "train") return am.includes("train");
            if (m.mode === "car") return am.includes("voiture") || am.includes("car");
            if (m.mode === "covoiturage")
              return am.includes("covoit") || am.includes("share") || am.includes("car");
            if (m.mode === "ferry") return am.includes("ferry") || am.includes("bateau");
            return false;
          });
          if (!matched) continue;
        }

        if (m.mode === "train" && navitiaConfigured && !trainJourney) {
          const hasImperativeTrainConstraint = Boolean(
            group.earliestDepartureTime ||
              group.latestArrivalTime ||
              group.earliestReturnDepartureTime ||
              group.latestReturnTime ||
              group.maxTravelDurationHours,
          );
          // A real "no solution" must not be replaced by a fake train. If Navitia
          // itself is temporarily down, keep the old external-search fallback only
          // when no hard timing/duration constraint needs to be verified.
          if (!navitiaTrainFailed || hasImperativeTrainConstraint) continue;
        }

        const duration =
          m.mode === "flight" && flightApiQuote?.outboundDurationMinutes
            ? Math.round((flightApiQuote.outboundDurationMinutes / 60) * 10) / 10
            : m.mode === "train" && trainJourney
              ? Math.round(
                  (Math.max(
                    trainJourney.outbound.durationMinutes,
                    trainJourney.return.durationMinutes,
                  ) /
                    60) *
                    10,
                ) / 10
              : estimateDurationForMode(m.mode, distanceKm);

        if (group.maxTravelDurationHours != null && group.maxTravelDurationHours > 0) {
          if (duration > group.maxTravelDurationHours) {
            continue;
          }
        }

        let price = priceForMode(m.mode);
        let directUrl: string | null = null;
        let exactSearchUrl: string | null = null;
        let providerName: string | null = null;
        let flightOutsideWindow = false;

        if (m.mode === "flight" && flightApiQuote) {
          price = Math.round(flightApiQuote.pricePerPerson);
          directUrl = flightApiQuote.url ?? null;
          exactSearchUrl = flightApiQuote.searchUrl ?? null;
          providerName = flightApiQuote.provider ?? "kayak";
          flightOutsideWindow = !!flightApiQuote.outsideTimeWindow;
        }
        if (m.mode === "train" && trainFare) {
          price = Math.round(
            (trainFare.roundTripFareRange.min + trainFare.roundTripFareRange.max) / 2,
          );
        }
        if (m.mode === "train" && trainJourney) {
          providerName = trainFare ? "Navitia + SNCF Open Data" : "Navitia";
        } else if (m.mode === "train" && trainFare) {
          providerName = "SNCF Open Data";
        }

        const modeLinks = linksForMode(m.mode, from, destName, group.participants.length);
        if (!exactSearchUrl && modeLinks[0]) {
          exactSearchUrl = modeLinks[0].url;
        }

        const primaryUrl = directUrl || exactSearchUrl || modeLinks[0]?.url || null;

        const links: { label: string; url: string }[] = [];
        if (directUrl) {
          links.push({ label: "Voir l'offre directe", url: directUrl });
        }
        for (const ml of modeLinks) {
          if (!links.some((l) => l.url === ml.url)) {
            links.push(ml);
          }
        }

        const respectedConstraints: string[] = [];
        if (group.earliestDepartureTime) {
          respectedConstraints.push(`Départ après ${group.earliestDepartureTime}`);
        }
        if (group.latestArrivalTime) {
          respectedConstraints.push(`Arrivée avant ${group.latestArrivalTime}`);
        }
        if (group.earliestReturnDepartureTime) {
          respectedConstraints.push(`Retour après ${group.earliestReturnDepartureTime}`);
        }
        if (group.latestReturnTime) {
          respectedConstraints.push(`Retour avant ${group.latestReturnTime}`);
        }
        if (group.maxTravelDurationHours) {
          respectedConstraints.push(
            `Durée < ${group.maxTravelDurationHours}h (porte-à-porte ~${duration}h)`,
          );
        }

        const { score: scoreVal, matchReasons: matchReasonsList } = scoreTransportOption(
          {
            mode: m.mode,
            pricePerPerson: price,
            durationHours: duration,
            respectedConstraints,
            outsideTimeWindow: m.mode === "flight" ? flightOutsideWindow : false,
          } as any,
          budget,
          group.maxTravelDurationHours,
        );

        // Proposition de trajet partagé si un autre participant a fait ce choix
        const currentLogistics = (trip.group_logistics as any) || {};
        const otherPicks = Array.isArray(currentLogistics.transportPicks)
          ? currentLogistics.transportPicks
          : [];
        const matchingPick = otherPicks.find(
          (pk: any) =>
            norm(pk.city || "") === norm(from) &&
            norm(pk.mode || "") === norm(m.mode) &&
            !group.participants.some((p) => p.participantId === pk.userId),
        );
        if (matchingPick) {
          matchReasonsList.push(
            `Choisi par ${matchingPick.displayName} — vous pouvez voyager ensemble !`,
          );
        }

        transports.push({
          city: from,
          count: group.participants.length,
          pricePerPerson: price,
          mode: m.mode,
          modeLabel: m.modeLabel,
          label: `A/R ${m.modeLabel.toLowerCase()} ${from} → ${destName}`,
          url: primaryUrl,
          searchUrl: exactSearchUrl,
          provider: providerName,
          dataKind:
            m.mode === "train" && trainJourney
              ? "provider_offer"
              : m.mode === "train" && trainFare
                ? "public_fare"
                : m.mode === "flight" && flightApiQuote
                  ? (flightApiQuote.dataKind ?? "provider_offer")
                  : "krew_estimate",
          providerOffer: m.mode === "flight" ? flightApiQuote : null,
          trainJourney: m.mode === "train" ? trainJourney : null,
          note:
            m.mode === "train" && trainJourney
              ? `${trainJourney.outbound.departureStation ?? from} ${trainJourney.outbound.departureTime} → ${trainJourney.outbound.arrivalStation ?? destName} ${trainJourney.outbound.arrivalTime} · retour ${trainJourney.return.departureTime} → ${trainJourney.return.arrivalTime}${trainFare ? " · tarif public indicatif A/R" : " · prix KREW indicatif"}`
              : m.mode === "train" && trainFare
                ? "tarif public indicatif A/R — horaires à vérifier"
                : m.mode === "flight" && flightApiQuote
                ? flightApiQuote.dataKind === "krew_estimate"
                  ? "estimation KREW — aucun tarif fournisseur vérifié"
                  : providerName
                    ? `prix ${providerName} réel`
                    : "prix API réel"
                : "prix indicatif basé sur la distance",
          links: links.slice(0, 4),
          durationHours: duration,
          subGroupKey: group.key,
          participantIds: group.participants.map((p) => p.participantId),
          earliestDepartureTime: group.earliestDepartureTime,
          latestArrivalTime: group.latestArrivalTime,
          earliestReturnDepartureTime: group.earliestReturnDepartureTime,
          latestReturnTime: group.latestReturnTime,
          respectedConstraints,
          score: scoreVal,
          matchReasons: matchReasonsList,
        });
      }
    }

    // Tri : par ville puis prix croissant
    transports.sort((a, b) => a.city.localeCompare(b.city) || a.pricePerPerson - b.pricePerPerson);

    // Ne pas afficher plusieurs fois le même trajet lorsqu'une même ville est
    // scindée en sous-groupes (contraintes renseignées vs valeurs par défaut).
    const dedupedTransports: TransportCard[] = [];
    for (const card of transports) {
      const routeKey = `${norm(card.city)}|${norm(card.mode)}|${card.url || card.searchUrl || ""}`;
      const existing = dedupedTransports.find(
        (item) => `${norm(item.city)}|${norm(item.mode)}|${item.url || item.searchUrl || ""}` === routeKey,
      );
      if (!existing) {
        dedupedTransports.push(card);
        continue;
      }
      existing.count += card.count;
      existing.participantIds = [...new Set([...(existing.participantIds ?? []), ...(card.participantIds ?? [])])];
      existing.respectedConstraints = [...new Set([...(existing.respectedConstraints ?? []), ...(card.respectedConstraints ?? [])])];
      existing.matchReasons = [...new Set([...(existing.matchReasons ?? []), ...(card.matchReasons ?? [])])];
      existing.score = Math.max(existing.score ?? 0, card.score ?? 0);
    }
    transports.splice(0, transports.length, ...dedupedTransports);

    // Mise à jour additive : une génération conserve l'autre domaine, ses votes et ses statuts.
    const prev = (trip.group_logistics as any) || {};
    const common = { destination: destName, country: destCountry, nights, checkin, checkout };
    const logisticsWithVotes = generateHotels
      ? {
          ...(await import("@/lib/krew/accommodation-ai.server")).mergeAccommodationLogistics(
            { ...prev, ...common },
            topHotels,
            providerErrors,
            accommodationMeta,
          ),
        }
      : {
          ...prev,
          ...common,
          transports,
          transportProviderErrors: providerErrors,
          transportsGeneratedAt: new Date().toISOString(),
        };

    await supabase
      .from("trips")
      .update({ group_logistics: logisticsWithVotes, updated_at: new Date().toISOString() } as any)
      .eq("id", data.tripId);

    return { ok: true, logistics: logisticsWithVotes };
  });
