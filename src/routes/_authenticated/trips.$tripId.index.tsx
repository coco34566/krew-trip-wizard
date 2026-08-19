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
  head: () => ({
    meta: [
      { title: "Mon Voyage — KREW" },
      {
        name: "description",
        content: "Propositions KREW, planning jour par jour, budget détaillé et votes du groupe.",
      },
      { property: "og:title", content: "Mon Voyage — KREW" },
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
      ></TripHubDashboard>

      {data.isOwner ? (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => shareOnWhatsApp(buildWhatsAppStatusMessage())}
          >
            Partager l’état du voyage
          </Button>
        </div>
      ) : null}

      {/* Restitution finale uniquement lorsque destination et planning sont réellement validés. */}
      {finalRestitutionReady ? (
        <section className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
                <Wallet className="size-5 text-primary" />
                Résumé du voyage
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Retrouve ici les éléments principaux du voyage.
              </p>
            </div>
            <Button
              type="button"
              className="bg-[#25D366] text-white hover:bg-[#1ebe57] border-transparent"
              onClick={() => {
                const text = buildWhatsAppStatusMessage();
                shareOnWhatsApp(text);
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
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Budget estimé par personne
              </dt>
              <dd className="mt-0.5 font-semibold text-primary text-sm">
                {(costSplitData?.totalReserved != null && costSplitData.totalReserved > 0) ||
                (costSplitData?.totalEstimated != null && costSplitData.totalEstimated > 0) ? (
                  <div className="text-xs space-y-0.5 font-normal">
                    <div className="flex justify-between gap-1">
                      <span>Déjà réservé :</span>{" "}
                      <span className="font-bold text-emerald-600">
                        {formatEuro(costSplitData.totalReserved ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-1">
                      <span>Reste estimé :</span>{" "}
                      <span className="font-bold text-amber-600">
                        {formatEuro(costSplitData.totalEstimated ?? 0)}
                      </span>
                    </div>
                  </div>
                ) : liveBudget.total > 0 ? (
                  `~${formatEuro(liveBudget.total)} / pers.`
                ) : (
                  "À définir"
                )}
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
                Hébergement ~{formatEuro(liveBudget.accommodation)}
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
      ) : null}

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

      <section
        id="hub-profile"
        className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24"
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

      <section
        id="hub-destination"
        className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24"
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
                .sort((a, b) => Number(b.is_selected) - Number(a.is_selected) || b.score - a.score)
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

      {destinationSelected ? (
        <section
          id="hub-logistics"
          className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
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
            <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {(trip as any).group_logistics?.accommodationGeneration?.status === "rate_limited"
                ? (trip as any).group_logistics.accommodationGeneration.userMessage ||
                  "Recherche de logements momentanément indisponible. Réessaie un peu plus tard."
                : data.isOwner
                ? "Lance la recherche pour proposer des hébergements."
                : "L'organisateur·rice proposera bientôt des hôtels à voter."}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
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
                  <article
                    key={h.id}
                    className={cn(
                      "rounded-2xl border bg-card p-4 shadow-sm",
                      isTop
                        ? isReserved
                          ? "border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-500/5"
                          : "border-border ring-1 ring-border"
                        : "border-border",
                    )}
                  >
                    {h.imageUrl && /^https:\/\//i.test(h.imageUrl) ? (
                      <img
                        src={h.imageUrl}
                        alt=""
                        className="mb-3 h-40 w-full rounded-xl object-cover aspect-[4/3]"
                        loading="lazy"
                      />
                    ) : (
                      <KrewPhotoFallback className="mb-3 h-40 w-full" type="accommodation" aspectRatio="4/3" />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-base">{h.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ACCOMMODATION_CONCEPT_LABELS[h.krewConcept] ?? "Sélection KREW"}
                          {h.rating ? ` · ★ ${Number(h.rating).toFixed(1)}` : ""}
                        </p>
                        {h.location?.area || h.location?.city ? (
                          <p className="text-xs text-muted-foreground">
                            {[h.location.area, h.location.city].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                      </div>
                      {isTop ? (
                        isReserved ? (
                          <Badge variant="success">Réservé</Badge>
                        ) : (
                          <Badge variant="muted">Top votes</Badge>
                        )
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm">
                      {h.pricePerPerson != null ? (
                        <>
                          <span className="font-mono font-semibold">{formatEuro(h.pricePerPerson)}</span>
                          <span> / pers. pour le séjour</span>
                        </>
                      ) : (
                        "Prix à vérifier"
                      )}
                      {h.pricePerPerson != null ? (
                        <span className="text-muted-foreground">
                          {h.priceStatus === "verified" ? " · Prix vérifié" : " · Prix indicatif"}
                        </span>
                      ) : null}
                    </p>
                    {h.capacity != null || h.bedrooms != null ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {h.capacity != null ? `${h.capacity} personnes` : ""}
                        {h.capacity != null && h.bedrooms != null ? " · " : ""}
                        {h.bedrooms != null ? `${h.bedrooms} chambres` : ""}
                      </p>
                    ) : null}
                    {h.matchReasons?.length ? (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {h.matchReasons.slice(0, 3).map((reason: string) => (
                          <li key={reason}>• {reason}</li>
                        ))}
                      </ul>
                    ) : null}
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
                      {(h.url ? [{ label: "Voir le logement", url: h.url }] : [])
                        .slice(0, 1)
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
                    {h.configs && h.configs.length > 0 && (
                      <div className="mt-4 space-y-2 border-t border-border/40 pt-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                          Configurations de couchage recommandées :
                        </p>
                        <div className="space-y-2">
                          {h.configs.map((c: any) => (
                            <div
                              key={c.id}
                              className="text-xs bg-muted/40 rounded-xl p-2.5 border border-border/40"
                            >
                              <div className="flex items-center justify-between font-medium">
                                <span>{c.name}</span>
                                <span className="text-primary font-mono font-semibold">
                                  {formatEuro(c.pricePerPerson)} / pers.
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                🛌 {c.bedrooms} ch. · 🛌 {c.beds} lits · 🚿 {c.bathrooms} SDB ·
                                Total : <span className="font-mono">{formatEuro(c.totalCost)}</span> (frais inclus)
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-1 italic leading-snug">
                                {c.explanation}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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

      <section
        id="hub-transports"
        className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
              <Plane className="size-5 text-primary" />
              Transport
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Des trajets adaptés au point de départ et aux contraintes de chacun.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={!destinationSelected || logisticsMutation.isPending}
            onClick={() => logisticsMutation.mutate()}
          >
            {logisticsMutation.isPending ? <Loader2 className="animate-spin" /> : <Plane />}
            {logisticsMutation.isPending ? "Recherche en cours…" : "Générer des propositions"}
          </Button>
        </div>

        <TransportTimePrefsCard tripId={tripId} />

        {groupTimeWindow &&
        (groupTimeWindow.majorityArrival || groupTimeWindow.majorityDeparture) ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 font-medium text-primary">
              <Clock className="size-4" />
              <span>Horaires du groupe</span>
            </div>
            <p className="text-muted-foreground">
              La majorité du groupe arrive vers{" "}
              <strong className="text-foreground">{groupTimeWindow.majorityArrival || "—"}</strong>{" "}
              et repart vers{" "}
              <strong className="text-foreground">
                {groupTimeWindow.majorityDeparture || "—"}
              </strong>
              .
            </p>
          </div>
        ) : null}

        {!(trip as any).group_logistics?.transports?.length ? (
          <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
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
                const cityPicks = picks.filter(
                  (p) => String(p.city).toLowerCase() === String(city).toLowerCase(),
                );
                const myPick = picks.find((p) => p.userId === data.userId);
                return (
                  <div key={city} className="rounded-3xl border border-border bg-card p-4 sm:p-5">
                    <h3 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
                      <Plane className="size-4 text-primary" />
                      Depuis {city}
                    </h3>
                    {cityPicks.length ? (
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
                              <p className="text-xs text-muted-foreground font-mono">
                                ~{formatEuro(tr.pricePerPerson)} / pers. A/R
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

      {destinationSelected ? (
        <section
          id="hub-activities-plan"
          className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
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
                disabled={itineraryMutation.isPending}
                onClick={() => itineraryMutation.mutate()}
              >
                {itineraryMutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {(trip as any).group_itinerary?.days?.length
                  ? "Régénérer tout le planning"
                  : "Générer le planning"}
              </Button>
            ) : null}
          </div>

          {!(trip as any).group_itinerary?.days?.length ? (
            <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {data.isOwner
                ? "Génère le programme du séjour, de l’arrivée au départ."
                : "Le planning du séjour sera bientôt disponible."}
            </p>
          ) : (
            <div className="space-y-4">
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
                                  <span className="mr-1.5 inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold font-mono text-primary normal-case tracking-normal">
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
                                <p className="text-xs text-muted-foreground font-mono">
                                  ~{formatEuro(Number(slot.priceHint))} / pers.
                                </p>
                              ) : null}
                              {slot.url && slot.type !== "transport" && slot.type !== "hotel" ? (
                                <a
                                  href={slot.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-0.5 inline-block text-xs font-medium text-primary hover:underline"
                                >
                                  Voir ou réserver →
                                </a>
                              ) : null}
                            </div>
                          </div>
                          {data.isOwner ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={slotMutation.isPending}
                              onClick={() => slotMutation.mutate({ day: day.day, slotIndex })}
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

      {destinationSelected ? (
        <section
          id="hub-tasks-org"
          className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/50 pb-4">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
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
                className="gap-1.5"
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
            <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Le planning doit être prêt avant de répartir les tâches du voyage.
            </p>
          ) : !tasksData || tasksData.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <p>Aucune tâche pour le moment.</p>
              <Button
                variant="hero"
                size="sm"
                onClick={() => generateTasksMutation.mutate()}
                className="mt-4 gap-1.5"
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2.5 pr-3">Date et heure</th>
                    <th className="py-2.5 pr-3">Action</th>
                    <th className="py-2.5 pr-3">Responsable</th>
                    <th className="py-2.5 pr-3">Statut</th>
                    <th className="py-2.5 text-right">Lien</th>
                  </tr>
                </thead>
                <tbody>
                  {tasksData.map((task: any) => {
                    const taskDate = task.day_date
                      ? new Date(task.day_date + "T12:00:00").toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })
                      : "—";
                    return (
                      <tr
                        key={task.id}
                        className="border-b border-border/50 hover:bg-surface/10 transition-colors"
                      >
                        <td className="py-3.5 pr-3 text-xs font-semibold tabular-nums text-muted-foreground">
                          {taskDate} {task.start_time ? `· ${task.start_time}` : ""}
                        </td>
                        <td className="py-3.5 pr-3">
                          <span className="text-sm font-semibold text-foreground">
                            {task.title}
                          </span>
                        </td>
                        <td className="py-3.5 pr-3">
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
                              className="bg-background border border-border rounded-xl px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
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
                            <span className="text-xs px-2.5 py-1 rounded-full bg-surface border border-border/60">
                              {task.assigned_participant
                                ? task.assigned_participant.display_name ||
                                  task.assigned_participant.email?.split("@")[0]
                                : "Non attribué"}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 pr-3">
                          <select
                            value={task.status}
                            onChange={(e) => {
                              updateStatusMutation.mutate({
                                taskId: task.id,
                                status: e.target.value as any,
                              });
                            }}
                            className={cn(
                              "border rounded-xl px-2 py-1 text-xs focus:outline-none font-semibold",
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
                        </td>
                        <td className="py-3.5 text-right">
                          {task.booking_url ? (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 gap-1 text-[11px]"
                            >
                              <a href={task.booking_url} target="_blank" rel="noopener noreferrer">
                                Réserver
                              </a>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
    </main>
  );
}
