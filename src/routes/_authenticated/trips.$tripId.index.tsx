// src/routes/_authenticated/trips.$tripId.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Heart, Loader2, MapPin, Sparkles, Star, Trash2, UserPlus, Users, Wallet, Copy, Link2, Check, ClipboardList, Lock, Unlock, CalendarDays, RefreshCw, Utensils, Wine, Camera, Plane, Hotel, Train } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  getTripDetail,
  generateRecommendations,
  getGenerationReadiness,
  getCostSplit,
  inviteParticipant,
  removeParticipant,
  selectRecommendation,
  toggleVote,
  toggleActivityVote,
  finalizeSelectedActivities,
  generateGroupItinerary,
  regenerateItinerarySlot,
  proposeStayAndTransport,
  voteHotel,
  pickTransport,
  setTransportTimeFilters,
  cancelTrip,
} from "@/lib/trips.functions";
import { getParticipantsProgress, getMyParticipantPreferences } from "@/lib/participant-preferences.functions";
import { searchExternalForTrip } from "@/lib/external/search-hotels.functions";
import { categoryLabel, eventTypeLabel, formatEuro, TRIP_STATUS_LABELS } from "@/lib/krew/constants";
import type { BudgetBreakdown, ItineraryDay } from "@/lib/krew/engine";
import { cn } from "@/lib/utils";
import { CostSplitCard } from "@/components/krew/CostSplitCard";
import { TripHubDashboard } from "@/components/krew/TripHubDashboard";
import {
  getTripAvailability,
  chooseTripDates,
  unlockTripDates,
} from "@/lib/availability.functions";
import { getStarPreferences } from "@/lib/star-preferences.functions";
import { buildTripIcs } from "@/lib/krew/calendar-export";
import { PackingListCard } from "@/components/krew/PackingListCard";
import { TransportTimePrefsCard } from "@/components/krew/TransportTimePrefsCard";


/** Photo destination : URL DB ou image Unsplash stable selon la ville. */
function destinationPhotoUrl(name?: string | null, imageUrl?: string | null) {
  if (imageUrl && /^https?:\/\//i.test(String(imageUrl))) return String(imageUrl);
  const key = String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  const known: Record<string, string> = {
    barcelone: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
    barcelona: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
    lisbonne: "https://images.unsplash.com/photo-1555881403-64995e224d73?auto=format&fit=crop&w=800&q=80",
    lisbon: "https://images.unsplash.com/photo-1555881403-64995e224d73?auto=format&fit=crop&w=800&q=80",
    porto: "https://images.unsplash.com/photo-1555881403-26d5c5c6e0e1?auto=format&fit=crop&w=800&q=80",
    rome: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80",
    milan: "https://images.unsplash.com/photo-1513581166391-887a96ddeafd?auto=format&fit=crop&w=800&q=80",
    amsterdam: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=800&q=80",
    berlin: "https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=800&q=80",
    prague: "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=800&q=80",
    budapest: "https://images.unsplash.com/photo-1541343672885-9be56236302a?auto=format&fit=crop&w=800&q=80",
    vienne: "https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=800&q=80",
    vienna: "https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=800&q=80",
    londres: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
    london: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
    paris: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
    nice: "https://images.unsplash.com/photo-1491160950325-4c0b0b0b0b0b?auto=format&fit=crop&w=800&q=80",
    marseille: "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?auto=format&fit=crop&w=800&q=80",
    bordeaux: "https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?auto=format&fit=crop&w=800&q=80",
    lyon: "https://images.unsplash.com/photo-1524396309943-e03f5249f002?auto=format&fit=crop&w=800&q=80",
    bruxelles: "https://images.unsplash.com/photo-1559113202-c916b8e44373?auto=format&fit=crop&w=800&q=80",
    brussels: "https://images.unsplash.com/photo-1559113202-c916b8e44373?auto=format&fit=crop&w=800&q=80",
    madrid: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=800&q=80",
    valence: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=800&q=80",
    valencia: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=800&q=80",
    seville: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
    sevilla: "https://images.unsplash.com/photo-1515443961218-a595975c78b4?auto=format&fit=crop&w=800&q=80",
    athens: "https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=800&q=80",
    athenes: "https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=800&q=80",
    dubrovnik: "https://images.unsplash.com/photo-1555990793-da11162e95d7?auto=format&fit=crop&w=800&q=80",
    split: "https://images.unsplash.com/photo-1555990793-da11162e95d7?auto=format&fit=crop&w=800&q=80",
    croatie: "https://images.unsplash.com/photo-1555990793-da11162e95d7?auto=format&fit=crop&w=800&q=80",
    nice: "https://images.unsplash.com/photo-1491161322373-3a5d0f5e0c0a?auto=format&fit=crop&w=800&q=80",
  };
  for (const [city, url] of Object.entries(known)) {
    if (key.includes(city)) return url;
  }
  // Fallback travel lifestyle (varie un peu avec le hash du nom)
  const fallbacks = [
    "https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1527631746610-b998ef1c7d1d?auto=format&fit=crop&w=800&q=80",
  ];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 1)) % fallbacks.length;
  return fallbacks[h]!;
}

export const Route = createFileRoute("/_authenticated/trips/$tripId/")({
  head: () => ({
    meta: [
      { title: "Mon Voyage — Krew" },
      { name: "description", content: "Propositions Krew, planning jour par jour, budget détaillé et votes du groupe." },
      { property: "og:title", content: "Mon Voyage — Krew" },
      { property: "og:description", content: "Comparez les propositions et validez le voyage avec votre groupe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TripDetail,
});

type Recommendation = {
  id: string;
  score: number;
  rationale: string | null;
  match_reasons: string[] | null;
  is_selected: boolean;
  itinerary: ItineraryDay[] | null;
  budget: BudgetBreakdown | null;
  activity_ids: string[] | null;
  destinations: { name: string; country: string; description: string | null; image_url: string | null; rating: number } | null;
  accommodations: { name: string; type: string; rating: number; price_per_night_per_person: number; distance_center_km: number } | null;
};

function TripDetail() {
  const { tripId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const vote = useServerFn(toggleVote);
  const select = useServerFn(selectRecommendation);
  const invite = useServerFn(inviteParticipant);
  const removeGuest = useServerFn(removeParticipant);
  const regenerate = useServerFn(generateRecommendations);
  const fetchReadiness = useServerFn(getGenerationReadiness);
  const { data: readiness } = useQuery({
    queryKey: ["generation-readiness", tripId],
    queryFn: () => fetchReadiness({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });
  const fetchProgress = useServerFn(getParticipantsProgress);
  const searchExternal = useServerFn(searchExternalForTrip);
  const fetchSplit = useServerFn(getCostSplit);
  const fetchAvail = useServerFn(getTripAvailability);
  const fetchStar = useServerFn(getStarPreferences);
  const { data: starData } = useQuery({
    queryKey: ["star-prefs", tripId],
    queryFn: () => fetchStar({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const chooseDatesFn = useServerFn(chooseTripDates);
  const unlockDatesFn = useServerFn(unlockTripDates);

  const handleMutationError = (error: any, fallbackMessage: string) => {
    const errMsg = String(error?.message || "");
    if (errMsg.includes("RATE_LIMITED:")) {
      const cleanMsg = errMsg.split("RATE_LIMITED:")[1]?.trim();
      if (cleanMsg) {
        toast.error(cleanMsg);
        return;
      }
    }
    toast.error(String(error?.message ?? fallbackMessage).slice(0, 160));
  };

  const { data: availData } = useQuery({
    queryKey: ["trip-availability", tripId],
    queryFn: () => fetchAvail({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });
  const { data: costSplitData } = useQuery({
    queryKey: ["cost-split", tripId],
    queryFn: () => fetchSplit({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });
  const [email, setEmail] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [arriveByFilter, setArriveByFilter] = useState("");
  const [departAfterFilter, setDepartAfterFilter] = useState("");
  const [pickArrival, setPickArrival] = useState("12:00");
  const [pickDeparture, setPickDeparture] = useState("18:00");

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${tripId}`;
  }, [tripId]);

  const queryKey = ["trip", tripId];
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => fetchDetail({ data: { tripId } }) });
  const progressQueryKey = ["trip-progress", tripId];
  const { data: progress } = useQuery({
    queryKey: progressQueryKey,
    queryFn: () => fetchProgress({ data: { tripId } }),
  });
  const fetchMyPrefs = useServerFn(getMyParticipantPreferences);
  const { data: myPrefsData } = useQuery({
    queryKey: ["my-participant-prefs", tripId],
    queryFn: () => fetchMyPrefs({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: progressQueryKey });
  };

  const voteMutation = useMutation({
    mutationFn: (recommendationId: string) => vote({ data: { tripId, recommendationId } }),
    onSuccess: refresh,
  });

  const activityVoteFn = useServerFn(toggleActivityVote);
  const finalizeActivitiesFn = useServerFn(finalizeSelectedActivities);
  const activityVoteMutation = useMutation({
    mutationFn: (activityId: string) =>
      activityVoteFn({ data: { tripId, activityId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Vote activité impossible").slice(0, 120)),
  });
  const finalizeActivitiesMutation = useMutation({
    mutationFn: (activityIds: string[]) =>
      finalizeActivitiesFn({ data: { tripId, activityIds } }),
    onSuccess: () => {
      toast.success("Activités validées pour le voyage");
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Validation impossible").slice(0, 120)),
  });

  const generateItineraryFn = useServerFn(generateGroupItinerary);
  const regenerateSlotFn = useServerFn(regenerateItinerarySlot);
  const itineraryMutation = useMutation({
    mutationFn: () => generateItineraryFn({ data: { tripId, force: true } }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      if (res?.ok) {
        toast.success(
          res.usedLlm
            ? "Planning activités généré (IA)"
            : "Planning activités généré (mode local)",
        );
        document.getElementById("hub-activities-plan")?.scrollIntoView({ behavior: "smooth" });
      }
    },
    onError: (e: any) => handleMutationError(e, "Génération planning impossible"),
  });
  const slotMutation = useMutation({
    mutationFn: (payload: { day: number; slotIndex: number }) =>
      regenerateSlotFn({ data: { tripId, day: payload.day, slotIndex: payload.slotIndex } }),
    onSuccess: () => {
      toast.success("Créneau mis à jour");
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) =>
      toast.error(String(e?.message ?? "Régénération impossible").slice(0, 140)),
  });

  const proposeLogisticsFn = useServerFn(proposeStayAndTransport);
  const logisticsMutation = useMutation({
    mutationFn: () => proposeLogisticsFn({ data: { tripId, refreshExternal: true } }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      const nH = res?.logistics?.hotels?.length ?? 0;
      const nT = res?.logistics?.transports?.length ?? 0;
      toast.success(`Logistique : ${nH} hôtels · ${nT} trajets`);
      document.getElementById("hub-logistics")?.scrollIntoView({ behavior: "smooth" });
    },
    onError: (e: any) => handleMutationError(e, "Recherche logistique impossible"),
  });

  const voteHotelFn = useServerFn(voteHotel);
  const pickTransportFn = useServerFn(pickTransport);
  const hotelVoteMutation = useMutation({
    mutationFn: (hotelId: string) => voteHotelFn({ data: { tripId, hotelId } }),
    onSuccess: () => {
      toast.success("Vote hôtel enregistré");
      refresh();
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Vote impossible").slice(0, 120)),
  });
  const setTimeFiltersFn = useServerFn(setTransportTimeFilters);
  const timeFilterMutation = useMutation({
    mutationFn: () =>
      setTimeFiltersFn({
        data: {
          tripId,
          arriveBy: arriveByFilter || null,
          departAfter: departAfterFilter || null,
        },
      }),
    onSuccess: () => {
      toast.success("Filtres horaires enregistrés");
      refresh();
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Erreur filtres").slice(0, 120)),
  });
  const transportPickMutation = useMutation({

    mutationFn: (payload: {
      city: string;
      mode: string;
      modeLabel?: string;
      label: string;
      time?: string;
      arrivalTime?: string;
      departureTime?: string;
      pricePerPerson?: number;
      url?: string | null;
    }) => pickTransportFn({ data: { tripId, ...payload } }),
    onSuccess: () => {
      toast.success("Trajet choisi — visible pour ta ville de départ");
      refresh();
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Choix impossible").slice(0, 120)),
  });


  const selectMutation = useMutation({
    mutationFn: (recommendationId: string) => select({ data: { tripId, recommendationId } }),
    onSuccess: () => {
      toast.success("Destination validée pour le groupe !");
      refresh();
    },
  });
  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: { tripId, email: email.trim() } }),
    onSuccess: () => {
      toast.success("Invitation ajoutée");
      setEmail("");
      refresh();
    },
    onError: () => toast.error("Adresse email invalide ou déjà invitée"),
  });
  const removeMutation = useMutation({
    mutationFn: (participantId: string) => removeGuest({ data: { participantId } }),
    onSuccess: refresh,
  });
  const cancelFn = useServerFn(cancelTrip);
  const cancelMutation = useMutation({
    mutationFn: (hardDelete?: boolean) =>
      cancelFn({ data: { tripId, hardDelete: Boolean(hardDelete) } }),
    onSuccess: (res) => {
      toast.success(res.mode === "deleted" ? "Voyage supprimé" : "Voyage annulé");
      window.location.href = "/dashboard";
    },
    onError: (e: any) => toast.error(String(e?.message ?? e).slice(0, 120)),
  });
  const regenerateMutation = useMutation({
    // `force` reste explicite (usage test/admin uniquement) : par défaut le serveur
    // applique assessGenerationReadiness et refuse si les questionnaires sont incomplets.
    mutationFn: (force?: boolean) => regenerate({ data: { tripId, force: force === true } }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      if (res?.skipped) {
        toast.error(res?.readiness?.message ?? "Pas assez de réponses pour générer");
      } else if ((res?.count ?? 0) === 0) {
        toast.warning(
          res?.providerErrors?.length
            ? `Aucune proposition (${res.providerErrors[0]})`
            : "Aucune proposition générée — réessaie ou élargis les critères",
        );
      } else {
        toast.success(`${res.count} proposition(s) générée(s)`);
        document.getElementById("hub-destination")?.scrollIntoView({ behavior: "smooth" });
      }
      refresh();
    },
    onError: (e: any) => handleMutationError(e, "Erreur lors de la génération"),
  });

  const searchExternalMutation = useMutation({
    mutationFn: () => searchExternal({ data: { tripId } }),
    onSuccess: (res: any) => {
      if (res?.ok === false) {
        toast.warning(res.message ?? "Aucune donnée externe récupérée");
        return;
      }
      toast.success(
        `${res.destination} : ${res.accommodationsCount} hébergements comparés${
          res.comparedProviders?.length ? ` (${res.comparedProviders.join(", ")})` : ""
        }, ${res.activitiesCount} activités · ${res.weatherSummary}`,
      );
      if (res.providerErrors?.length) {
        console.warn("Sources indisponibles", res.providerErrors);
      }
      refresh();
    },
    onError: (err: any) => {
      console.error("Recherche externe échouée", err);
      toast.error(err?.message ?? "Recherche externe échouée");
    },
  });


  const chooseDatesMutation = useMutation({
    mutationFn: (payload: { start: string; end: string }) =>
      chooseDatesFn({ data: { tripId, startDate: payload.start, endDate: payload.end } }),
    onSuccess: () => {
      toast.success("Dates validées — les recherches destinations peuvent démarrer");
      queryClient.invalidateQueries({ queryKey: ["trip-availability", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Impossible de valider les dates").slice(0, 140)),
  });

  const unlockDatesMutation = useMutation({
    mutationFn: () => unlockDatesFn({ data: { tripId } }),
    onSuccess: () => {
      toast.success("Dates déverrouillées");
      queryClient.invalidateQueries({ queryKey: ["trip-availability", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Erreur").slice(0, 120)),
  });


  const tripPreview = data?.trip as any;
  const recommendationsPreview = (data?.recommendations ?? []) as any[];
  const selectedRecoPreview = recommendationsPreview.find((r: any) => r.is_selected);
  const logisticsPreview = (tripPreview?.group_logistics || {}) as any;

  const liveBudget = useMemo(() => {
    const trip = tripPreview || {};
    const selectedReco = selectedRecoPreview;
    const logistics = logisticsPreview;
    const b = selectedReco?.budget as any;
    const nights = (() => {
      if (trip.start_date && trip.end_date) {
        const ms =
          new Date(trip.end_date + "T12:00:00").getTime() -
          new Date(trip.start_date + "T12:00:00").getTime();
        const d = Math.round(ms / 86400000);
        return d >= 1 ? d : Number(trip.duration_nights) || 2;
      }
      return Number(trip.duration_nights) || 2;
    })();

    let transport = Number(b?.transport ?? 0);
    let accommodation = Number(b?.accommodation ?? 0);
    let activities = Number(b?.activities ?? 0);
    let food = Number(b?.food ?? 0);

    const hotels = (logistics.hotels ?? []) as any[];
    const topHotelId = logistics.selectedHotelId as string | null;
    if (topHotelId) {
      const h = hotels.find((x: any) => x.id === topHotelId);
      if (h?.totalEstimate != null) accommodation = Number(h.totalEstimate);
      else if (h?.pricePerNight != null) accommodation = Number(h.pricePerNight) * nights;
    }

    const picks = (logistics.transportPicks ?? []) as any[];
    if (picks.length) {
      const prices = picks
        .map((p: any) => Number(p.pricePerPerson))
        .filter((n: number) => Number.isFinite(n) && n > 0);
      if (prices.length) {
        transport = Math.round(prices.reduce((a: number, c: number) => a + c, 0) / prices.length);
      }
    }

    const days = (trip.group_itinerary?.days ?? []) as any[];
    if (days.length) {
      let actSum = 0;
      for (const d of days) {
        for (const s of d.slots ?? []) {
          if (s.priceHint != null && Number(s.priceHint) > 0) actSum += Number(s.priceHint);
        }
      }
      if (actSum > 0) {
        food = Math.round(actSum * 0.45);
        activities = Math.round(actSum * 0.55);
      }
    }

    const total =
      Math.round(transport) +
      Math.round(accommodation) +
      Math.round(activities) +
      Math.round(food);

    return {
      transport: Math.round(transport),
      accommodation: Math.round(accommodation),
      activities: Math.round(activities),
      food: Math.round(food),
      total,
      baseBudget: Number(trip.budget_per_person) || 0,
      destinationName: selectedReco?.destinations?.name ?? null,
      country: selectedReco?.destinations?.country ?? null,
      topHotelName: topHotelId
        ? hotels.find((x: any) => x.id === topHotelId)?.name ?? null
        : null,
      transportPicksCount: picks.length,
      nights,
    };
  }, [tripPreview, selectedRecoPreview, logisticsPreview]);

  function buildWhatsAppSummary() {
    const trip = tripPreview || {};
    const lines: string[] = [
      `Salut ! On organise « ${trip.name || "notre voyage"} » avec Krew ✈️`,
      "",
    ];
    if (trip.event_type) lines.push(`Type : ${String(trip.event_type).replace(/_/g, " ")}`);
    if (liveBudget.destinationName) {
      lines.push(
        `Lieu : ${liveBudget.destinationName}${liveBudget.country ? ` (${liveBudget.country})` : ""}`,
      );
    }
    if (trip.start_date && trip.end_date) {
      const a = new Date(trip.start_date + "T12:00:00").toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
      });
      const b = new Date(trip.end_date + "T12:00:00").toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      lines.push(`Dates : ${a} → ${b}`);
    } else if (trip.start_date) {
      lines.push(`Date : ${new Date(trip.start_date + "T12:00:00").toLocaleDateString("fr-FR")}`);
    }
    if (liveBudget.total > 0) {
      lines.push(`Budget estimé : ~${liveBudget.total} € / pers.`);
      lines.push(
        `  · transport ${liveBudget.transport} € · héberg. ${liveBudget.accommodation} € · act. ${liveBudget.activities} € · repas ${liveBudget.food} €`,
      );
    } else if (liveBudget.baseBudget > 0) {
      lines.push(`Budget cible : ${liveBudget.baseBudget} € / pers.`);
    }
    if (liveBudget.topHotelName) lines.push(`Hôtel plébiscité : ${liveBudget.topHotelName}`);
    lines.push("");
    lines.push("Rejoins le groupe et indique tes dispos ici :");
    if (typeof window !== "undefined" && trip.id) {
      lines.push(`${window.location.origin}/join/${trip.id}`);
    }
    return lines.join("\n");
  }

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 rounded-3xl" />
      </main>
    );
  }

  const trip = data.trip;
  const recommendations = (data.recommendations ?? []) as unknown as Recommendation[];
  const activities = (data.activities ?? []) as {
    id: string;
    name: string;
    category: string;
    price_per_person: number;
    rating: number;
  }[];
  const votes = (data.votes ?? []) as { recommendation_id: string; user_id: string }[];
  const activityVotes = ((data as any).activityVotes ?? []) as {
    activity_id: string;
    user_id: string;
  }[];
  const participants = (data.participants ?? []) as any[];
  const destinationSelected = recommendations.some((r) => r.is_selected);
  const selectedReco = recommendations.find((r) => r.is_selected);
  const logistics = ((trip as any).group_logistics || {}) as any;
  const selectedActivityIds = new Set<string>(
    ((trip as any).selected_activity_ids ?? []) as string[],
  );

  const handleDownloadIcs = () => {
    const icsContent = buildTripIcs(trip, trip.group_itinerary);
    if (!icsContent) {
      toast.error("Impossible d'exporter le calendrier : vérifiez que les dates sont verrouillées.");
      return;
    }
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${trip.name || "voyage"}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Calendrier .ics téléchargé !");
  };

  const googleCalendarUrl = useMemo(() => {
    if (!trip.start_date || !trip.end_date) return "";
    const start = trip.start_date.replace(/[-]/g, "");
    const endDateObj = new Date(trip.end_date);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const nextDay = endDateObj.toISOString().slice(0, 10).replace(/[-]/g, "");
    const title = encodeURIComponent(trip.name || "Mon Voyage Krew");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${nextDay}`;
  }, [trip.start_date, trip.end_date, trip.name]);


  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <TripHubDashboard
        viewerUserId={data.userId}
        tripId={tripId}
        trip={trip}
        isOwner={data.isOwner}
        participantsCount={(data.participants?.length ?? trip.participants_count) || 1}
        progressAnswered={progress?.answered ?? 0}
        progressTotal={progress?.expected ?? progress?.total ?? trip.participants_count ?? 1}
        availabilityAnswered={availData?.answered ?? 0}
        availabilityExpected={availData?.expected ?? trip.participants_count ?? 1}
        provisionalStart={trip.start_date ?? availData?.windows?.[0]?.start ?? (trip as any).provisional_start_date}
        provisionalCoverage={availData?.windows?.[0]?.coverageRatio}
        myAvailabilityDone={Boolean(availData?.mine)}
        myPreferencesDone={Boolean((myPrefsData as any)?.preferences)}
        starDone={Boolean(starData?.preferences)}
        hasRecommendations={recommendations.length > 0}
        destinationSelected={recommendations.some((r) => r.is_selected)}
        destinationName={
          recommendations.find((r) => r.is_selected)?.destinations?.name ?? null
        }
        liveBudgetTotal={liveBudget.total > 0 ? liveBudget.total : null}
        topScores={recommendations.slice(0, 3).map((r) => ({
          name: r.destinations?.name ?? "Destination",
          score: r.score,
        }))}
      >
      </TripHubDashboard>

      {/* Résumé live + partage WhatsApp */}
      <section className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
              <Wallet className="size-5 text-primary" />
              Résumé du voyage
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Se met à jour avec les votes hôtel, trajets choisis et le planning.
            </p>
          </div>
          <Button
            type="button"
            className="bg-[#25D366] text-white hover:bg-[#1ebe57] border-transparent"
            onClick={() => {
              const text = buildWhatsAppSummary();
              window.open(
                `https://wa.me/?text=${encodeURIComponent(text)}`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
          >
            Partager sur WhatsApp
          </Button>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div className="rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Dates</dt>
            <dd className="mt-0.5 font-medium">
              {trip.start_date && trip.end_date
                ? `${new Date(trip.start_date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${new Date(trip.end_date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                : trip.start_date
                  ? new Date(trip.start_date + "T12:00:00").toLocaleDateString("fr-FR")
                  : "À définir"}
            </dd>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Lieu</dt>
            <dd className="mt-0.5 font-medium">
              {liveBudget.destinationName
                ? `${liveBudget.destinationName}${liveBudget.country ? ` · ${liveBudget.country}` : ""}`
                : "Destination à choisir"}
            </dd>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Budget / pers.</dt>
            <dd className="mt-0.5 font-semibold text-primary">
              {liveBudget.total > 0
                ? `~${formatEuro(liveBudget.total)}`
                : liveBudget.baseBudget > 0
                  ? `cible ${formatEuro(liveBudget.baseBudget)}`
                  : "—"}
            </dd>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Groupe</dt>
            <dd className="mt-0.5 font-medium">
              {trip.participants_count || participants?.length || "?"} pers.
              {liveBudget.topHotelName ? ` · hôtel : ${liveBudget.topHotelName}` : ""}
            </dd>
          </div>
        </dl>

        {liveBudget.total > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <li className="rounded-full border border-border px-2.5 py-1">
              Transport ~{formatEuro(liveBudget.transport)}
            </li>
            <li className="rounded-full border border-border px-2.5 py-1">
              Héberg. ~{formatEuro(liveBudget.accommodation)}
            </li>
            <li className="rounded-full border border-border px-2.5 py-1">
              Activités ~{formatEuro(liveBudget.activities)}
            </li>
            <li className="rounded-full border border-border px-2.5 py-1">
              Repas ~{formatEuro(liveBudget.food)}
            </li>
            {liveBudget.transportPicksCount > 0 ? (
              <li className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-primary">
                {liveBudget.transportPicksCount} trajet(s) choisi(s)
              </li>
            ) : null}
          </ul>
        ) : null}
      </section>



      <section className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24" id="hub-dates">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            1. Dates du groupe
          </h2>
          <a
            href={`/trips/${tripId}/availability`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Voir le calendrier →
          </a>
        </div>

        {(availData as any)?.schemaMissing ? (
          <p className="text-sm text-destructive">
            Table dispos absente — exécute le SQL trip_availability dans Lovable.
          </p>
        ) : (trip as any).dates_locked || availData?.trip?.datesLocked ? (
          <div className="rounded-2xl border border-lagoon/40 bg-lagoon/10 px-4 py-3">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <Lock className="size-4 text-lagoon" />
              Dates validées
            </p>
            <p className="mt-1 text-sm">
              {new Date(
                ((trip as any).start_date || availData?.trip?.lockedStart) + "T12:00:00",
              ).toLocaleDateString("fr-FR")}
              {" → "}
              {new Date(
                ((trip as any).end_date || availData?.trip?.lockedEnd) + "T12:00:00",
              ).toLocaleDateString("fr-FR")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ces dates alimentent les recherches API (vols, hébergements, activités).
            </p>
            {data.isOwner ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={unlockDatesMutation.isPending}
                onClick={() => {
                  if (window.confirm("Déverrouiller les dates pour en choisir d'autres ?")) {
                    unlockDatesMutation.mutate();
                  }
                }}
              >
                {unlockDatesMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Unlock className="size-3.5" />
                )}
                Déverrouiller
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {(availData?.answered ?? 0)}/{availData?.expected ?? trip.participants_count ?? 1}{" "}
              dispos reçues. L&apos;organisateur valide une fenêtre pour lancer les destinations.
            </p>
            <ul className="space-y-2">
              {(availData?.windows ?? []).slice(0, 3).map((w: any, i: number) => (
                <li
                  key={`${w.start}-${w.end}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface/30 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">
                      {i === 0 ? "🥇 " : i === 1 ? "🥈 " : "🥉 "}
                      {new Date(w.start + "T12:00:00").toLocaleDateString("fr-FR")} →{" "}
                      {new Date(w.end + "T12:00:00").toLocaleDateString("fr-FR")}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {w.covered}/{w.total} · {Math.round((w.coverageRatio ?? 0) * 100)} %
                      </span>
                    </p>
                    {(w.availablePeople?.length ?? 0) > 0 ? (
                      <p className="mt-0.5 text-xs text-lagoon">
                        ✅ {w.availablePeople.map((p: any) => p.name).join(", ")}
                      </p>
                    ) : null}
                    {(w.unavailablePeople?.length ?? 0) > 0 ? (
                      <p className="mt-0.5 text-xs text-destructive/90">
                        ❌ {w.unavailablePeople.map((p: any) => p.name).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  {data.isOwner ? (
                    <Button
                      size="sm"
                      variant={i === 0 ? "default" : "outline"}
                      disabled={chooseDatesMutation.isPending}
                      onClick={() =>
                        chooseDatesMutation.mutate({ start: w.start, end: w.end })
                      }
                    >
                      {chooseDatesMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Lock className="size-3.5" />
                      )}
                      Valider ces dates
                    </Button>
                  ) : null}
                </li>
              ))}
              {(availData?.windows ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Pas encore de fenêtre commune — attends plus de réponses dispos.
                </p>
              ) : null}
            </ul>
          </>
        )}
      </section>


      


      <section id="hub-destination" className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">2. Destinations proposées</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Score, budget moyen et activités — votez, l&apos;orga valide.
            </p>
          </div>
          {data.isOwner ? (
            <Button
              variant="hero"
              onClick={() => regenerateMutation.mutate()}
              disabled={
                regenerateMutation.isPending || (readiness ? !readiness.canGenerate : false)
              }
              title={
                readiness && !readiness.canGenerate
                  ? readiness.message ?? "Questionnaires incomplets"
                  : undefined
              }
            >
              {regenerateMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              {recommendations.length ? "Régénérer" : "Générer les propositions"}
            </Button>
          ) : null}
        </div>
        {recommendations.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {data.isOwner
              ? readiness && !readiness.canGenerate
                ? (readiness.message ??
                  "Les questionnaires doivent être complétés avant de générer les propositions.")
                : "Clique sur « Générer les propositions » pour lancer la recherche de destinations Krew."
              : "L'organisateur générera bientôt les propositions de destinations."}
          </p>
        ) : (
          <>
          {destinationSelected ? (
            <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
              Destination validée — {Math.max(0, recommendations.length - 1)} autre
              {Math.max(0, recommendations.length - 1) > 1 ? "s" : ""} encore visible
              {Math.max(0, recommendations.length - 1) > 1 ? "s" : ""}
              {data.isOwner ? " (change possible)." : "."}
            </p>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-1">
          {[...recommendations]
            .sort((a, b) => Number(b.is_selected) - Number(a.is_selected) || b.score - a.score)
            .map((reco, index) => {
            const recoVotes = votes.filter((v) => v.recommendation_id === reco.id);
            const hasVoted = recoVotes.some((v) => v.user_id === data.userId);
            const recoActivities = activities
              .filter((a) => (reco.activity_ids ?? []).includes(a.id))
              .slice(0, 3);
            const budgetTotal =
              reco.budget != null
                ? Number(reco.budget.transport || 0) +
                  Number(reco.budget.accommodation || 0) +
                  Number(reco.budget.activities || 0) +
                  Number(reco.budget.food || 0)
                : null;
            const reasons = (reco.match_reasons ?? []).slice(0, 4);
            return (
              <article
                key={reco.id}
                className={cn(
                  "rounded-2xl border bg-card p-4 shadow-sm transition sm:p-5",
                  reco.is_selected
                    ? "border-emerald-500 ring-2 ring-emerald-500/20"
                    : "border-border",
                )}
              >
                <div className="flex gap-3 sm:gap-4">
                  <img
                    src={destinationPhotoUrl(
                      reco.destinations?.name,
                      reco.destinations?.image_url,
                    )}
                    alt={reco.destinations?.name ? `Vue de ${reco.destinations.name}` : "Destination"}
                    loading="lazy"
                    className="h-24 w-24 shrink-0 rounded-xl object-cover sm:h-28 sm:w-28"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          #{index + 1}
                          {reco.destinations?.country ? ` · ${reco.destinations.country}` : ""}
                        </p>
                        <h3 className="font-display text-xl font-semibold leading-tight">
                          {reco.destinations?.name}
                        </h3>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {reco.is_selected ? (
                          <Badge variant="success">Choisie</Badge>
                        ) : null}
                        <Badge variant="lagoon">{Math.round(reco.score)} %</Badge>
                      </div>
                    </div>

                    {/* Budget moyen */}
                    {budgetTotal != null && budgetTotal > 0 ? (
                      <p className="mt-2 text-sm">
                        <span className="font-semibold text-foreground">
                          ~{formatEuro(budgetTotal)}
                        </span>
                        <span className="text-muted-foreground"> / pers. tout compris</span>
                        {(reco.budget as any)?.budgetFitTotal ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            · budget OK pour {(reco.budget as any).budgetFitCount}/
                            {(reco.budget as any).budgetFitTotal}
                          </span>
                        ) : null}
                      </p>
                    ) : null}

                    {/* Pourquoi ça match le groupe */}
                    {reasons.length ? (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {reasons.map((reason: string) => (
                          <li
                            key={reason}
                            className="rounded-full bg-primary/8 px-2.5 py-0.5 text-[11px] text-foreground/80"
                          >
                            {reason}
                          </li>
                        ))}
                      </ul>
                    ) : reco.rationale ? (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {reco.rationale}
                      </p>
                    ) : null}

                    {/* 2–3 activités */}
                    {recoActivities.length ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">À faire · </span>
                        {recoActivities
                          .map(
                            (a: any) =>
                              `${a.name}${a.price_per_person ? ` (${formatEuro(Number(a.price_per_person))})` : ""}`,
                          )
                          .join(" · ")}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant={hasVoted ? "lagoon" : "outline"}
                        disabled={voteMutation.isPending}
                        onClick={() => voteMutation.mutate(reco.id)}
                      >
                        <Heart className={cn("size-3.5", hasVoted && "fill-current")} />
                        {hasVoted ? "Mon vote" : "Voter"} · {recoVotes.length}
                      </Button>
                      {data.isOwner && reco.is_selected ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="border-emerald-500 text-emerald-700"
                        >
                          <CheckCircle2 className="size-3.5" /> Destination choisie
                        </Button>
                      ) : data.isOwner ? (
                        <Button
                          size="sm"
                          variant={destinationSelected ? "outline" : "hero"}
                          onClick={() => selectMutation.mutate(reco.id)}
                          disabled={selectMutation.isPending}
                        >
                          <CheckCircle2 className="size-3.5" />
                          {destinationSelected
                            ? "Changer pour celle-ci"
                            : "Choisir cette destination"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          </div>
          </>
        )}

      </section>

      {destinationSelected ? (
        <section id="hub-logistics" className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">3. Hôtels — vote du groupe</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Chacun vote pour un hébergement. L&apos;orga réserve celui qui a le plus de voix.
              </p>
            </div>
            {data.isOwner ? (
              <Button
                variant="hero"
                disabled={logisticsMutation.isPending}
                onClick={() => logisticsMutation.mutate()}
              >
                {logisticsMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Hotel />
                )}
                {(trip as any).group_logistics?.hotels?.length
                  ? "Actualiser les offres"
                  : "Chercher des hôtels"}
              </Button>
            ) : null}
          </div>

          {(trip as any).group_logistics?.hotelVoteTodo ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              To-do orga · {(trip as any).group_logistics.hotelVoteTodo}
            </p>
          ) : null}

          {!(trip as any).group_logistics?.hotels?.length ? (
            <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {data.isOwner
                ? "Lance la recherche pour proposer des hébergements."
                : "L'organisateur proposera bientôt des hôtels à voter."}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {((trip as any).group_logistics.hotels as any[]).map((h: any) => {
                const votes = ((trip as any).group_logistics.hotelVotes ?? []) as {
                  userId: string;
                  hotelId: string;
                }[];
                const n = votes.filter((v) => v.hotelId === h.id).length;
                const iVoted = votes.some(
                  (v) => v.hotelId === h.id && v.userId === data.userId,
                );
                const isTop = (trip as any).group_logistics.selectedHotelId === h.id && n > 0;
                return (
                  <article
                    key={h.id}
                    className={cn(
                      "rounded-2xl border bg-card p-4 shadow-sm",
                      isTop ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-border",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{h.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {h.type}
                          {h.rating ? ` · ★ ${Number(h.rating).toFixed(1)}` : ""}
                        </p>
                      </div>
                      {isTop ? <Badge variant="success">Top votes</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm">
                      {formatEuro(h.pricePerNight)} / nuit / pers.
                      <span className="text-muted-foreground">
                        {" "}
                        · ~{formatEuro(h.totalEstimate)} séjour
                      </span>
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant={iVoted ? "lagoon" : "outline"}
                        disabled={hotelVoteMutation.isPending}
                        onClick={() => hotelVoteMutation.mutate(h.id)}
                      >
                        <Heart className={cn("size-3.5", iVoted && "fill-current")} />
                        {iVoted ? "Mon vote" : "Voter"} · {n}
                      </Button>
                      {(h.links?.length
                        ? h.links
                        : h.bookingUrl
                          ? [{ label: "Réserver", url: h.bookingUrl }]
                          : []
                      )
                        .slice(0, 2)
                        .map((l: any) => (
                          <a
                            key={l.label + l.url}
                            href={l.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {l.label} →
                          </a>
                        ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {destinationSelected ? (
        <section id="hub-transports" className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">4. Transports A/R</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choisis ton trajet + horaires d&apos;arrivée / départ. Ils orientent le planning
                une fois tout le monde fixé.
              </p>
            </div>
            {data.isOwner && !(trip as any).group_logistics?.transports?.length ? (
              <Button
                variant="outline"
                disabled={logisticsMutation.isPending}
                onClick={() => logisticsMutation.mutate()}
              >
                {logisticsMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Plane />
                )}
                Générer les options
              </Button>
            ) : null}
          </div>


          <TransportTimePrefsCard tripId={tripId} />

          {!(trip as any).group_logistics?.transports?.length ? (
            <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Les options de trajet apparaîtront après la recherche logistique (orga).
            </p>
          ) : (
            <div className="space-y-6">
              {(() => {
                const transports = ((trip as any).group_logistics.transports ?? []) as any[];
                const picks = ((trip as any).group_logistics.transportPicks ?? []) as any[];
                const cities = [...new Set(transports.map((tr) => tr.city as string))];
                return cities.map((city) => {
                  const options = transports.filter((tr) => tr.city === city);
                  const cityPicks = picks.filter(
                    (p) => String(p.city).toLowerCase() === String(city).toLowerCase(),
                  );
                  const myPick = picks.find((p) => p.userId === data.userId);
                  return (
                    <div
                      key={city}
                      className="rounded-3xl border border-border bg-card p-4 sm:p-5"
                    >
                      <h3 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
                        <Plane className="size-4 text-primary" />
                        Depuis {city}
                      </h3>
                      {cityPicks.length ? (
                        <ul className="mt-2 space-y-1 rounded-xl bg-surface/50 px-3 py-2 text-xs text-muted-foreground">
                          {cityPicks.map((p) => (
                            <li key={p.userId}>
                              <span className="font-medium text-foreground">
                                {p.displayName}
                              </span>
                              {" · "}
                              {p.modeLabel || p.mode}
                              {p.arrivalTime || p.time
                                ? ` · arrivée ${p.arrivalTime || p.time}`
                                : ""}
                              {p.departureTime ? ` · retour ${p.departureTime}` : ""}
                              {p.label ? ` · ${p.label}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Personne de {city} n&apos;a encore choisi de trajet.
                        </p>
                      )}
                      <ul className="mt-3 space-y-2">
                        {options.map((tr: any, i: number) => {
                          const isMine =
                            myPick &&
                            myPick.city === tr.city &&
                            myPick.mode === tr.mode &&
                            myPick.label === tr.label;
                          return (
                            <li
                              key={`${tr.city}-${tr.mode}-${i}`}
                              className={cn(
                                "flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3",
                                isMine
                                  ? "border-primary bg-primary/5"
                                  : "border-border bg-background/40",
                              )}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium">
                                  {tr.modeLabel || tr.mode} · {tr.label}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  ~{formatEuro(tr.pricePerPerson)} / pers. A/R
                                  {tr.note ? ` · ${tr.note}` : ""}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  variant={isMine ? "hero" : "outline"}
                                  disabled={transportPickMutation.isPending}
                                  onClick={() =>
                                    transportPickMutation.mutate({
                                      city: tr.city,
                                      mode: tr.mode,
                                      modeLabel: tr.modeLabel,
                                      label: tr.label,
                                      pricePerPerson: tr.pricePerPerson,
                                      url: tr.url,
                                      arrivalTime: pickArrival || undefined,
                                      departureTime: pickDeparture || undefined,
                                      time: pickArrival || undefined,
                                    })
                                  }
                                >
                                  {isMine ? "Mon trajet" : "J'ai choisi ce trajet"}
                                </Button>
                                {(tr.links ?? [])
                                  .slice(0, 2)
                                  .map((l: any) => (
                                    <a
                                      key={l.label}
                                      href={l.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs text-primary hover:underline"
                                    >
                                      {l.label}
                                    </a>
                                  ))}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </section>
      ) : null}

      {destinationSelected ? (
        <section id="hub-activities-plan" className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">5. Planning du séjour</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Resto, activités et bars pour chaque jour — basé sur les dates, la destination et les préférences.
              </p>
            </div>
            {data.isOwner ? (
              <Button
                variant="hero"
                disabled={itineraryMutation.isPending}
                onClick={() => itineraryMutation.mutate()}
              >
                {itineraryMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                {(trip as any).group_itinerary?.days?.length
                  ? "Régénérer tout le planning"
                  : "Générer le planning"}
              </Button>
            ) : null}
          </div>

          {!(trip as any).group_itinerary?.days?.length ? (
            <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {data.isOwner
                ? "Génère un planning complet (arrivée → départ) avec restos, activités et bars."
                : "L'organisateur générera bientôt le planning du séjour."}
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Source :{" "}
                {(trip as any).group_itinerary?.source === "ai" ? "IA Lovable" : "modèle local"}
                {(trip as any).group_itinerary?.destination
                  ? ` · ${(trip as any).group_itinerary.destination}`
                  : ""}
              </p>
              {((trip as any).group_itinerary.days as any[]).map((day: any) => (
                <article
                  key={day.day}
                  className="rounded-3xl border border-border bg-card p-5 shadow-sm"
                >
                  <h3 className="font-display text-xl font-semibold tracking-tight">
                    Jour {day.day}
                    {day.date
                      ? ` · ${new Date(day.date + "T12:00:00").toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "short",
                        })}`
                      : ""}
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {(day.slots ?? []).map((slot: any, slotIndex: number) => {
                      const Icon =
                        slot.type === "resto"
                          ? Utensils
                          : slot.type === "bar"
                            ? Wine
                            : slot.type === "activite"
                              ? Camera
                              : CalendarDays;
                      return (
                        <li
                          key={`${day.day}-${slotIndex}`}
                          className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-border/60 bg-surface/40 px-3 py-2.5"
                        >
                          <div className="flex gap-2.5 min-w-0">
                            <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                {slot.time ? (
                                  <span className="mr-1.5 inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold tabular-nums text-primary normal-case tracking-normal">
                                    {slot.time}
                                  </span>
                                ) : null}
                                {slot.moment}
                                {slot.type ? ` · ${slot.type}` : ""}
                              </p>
                              <p className="font-medium text-sm">{slot.label}</p>
                              {slot.detail ? (
                                <p className="text-xs text-muted-foreground">{slot.detail}</p>
                              ) : null}
                              {slot.priceHint != null ? (
                                <p className="text-xs text-muted-foreground">
                                  ~{formatEuro(Number(slot.priceHint))} / pers.
                                </p>
                              ) : null}
                              {slot.url ? (
                                <a
                                  href={slot.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-0.5 inline-block text-xs font-medium text-primary hover:underline"
                                >
                                  Voir / réserver →
                                </a>
                              ) : null}
                            </div>
                          </div>
                          {data.isOwner ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={slotMutation.isPending}
                              onClick={() =>
                                slotMutation.mutate({ day: day.day, slotIndex })
                              }
                              title="Proposer une autre option pour ce créneau seulement"
                            >
                              {slotMutation.isPending ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="size-3.5" />
                              )}
                              Autre option
                            </Button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {datesLocked ? (
        <div className="space-y-8 mt-8">
          <section className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-5 text-primary" />
              <h2 className="font-display text-xl font-semibold tracking-tight">Exporter mon calendrier</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              {hasItinerary
                ? "Téléchargez le fichier de l'itinéraire ou ajoutez le séjour complet à votre agenda."
                : "Ajoutez les dates de votre séjour à votre calendrier."}
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Button onClick={handleDownloadIcs} variant="hero" size="sm" className="gap-1.5">
                <CalendarDays className="size-4" /> Télécharger .ics
              </Button>
              {googleCalendarUrl && (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer">
                    Ajouter à Google Calendar
                  </a>
                </Button>
              )}
            </div>
          </section>

          <PackingListCard
            avgTemp={null}
            activities={activities.map((a) => a.name)}
            durationDays={liveBudget.nights || 2}
            eventType={trip.event_type}
          />
        </div>
      ) : null}


      {/* Résumé + validation des dates */}



      {/* 3. Planning jour par jour */}
      

      {/* 4. Hôtels (vote groupe) */}
      

      {/* 5. Transports — choix perso par ville */}
      


      {(trip.celebrated_person ||
        ["evg", "evjf", "anniversaire", "retraite"].includes(String(trip.event_type))) && (
        <section className="mt-8 space-y-4 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold tracking-tight">Préférences de la star</h2>
            <a
              href={`/trips/${tripId}/star`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {starData?.preferences ? "Modifier" : "Remplir"} →
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Ces réponses pèsent ~×2,5 à ×3,2 dans le scoring par rapport aux autres participants.
          </p>
          {starData?.preferences ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">
                  {trip.celebrated_person || "Personne principale"}
                </span>{" "}
                — questionnaire enregistré
              </p>
              {(starData.preferences.wantedActivities?.length ?? 0) > 0 ? (
                <p>✅ Envies : {starData.preferences.wantedActivities.join(", ")}</p>
              ) : null}
              {(starData.preferences.dealBreakers?.length ?? 0) > 0 ? (
                <p>⛔ À éviter : {starData.preferences.dealBreakers.join(", ")}</p>
              ) : null}
              {(starData.preferences.ambiances?.length ?? 0) > 0 ? (
                <p>✨ Ambiances : {starData.preferences.ambiances.join(", ")}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pas encore rempli — à faire avant de générer les destinations pour bien pondérer.
            </p>
          )}
        </section>
      )}

      <section id="invite-section" className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24">
        <h2 className="font-display text-xl font-semibold tracking-tight">Inviter la bande</h2>
        <div className="mt-4 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Envoie ce lien (WhatsApp, SMS, Instagram…) — tes amis rejoignent le voyage et répondent au questionnaire.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input readOnly value={shareUrl} className="max-w-md font-mono text-xs" />
            <Button
              type="button"
              variant="hero"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  setShareCopied(true);
                  toast.success("Lien copié !");
                  setTimeout(() => setShareCopied(false), 2000);
                } catch {
                  toast.error("Impossible de copier — sélectionne le lien manuellement");
                }
              }}
            >
              {shareCopied ? <Check /> : <Copy />}
              {shareCopied ? "Copié" : "Copier le lien"}
            </Button>
            <Button
              type="button"
              className="bg-[#25D366] text-white hover:bg-[#1ebe57] border-transparent"
              onClick={() => {
                const text = buildWhatsAppSummary();
                const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                window.open(url, "_blank", "noopener,noreferrer");
              }}
            >
              WhatsApp
            </Button>
            {typeof navigator !== "undefined" && typeof (navigator as any).share === "function" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  (navigator as any).share({
                    title: data.trip.name,
                    text: `Rejoins mon voyage « ${data.trip.name} » sur Krew — ${shareUrl}`,
                    url: shareUrl,
                  })
                }
              >
                <Link2 /> Partager
              </Button>
            ) : null}
          </div>
        </div>

        <h3 className="mt-8 font-display text-lg font-semibold">Le groupe</h3>
        {data.isOwner ? (
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) inviteMutation.mutate();
            }}
          >
            <Input
              type="email"
              placeholder="email@ami.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-xs"
            />
            <Button type="submit" variant="hero" disabled={inviteMutation.isPending}>
              <UserPlus /> Inviter
            </Button>
          </form>
        ) : null}

        <ul className="mt-5 space-y-2">
          {participants.length === 0 ? (
            <li className="text-sm text-muted-foreground">Personne n'est encore invité.</li>
          ) : (
            participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div>
                  <p className="font-medium">{p.display_name ?? p.email}</p>
                  <p className="text-sm text-muted-foreground">{p.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={p.status === "accepte" ? "success" : "muted"}>{p.status}</Badge>
                  {data.isOwner ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Retirer ${p.email}`}
                      onClick={() => removeMutation.mutate(p.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
      {data.isOwner && trip.status !== "annule" ? (
        <section className="mt-10 space-y-3 rounded-3xl border border-border/60 bg-surface/30 p-5 sm:p-6">
          <p className="mb-3 text-sm text-muted-foreground">Zone organisateur</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (window.confirm("Annuler ce voyage ? Il disparaîtra de la liste active.")) {
                  cancelMutation.mutate(false);
                }
              }}
            >
              Annuler le voyage
            </Button>
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Supprimer DÉFINITIVEMENT ce voyage et toutes ses données ? Irréversible.",
                  )
                ) {
                  cancelMutation.mutate(true);
                }
              }}
            >
              Supprimer définitivement
            </Button>
          </div>
        </section>
      ) : null}

    </main>
  );
}
