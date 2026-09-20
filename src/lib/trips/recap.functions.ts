import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeExternalUrl } from "@/lib/safe-url";
import { aggregateParticipantPreferences } from "@/lib/krew/trip-service";
import { isTripAdmin } from "@/lib/krew/engine";

export const getTripRecap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase.from("trips").select("*").eq("id", data.tripId).maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    // Membre uniquement
    const isAdmin = isTripAdmin(trip.data, userId);
    if (!isAdmin) {
      const email = (typeof context.claims?.email === "string" ? context.claims.email : "")
        .trim()
        .toLowerCase();
      const part = await supabase
        .from("trip_participants")
        .select("id")
        .eq("trip_id", data.tripId)
        .or(email ? `user_id.eq.${userId},email.eq.${email}` : `user_id.eq.${userId}`)
        .maybeSingle();
      if (part.error) throw part.error;
      if (!part.data) throw new Error("Accès réservé aux membres du voyage");
    }

    const [recommendations, preferences, progress] = await Promise.all([
      supabase
        .from("recommendations")
        .select("*, destinations(*), accommodations(*)")
        .eq("trip_id", data.tripId)
        .order("score", { ascending: false })
        .limit(3),
      supabase
        .from("trip_preferences")
        .select("duration_nights")
        .eq("trip_id", data.tripId)
        .maybeSingle(),
      (async () => {
        const { getParticipantsProgress } = await import("@/lib/participant-preferences.functions");
        // fallback inline if no handler export
        try {
          const prefs = await supabase
            .from("trip_participant_preferences")
            .select("user_id")
            .eq("trip_id", data.tripId);
          const parts = await supabase
            .from("trip_participants")
            .select("id, user_id")
            .eq("trip_id", data.tripId);
          const total = Math.max((parts.data ?? []).length, 1);
          const answered = new Set((prefs.data ?? []).map((p: any) => p.user_id).filter(Boolean))
            .size;
          return { answered, total };
        } catch {
          return { answered: 0, total: 0 };
        }
      })(),
    ]);
    if (recommendations.error) throw recommendations.error;

    const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);

    const tripOrigin = ((trip.data.departure_city as string) || "Paris").trim() || "Paris";
    let departureOrigins =
      aggregated.departureOrigins && aggregated.departureOrigins.length > 0
        ? aggregated.departureOrigins
        : [{ city: tripOrigin, count: Math.max(1, Number(trip.data.participants_count) || 1) }];

    const counted = departureOrigins.reduce((s: number, o: { count: number }) => s + o.count, 0);
    const participants = Math.max(1, Number(trip.data.participants_count) || counted || 1);
    if (counted < participants) {
      const remaining = participants - counted;
      const copy = departureOrigins.map((o: { city: string; count: number }) => ({ ...o }));
      const primary = copy.find((o) => o.city.toLowerCase() === tripOrigin.toLowerCase());
      if (primary) primary.count += remaining;
      else copy.push({ city: tripOrigin, count: remaining });
      departureOrigins = copy;
    }

    const nights =
      preferences.data?.duration_nights ??
      (trip.data.start_date && trip.data.end_date
        ? Math.max(
            1,
            Math.round(
              (new Date(trip.data.end_date as string).getTime() -
                new Date(trip.data.start_date as string).getTime()) /
                (24 * 3600 * 1000),
            ),
          )
        : 3);

    const recoIds = (recommendations.data ?? []).map((r: any) => r.id as string);
    let reactions: any[] = [];
    if (recoIds.length) {
      const reactionsRes = await supabase
        .from("destination_feedback")
        .select("recommendation_id, reaction, participant_id, trip_participants(user_id)")
        .in("recommendation_id", recoIds);
      if (!reactionsRes.error) {
        reactions = reactionsRes.data ?? [];
      }
    }

    const reactionsByReco = new Map<
      string,
      {
        myReaction: "like" | "dislike" | null;
        likesCount: number;
        dislikesCount: number;
      }
    >();

    for (const recoId of recoIds) {
      reactionsByReco.set(recoId, { myReaction: null, likesCount: 0, dislikesCount: 0 });
    }

    for (const r of reactions) {
      const recoId = r.recommendation_id;
      const entry = reactionsByReco.get(recoId);
      if (!entry) continue;

      if (r.reaction === "like") entry.likesCount++;
      if (r.reaction === "dislike") entry.dislikesCount++;

      const isMine = r.trip_participants?.user_id === userId;
      if (isMine) {
        entry.myReaction = r.reaction;
      }
    }

    return {
      trip: {
        id: trip.data.id as string,
        name: trip.data.name as string,
        startDate: trip.data.start_date as string | null,
        endDate: trip.data.end_date as string | null,
        departureCity: tripOrigin,
        participantsCount: participants,
        status: trip.data.status as string,
        runnerUps: (trip.data as any).runner_ups || [],
      },
      isOwner,
      nights,
      departureOrigins,
      progress,
      recommendations: (recommendations.data ?? []).map((r: any) => {
        const rInfo = reactionsByReco.get(r.id) ?? {
          myReaction: null,
          likesCount: 0,
          dislikesCount: 0,
        };
        return {
          id: r.id as string,
          score: Number(r.score ?? 0),
          budget: r.budget,
          matchReasons: r.match_reasons as string[] | null,
          destination: r.destinations
            ? {
                name: r.destinations.name as string,
                country: r.destinations.country as string,
                imageUrl: r.destinations.image_url as string | null,
                distanceKm: Number(r.destinations.distance_from_paris_km ?? 0),
                rating: Number(r.destinations.rating ?? 0),
              }
            : null,
          accommodation: r.accommodations
            ? (() => {
                const acc = r.accommodations;
                const priceOfferUrl = Array.isArray(acc?.price_offers)
                  ? acc.price_offers[0]?.url || acc.price_offers[0]?.booking_url
                  : (acc?.price_offers as any)?.url || (acc?.price_offers as any)?.booking_url;
                const directUrl = acc?.booking_url || acc?.url || priceOfferUrl;
                const destName = r.destinations?.name || "";
                const groupAdults = Math.max(1, Number(trip.data.participants_count) || 1);
                const noRooms = Math.max(1, Math.ceil(groupAdults / 2));
                const exactDeepLink = destName
                  ? `https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(`${acc?.name ?? ""} ${destName}`)}&group_adults=${groupAdults}&no_rooms=${noRooms}&selected_currency=EUR`
                  : null;
                return {
                  id: acc.id as string,
                  name: acc.name as string,
                  type: acc.type as string,
                  bookingUrl: safeExternalUrl(directUrl || exactDeepLink),
                };
              })()
            : null,
          myReaction: rInfo.myReaction,
          likesCount: rInfo.likesCount,
          dislikesCount: rInfo.dislikesCount,
        };
      }),
    };
  });

export const watchPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        recommendationId: z.string().uuid(),
        destinationName: z.string().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    const recommendation = await supabase
      .from("recommendations")
      .select("id")
      .eq("id", data.recommendationId)
      .eq("trip_id", data.tripId)
      .maybeSingle();
    if (recommendation.error) throw recommendation.error;
    if (!recommendation.data) {
      throw new Error("Cette recommandation n'appartient pas à ce voyage");
    }

    // Upsert manuel (unique trip + user + reco)
    const existing = await supabase
      .from("price_watch")
      .select("id")
      .eq("trip_id", data.tripId)
      .eq("created_by", userId)
      .eq("recommendation_id", data.recommendationId)
      .maybeSingle();

    if (existing.data?.id) {
      const upd = await supabase
        .from("price_watch")
        .update({ last_checked_at: now, destination_name: data.destinationName ?? null })
        .eq("id", existing.data.id)
        .select("*")
        .single();
      if (upd.error) throw upd.error;
      return { ok: true, watch: upd.data, refreshed: true };
    }

    const ins = await supabase
      .from("price_watch")
      .insert({
        trip_id: data.tripId,
        recommendation_id: data.recommendationId,
        destination_name: data.destinationName ?? null,
        created_by: userId,
        last_checked_at: now,
      })
      .select("*")
      .single();
    if (ins.error) throw ins.error;
    return { ok: true, watch: ins.data, refreshed: false };
  });

export const listMyPriceWatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("price_watch")
      .select(
        "id, trip_id, recommendation_id, destination_name, last_checked_at, created_at, trips(name, status)",
      )
      .eq("created_by", userId)
      .order("last_checked_at", { ascending: false })
      .limit(20);
    if (res.error) {
      // Table absente (migration pas encore appliquée)
      if (String(res.error.message || "").includes("price_watch")) return { watches: [] as any[] };
      throw res.error;
    }
    return { watches: res.data ?? [] };
  });

export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        type: z.enum(["hotel", "transport"]),
        status: z.enum(["estimé", "sélectionné", "réservé"]),
        userId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tripRes = await supabase
      .from("trips")
      .select("id, owner_id, group_logistics, co_organizer_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    const trip = tripRes.data as any;

    if (!isTripAdmin(trip, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut modifier les statuts de réservation",
      );
    }

    if (data.type === "transport" && data.userId) {
      const participant = await supabase
        .from("trip_participants")
        .select("id")
        .eq("trip_id", data.tripId)
        .eq("user_id", data.userId)
        .neq("status", "absent")
        .maybeSingle();
      if (participant.error) throw participant.error;
      if (!participant.data && data.userId !== trip.owner_id) {
        throw new Error("Le statut de transport ne peut viser qu'un membre actif du voyage");
      }
    }

    const logistics = (trip.group_logistics || {}) as any;
    if (data.type === "hotel") {
      logistics.hotelBookingStatus = data.status;
    } else {
      const targetUid = data.userId || userId;
      const picks = Array.isArray(logistics.transportPicks) ? [...logistics.transportPicks] : [];
      const idx = picks.findIndex((p) => p.userId === targetUid);
      if (idx >= 0) {
        picks[idx].status = data.status;
      }
      logistics.transportPicks = picks;
    }

    const { error } = await supabase
      .from("trips")
      .update({ group_logistics: logistics, updated_at: new Date().toISOString() } as any)
      .eq("id", data.tripId);
    if (error) throw error;
    return { ok: true, logistics };
  });

export const getCostSplit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string; recommendationId?: string }) =>
    z
      .object({
        tripId: z.string().uuid(),
        recommendationId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const trip = await supabase.from("trips").select("*").eq("id", data.tripId).maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    let recoQuery = supabase
      .from("recommendations")
      .select("*, destinations(name, distance_from_paris_km)")
      .eq("trip_id", data.tripId);

    if (data.recommendationId) {
      recoQuery = recoQuery.eq("id", data.recommendationId);
    } else {
      recoQuery = recoQuery.eq("is_selected", true);
    }

    const reco = await recoQuery.maybeSingle();
    if (reco.error) throw reco.error;
    if (!reco.data) throw new Error("Aucune proposition validée");

    const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
    const { buildCostSplit } = await import("@/lib/krew/cost-split");
    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);

    const partsRes = await supabase
      .from("trip_participants")
      .select("id, user_id, email, display_name, status")
      .eq("trip_id", data.tripId);
    if (partsRes.error) throw partsRes.error;
    const participants = (partsRes.data ?? []).filter((p: any) => p.status !== "absent");

    const [prefsRes, starPrefsRes] = await Promise.all([
      supabase
        .from("trip_participant_preferences")
        .select("user_id, departure_city")
        .eq("trip_id", data.tripId),
      supabase
        .from("trip_star_preferences")
        .select("user_id, departure_city")
        .eq("trip_id", data.tripId)
        .maybeSingle(),
    ]);

    const prefMap = new Map<string, string>();
    for (const p of prefsRes.data ?? []) {
      if (p.user_id && p.departure_city) {
        prefMap.set(p.user_id, p.departure_city);
      }
    }

    const celebratedPerson = trip.data?.celebrated_person;
    const starUid =
      (starPrefsRes.data as any)?.user_id || (trip.data as any)?.star_user_id || "star-virtual-uid";

    const tripOrigin = ((trip.data.departure_city as string) || "Paris").trim() || "Paris";
    const budget = (reco.data.budget ?? {}) as any;
    const budgetOrigins = Array.isArray(budget.transportByOrigin) ? budget.transportByOrigin : [];
    const fallbackTransport = Number(budget.transport ?? 0);

    const normCity = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const getPriceForCity = (city: string) => {
      const target = normCity(city);
      const match = budgetOrigins.find(
        (bo: any) => normCity(bo.city || bo.originCity || "") === target,
      );
      return match
        ? Number(match.pricePerPerson ?? match.price ?? fallbackTransport)
        : fallbackTransport;
    };

    const logistics = (trip.data.group_logistics || {}) as any;
    const hotelBookingStatus = logistics.hotelBookingStatus || "estimé";
    const picks = Array.isArray(logistics.transportPicks) ? logistics.transportPicks : [];
    const { getEffectiveParticipantsCount } = await import("@/lib/krew/trip-service");
    const totalGroupParticipants = getEffectiveParticipantsCount(trip.data, participants);

    let accommodationCost = Number(budget.accommodation ?? 0);
    const selectedHotelId = logistics.selectedHotelId;
    const hotelsList = Array.isArray(logistics.hotels) ? logistics.hotels : [];
    if (selectedHotelId) {
      const matchHotel = hotelsList.find((h: any) => h.id === selectedHotelId);
      if (matchHotel) {
        accommodationCost = Number(matchHotel.pricePerNight * (trip.data.duration_nights || 2));
      }
    }

    const participantLines: any[] = [];
    let reservedTransportSum = 0;
    let estimatedTransportSum = 0;

    for (const p of participants) {
      const isStar = Boolean(p.user_id && starUid && p.user_id === starUid);

      let city = "";
      if (isStar && (starPrefsRes.data as any)?.departure_city) {
        city = (starPrefsRes.data as any).departure_city;
      } else if (p.user_id && prefMap.has(p.user_id)) {
        city = prefMap.get(p.user_id)!;
      }

      if (!city) {
        city = tripOrigin;
      }

      const userPick = p.user_id ? picks.find((pk: any) => pk.userId === p.user_id) : null;
      let transportPrice = fallbackTransport;
      let isTransportReserved = false;

      if (userPick) {
        transportPrice =
          userPick.pricePerPerson != null ? Number(userPick.pricePerPerson) : fallbackTransport;
        isTransportReserved = userPick.status === "réservé";
      } else {
        transportPrice = getPriceForCity(city);
      }

      if (isTransportReserved) {
        reservedTransportSum += transportPrice;
      } else {
        estimatedTransportSum += transportPrice;
      }

      const name = p.display_name || p.email?.split("@")[0] || "Ami";
      const displayName = isStar ? `${name} ⭐ (${city})` : `${name} (${city})`;

      participantLines.push({
        city: displayName,
        count: 1,
        pricePerPerson: transportPrice,
        isReserved: isTransportReserved,
        userId: p.user_id || null,
        transportStatus: userPick?.status || "estimé",
        isStar,
      });
    }

    if (participantLines.length === 0) {
      participantLines.push({
        city: `Groupe (${tripOrigin})`,
        count: totalGroupParticipants,
        pricePerPerson: fallbackTransport,
        isReserved: false,
        userId: null,
        transportStatus: "estimé",
      });
      estimatedTransportSum += fallbackTransport * totalGroupParticipants;
    }

    const destName =
      (reco.data as any).destinations?.name ?? budget.destinationName ?? "Destination";

    const { computeItineraryActivitiesCost } = await import("@/lib/krew/cost-split");
    const itinerary = (trip.data as any)?.group_itinerary;
    const itineraryActivities = computeItineraryActivitiesCost(itinerary?.days);

    let activitiesCost = Number(budget.activities ?? 0);
    let activitiesPriceStatus = itineraryActivities.priceStatus;

    if (itineraryActivities.activitiesPerPerson != null) {
      activitiesCost = itineraryActivities.activitiesPerPerson;
    }

    const split = buildCostSplit({
      destinationName: destName,
      accommodation: accommodationCost,
      activities: activitiesCost,
      food: Number(budget.food ?? 0),
      origins: participantLines,
      fallbackTransportPerPerson: fallbackTransport,
      participants: totalGroupParticipants || 1,
      starPaysShare: logistics.star_pays_share !== false,
    } as any);

    split.activitiesPriceStatus = activitiesPriceStatus;

    const isHotelReserved = hotelBookingStatus === "réservé";
    const sharedCostReserved = isHotelReserved ? accommodationCost : 0;
    const sharedCostEstimated = isHotelReserved ? 0 : accommodationCost;

    const foodCost = Number(budget.food ?? 0);

    const totalReserved =
      reservedTransportSum + sharedCostReserved + (isHotelReserved ? activitiesCost + foodCost : 0);
    const totalEstimated =
      estimatedTransportSum +
      sharedCostEstimated +
      (isHotelReserved ? 0 : activitiesCost + foodCost);

    return {
      tripName: trip.data.name as string,
      isSelected: Boolean(reco.data.is_selected),
      recommendationId: reco.data.id as string,
      hotelBookingStatus,
      isHotelReserved,
      totalReserved: Math.round(totalReserved),
      totalEstimated: Math.round(totalEstimated),
      split: {
        ...split,
        lines: split.lines.map((l, idx) => {
          const pl = participantLines[idx];
          return {
            ...l,
            userId: pl?.userId || null,
            isTransportReserved: pl?.isReserved || false,
            transportStatus: pl?.transportStatus || "estimé",
          };
        }),
      },
    };
  });
