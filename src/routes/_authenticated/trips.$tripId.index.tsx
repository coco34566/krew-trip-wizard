// src/routes/_authenticated/trips.$tripId.index.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Heart,
  Loader2,
  MapPin,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  Copy,
  Link2,
  Check,
  ClipboardList,
  Lock,
  Unlock,
  CalendarDays,
  RefreshCw,
  Plane,
  Hotel,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
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
  setBookingStatus,
  getGroupTransportTimeWindow,
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
  generateTasksForTrip,
  updateTaskStatus,
  reassignTask,
  setCoOrganizer,
  validateStayProfile,
} from "@/lib/trips.functions";
import {
  getParticipantsProgress,
  getMyParticipantPreferences,
  declareMyStatus,
} from "@/lib/participant-preferences.functions";
import { searchExternalForTrip } from "@/lib/external/search-hotels.functions";
import {
  categoryLabel,
  eventTypeLabel,
  formatEuro,
} from "@/lib/krew/constants";
import type { BudgetBreakdown, ItineraryDay } from "@/lib/krew/engine";
import type { StayConcept } from "@/lib/krew/stay-profiles";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { CostSplitCard } from "@/components/krew/CostSplitCard";
import { TripHubDashboard } from "@/components/krew/TripHubDashboard";
import {
  getTripAvailability,
  chooseTripDates,
  calculateTripDateRange,
  unlockTripDates,
} from "@/lib/availability.functions";
import { getStarPreferences } from "@/lib/star-preferences.functions";
import { buildTripIcs } from "@/lib/krew/calendar-export";
import { buildTripStatusWhatsApp, shareOnWhatsApp } from "@/lib/krew/whatsapp";
import { PackingListCard } from "@/components/krew/PackingListCard";
import { isFinalTripPreparationReady } from "@/lib/krew/packing-list";
import { TransportTimePrefsCard } from "@/components/krew/TransportTimePrefsCard";
import { KrewPhotoFallback } from "@/components/krew/KrewPhotoFallback";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import {
  destinationBudgetTotal,
  isDestinationBudgetEstimated,
} from "@/lib/krew/destination-budget";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function destinationPhotoUrl(name?: string | null, imageUrl?: string | null) {
  if (imageUrl && /^https?:\/\//i.test(String(imageUrl))) return String(imageUrl);
  const key = String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  const known: Record<string, string> = {
    barcelone:
      "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
    barcelona:
      "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
    lisbonne:
      "https://images.unsplash.com/photo-1555881403-64995e224d73?auto=format&fit=crop&w=800&q=80",
    lisbon:
      "https://images.unsplash.com/photo-1555881403-64995e224d73?auto=format&fit=crop&w=800&q=80",
    porto:
      "https://images.unsplash.com/photo-1555881403-26d5c5c6e0e1?auto=format&fit=crop&w=800&q=80",
    rome: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80",
    milan:
      "https://images.unsplash.com/photo-1513581166391-887a96ddeafd?auto=format&fit=crop&w=800&q=80",
    amsterdam:
      "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=800&q=80",
    berlin:
      "https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=800&q=80",
    prague:
      "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=800&q=80",
    budapest:
      "https://images.unsplash.com/photo-1541343672885-9be56236302a?auto=format&fit=crop&w=800&q=80",
    vienne:
      "https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=800&q=80",
    vienna:
      "https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=800&q=80",
    londres:
      "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
    london:
      "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
    paris:
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
    nice: "https://images.unsplash.com/photo-1491160950325-4c0b0b0b0b0b?auto=format&fit=crop&w=800&q=80",
    marseille:
      "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?auto=format&fit=crop&w=800&q=80",
    bordeaux:
      "https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?auto=format&fit=crop&w=800&q=80",
    lyon: "https://images.unsplash.com/photo-1524396309943-e03f5249f002?auto=format&fit=crop&w=800&q=80",
    bruxelles:
      "https://images.unsplash.com/photo-1559113202-c916b8e44373?auto=format&fit=crop&w=800&q=80",
    brussels:
      "https://images.unsplash.com/photo-1559113202-c916b8e44373?auto=format&fit=crop&w=800&q=80",
    madrid:
      "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=800&q=80",
    valence:
      "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=800&q=80",
    valencia:
      "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=800&q=80",
    seville:
      "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
    sevilla:
      "https://images.unsplash.com/photo-1515443961218-a595975c78b4?auto=format&fit=crop&w=800&q=80",
    athens:
      "https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=800&q=80",
    athenes:
      "https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=800&q=80",
    dubrovnik:
      "https://images.unsplash.com/photo-1555990793-da11162e95d7?auto=format&fit=crop&w=800&q=80",
    split:
      "https://images.unsplash.com/photo-1555990793-da11162e95d7?auto=format&fit=crop&w=800&q=80",
    croatie:
      "https://images.unsplash.com/photo-1555990793-da11162e95d7?auto=format&fit=crop&w=800&q=80",
  };
  for (const [city, url] of Object.entries(known)) {
    if (key.includes(city)) return url;
  }
  return null;
}

const ACCOMMODATION_CONCEPT_LABELS: Record<string, string> = {
  central_hotel: "Au cœur de l'action",
  comfort_hotel: "Confort sans compromis",
  aparthotel: "Autonomes, mais bien installés",
  entire_city_home: "Notre chez-nous en ville",
  group_house: "Tous ensemble",
  nature_stay: "Au vert",
  exceptional_property: "Le logement fait le voyage",
  wellness_property: "Parenthèse bien-être",
};

export const Route = createFileRoute("/_authenticated/trips/$tripId/")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: (search.view as string) || "todo",
    section: (search.section as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Voyage — KREW" },
      {
        name: "description",
        content: "Propositions KREW, planning jour par jour, budget détaillé et votes du groupe.",
      },
      { property: "og:title", content: "Voyage — KREW" },
      { property: "og:description", content: "Compare les propositions et valide le voyage avec ton groupe." },
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
  destinations: {
    name: string;
    country: string;
    description: string | null;
    image_url: string | null;
    rating: number;
  } | null;
  accommodations: {
    name: string;
    type: string;
    rating: number;
    price_per_night_per_person: number;
    distance_center_km: number;
  } | null;
};

function TripDetail() {
  const { tripId } = Route.useParams();
  const search = Route.useSearch();
  const currentView = search?.view ?? "todo";
  const currentSection = search?.section;
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const vote = useServerFn(toggleVote);
  const select = useServerFn(selectRecommendation);
  const invite = useServerFn(inviteParticipant);
  const removeGuest = useServerFn(removeParticipant);
  const regenerate = useServerFn(generateRecommendations);
  const fetchReadiness = useServerFn(getGenerationReadiness);
  const updateTaskStatusFn = useServerFn(updateTaskStatus);
  const reassignTaskFn = useServerFn(reassignTask);
  const generateTasksForTripFn = useServerFn(generateTasksForTrip);
  const setCoOrg = useServerFn(setCoOrganizer);
  const validateProfile = useServerFn(validateStayProfile);
  const [selectedConceptIds, setSelectedConceptIds] = useState<string[]>([]);

  const { data: readiness } = useQuery({
    queryKey: ["generation-readiness", tripId],
    queryFn: () => fetchReadiness({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const { data: tasksData, refetch: refetchTasks } = useQuery({
    queryKey: ["trip-tasks", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_tasks" as any)
        .select("*, assigned_participant:assigned_participant_id (id, display_name, email, user_id)")
        .eq("trip_id", tripId)
        .order("day_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: Boolean(tripId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: "todo" | "in_progress" | "done" }) =>
      updateTaskStatusFn({ data: { taskId, status } }),
    onSuccess: () => {
      toast.success("Statut de la tâche mis à jour");
      refetchTasks();
    },
    onError: (err: any) => toast.error(`Erreur : ${err.message}`),
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ taskId, participantId }: { taskId: string; participantId: string | null }) =>
      reassignTaskFn({ data: { taskId, participantId } }),
    onSuccess: () => {
      toast.success("Tâche réassignée avec succès");
      refetchTasks();
    },
    onError: (err: any) => toast.error(`Erreur : ${err.message}`),
  });

  const generateTasksMutation = useMutation({
    mutationFn: async () => generateTasksForTripFn({ data: { tripId } }),
    onSuccess: (res: any) => {
      if (res.ok) {
        toast.success(`${res.count} tâche(s) générée(s) / synchronisée(s) !`);
        refetchTasks();
      } else {
        toast.warning(res.message || "Aucune tâche générée");
      }
    },
    onError: (err: any) => toast.error(`Erreur : ${err.message}`),
  });

  const fetchProgress = useServerFn(getParticipantsProgress);
  const searchExternal = useServerFn(searchExternalForTrip);
  const fetchSplit = useServerFn(getCostSplit);
  const fetchBookingStatus = useServerFn(setBookingStatus);
  const fetchGroupTimeWindow = useServerFn(getGroupTransportTimeWindow);
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

  const [manualStartDate, setManualStartDate] = useState("");

  const queryKey = ["trip", tripId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchDetail({ data: { tripId } }),
  });

  const profile = data?.profile as {
    calculatedConcepts: StayConcept[];
    selectedConcepts: StayConcept[];
    validated: boolean;
    legacyBypass: boolean;
  } | undefined;

  useEffect(() => {
    if (!profile || profile.validated) return;
    setSelectedConceptIds(profile.calculatedConcepts.slice(0, 3).map((concept) => concept.id));
  }, [profile?.validated, JSON.stringify(profile?.calculatedConcepts ?? [])]);

  const validateProfileMutation = useMutation({
    mutationFn: () => validateProfile({ data: { tripId, selectedConceptIds } }),
    onSuccess: () => {
      toast.success("Profil du voyage validé !");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
    },
    onError: (error: any) => toast.error(String(error?.message ?? "Validation impossible")),
  });

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

  const generateItineraryFn = useServerFn(generateGroupItinerary);
  const regenerateSlotFn = useServerFn(regenerateItinerarySlot);
  const itineraryMutation = useMutation({
    mutationFn: () => generateItineraryFn({ data: { tripId, force: true } }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      if (res?.ok) {
        toast.success(res.usedLlm ? "Planning activités généré (IA)" : "Planning activités généré (mode local)");
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
    onError: (e: any) => toast.error(String(e?.message ?? "Régénération impossible").slice(0, 140)),
  });

  const proposeLogisticsFn = useServerFn(proposeStayAndTransport);
  const hotelLogisticsMutation = useMutation({
    mutationFn: () => proposeLogisticsFn({ data: { tripId, refreshExternal: true, includeTransport: false } }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      const nH = res?.logistics?.hotels?.length ?? 0;
      toast.success(`Hébergements : ${nH} hôtels`);
    },
    onError: (e: any) => handleMutationError(e, "Recherche d’hébergements impossible"),
  });

  const logisticsMutation = useMutation({
    mutationFn: () => proposeLogisticsFn({ data: { tripId, refreshExternal: true } }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      const nT = res?.logistics?.transports?.length ?? 0;
      toast.success(`Transports : ${nT} proposition(s)`);
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

  const transportPickMutation = useMutation({
    mutationFn: (payload: any) => pickTransportFn({ data: { tripId, ...payload } }),
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

  const regenerateMutation = useMutation({
    mutationFn: (force?: boolean) => regenerate({ data: { tripId, force: force === true } }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      if (res?.skipped) {
        toast.error(res?.readiness?.message ?? "Pas assez de réponses pour générer");
      } else if ((res?.count ?? 0) === 0) {
        toast.warning("Aucune proposition générée — réessaie ou élargis les critères");
      } else {
        toast.success(`${res.count} proposition(s) générée(s)`);
      }
      refresh();
    },
    onError: (e: any) => handleMutationError(e, "Erreur lors de la génération"),
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
        const ms = new Date(trip.end_date + "T12:00:00").getTime() - new Date(trip.start_date + "T12:00:00").getTime();
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
      const prices = picks.map((p: any) => Number(p.pricePerPerson)).filter((n: number) => Number.isFinite(n) && n > 0);
      if (prices.length) {
        transport = Math.round(prices.reduce((a: number, c: number) => a + c, 0) / prices.length);
      }
    }

    const total = Math.round(transport) + Math.round(accommodation) + Math.round(activities) + Math.round(food);

    return {
      transport: Math.round(transport),
      accommodation: Math.round(accommodation),
      activities: Math.round(activities),
      food: Math.round(food),
      total,
      destinationName: selectedReco?.destinations?.name ?? null,
      country: selectedReco?.destinations?.country ?? null,
      topHotelName: topHotelId ? (hotels.find((x: any) => x.id === topHotelId)?.name ?? null) : null,
      transportPicksCount: picks.length,
      nights,
    };
  }, [tripPreview, selectedRecoPreview, logisticsPreview]);

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 rounded-3xl" />
      </main>
    );
  }

  const trip = data.trip;
  const manualRange = manualStartDate ? calculateTripDateRange(manualStartDate, Number((trip as any).duration_nights || 1)) : null;
  const datesLocked = Boolean(trip.dates_locked);
  const hasItinerary = Boolean((trip as any).group_itinerary?.days?.length);
  const recommendations = (data.recommendations ?? []) as unknown as Recommendation[];
  const activities = (data.activities ?? []) as any[];
  const votes = (data.votes ?? []) as { recommendation_id: string; user_id: string }[];
  const rawParticipants = (data.participants ?? []) as any[];
  const celebratedPerson = trip?.celebrated_person;
  const destinationSelected = recommendations.some((r) => r.is_selected);
  const logistics = ((trip as any).group_logistics || {}) as any;
  const selectedActivityIdsList = ((trip as any).selected_activity_ids ?? []) as string[];
  const activitiesValidated = selectedActivityIdsList.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Top Navigation Tabs */}
      <nav aria-label="Navigation principale du voyage" className="flex items-center border-b border-border/50 pb-3 gap-6 font-medium text-sm mb-6">
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "todo" }}
          className={cn(
            "pb-1 transition-colors hover:text-foreground",
            currentView === "todo" ? "border-b-2 border-primary text-foreground font-semibold" : "text-muted-foreground",
          )}
        >
          À faire
        </Link>
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "voyage" }}
          className={cn(
            "pb-1 transition-colors hover:text-foreground",
            currentView === "voyage" ? "border-b-2 border-primary text-foreground font-semibold" : "text-muted-foreground",
          )}
        >
          Voyage
        </Link>
        <Link
          to="/trips/$tripId/invite"
          params={{ tripId }}
          className="pb-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          Groupe
        </Link>
      </nav>

      {/* VUE À FAIRE */}
      {currentView === "todo" ? (
        <TripHubDashboard
          viewerUserId={data.userId}
          tripId={tripId}
          trip={{ ...trip, participants: rawParticipants }}
          isOwner={data.isOwner}
          participantsCount={progress?.total || rawParticipants.length}
          progressAnswered={progress?.answered ?? 0}
          progressTotal={progress?.total || rawParticipants.length}
          availabilityAnswered={availData?.answered ?? 0}
          availabilityExpected={progress?.total || rawParticipants.length}
          provisionalStart={trip.start_date ?? availData?.windows?.[0]?.start ?? (trip as any).provisional_start_date}
          provisionalCoverage={availData?.windows?.[0]?.coverageRatio ?? null}
          myAvailabilityDone={Boolean(availData?.mine)}
          myPreferencesDone={Boolean((myPrefsData as any)?.preferences)}
          starDone={Boolean(starData?.preferences)}
          hasRecommendations={recommendations.length > 0}
          profileReady={Boolean(readiness?.profile.questionnairesReady)}
          profileValidated={Boolean(profile?.validated)}
          destinationSelected={destinationSelected}
          destinationName={recommendations.find((r) => r.is_selected)?.destinations?.name ?? null}
          liveBudgetTotal={liveBudget.total > 0 ? liveBudget.total : null}
          totalReserved={costSplitData?.totalReserved ?? null}
          totalEstimated={costSplitData?.totalEstimated ?? null}
          activitiesValidated={activitiesValidated}
        />
      ) : null}

      {/* VUE SYNTHÈSE OU SINGLE SUB-SECTION UNDER VOYAGE */}
      {currentView === "voyage" ? (
        currentSection ? (
          /* SINGLE MODULE VIEW UNDER VOYAGE */
          <div className="space-y-6">
            <Link
              to="/trips/$tripId"
              params={{ tripId }}
              search={{ view: "voyage" }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="size-4" /> Voyage
            </Link>

            {currentSection === "dates" && (
              <section
                id="hub-dates"
                className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
                    <CalendarDays className="size-5 text-primary" />
                    Dates du groupe
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
                    Les disponibilités sont momentanément indisponibles.
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
                      Les dates du voyage sont validées pour la suite de l’organisation.
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
                      {availData?.answered ?? 0}/{availData?.expected ?? trip.participants_count ?? 1}{" "}
                      dispos reçues. L&apos;organisateur·rice valide une fenêtre pour lancer les
                      destinations.
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
                              onClick={() => chooseDatesMutation.mutate({ start: w.start, end: w.end })}
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
                          Aucune date commune pour le moment. Il manque peut-être encore des disponibilités.
                        </p>
                      ) : null}
                    </ul>
                    {data.isOwner ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline">
                            Choisir d’autres dates
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Choisir d’autres dates</DialogTitle>
                            <DialogDescription>
                              La date de fin est calculée selon la durée définie pour le voyage.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <label htmlFor="manual-start-date" className="text-sm font-medium">
                                Date de départ
                              </label>
                              <Input
                                id="manual-start-date"
                                type="date"
                                className="mt-1.5"
                                value={manualStartDate}
                                onChange={(event) => setManualStartDate(event.target.value)}
                              />
                            </div>
                            {manualRange ? (
                              <p className="rounded-2xl bg-surface/60 px-4 py-3 text-sm font-medium">
                                {new Date(`${manualRange.startDate}T12:00:00`).toLocaleDateString("fr-FR", {
                                  day: "numeric",
                                })}{" "}
                                →{" "}
                                {new Date(`${manualRange.endDate}T12:00:00`).toLocaleDateString("fr-FR", {
                                  day: "numeric",
                                  month: "long",
                                })}{" "}
                                · {(trip as any).duration_nights} nuits
                              </p>
                            ) : null}
                            <Button
                              disabled={!manualRange || chooseDatesMutation.isPending}
                              onClick={() =>
                                manualRange &&
                                chooseDatesMutation.mutate({
                                  start: manualRange.startDate,
                                  end: manualRange.endDate,
                                })
                              }
                            >
                              {chooseDatesMutation.isPending ? <Loader2 className="animate-spin" /> : null}{" "}
                              Valider ces dates
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : null}
                  </>
                )}
              </section>
            )}

            {currentSection === "profile" && (
              <section
                id="hub-profile"
                className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6"
              >
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
                    <Sparkles className="size-5 text-primary" />
                    Profil du voyage
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    KREW rassemble les préférences du groupe pour préparer les prochaines propositions.
                  </p>
                </div>
                {!readiness?.profile.questionnairesReady && !profile?.legacyBypass ? (
                  <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                    Le profil apparaîtra lorsque suffisamment de questionnaires auront été complétés.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(profile?.calculatedConcepts ?? readiness?.profile.calculatedConcepts ?? [])
                      .slice(0, 3)
                      .map((concept: StayConcept) => {
                        const selected = profile?.validated
                          ? profile.selectedConcepts.some((item) => item.id === concept.id)
                          : selectedConceptIds.includes(concept.id);
                        return (
                          <button
                            key={concept.id}
                            type="button"
                            disabled={!data.isOwner || profile?.validated}
                            aria-pressed={selected}
                            onClick={() =>
                              setSelectedConceptIds((ids) =>
                                ids.includes(concept.id)
                                  ? ids.filter((id) => id !== concept.id)
                                  : [...ids, concept.id],
                              )
                            }
                            className={cn(
                              "rounded-2xl border p-4 text-left transition",
                              selected ? "border-primary bg-primary/5" : "border-border opacity-65",
                              (!data.isOwner || profile?.validated) && "cursor-default",
                            )}
                          >
                            <p className="font-semibold">
                              {selected ? "✓ " : ""}
                              {concept.title}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">{concept.rationale}</p>
                          </button>
                        );
                      })}
                  </div>
                )}
                {profile?.validated ? (
                  <p className="text-sm font-medium text-emerald-700">
                    Profil validé — les destinations sont disponibles.
                  </p>
                ) : data.isOwner && readiness?.profile.questionnairesReady ? (
                  <Button
                    variant="hero"
                    disabled={validateProfileMutation.isPending}
                    onClick={() => validateProfileMutation.mutate()}
                  >
                    {validateProfileMutation.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                    Valider notre profil de voyage
                  </Button>
                ) : null}
              </section>
            )}

            {currentSection === "destination" && (
              <section
                id="hub-destination"
                className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
                      <MapPin className="size-5 text-primary" />
                      Destinations proposées
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Des destinations sélectionnées pour correspondre aux envies du groupe.
                    </p>
                  </div>
                  {data.isOwner ? (
                    <Button
                      variant="hero"
                      onClick={() => regenerateMutation.mutate(undefined)}
                      disabled={
                        regenerateMutation.isPending || (readiness ? !readiness.canGenerate : false)
                      }
                      title={
                        readiness && !readiness.canGenerate
                          ? (readiness.message ?? "Questionnaires incomplets")
                          : undefined
                      }
                    >
                      {regenerateMutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
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
                        : "Génère les premières propositions pour le groupe."
                      : "Les propositions de destinations arriveront bientôt."}
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
                        .sort((a, b) => b.score - a.score)
                        .map((reco, index) => {
                          const recoVotes = votes.filter((v) => v.recommendation_id === reco.id);
                          const hasVoted = recoVotes.some((v) => v.user_id === data.userId);
                          const recoActivities = activities
                            .filter((a) => (reco.activity_ids ?? []).includes(a.id))
                            .slice(0, 3);
                          const budgetTotal =
                            reco.budget != null ? destinationBudgetTotal(reco.budget) : null;
                          const budgetEstimated =
                            reco.budget != null && isDestinationBudgetEstimated(reco.budget);
                          const reasons = (reco.match_reasons ?? []).slice(0, 4);
                          const destPhoto = destinationPhotoUrl(
                            reco.destinations?.name,
                            reco.destinations?.image_url,
                          );
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
                              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                {destPhoto ? (
                                  <img
                                    src={destPhoto}
                                    alt={
                                      reco.destinations?.name
                                        ? `Vue de ${reco.destinations.name}`
                                        : "Destination"
                                    }
                                    loading="lazy"
                                    className="h-44 w-full sm:h-32 sm:w-44 shrink-0 rounded-xl object-cover aspect-[4/3]"
                                  />
                                ) : (
                                  <KrewPhotoFallback
                                    type="destination"
                                    aspectRatio="4/3"
                                    className="h-44 w-full sm:h-32 sm:w-44 shrink-0"
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-mono">
                                        #{index + 1}
                                        {reco.destinations?.country
                                          ? ` · ${reco.destinations.country}`
                                          : ""}
                                      </p>
                                      <h3 className="font-display text-2xl font-semibold leading-tight">
                                        {reco.destinations?.name}
                                      </h3>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                      {reco.is_selected ? <Badge variant="success">Choisie</Badge> : null}
                                    </div>
                                  </div>

                                  {/* Budget moyen */}
                                  {budgetTotal != null && budgetTotal > 0 ? (
                                    <p className="mt-2 text-sm">
                                      <span className="font-semibold text-foreground font-mono">
                                        {budgetEstimated ? "Budget estimé ~" : ""}
                                        {formatEuro(budgetTotal)}
                                      </span>
                                      <span className="text-muted-foreground"> / pers.</span>
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
            )}

            {currentSection === "accommodation" && (
              <section className="space-y-4 rounded-3xl border border-border bg-card p-6">
                <h2 className="font-display text-2xl font-normal flex items-center gap-2">
                  <Hotel className="size-5 text-primary" /> Hébergement
                </h2>
                <p className="text-sm text-muted-foreground">Logements disponibles pour le groupe.</p>
              </section>
            )}

            {currentSection === "transport" && (
              <section className="space-y-4 rounded-3xl border border-border bg-card p-6">
                <h2 className="font-display text-2xl font-normal flex items-center gap-2">
                  <Plane className="size-5 text-primary" /> Transport
                </h2>
                <TransportTimePrefsCard tripId={tripId} />
              </section>
            )}

            {currentSection === "planning" && (
              <section className="space-y-4 rounded-3xl border border-border bg-card p-6">
                <h2 className="font-display text-2xl font-normal flex items-center gap-2">
                  <CalendarDays className="size-5 text-primary" /> Planning
                </h2>
                <p className="text-sm text-muted-foreground">Programme jour par jour.</p>
              </section>
            )}

            {currentSection === "tasks" && (
              <section className="space-y-4 rounded-3xl border border-border bg-card p-6">
                <h2 className="font-display text-2xl font-normal flex items-center gap-2">
                  <ClipboardList className="size-5 text-primary" /> Tâches
                </h2>
                <p className="text-sm text-muted-foreground">Tâches attribuées pour l'organisation.</p>
              </section>
            )}

            {currentSection === "packing" && (
              <PackingListCard
                tripId={tripId}
                participants={rawParticipants}
                avgTemp={null}
                activities={[]}
                durationDays={liveBudget.nights || 2}
                eventType={trip.event_type}
                accommodation=""
              />
            )}

            {currentSection === "expenses" && (
              <section className="space-y-4 rounded-3xl border border-border bg-card p-6">
                <h2 className="font-display text-2xl font-normal flex items-center gap-2">
                  <Wallet className="size-5 text-primary" /> Répartition des coûts
                </h2>
                {costSplitData?.split ? <CostSplitCard split={costSplitData.split} tripName={trip.name} tripId={tripId} /> : null}
              </section>
            )}
          </div>
        ) : (
          /* SYNTHESIS 9-ENTRY LIST VIEW */
          <div className="space-y-6">
            <div className="rounded-[28px] border border-border/60 bg-card p-6 sm:p-8 space-y-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
                  {eventTypeLabel(trip.event_type)}
                </p>
                <h1 className="font-display text-[38px] sm:text-[48px] font-normal leading-tight text-foreground">
                  {trip.name}
                </h1>
                {celebratedPerson ? (
                  <p className="text-sm font-medium text-foreground/80 mt-1">Pour {celebratedPerson}</p>
                ) : null}
              </div>

              <div className="divide-y divide-border/50 text-sm">
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground">1. Dates</span>
                    <p className="text-xs text-muted-foreground">
                      {trip.start_date && trip.end_date
                        ? `${new Date(trip.start_date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${new Date(trip.end_date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                        : "À définir"}
                    </p>
                  </div>
                  <Link to="/trips/$tripId" params={{ tripId }} search={{ view: "voyage", section: "dates" }} className="text-xs font-semibold text-primary hover:underline">Voir →</Link>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground">2. Profil du voyage</span>
                    <p className="text-xs text-muted-foreground">
                      {profile?.selectedConcepts?.length ? profile.selectedConcepts.map(c => c.title).join(" · ") : "À définir"}
                    </p>
                  </div>
                  <Link to="/trips/$tripId" params={{ tripId }} search={{ view: "voyage", section: "profile" }} className="text-xs font-semibold text-primary hover:underline">Voir →</Link>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground">3. Destination</span>
                    <p className="text-xs text-muted-foreground">{liveBudget.destinationName || "À définir"}</p>
                  </div>
                  <Link to="/trips/$tripId" params={{ tripId }} search={{ view: "voyage", section: "destination" }} className="text-xs font-semibold text-primary hover:underline">Voir →</Link>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground">4. Hébergement</span>
                    <p className="text-xs text-muted-foreground">{liveBudget.topHotelName || "À définir"}</p>
                  </div>
                  <Link to="/trips/$tripId" params={{ tripId }} search={{ view: "voyage", section: "accommodation" }} className="text-xs font-semibold text-primary hover:underline">Voir →</Link>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground">5. Transport</span>
                    <p className="text-xs text-muted-foreground">{liveBudget.transportPicksCount ? `${liveBudget.transportPicksCount} trajet(s) choisi(s)` : "À définir"}</p>
                  </div>
                  <Link to="/trips/$tripId" params={{ tripId }} search={{ view: "voyage", section: "transport" }} className="text-xs font-semibold text-primary hover:underline">Voir →</Link>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground">6. Planning</span>
                    <p className="text-xs text-muted-foreground">{hasItinerary ? "Planning prêt" : "À définir"}</p>
                  </div>
                  <Link to="/trips/$tripId" params={{ tripId }} search={{ view: "voyage", section: "planning" }} className="text-xs font-semibold text-primary hover:underline">Voir →</Link>
                </div>

                <div className="pt-4 pb-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Organisation</span>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground">7. Tâches</span>
                    <p className="text-xs text-muted-foreground">{tasksData?.length ? `${tasksData.length} tâche(s)` : "À préparer"}</p>
                  </div>
                  <Link to="/trips/$tripId" params={{ tripId }} search={{ view: "voyage", section: "tasks" }} className="text-xs font-semibold text-primary hover:underline">Voir →</Link>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground">8. À emporter</span>
                    <p className="text-xs text-muted-foreground">Checklist personnalisée</p>
                  </div>
                  <Link to="/trips/$tripId" params={{ tripId }} search={{ view: "voyage", section: "packing" }} className="text-xs font-semibold text-primary hover:underline">Voir →</Link>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground">9. Dépenses</span>
                    <p className="text-xs text-muted-foreground">{liveBudget.total > 0 ? `~${formatEuro(liveBudget.total)} / pers.` : "À définir"}</p>
                  </div>
                  <Link to="/trips/$tripId" params={{ tripId }} search={{ view: "voyage", section: "expenses" }} className="text-xs font-semibold text-primary hover:underline">Voir →</Link>
                </div>
              </div>
            </div>
          </div>
        )
      ) : null}
    </main>
  );
}
