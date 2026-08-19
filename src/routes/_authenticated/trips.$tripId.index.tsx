// src/routes/_authenticated/trips.$tripId.tsx
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
  Utensils,
  Wine,
  Camera,
  Plane,
  Hotel,
  Train,
  Clock,
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
  TRIP_STATUS_LABELS,
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
import { isTripAdmin } from "@/lib/krew/engine";
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

/** Photo destination : URL DB ou image Unsplash stable selon la ville. */
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
  }),
  head: () => ({
    meta: [
      { title: "Voyage — KREW" },
      {
        name: "description",
        content: "Propositions KREW, planning jour par jour, budget détaillé et votes du groupe.",
      },
      { property: "og:title", content: "Voyage — KREW" },
      {
        property: "og:description",
        content: "Compare les propositions et valide le voyage avec ton groupe.",
      },
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

  const setCoOrgMutation = useMutation({
    mutationFn: ({ coOrganizerId }: { coOrganizerId: string | null }) =>
      setCoOrg({ data: { tripId, coOrganizerId } }),
    onSuccess: (_, variables) => {
      if (variables.coOrganizerId) {
        toast.success("Co-organisateur·rice nommé·e !");
      } else {
        toast.success("Rôle co-organisateur·rice retiré.");
      }
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erreur lors de la mise à jour des rôles.");
    },
  });

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
        .select(
          `
          *,
          assigned_participant:assigned_participant_id (
            id,
            display_name,
            email,
            user_id
          )
        `,
        )
        .eq("trip_id", tripId)
        .order("day_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: Boolean(tripId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      taskId,
      status,
    }: {
      taskId: string;
      status: "todo" | "in_progress" | "done";
    }) => {
      return updateTaskStatusFn({ data: { taskId, status } });
    },
    onSuccess: () => {
      toast.success("Statut de la tâche mis à jour");
      refetchTasks();
    },
    onError: (err: any) => {
      toast.error(`Erreur : ${err.message}`);
    },
  });

  const reassignMutation = useMutation({
    mutationFn: async ({
      taskId,
      participantId,
    }: {
      taskId: string;
      participantId: string | null;
    }) => {
      return reassignTaskFn({ data: { taskId, participantId } });
    },
    onSuccess: () => {
      toast.success("Tâche réassignée avec succès");
      refetchTasks();
    },
    onError: (err: any) => {
      toast.error(`Erreur : ${err.message}`);
    },
  });

  const generateTasksMutation = useMutation({
    mutationFn: async () => {
      return generateTasksForTripFn({ data: { tripId } });
    },
    onSuccess: (res: any) => {
      if (res.ok) {
        toast.success(`${res.count} tâche(s) générée(s) / synchronisée(s) !`);
        refetchTasks();
      } else {
        toast.warning(res.message || "Aucune tâche générée");
      }
    },
    onError: (err: any) => {
      toast.error(`Erreur : ${err.message}`);
    },
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

  const { data: groupTimeWindow } = useQuery({
    queryKey: ["group-time-window", tripId],
    queryFn: () => fetchGroupTimeWindow({ data: { tripId } }),
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
  const [manualStartDate, setManualStartDate] = useState("");

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${tripId}`;
  }, [tripId]);

  const queryKey = ["trip", tripId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchDetail({ data: { tripId } }),
  });
  const profile = data?.profile as
    | {
        calculatedConcepts: StayConcept[];
        selectedConcepts: StayConcept[];
        validated: boolean;
        legacyBypass: boolean;
      }
    | undefined;
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

  const activityVoteFn = useServerFn(toggleActivityVote);
  const finalizeActivitiesFn = useServerFn(finalizeSelectedActivities);
  const activityVoteMutation = useMutation({
    mutationFn: (activityId: string) => activityVoteFn({ data: { tripId, activityId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) =>
      toast.error(String(e?.message ?? "Vote activité impossible").slice(0, 120)),
  });
  const finalizeActivitiesMutation = useMutation({
    mutationFn: (activityIds: string[]) => finalizeActivitiesFn({ data: { tripId, activityIds } }),
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
          res.usedLlm ? "Planning activités généré (IA)" : "Planning activités généré (mode local)",
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
    onError: (e: any) => toast.error(String(e?.message ?? "Régénération impossible").slice(0, 140)),
  });

  const proposeLogisticsFn = useServerFn(proposeStayAndTransport);
  const hotelLogisticsMutation = useMutation({
    mutationFn: () =>
      proposeLogisticsFn({ data: { tripId, refreshExternal: true, includeTransport: false } }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      const nH = res?.logistics?.hotels?.length ?? 0;
      toast.success(`Hébergements : ${nH} hôtels`);
      document.getElementById("hub-logistics")?.scrollIntoView({ behavior: "smooth" });
    },
    onError: (e: any) => handleMutationError(e, "Recherche d’hébergements impossible"),
  });
  const logisticsMutation = useMutation({
    mutationFn: () => proposeLogisticsFn({ data: { tripId, refreshExternal: true } }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      const nT = res?.logistics?.transports?.length ?? 0;
      toast.success(`Transports : ${nT} proposition(s)`);
      document.getElementById("hub-transports")?.scrollIntoView({ behavior: "smooth" });
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
      durationHours?: number;
      outboundDepartureTime?: string;
      returnArrivalTime?: string;
      pricePerPerson?: number;
      url?: string | null;
    }) => pickTransportFn({ data: { tripId, ...payload } }),
    onSuccess: () => {
      toast.success("Trajet choisi — visible pour ta ville de départ");
      refresh();
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Choix impossible").slice(0, 120)),
  });

  const bookingStatusMutation = useMutation({
    mutationFn: (vars: {
      type: "hotel" | "transport";
      status: "estimé" | "sélectionné" | "réservé";
      userId?: string;
    }) => fetchBookingStatus({ data: { tripId, ...vars } }),
    onSuccess: () => {
      toast.success("Statut de réservation mis à jour !");
      refresh();
      queryClient.invalidateQueries({ queryKey: ["cost-split", tripId] });
      queryClient.invalidateQueries({ queryKey: ["group-time-window", tripId] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Erreur de statut").slice(0, 120)),
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
  const declareStatusFn = useServerFn(declareMyStatus);
  const declareStatusMutation = useMutation({
    mutationFn: (status: "accepte" | "absent") => declareStatusFn({ data: { tripId, status } }),
    onSuccess: (res) => {
      toast.success(
        res.status === "absent" ? "Tu as déclaré ton absence" : "Tu participes de nouveau !",
      );
      refresh();
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Erreur de mise à jour").slice(0, 120)),
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
        toast.warning("Aucune proposition générée — réessaie ou élargis les critères");
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
      toast.error(
        "Impossible de récupérer les informations de voyage en temps réel pour le moment. Réessaie dans un instant.",
      );
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
    onError: (e: any) =>
      toast.error(String(e?.message ?? "Impossible de valider les dates").slice(0, 140)),
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
      Math.round(transport) + Math.round(accommodation) + Math.round(activities) + Math.round(food);

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
        ? (hotels.find((x: any) => x.id === topHotelId)?.name ?? null)
        : null,
      transportPicksCount: picks.length,
      nights,
    };
  }, [tripPreview, selectedRecoPreview, logisticsPreview]);

  const googleCalendarUrl = useMemo(() => {
    const tStartDate = tripPreview?.start_date;
    const tEndDate = tripPreview?.end_date;
    const tName = tripPreview?.name;
    if (!tStartDate || !tEndDate) return "";
    const start = tStartDate.replace(/[-]/g, "");
    const endDateObj = new Date(tEndDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const nextDay = endDateObj.toISOString().slice(0, 10).replace(/[-]/g, "");
    const title = encodeURIComponent(tName || "Mon Voyage KREW");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${nextDay}`;
  }, [tripPreview?.start_date, tripPreview?.end_date, tripPreview?.name]);

  const exclusiveEndStr = useMemo(() => {
    const tEndDate = tripPreview?.end_date;
    if (!tEndDate) return "";
    const endDateObj = new Date(tEndDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    return endDateObj.toISOString().slice(0, 10);
  }, [tripPreview?.end_date]);

  const outlookCalendarUrl = useMemo(() => {
    const tStartDate = tripPreview?.start_date;
    const tName = tripPreview?.name;
    if (!tStartDate || !exclusiveEndStr) return "";
    const title = encodeURIComponent(tName || "Mon Voyage KREW");
    return `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}&startdt=${tStartDate}&enddt=${exclusiveEndStr}&allday=true`;
  }, [tripPreview?.start_date, exclusiveEndStr, tripPreview?.name]);

  const office365CalendarUrl = useMemo(() => {
    const tStartDate = tripPreview?.start_date;
    const tName = tripPreview?.name;
    if (!tStartDate || !exclusiveEndStr) return "";
    const title = encodeURIComponent(tName || "Mon Voyage KREW");
    return `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}&startdt=${tStartDate}&enddt=${exclusiveEndStr}&allday=true`;
  }, [tripPreview?.start_date, exclusiveEndStr, tripPreview?.name]);

  function buildWhatsAppInviteMessage() {
    const trip = tripPreview || {};
    const eventTypeStr = trip.event_type ? String(trip.event_type).replace(/_/g, " ") : "";
    const lines: string[] = [
      `Salut ! Viens rejoindre l'aventure pour organiser notre voyage « ${trip.name || "KREW"} » ! ✈️🥳`,
      "",
    ];
    if (eventTypeStr) {
      lines.push(`Événement : ${eventTypeStr}`);
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
      lines.push(`Dates prévues : ${a} → ${b}`);
    } else if (trip.start_date) {
      lines.push(
        `Date prévue : ${new Date(trip.start_date + "T12:00:00").toLocaleDateString("fr-FR")}`,
      );
    }
    lines.push("");
    if (typeof window !== "undefined" && trip.id) {
      lines.push(
        `Rejoins-nous et donne tes dispos en 2 min : 👉 ${window.location.origin}/join/${trip.id}`,
      );
    }
    return lines.join("\n");
  }

  function buildWhatsAppStatusMessage() {
    const trip = tripPreview || {};
    const statusLines: string[] = [];
    const actions: { name: string; action: string }[] = [];
    const nameOf = (participant: any) =>
      participant.display_name || participant.email?.split("@")[0] || "Ami";
    if (trip.start_date && trip.end_date) {
      const start = new Date(`${trip.start_date}T12:00:00`).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
      });
      const end = new Date(`${trip.end_date}T12:00:00`).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      statusLines.push(`📅 Dates : ${start} → ${end}`);
    }
    if (liveBudget.destinationName)
      statusLines.push(`📍 Destination : ${liveBudget.destinationName}`);
    if (logisticsPreview.hotels?.length)
      statusLines.push(
        `🏠 Hébergement : ${logisticsPreview.hotelBookingStatus || "vote en cours"}`,
      );
    if (logisticsPreview.transports?.length)
      statusLines.push(`🚆 Transport : ${liveBudget.transportPicksCount || 0} choix enregistré(s)`);
    if (liveBudget.total > 0) statusLines.push(`💰 Budget estimé : ~${liveBudget.total} € / pers.`);
    for (const participant of progress?.participants ?? []) {
      if (!participant.hasAnsweredAvailability)
        actions.push({ name: nameOf(participant), action: "disponibilités" });
      if (!participant.hasAnswered)
        actions.push({ name: nameOf(participant), action: "préférences" });
    }
    if (logisticsPreview.star_mode === "secret" && trip.celebrated_person && !starData?.preferences)
      actions.push({ name: "organisateur", action: `Préférences de ${trip.celebrated_person}` });
    if (logisticsPreview.hotels?.length) {
      const voters = new Set((logisticsPreview.hotelVotes ?? []).map((vote: any) => vote.userId));
      for (const participant of participants.filter(
        (item: any) => item.user_id && item.status !== "absent",
      ))
        if (!voters.has(participant.user_id))
          actions.push({ name: nameOf(participant), action: "voter pour l’hébergement" });
    }
    if (logisticsPreview.transports?.length) {
      const pickers = new Set(
        (logisticsPreview.transportPicks ?? []).map((pick: any) => pick.userId),
      );
      for (const participant of participants.filter(
        (item: any) => item.user_id && item.status !== "absent",
      ))
        if (!pickers.has(participant.user_id))
          actions.push({ name: nameOf(participant), action: "choisir son transport" });
    }
    return buildTripStatusWhatsApp({
      tripName: trip.name || "notre voyage",
      tripUrl:
        typeof window === "undefined"
          ? `/trips/${trip.id}`
          : `${window.location.origin}/trips/${trip.id}`,
      statusLines,
      actions,
    });
  }

  function buildWhatsAppRemindMessage() {
    const trip = tripPreview || {};
    const missingParticipants =
      progress?.participants?.filter((p) => !p.hasAnswered || !p.hasAnsweredAvailability) || [];
    const lines: string[] = [
      `🔔 Petit rappel pour le voyage « ${trip.name || "notre voyage"} » !`,
      "",
      "Certain·es d'entre nous n'ont pas encore eu le temps de remplir leurs infos :",
    ];

    for (const p of missingParticipants) {
      const name = p.display_name || p.email?.split("@")[0] || "Ami";
      const missing: string[] = [];
      if (!p.hasAnsweredAvailability) missing.push("disponibilités 📅");
      if (!p.hasAnswered) missing.push("préférences ⚙️");
      lines.push(`• *${name}* : il te manque tes ${missing.join(" et ")}`);
    }

    lines.push("");
    if (typeof window !== "undefined" && trip.id) {
      lines.push(
        `Prenez 2 petites minutes pour compléter vos infos : 👉 ${window.location.origin}/trips/${trip.id}`,
      );
    }
    return lines.join("\n");
  }

  const navigate = useNavigate();

  const isStar = useMemo(() => {
    if (!tripPreview || !data?.userId) return false;
    const starUid = tripPreview.star_user_id;
    return Boolean(starUid && data.userId === starUid);
  }, [tripPreview, data]);

  const isSecretStar = useMemo(() => {
    if (!tripPreview || !isStar) return false;
    const starMode = (tripPreview.group_logistics as any)?.star_mode ?? "secret";
    return starMode === "secret";
  }, [tripPreview, isStar]);

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 rounded-3xl" />
      </main>
    );
  }

  if (isSecretStar) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center space-y-6">
        <span className="inline-flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary animate-pulse text-4xl">
          🤫
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-primary">
          Chut... C&apos;est un secret !
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Tes ami·e·s te préparent une surprise incroyable pour ton événement (
          <strong>{tripPreview.name}</strong>).
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Toutes les informations sur la destination, les hébergements et le planning sont gardées
          secrètes pour te laisser la surprise le jour J.
        </p>
        <p className="text-primary font-medium">
          Laisse-toi porter et prépare-toi à vivre un moment inoubliable ! 🎂✨
        </p>
      </main>
    );
  }

  const trip = data.trip;
  const manualRange = manualStartDate
    ? calculateTripDateRange(manualStartDate, Number((trip as any).duration_nights || 1))
    : null;
  const datesLocked = Boolean(trip.dates_locked);
  const hasItinerary = Boolean((trip as any).group_itinerary?.days?.length);
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
  const rawParticipants = (data.participants ?? []) as any[];
  const celebratedPerson = trip?.celebrated_person;
  const starUid = trip?.star_user_id || "star-virtual-uid";
  const hasStar = Boolean(trip?.has_star || celebratedPerson);

  const combinedParticipants = (() => {
    if (!hasStar) return rawParticipants;

    const starExists = (rawParts: any[]) =>
      rawParts.some((p: any) => Boolean(p.user_id && starUid && p.user_id === starUid));

    if (starExists(rawParticipants)) {
      return rawParticipants.map((p) => {
        const isStarByUid = Boolean(p.user_id && starUid && p.user_id === starUid);
        if (isStarByUid) {
          return { ...p, isStar: true };
        }
        return p;
      });
    }

    const starVirtual = {
      id: "star-virtual-id",
      trip_id: tripId,
      user_id: starUid,
      email: null,
      display_name: celebratedPerson || "La Star",
      status: "accepte",
      role: "membre",
      isStar: true,
      created_at: new Date().toISOString(),
    };

    return [...rawParticipants, starVirtual];
  })();

  const participants = combinedParticipants;
  const destinationSelected = recommendations.some((r) => r.is_selected);
  const selectedReco = recommendations.find((r) => r.is_selected);
  const logistics = ((trip as any).group_logistics || {}) as any;
  const selectedActivityIds = new Set<string>(
    ((trip as any).selected_activity_ids ?? []) as string[],
  );

  const handleDownloadIcs = () => {
    const icsContent = buildTripIcs(trip, trip.group_itinerary);
    if (!icsContent) {
      toast.error(
        "Impossible d'exporter le calendrier : vérifiez que les dates sont verrouillées.",
      );
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

  const selectedActivityIdsList = ((trip as any).selected_activity_ids ?? []) as string[];
  const activitiesValidated = selectedActivityIdsList.length > 0;
  const finalRestitutionReady = isFinalTripPreparationReady({
    destinationSelected,
    hasItinerary,
    selectedActivityIds: selectedActivityIdsList,
  });
  const tripEndDatePassed = Boolean(
    trip.end_date && new Date(trip.end_date + "T23:59:59") < new Date(),
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* Top Navigation Tabs */}
      <nav aria-label="Navigation principale du voyage" className="flex items-center border-b border-border/50 pb-3 gap-6 font-medium text-sm mb-6">
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "todo" }}
          className={cn(
            "pb-1 transition-colors hover:text-foreground",
            currentView === "todo"
              ? "border-b-2 border-primary text-foreground font-semibold"
              : "text-muted-foreground",
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
            currentView === "voyage"
              ? "border-b-2 border-primary text-foreground font-semibold"
              : "text-muted-foreground",
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

      {currentView === "organize" ? (
        <div className="mb-4">
          <Link
            to="/trips/$tripId"
            params={{ tripId }}
            search={{ view: "todo" }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            ← Retour au voyage
          </Link>
        </div>
      ) : null}

      {/* Main Dashboard Header & Actions */}
      {currentView === "todo" || currentView === "organize" ? (
        <TripHubDashboard
          viewerUserId={data.userId}
          tripId={tripId}
          trip={{
            ...trip,
            participants: participants,
          }}
          isOwner={data.isOwner}
          participantsCount={progress?.total || participants.length}
          progressAnswered={progress?.answered ?? 0}
          progressTotal={progress?.total || participants.length}
          availabilityAnswered={availData?.answered ?? 0}
          availabilityExpected={progress?.total || participants.length}
          provisionalStart={
            trip.start_date ?? availData?.windows?.[0]?.start ?? (trip as any).provisional_start_date
          }
          provisionalCoverage={availData?.windows?.[0]?.coverageRatio ?? null}
          myAvailabilityDone={Boolean(availData?.mine)}
          myPreferencesDone={Boolean((myPrefsData as any)?.preferences)}
          starDone={Boolean(starData?.preferences)}
          hasRecommendations={recommendations.length > 0}
          profileReady={Boolean(readiness?.profile.questionnairesReady)}
          profileValidated={Boolean(profile?.validated)}
          destinationSelected={recommendations.some((r) => r.is_selected)}
          destinationName={recommendations.find((r) => r.is_selected)?.destinations?.name ?? null}
          liveBudgetTotal={liveBudget.total > 0 ? liveBudget.total : null}
          totalReserved={costSplitData?.totalReserved ?? null}
          totalEstimated={costSplitData?.totalEstimated ?? null}
          topScores={recommendations.slice(0, 3).map((r) => ({
            name: r.destinations?.name ?? "Destination",
            score: r.score,
          }))}
          activitiesValidated={activitiesValidated}
          tripEndDatePassed={tripEndDatePassed}
        />
      ) : null}

      {/* VUE SYNTHÈSE : VOYAGE */}
      {currentView === "voyage" ? (
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
                <p className="text-sm font-medium text-foreground/80 mt-1">
                  Pour {celebratedPerson}
                </p>
              ) : null}
            </div>

            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <div className="rounded-2xl border border-border/50 bg-surface/40 p-4">
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dates</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {trip.start_date && trip.end_date
                    ? `${new Date(trip.start_date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${new Date(trip.end_date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
                    : "À définir"}
                </dd>
                <Link
                  to="/trips/$tripId"
                  params={{ tripId }}
                  search={{ view: "organize" }}
                  hash="hub-dates"
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Voir les dates →
                </Link>
              </div>

              <div className="rounded-2xl border border-border/50 bg-surface/40 p-4">
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Destination</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {liveBudget.destinationName
                    ? `${liveBudget.destinationName}${liveBudget.country ? ` (${liveBudget.country})` : ""}`
                    : "À définir"}
                </dd>
                <Link
                  to="/trips/$tripId"
                  params={{ tripId }}
                  search={{ view: "organize" }}
                  hash="hub-destination"
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Voir les destinations →
                </Link>
              </div>

              <div className="rounded-2xl border border-border/50 bg-surface/40 p-4">
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hébergement</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {liveBudget.topHotelName || (logistics.hotelBookingStatus === "réservé" ? "Réservé" : "À définir")}
                </dd>
                <Link
                  to="/trips/$tripId"
                  params={{ tripId }}
                  search={{ view: "organize" }}
                  hash="hub-logistics"
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Voir l’hébergement →
                </Link>
              </div>

              <div className="rounded-2xl border border-border/50 bg-surface/40 p-4">
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transport</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {liveBudget.transportPicksCount > 0
                    ? `${liveBudget.transportPicksCount} trajet(s) choisi(s)`
                    : "À définir"}
                </dd>
                <Link
                  to="/trips/$tripId"
                  params={{ tripId }}
                  search={{ view: "organize" }}
                  hash="hub-transports"
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Voir les transports →
                </Link>
              </div>

              <div className="rounded-2xl border border-border/50 bg-surface/40 p-4">
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Planning</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {hasItinerary ? "Planning prêt" : "À définir"}
                </dd>
                <Link
                  to="/trips/$tripId"
                  params={{ tripId }}
                  search={{ view: "organize" }}
                  hash="hub-activities-plan"
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Voir le planning →
                </Link>
              </div>

              <div className="rounded-2xl border border-border/50 bg-surface/40 p-4">
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Budget estimé</dt>
                <dd className="mt-1 font-medium text-foreground font-mono">
                  {liveBudget.total > 0 ? `~${formatEuro(liveBudget.total)} / pers.` : "À définir"}
                </dd>
                <Link
                  to="/trips/$tripId"
                  params={{ tripId }}
                  search={{ view: "organize" }}
                  hash="hub-cost-split"
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Voir la répartition →
                </Link>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      {/* DETAILED DOMAIN MODULES (rendered on view=organize) */}
      {currentView === "organize" ? (
        <>
      <section
        className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24"
        id="hub-dates"
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

      {/* PROFIL DU VOYAGE */}
      <section
        id="hub-profile"
        className="mt-8 space-y-4 scroll-mt-24"
      >
        <div className="relative inline-block">
          <h2 className="font-display text-2xl font-normal text-foreground flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Profil du voyage
          </h2>
          <KrewMark
            type="highlight"
            tone="sage"
            size="md"
            rotation={-2}
            className="absolute left-0 bottom-0 w-[220px] opacity-60 pointer-events-none"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          KREW rassemble les préférences du groupe pour préparer les prochaines propositions.
        </p>

        {!readiness?.profile.questionnairesReady && !profile?.legacyBypass ? (
          <p className="rounded-[22px] border border-dashed border-border p-6 text-sm text-muted-foreground bg-background">
            Le profil apparaîtra lorsque suffisamment de questionnaires auront été complétés.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
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
                      "bg-background border border-border/60 rounded-[22px] p-6 text-left transition-all",
                      selected ? "border-primary bg-primary/4" : "hover:border-primary/40",
                      (!data.isOwner || profile?.validated) && "cursor-default",
                    )}
                  >
                    <p className="font-display text-[28px] font-normal leading-snug text-foreground">
                      {selected ? "✓ " : ""}
                      {concept.title}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{concept.rationale}</p>
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
            className="rounded-xl"
          >
            {validateProfileMutation.isPending ? <Loader2 className="animate-spin" /> : <Check />}
            Valider notre profil de voyage
          </Button>
        ) : null}
      </section>

      {/* DESTINATIONS proposées */}
      <section
        id="hub-destination"
        className="mt-8 space-y-6 scroll-mt-24"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/50 pb-4">
          <div>
            <h2 className="font-display text-2xl font-normal text-foreground flex items-center gap-2">
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
              className="rounded-xl"
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
          <p className="rounded-[24px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground bg-background">
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
          {(() => {
            const sortedRecos = [...recommendations].sort(
              (a, b) => Number(b.is_selected) - Number(a.is_selected) || b.score - a.score,
            );
            const topReco = sortedRecos[0];
            const otherRecos = sortedRecos.slice(1);

            const renderRecoCard = (reco: Recommendation, index: number, isFirst: boolean) => {
              const recoVotes = votes.filter((v) => v.recommendation_id === reco.id);
              const hasVoted = recoVotes.some((v) => v.user_id === data.userId);
              const recoActivities = activities
                .filter((a) => (reco.activity_ids ?? []).includes(a.id))
                .slice(0, 3);
              const budgetTotal =
                reco.budget != null ? destinationBudgetTotal(reco.budget) : null;
              const reasons = (reco.match_reasons ?? []).slice(0, 4);
              const destPhoto = destinationPhotoUrl(
                reco.destinations?.name,
                reco.destinations?.image_url,
              );

              if (isFirst) {
                // PROPOSITION #1 : Desktop grid-cols-[1.15fr_0.85fr], Photo left 4/3 rounded-[26px], Content right
                return (
                  <article
                    key={reco.id}
                    className={cn(
                      "relative rounded-[28px] border bg-background p-6 shadow-none transition-all grid lg:grid-cols-[1.15fr_0.85fr] gap-6 items-center",
                      reco.is_selected
                        ? "border-emerald-500/80 ring-2 ring-emerald-500/20"
                        : "border-border/60",
                    )}
                  >
                    {/* Circle KrewMark sage sur proposition #1 */}
                    <KrewMark
                      type="circle"
                      tone="sage"
                      size="md"
                      rotation={-4}
                      className="absolute -top-3 -left-3 pointer-events-none opacity-70"
                    />

                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[26px]">
                      {destPhoto ? (
                        <img
                          src={destPhoto}
                          alt={reco.destinations?.name || "Destination"}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <KrewPhotoFallback
                          type="destination"
                          aspectRatio="4/3"
                          className="size-full rounded-[26px]"
                        />
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
                            #1 {reco.destinations?.country ? `· ${reco.destinations.country}` : ""}
                          </p>
                          <h3 className="font-display text-[38px] font-normal leading-tight text-foreground">
                            {reco.destinations?.name}
                          </h3>
                        </div>
                        {(() => {
                          const recoScore = reco.score;
                          const compatibilityPct = Math.round(recoScore);
                          return (
                            <span className="font-mono text-[18px] font-semibold text-primary">
                              {compatibilityPct}% compatibilité
                            </span>
                          );
                        })()}
                      </div>

                      {budgetTotal != null && budgetTotal > 0 ? (
                        <p className="text-sm">
                          <span className="font-semibold text-foreground font-mono">
                            {isDestinationBudgetEstimated(reco.budget) ? "Budget estimé ~" : ""}
                            {formatEuro(budgetTotal)}
                          </span>
                          <span className="text-muted-foreground"> / pers.</span>
                        </p>
                      ) : null}

                      {reasons.length ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {reasons.map((reason: string) => (
                            <li
                              key={reason}
                              className="rounded-full bg-sage/10 px-3 py-1 text-xs text-foreground/80 font-medium"
                            >
                              {reason}
                            </li>
                          ))}
                        </ul>
                      ) : reco.rationale ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {reco.rationale}
                        </p>
                      ) : null}

                      {recoActivities.length ? (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/80">À faire · </span>
                          {recoActivities
                            .map(
                              (a: any) =>
                                `${a.name}${a.price_per_person ? ` (${formatEuro(Number(a.price_per_person))})` : ""}`,
                            )
                            .join(" · ")}
                        </p>
                      ) : null}

                      <div className="pt-2 flex flex-wrap items-center gap-3">
                        <Button
                          size="sm"
                          variant={hasVoted ? "secondary" : "outline"}
                          className="rounded-xl"
                          disabled={voteMutation.isPending}
                          onClick={() => voteMutation.mutate(reco.id)}
                        >
                          <Heart className={cn("size-3.5 mr-1", hasVoted && "fill-current")} />
                          {hasVoted ? "Mon vote" : "Voter"} · {recoVotes.length}
                        </Button>
                        {data.isOwner && reco.is_selected ? (
                          <Button size="sm" variant="outline" disabled className="rounded-xl border-emerald-500 text-emerald-700">
                            <CheckCircle2 className="size-3.5 mr-1" /> Destination choisie
                          </Button>
                        ) : data.isOwner ? (
                          <Button
                            size="sm"
                            variant={destinationSelected ? "outline" : "hero"}
                            className="rounded-xl"
                            onClick={() => selectMutation.mutate(reco.id)}
                            disabled={selectMutation.isPending}
                          >
                            <CheckCircle2 className="size-3.5 mr-1" />
                            {destinationSelected
                              ? "Changer pour celle-ci"
                              : "Choisir cette destination"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              }

              // AUTRES PROPOSITIONS : 2 colonnes desktop, photo top, contenu bottom
              return (
                <article
                  key={reco.id}
                  className={cn(
                    "rounded-[24px] border bg-background p-5 shadow-none transition-all space-y-4 flex flex-col justify-between",
                    reco.is_selected ? "border-emerald-500" : "border-border/60",
                  )}
                >
                  <div className="space-y-4">
                    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[20px]">
                      {destPhoto ? (
                        <img
                          src={destPhoto}
                          alt={reco.destinations?.name || "Destination"}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <KrewPhotoFallback
                          type="destination"
                          aspectRatio="16/9"
                          className="size-full rounded-[20px]"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
                            #{index + 1} {reco.destinations?.country ? `· ${reco.destinations.country}` : ""}
                          </p>
                          <h3 className="font-display text-2xl font-normal leading-tight text-foreground">
                            {reco.destinations?.name}
                          </h3>
                        </div>
                        {reco.is_selected ? <Badge variant="success">Choisie</Badge> : null}
                      </div>

                      {budgetTotal != null && budgetTotal > 0 ? (
                        <p className="text-sm font-mono text-foreground font-semibold">
                          ~{formatEuro(budgetTotal)} <span className="font-sans font-normal text-muted-foreground">/ pers.</span>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant={hasVoted ? "secondary" : "outline"}
                      className="rounded-xl text-xs h-8"
                      disabled={voteMutation.isPending}
                      onClick={() => voteMutation.mutate(reco.id)}
                    >
                      <Heart className={cn("size-3 mr-1", hasVoted && "fill-current")} />
                      {hasVoted ? "Mon vote" : "Voter"} · {recoVotes.length}
                    </Button>
                    {data.isOwner && !reco.is_selected ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-xs h-8"
                        onClick={() => selectMutation.mutate(reco.id)}
                        disabled={selectMutation.isPending}
                      >
                        Choisir
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            };

            return (
              <div className="space-y-6">
                {topReco ? renderRecoCard(topReco, 0, true) : null}

                {otherRecos.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {otherRecos.map((reco, idx) => renderRecoCard(reco, idx + 1, false))}
                  </div>
                ) : null}
              </div>
            );
          })()}
          </>
        )}
      </section>

      {/* HÉBERGEMENTS : Vertical Editorial List */}
      {destinationSelected ? (
        <section
          id="hub-logistics"
          className="mt-8 space-y-6 scroll-mt-24"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/50 pb-4">
            <div>
              <h2 className="font-display text-2xl font-normal text-foreground flex items-center gap-2">
                <Hotel className="size-5 text-primary" />
                Hébergement
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Des options d’hébergement adaptées au groupe et au séjour.
              </p>
            </div>
            {data.isOwner ? (
              <Button
                variant="hero"
                className="rounded-xl"
                disabled={hotelLogisticsMutation.isPending}
                onClick={() => hotelLogisticsMutation.mutate()}
              >
                {hotelLogisticsMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Hotel />
                )}
                {(trip as any).group_logistics?.hotels?.length
                  ? "Actualiser les offres"
                  : "Rechercher des hébergements"}
              </Button>
            ) : null}
          </div>

          {(trip as any).group_logistics?.hotelVoteTodo ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              To-do orga · {(trip as any).group_logistics.hotelVoteTodo}
            </p>
          ) : null}

          {(trip as any).group_logistics?.accommodationGeneration?.status === "rate_limited" ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
              <p className="font-semibold">
                {(trip as any).group_logistics.accommodationGeneration.userMessage ||
                  "Recherche de logements momentanément indisponible. Réessaie un peu plus tard."}
              </p>
            </div>
          ) : null}

          {!(trip as any).group_logistics?.hotels?.length ? (
            <p className="rounded-[24px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground bg-background">
              {(trip as any).group_logistics?.accommodationGeneration?.status === "rate_limited"
                ? (trip as any).group_logistics.accommodationGeneration.userMessage ||
                  "Recherche de logements momentanément indisponible. Réessaie un peu plus tard."
                : data.isOwner
                ? "Lance la recherche pour proposer des hébergements."
                : "L'organisateur·rice proposera bientôt des hôtels à voter."}
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {((trip as any).group_logistics.hotels as any[]).map((h: any) => {
                const votes = ((trip as any).group_logistics.hotelVotes ?? []) as {
                  userId: string;
                  hotelId: string;
                }[];
                const n = votes.filter((v) => v.hotelId === h.id).length;
                const iVoted = votes.some((v) => v.hotelId === h.id && v.userId === data.userId);
                const isTop = (trip as any).group_logistics.selectedHotelId === h.id && n > 0;
                const isReserved = (trip as any).group_logistics?.hotelBookingStatus === "réservé";
                return (
                  <article key={h.id} className="py-6 first:pt-0 last:pb-0">
                    {/* Desktop Editorial Row Grid: [photo 280px] [contenu 1fr] [prix/action 180px] */}
                    <div className="hidden lg:grid grid-cols-[280px_1fr_180px] gap-6 items-start">
                      <div className="w-[280px] h-[210px] rounded-[22px] overflow-hidden shrink-0 border border-border/40">
                        {h.imageUrl && /^https:\/\//i.test(h.imageUrl) ? (
                          <img
                            src={h.imageUrl}
                            alt=""
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <KrewPhotoFallback className="size-full" type="accommodation" aspectRatio="4/3" />
                        )}
                      </div>

                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display text-[30px] font-normal leading-snug text-foreground">
                            {h.name}
                          </h3>
                          {isTop ? (
                            isReserved ? (
                              <Badge variant="success">Réservé</Badge>
                            ) : (
                              <Badge variant="secondary">Top votes</Badge>
                            )
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground font-sans">
                          {ACCOMMODATION_CONCEPT_LABELS[h.krewConcept] ?? "Sélection KREW"}
                          {h.rating ? ` · ★ ${Number(h.rating).toFixed(1)}` : ""}
                          {h.location?.area || h.location?.city ? ` · ${[h.location.area, h.location.city].filter(Boolean).join(" · ")}` : ""}
                        </p>
                        {h.capacity != null || h.bedrooms != null ? (
                          <p className="text-xs text-muted-foreground font-sans">
                            {h.capacity != null ? `${h.capacity} personnes` : ""}
                            {h.capacity != null && h.bedrooms != null ? " · " : ""}
                            {h.bedrooms != null ? `${h.bedrooms} chambres` : ""}
                          </p>
                        ) : null}
                        {h.matchReasons?.length ? (
                          <ul className="pt-1 space-y-0.5 text-xs text-muted-foreground">
                            {h.matchReasons.slice(0, 2).map((reason: string) => (
                              <li key={reason}>• {reason}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      <div className="space-y-3 text-right">
                        <p className="font-mono text-[24px] lg:text-[28px] font-semibold text-foreground leading-none">
                          {h.pricePerPerson != null ? formatEuro(h.pricePerPerson) : "—"}
                          <span className="font-sans text-xs font-normal text-muted-foreground block mt-1">/ pers.</span>
                        </p>
                        <div className="flex flex-col items-end gap-2">
                          <Button
                            size="sm"
                            variant={iVoted ? "secondary" : "outline"}
                            className="rounded-xl w-full"
                            disabled={hotelVoteMutation.isPending}
                            onClick={() => hotelVoteMutation.mutate(h.id)}
                          >
                            <Heart className={cn("size-3.5 mr-1", iVoted && "fill-current")} />
                            {iVoted ? "Mon vote" : "Voter"} · {n}
                          </Button>
                          {h.url ? (
                            <a
                              href={h.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Voir le logement →
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Mobile Full-width Stack */}
                    <div className="lg:hidden space-y-4">
                      <div className="w-full aspect-[4/3] rounded-[22px] overflow-hidden border border-border/40">
                        {h.imageUrl && /^https:\/\//i.test(h.imageUrl) ? (
                          <img
                            src={h.imageUrl}
                            alt=""
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <KrewPhotoFallback className="size-full" type="accommodation" aspectRatio="4/3" />
                        )}
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-display text-2xl font-normal leading-snug text-foreground">
                          {h.name}
                        </h3>
                        <p className="font-mono text-xl font-semibold text-foreground">
                          {h.pricePerPerson != null ? formatEuro(h.pricePerPerson) : "—"} <span className="font-sans text-xs font-normal text-muted-foreground">/ pers.</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant={iVoted ? "secondary" : "outline"}
                            className="rounded-xl text-xs"
                            disabled={hotelVoteMutation.isPending}
                            onClick={() => hotelVoteMutation.mutate(h.id)}
                          >
                            <Heart className={cn("size-3.5 mr-1", iVoted && "fill-current")} />
                            {iVoted ? "Mon vote" : "Voter"} · {n}
                          </Button>
                          {h.url ? (
                            <a
                              href={h.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Voir le logement →
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {Boolean(
            data.isOwner ||
            (trip &&
              ((trip as any).co_organizer_id === data.userId ||
                (trip as any).coOrganizerId === data.userId)),
          ) &&
            (trip as any).group_logistics?.hotels?.length > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-muted/20 p-3 sm:px-4">
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Statut de l&apos;hôtel : </span>
                  <span className="capitalize font-medium text-primary">
                    {(trip as any).group_logistics?.hotelBookingStatus || "estimé"}
                  </span>
                </div>
                {(trip as any).group_logistics?.hotelBookingStatus !== "réservé" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                    disabled={bookingStatusMutation.isPending}
                    onClick={() =>
                      bookingStatusMutation.mutate({ type: "hotel", status: "réservé" })
                    }
                  >
                    {bookingStatusMutation.isPending ? (
                      <Loader2 className="animate-spin size-3" />
                    ) : (
                      <Check className="size-3" />
                    )}
                    Marquer comme réservé
                  </Button>
                )}
              </div>
            )}
        </section>
      ) : null}

      {/* TRANSPORT : No photos, zones bg-background rounded-[24px] p-6 */}
      <section
        id="hub-transports"
        className="mt-8 space-y-6 scroll-mt-24"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/50 pb-4">
          <div>
            <h2 className="font-display text-2xl font-normal text-foreground flex items-center gap-2">
              <Plane className="size-5 text-primary" />
              Transport
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Des trajets adaptés au point de départ et aux contraintes de chacun.
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-xl"
            disabled={!destinationSelected || logisticsMutation.isPending}
            onClick={() => logisticsMutation.mutate()}
          >
            {logisticsMutation.isPending ? <Loader2 className="animate-spin" /> : <Plane />}
            {logisticsMutation.isPending ? "Recherche en cours…" : "Générer des propositions"}
          </Button>
        </div>

        <TransportTimePrefsCard tripId={tripId} />

        {!(trip as any).group_logistics?.transports?.length ? (
          <p className="rounded-[24px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground bg-background">
            Génère des propositions de transport pour le groupe.
          </p>
        ) : (
          <div className="space-y-6">
            {(() => {
              const transports = ((trip as any).group_logistics.transports ?? []) as any[];
              const picks = ((trip as any).group_logistics.transportPicks ?? []) as any[];
              const cities = [...new Set(transports.map((tr) => tr.city as string))];
              return cities.map((city) => {
                const options = transports.filter((tr) => tr.city === city);
                const myPick = picks.find((p) => p.userId === data.userId);
                return (
                  <div key={city} className="rounded-[24px] bg-background border border-border/50 p-6 space-y-4">
                    <h3 className="font-display text-2xl font-normal text-foreground">
                      Depuis {city}
                    </h3>
                    {(() => {
                      const picks = ((trip as any).group_logistics.transportPicks ?? []) as any[];
                      const cityPicks = picks.filter(
                        (p) => String(p.city).toLowerCase() === String(city).toLowerCase(),
                      );
                      return cityPicks.length ? (
                        <ul className="mt-2 space-y-1 rounded-xl bg-surface/50 px-3 py-2 text-xs text-muted-foreground">
                          {cityPicks.map((p) => {
                            const isReserved = p.status === "réservé";
                            const isOrg = Boolean(
                              data.isOwner ||
                              (trip &&
                                ((trip as any).co_organizer_id === data.userId ||
                                  (trip as any).coOrganizerId === data.userId)),
                            );
                            return (
                              <li
                                key={p.userId}
                                className="flex items-center justify-between gap-2 py-0.5"
                              >
                                <div>
                                  <span className="font-medium text-foreground">{p.displayName}</span>
                                  {" · "}
                                  {p.modeLabel || p.mode}
                                  {p.arrivalTime || p.time
                                    ? ` · arrivée ${p.arrivalTime || p.time}`
                                    : ""}
                                  {p.departureTime ? ` · retour ${p.departureTime}` : ""}
                                  {p.label ? ` · ${p.label}` : ""}
                                  {" · "}
                                  <span className="italic text-[10px] text-muted-foreground font-semibold">
                                    ({p.status || "estimé"})
                                  </span>
                                </div>
                                {isOrg && !isReserved && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-1.5 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    disabled={bookingStatusMutation.isPending}
                                    onClick={() =>
                                      bookingStatusMutation.mutate({
                                        type: "transport",
                                        status: "réservé",
                                        userId: p.userId,
                                      })
                                    }
                                  >
                                    <Check className="size-3 mr-0.5" />
                                    Marquer comme réservé
                                  </Button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Personne au départ de {city} n&apos;a encore choisi son trajet.
                        </p>
                      );
                    })()}
                    <div className="divide-y divide-border/40">
                      {options.map((tr: any, i: number) => {
                        const isMine =
                          myPick &&
                          myPick.city === tr.city &&
                          myPick.mode === tr.mode &&
                          myPick.label === tr.label;
                        return (
                          <div
                            key={`${tr.city}-${tr.mode}-${i}`}
                            className="py-3 flex flex-wrap items-center justify-between gap-4 first:pt-0 last:pb-0"
                          >
                            <div className="min-w-0 font-sans">
                              <p className="text-sm font-semibold text-foreground">
                                {tr.modeLabel || tr.mode} · {tr.label}
                              </p>
                            </div>
                            <div className="font-mono text-sm font-semibold text-foreground">
                              {formatEuro(tr.pricePerPerson)}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant={isMine ? "hero" : "outline"}
                                className="rounded-xl text-xs h-8"
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
                                    durationHours: tr.durationHours,
                                    outboundDepartureTime:
                                      tr.providerOffer?.outboundTime || undefined,
                                    returnArrivalTime: tr.providerOffer?.returnTime || undefined,
                                    time: pickArrival || undefined,
                                  } as any)
                                }
                              >
                                {isMine ? "Mon trajet" : "Choisir ce trajet"}
                              </Button>
                              {(tr.links ?? []).slice(0, 1).map((l: any) => (
                                <a
                                  key={l.label}
                                  href={l.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-primary hover:underline"
                                >
                                  {l.label} →
                                </a>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </section>

      {/* PLANNING : Single vertical timeline, No cards */}
      {destinationSelected ? (
        <section
          id="hub-activities-plan"
          className="mt-8 space-y-6 scroll-mt-24"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/50 pb-4">
            <div>
              <h2 className="font-display text-2xl font-normal text-foreground flex items-center gap-2">
                <CalendarDays className="size-5 text-primary" />
                Planning
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Le programme du séjour, jour par jour.
              </p>
            </div>
            {data.isOwner ? (
              <Button
                variant="hero"
                className="rounded-xl"
                disabled={itineraryMutation.isPending}
                onClick={() => itineraryMutation.mutate()}
              >
                {itineraryMutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {(trip as any).group_itinerary?.days?.length
                  ? "Régénérer le planning"
                  : "Générer le planning"}
              </Button>
            ) : null}
          </div>

          {!(trip as any).group_itinerary?.days?.length ? (
            <p className="rounded-[24px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground bg-background">
              {data.isOwner
                ? "Génère le programme du séjour, de l’arrivée au départ."
                : "Le planning du séjour sera bientôt disponible."}
            </p>
          ) : (
            <div className="space-y-10">
              {((trip as any).group_itinerary.days as any[]).map((day: any) => (
                <article key={day.day} className="space-y-4">
                  <h3 className="font-display text-[34px] font-normal leading-none text-foreground mt-12 mb-6">
                    Jour {day.day}
                    {day.date
                      ? ` · ${new Date(day.date + "T12:00:00").toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "short",
                        })}`
                      : ""}
                  </h3>

                  <div className="space-y-4">
                    {(day.slots ?? []).map((slot: any, slotIndex: number) => {
                      return (
                        <div
                          key={`${day.day}-${slotIndex}`}
                          className="grid lg:grid-cols-[100px_24px_1fr_auto] gap-3 items-center py-2 border-b border-border/30 last:border-0"
                        >
                          {/* Heure Space Mono */}
                          <div className="font-mono text-sm font-semibold text-primary">
                            {slot.time || slot.moment}
                          </div>

                          {/* Timeline dot & line */}
                          <div className="hidden lg:flex flex-col items-center justify-center size-full relative">
                            <span className="size-2.5 rounded-full bg-primary shrink-0" />
                          </div>

                          {/* Contenu */}
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm">{slot.label}</p>
                            {slot.detail ? (
                              <p className="text-xs text-muted-foreground mt-0.5">{slot.detail}</p>
                            ) : null}
                            {slot.priceHint != null ? (
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                ~{formatEuro(Number(slot.priceHint))} / pers.
                              </p>
                            ) : null}
                            {slot.url && slot.type !== "transport" && slot.type !== "hotel" ? (
                              <a
                                href={slot.url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                              >
                                Voir ou réserver →
                              </a>
                            ) : null}
                          </div>

                          {/* Actions */}
                          {data.isOwner ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={slotMutation.isPending}
                              onClick={() => slotMutation.mutate({ day: day.day, slotIndex })}
                              className="shrink-0 h-8 text-xs text-muted-foreground hover:text-foreground"
                            >
                              {slotMutation.isPending ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <RefreshCw className="size-3" />
                              )}
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* TÂCHES : H1 -> rows (Checkbox, titre, assignation, statut). No cards. */}
      {destinationSelected ? (
        <section
          id="hub-tasks-org"
          className="mt-8 space-y-6 scroll-mt-24"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/50 pb-4">
            <div>
              <h2 className="font-display text-2xl font-normal text-foreground flex items-center gap-2">
                <ClipboardList className="size-5 text-primary" />
                Organisation du groupe
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Les tâches à répartir pour préparer le voyage.
              </p>
            </div>
            {hasItinerary ? (
              <Button
                variant="hero"
                size="sm"
                disabled={generateTasksMutation.isPending}
                onClick={() => generateTasksMutation.mutate()}
                className="gap-1.5 rounded-xl"
              >
                {generateTasksMutation.isPending ? (
                  <Loader2 className="animate-spin size-4" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Préparer les tâches
              </Button>
            ) : null}
          </div>

          {!hasItinerary ? (
            <p className="rounded-[24px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground bg-background">
              Le planning doit être prêt avant de répartir les tâches du voyage.
            </p>
          ) : !tasksData || tasksData.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground bg-background">
              <p>Aucune tâche pour le moment.</p>
              <Button
                variant="hero"
                size="sm"
                onClick={() => generateTasksMutation.mutate()}
                className="mt-4 gap-1.5 rounded-xl"
                disabled={generateTasksMutation.isPending}
              >
                {generateTasksMutation.isPending ? (
                  <Loader2 className="animate-spin size-4" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Préparer les tâches
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {tasksData.map((task: any) => {
                const taskDate = task.day_date
                  ? new Date(task.day_date + "T12:00:00").toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    })
                  : "—";
                return (
                  <div
                    key={task.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground shrink-0 w-24">
                        {taskDate}
                      </span>
                      <span className="font-medium text-sm text-foreground truncate">
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {data.isOwner ? (
                        <select
                          value={task.assigned_participant_id || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            reassignMutation.mutate({
                              taskId: task.id,
                              participantId: val ? val : null,
                            });
                          }}
                          className="bg-background border border-border rounded-xl px-2.5 py-1 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                        >
                          <option value="">Non attribué</option>
                          {(participants ?? [])
                            .filter((p: any) => p.status !== "absent")
                            .map((p: any) => (
                              <option key={p.id} value={p.id}>
                                {p.display_name || p.email?.split("@")[0] || "Ami"}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium">
                          {task.assigned_participant
                            ? task.assigned_participant.display_name ||
                              task.assigned_participant.email?.split("@")[0]
                            : "Non attribué"}
                        </span>
                      )}

                      <select
                        value={task.status}
                        onChange={(e) => {
                          updateStatusMutation.mutate({
                            taskId: task.id,
                            status: e.target.value as any,
                          });
                        }}
                        className={cn(
                          "border rounded-xl px-2.5 py-1 text-xs focus:outline-none font-semibold",
                          task.status === "done" &&
                            "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                          task.status === "in_progress" &&
                            "bg-amber-500/10 text-amber-600 border-amber-500/30",
                          task.status === "todo" &&
                            "bg-muted text-muted-foreground border-border",
                        )}
                      >
                        <option value="todo">À faire</option>
                        <option value="in_progress">En cours</option>
                        <option value="done">Terminé</option>
                      </select>

                      {task.booking_url ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 gap-1 text-[11px] rounded-lg"
                        >
                          <a href={task.booking_url} target="_blank" rel="noopener noreferrer">
                            Réserver
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {destinationSelected && costSplitData?.split ? (
        <section
          id="hub-cost-split"
          className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
                <Wallet className="size-5 text-primary" />
                Répartition des coûts
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Une estimation de la part de chacun pour le voyage.
              </p>
            </div>
          </div>
          <CostSplitCard split={costSplitData.split} tripName={trip.name} tripId={tripId} />
        </section>
      ) : null}

      {datesLocked ? (
        <div className="space-y-8 mt-8">
          <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <CalendarDays className="size-4" /> Ajouter au calendrier
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter au calendrier</DialogTitle>
                  <DialogDescription>Choisis le calendrier que tu utilises.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-2">
                  <Button onClick={handleDownloadIcs} variant="outline">
                    Apple / calendrier mobile (.ics)
                  </Button>
                  {googleCalendarUrl ? (
                    <Button asChild variant="outline">
                      <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer">
                        Google Calendar
                      </a>
                    </Button>
                  ) : null}
                  {outlookCalendarUrl ? (
                    <Button asChild variant="outline">
                      <a href={outlookCalendarUrl} target="_blank" rel="noopener noreferrer">
                        Outlook
                      </a>
                    </Button>
                  ) : null}
                  {office365CalendarUrl ? (
                    <Button asChild variant="outline">
                      <a href={office365CalendarUrl} target="_blank" rel="noopener noreferrer">
                        Microsoft 365
                      </a>
                    </Button>
                  ) : null}
                </div>
              </DialogContent>
            </Dialog>
          </section>

          {finalRestitutionReady ? (
            <PackingListCard
              tripId={tripId}
              participants={participants}
              avgTemp={null}
              activities={
                hasItinerary && (trip as any).group_itinerary?.days
                  ? ((trip as any).group_itinerary.days as any[])
                      .flatMap((day) =>
                        (day.slots ?? []).map((slot: any) =>
                          `${slot.label || ""} ${slot.detail || ""}`.trim(),
                        ),
                      )
                      .filter(Boolean)
                  : activities.map((a) => a.name)
              }
              durationDays={liveBudget.nights || 2}
              eventType={trip.event_type}
              accommodation={String(
                logistics.hotels?.find((hotel: any) => hotel.id === logistics.selectedHotelId)
                  ?.type ||
                  (selectedReco as any)?.accommodations?.type ||
                  logistics.accommodationType ||
                  "",
              )}
            />
          ) : null}
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
            <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
              <Star className="size-5 text-amber-500 fill-amber-500" />
              Préférences de la Star
            </h2>
            <a
              href={`/trips/${tripId}/star`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {starData?.preferences ? "Modifier" : "Remplir"} →
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Les préférences de {trip.celebrated_person || "la Star"} sont prises en compte avec
            celles du groupe.
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
              Les préférences de la Star n’ont pas encore été complétées.
            </p>
          )}
        </section>
      )}

      <section
        id="invite-section"
        className="mt-8 space-y-6 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24"
      >
        {/* 1. Le groupe */}
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Le groupe
          </h2>
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
                <UserPlus /> Ajouter une adresse e-mail
              </Button>
            </form>
          ) : null}

          <ul className="mt-4 space-y-2">
            {participants.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                Personne n’a encore rejoint le groupe.
              </li>
            ) : (
              participants.map((p) => {
                const picks = (logistics.transportPicks ?? []) as any[];
                const userPick = p.user_id
                  ? picks.find((pk: any) => pk.userId === p.user_id)
                  : null;
                const city =
                  progress?.participants?.find((pr: any) => pr.user_id === p.user_id)
                    ?.departure_city ||
                  p.departure_city ||
                  userPick?.city ||
                  null;
                return (
                  <li
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-border bg-card p-4 gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">
                          {p.display_name ?? p.email} {p.user_id === data.userId ? " (Moi)" : ""}
                        </p>
                        {p.user_id === trip.owner_id ? (
                          <Badge
                            variant="sun"
                            className="gap-1 px-1.5 py-0 text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20"
                          >
                            Organisateur·rice
                          </Badge>
                        ) : p.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId) ? (
                          <Badge variant="lagoon" className="gap-1 px-1.5 py-0 text-[10px]">
                            Co-organisateur·rice
                          </Badge>
                        ) : null}
                        {p.isStar ? (
                          <Badge
                            variant="sun"
                            className="gap-1 px-1.5 py-0 text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20"
                          >
                            <Star className="size-2.5 fill-amber-500 text-amber-500" /> Star
                          </Badge>
                        ) : null}
                      </div>
                      {p.email ? (
                        <p className="text-sm text-muted-foreground mt-0.5">{p.email}</p>
                      ) : null}
                      {city || userPick ? (
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {city ? (
                            <span>
                              📍 Départ : <strong className="text-foreground">{city}</strong>
                            </span>
                          ) : null}
                          {userPick ? (
                            <span>
                              🚆 Trajet :{" "}
                              <strong className="text-foreground">
                                {userPick.modeLabel || userPick.mode} ({userPick.label})
                              </strong>
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-end sm:self-auto">
                      <Badge
                        variant={
                          p.status === "accepte"
                            ? "success"
                            : p.status === "absent"
                              ? "destructive"
                              : "muted"
                        }
                      >
                        {p.status === "accepte" ? "Participe" : p.status}
                      </Badge>
                      {p.user_id === data.userId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 px-2"
                          onClick={() => {
                            const nextStatus =
                              (p.status as string) === "absent" ? "accepte" : "absent";
                            declareStatusMutation.mutate(nextStatus);
                          }}
                        >
                          {(p.status as string) === "absent"
                            ? "Participer à nouveau"
                            : "Indiquer mon absence"}
                        </Button>
                      ) : null}
                      {data.isCreator && p.user_id && p.user_id !== trip.owner_id && !p.isStar ? (
                        p.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-destructive hover:bg-destructive/5 h-7 px-2"
                            disabled={setCoOrgMutation.isPending}
                            onClick={() => setCoOrgMutation.mutate({ coOrganizerId: null })}
                          >
                            Retirer co-org
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-primary hover:bg-primary/5 h-7 px-2"
                            disabled={setCoOrgMutation.isPending}
                            onClick={() =>
                              setCoOrgMutation.mutate({ coOrganizerId: p.user_id || null })
                            }
                          >
                            Nommer co-org
                          </Button>
                        )
                      ) : null}
                      {data.isOwner ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Retirer ${p.email}`}
                          className="size-8"
                          onClick={() => removeMutation.mutate(p.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <Separator />

        {/* 2. Inviter de nouveaux participants */}
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Inviter de nouveaux participants
          </h2>
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Partage ce lien pour permettre au groupe de rejoindre le voyage.
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
                    toast.success("Lien copié");
                    setTimeout(() => setShareCopied(false), 2000);
                  } catch {
                    toast.error("Impossible de copier le lien.");
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
                  const text = buildWhatsAppInviteMessage();
                  shareOnWhatsApp(text);
                }}
              >
                WhatsApp
              </Button>
              {data.isOwner
                ? (() => {
                    const missingParticipants =
                      progress?.participants?.filter(
                        (p) => !p.hasAnswered || !p.hasAnsweredAvailability,
                      ) || [];
                    return (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={missingParticipants.length === 0}
                        className={
                          missingParticipants.length === 0
                            ? ""
                            : "bg-amber-500 text-white hover:bg-amber-600 border-transparent"
                        }
                        onClick={() => {
                          const text = buildWhatsAppRemindMessage();
                          shareOnWhatsApp(text);
                        }}
                      >
                        🔔{" "}
                        {missingParticipants.length === 0
                          ? "Tout le monde a répondu"
                          : "Relancer le groupe"}
                      </Button>
                    );
                  })()
                : null}
              {typeof navigator !== "undefined" &&
              typeof (navigator as any).share === "function" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    (navigator as any).share({
                      title: data.trip.name,
                      text: `Rejoins mon voyage « ${data.trip.name} » sur KREW — ${shareUrl}`,
                      url: shareUrl,
                    })
                  }
                >
                  <Link2 /> Partager
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      {data.isOwner && (trip.status as string) !== "annule" ? (
        <section className="mt-10 space-y-3 rounded-3xl border border-border/60 bg-surface/30 p-5 sm:p-6">
          <p className="mb-3 text-sm text-muted-foreground">Gestion du voyage</p>
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
                    "Supprimer définitivement ce voyage et toutes ses données ? Cette action est irréversible.",
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
        </>
      ) : null}
    </main>
  );
}
