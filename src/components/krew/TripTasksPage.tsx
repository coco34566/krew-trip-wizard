import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewIcon, KrewMark } from "@/components/krew/visual-language";
import { supabase } from "@/integrations/supabase/client";
import { isCompletedTripView } from "@/lib/krew/completed-trip-view";
import {
  reassignTaskSecure,
  sanitizeTaskAssignments,
  updateTaskStatusSecure,
} from "@/lib/task-permissions.functions";
import { generateTasksForTrip, getTripDetail } from "@/lib/trips.functions";
import { cn } from "@/lib/utils";

type TaskStatus = "todo" | "in_progress" | "done";
type TripTask = {
  id: string;
  title: string;
  status: TaskStatus;
  day_date?: string | null;
  start_time?: string | null;
  booking_url?: string | null;
  assigned_participant_id?: string | null;
  assigned_participant?: {
    id: string;
    user_id?: string | null;
    display_name?: string | null;
    email?: string | null;
  } | null;
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminé",
};

function statusClass(status: TaskStatus) {
  return cn(
    "rounded-xl border px-2.5 py-1 text-xs font-semibold",
    status === "done" && "border-sage/40 bg-sage/20 text-primary",
    status === "in_progress" && "border-primary/25 bg-primary/8 text-primary",
    status === "todo" && "border-border bg-muted text-muted-foreground",
  );
}

function participantLabel(participant: TripTask["assigned_participant"]) {
  if (!participant) return "Non attribué";
  return participant.display_name || participant.email?.split("@")[0] || "Participant";
}

export function TripTasksPage({ tripId }: { tripId: string }) {
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const updateStatus = useServerFn(updateTaskStatusSecure);
  const reassign = useServerFn(reassignTaskSecure);
  const generateTasks = useServerFn(generateTasksForTrip);
  const sanitizeAssignments = useServerFn(sanitizeTaskAssignments);

  const detailQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });
  const tasksQuery = useQuery({
    queryKey: ["trip-tasks", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_tasks" as any)
        .select(`*, assigned_participant:assigned_participant_id (id, display_name, email, user_id)`)
        .eq("trip_id", tripId)
        .order("day_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TripTask[];
    },
  });

  const refreshTasks = () => queryClient.invalidateQueries({ queryKey: ["trip-tasks", tripId] });
  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) => updateStatus({ data: { taskId, status } }),
    onSuccess: () => { toast.success("Statut de la tâche mis à jour"); refreshTasks(); },
    onError: () => { toast.error("Tu ne peux modifier que les tâches qui te sont attribuées."); refreshTasks(); },
  });
  const reassignMutation = useMutation({
    mutationFn: ({ taskId, participantId }: { taskId: string; participantId: string | null }) => reassign({ data: { taskId, participantId } }),
    onSuccess: () => { toast.success("Tâche réattribuée"); refreshTasks(); },
    onError: () => toast.error("Impossible de réattribuer cette tâche pour le moment."),
  });
  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await generateTasks({ data: { tripId } });
      if ((result as any)?.ok) await sanitizeAssignments({ data: { tripId } });
      return result;
    },
    onSuccess: () => { refreshTasks(); toast.success("Tâches prêtes"); },
    onError: () => toast.error("Impossible de préparer les tâches pour le moment."),
  });

  if (detailQuery.isLoading || tasksQuery.isLoading) {
    return <main className="mx-auto w-full max-w-5xl px-4 py-10"><KrewThinkingState context="generic" customMessage="Chargement des tâches…" delayMs={0} /></main>;
  }
  if (!detailQuery.data || detailQuery.isError || tasksQuery.isError) {
    return <main className="mx-auto w-full max-w-5xl px-4 py-10 text-sm text-muted-foreground">Impossible de charger les tâches pour le moment.</main>;
  }

  const data = detailQuery.data as any;
  const trip = data.trip as any;
  const isAdmin = Boolean(data.isOwner);
  const userId = data.userId as string;
  const completedTrip = isCompletedTripView(trip);
  const participants = ((data.participants ?? []) as any[]).filter((participant) =>
    Boolean(participant.user_id) && !participant.placeholder && participant.status !== "absent" && participant.status !== "refuse");
  const tasks = tasksQuery.data ?? [];
  const completedCount = tasks.filter((task) => task.status === "done").length;
  const hasItinerary = Boolean(trip.group_itinerary?.days?.length);

  const renderStatus = (task: TripTask) => {
    if (completedTrip) return <span className={statusClass(task.status)}>{STATUS_LABEL[task.status]}</span>;
    const canEdit = isAdmin || task.assigned_participant?.user_id === userId;
    if (!canEdit) return <span className={statusClass(task.status)}>{STATUS_LABEL[task.status]}</span>;
    return (
      <select aria-label={`Statut de ${task.title}`} value={task.status} disabled={statusMutation.isPending}
        onChange={(event) => statusMutation.mutate({ taskId: task.id, status: event.target.value as TaskStatus })}
        className={cn(statusClass(task.status), "bg-background focus:outline-none focus:ring-1 focus:ring-primary")}>
        <option value="todo">À faire</option><option value="in_progress">En cours</option><option value="done">Terminé</option>
      </select>
    );
  };

  const renderAssignee = (task: TripTask) => {
    if (completedTrip || !isAdmin) return <span className="rounded-full border border-border/60 bg-surface px-2.5 py-1 text-xs">{participantLabel(task.assigned_participant)}</span>;
    return (
      <select aria-label={`Responsable de ${task.title}`} value={task.assigned_participant_id || ""} disabled={reassignMutation.isPending}
        onChange={(event) => reassignMutation.mutate({ taskId: task.id, participantId: event.target.value || null })}
        className="rounded-xl border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
        <option value="">Non attribué</option>
        {participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.display_name || participant.email?.split("@")[0] || "Participant"}</option>)}
      </select>
    );
  };

  const taskDate = (task: TripTask) => task.day_date
    ? new Date(`${task.day_date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
    : completedTrip ? "Avant le voyage" : "Préparation";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
      <Link to="/trips/$tripId" params={{ tripId }} search={{ view: "voyage" }} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> Retour au parcours
      </Link>
      <header className="relative border-b border-border/45 pb-5 pr-20 sm:pr-24">
        <img src="/brand/otter-states/trip-preparation.png" alt="" className="pointer-events-none absolute right-0 top-0 w-[72px] object-contain opacity-90 sm:w-[88px]" />
        <h1 className="flex items-center gap-2 font-display text-[30px] font-normal text-foreground sm:text-[36px]"><KrewIcon name="tasks" tone="plum" size="sm" className="size-5" />{completedTrip ? "Tâches du voyage" : isAdmin ? "Répartir les tâches" : "Les tâches du groupe"}</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {completedTrip ? "Historique des tâches et de leur statut à la fin du voyage." : isAdmin ? "Attribue les actions utiles pour préparer le voyage et suis leur avancement." : "Retrouve les tâches du groupe. Tu peux mettre à jour uniquement celles qui te sont attribuées."}
        </p>
        {tasks.length > 0 && !completedTrip ? <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-foreground"><KrewMark type={completedCount === tasks.length ? "check" : "scribble"} tone="sage" size="sm" className="size-4" />{completedCount}/{tasks.length} terminée{tasks.length > 1 ? "s" : ""}</p> : null}
      </header>

      {!hasItinerary && !completedTrip ? <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Le planning doit être prêt avant de préparer les tâches du voyage.</div> : tasks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <p>{completedTrip ? "Aucune tâche n’avait été enregistrée pour ce voyage." : "Aucune tâche pour le moment."}</p>
          {isAdmin && !completedTrip ? <KrewStatefulButton className="mt-4 w-full sm:w-auto" idleLabel="Préparer les tâches" loadingLabel="Préparation…" successLabel="Tâches prêtes" errorLabel="Réessayer" resetAfterMs={1400} onAction={() => generateMutation.mutateAsync()} /> : null}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <article key={task.id} className="grid gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div><p className="text-xs font-medium text-muted-foreground">{taskDate(task)}{task.start_time ? ` · ${task.start_time}` : ""}</p><h2 className="mt-1 text-sm font-semibold text-foreground">{task.title}</h2></div>
              <div>{renderAssignee(task)}</div><div>{renderStatus(task)}</div>
              {task.booking_url ? <a href={task.booking_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline sm:col-span-3">Voir / réserver →</a> : null}
            </article>
          ))}
          {!completedTrip && isAdmin ? <div className="flex justify-end"><Button variant="outline" onClick={() => generateMutation.mutate()}>Actualiser les tâches</Button></div> : null}
        </div>
      )}
    </main>
  );
}
