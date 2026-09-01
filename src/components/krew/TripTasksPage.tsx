import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewIcon, KrewMark } from "@/components/krew/visual-language";
import { supabase } from "@/integrations/supabase/client";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
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
      return (data ?? []) as unknown as TripTask[];
    },
  });

  const refreshTasks = () => {
    queryClient.invalidateQueries({ queryKey: ["trip-tasks", tripId] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateStatus({ data: { taskId, status } }),
    onSuccess: () => {
      refreshTasks();
    },
    onError: (error) => {
      console.error("Impossible de mettre à jour la tâche:", error);
      toast.error("Tu ne peux modifier que les tâches qui te sont attribuées.");
      refreshTasks();
    },
  });

  const reassignMutation = useMutation({
    mutationFn: ({ taskId, participantId }: { taskId: string; participantId: string | null }) =>
      reassign({ data: { taskId, participantId } }),
    onSuccess: () => {
      refreshTasks();
    },
    onError: (error) => {
      console.error("Impossible de réattribuer la tâche:", error);
      toast.error("Impossible de réattribuer cette tâche pour le moment.");
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await generateTasks({ data: { tripId } });
      if ((result as any)?.ok) {
        await sanitizeAssignments({ data: { tripId } });
      }
      return result;
    },
    onSuccess: (result: any) => {
      if (result?.ok) {
        toast.success(`${result.count ?? 0} tâche${result.count === 1 ? "" : "s"} prête${result.count === 1 ? "" : "s"}`);
        refreshTasks();
      } else {
        toast.warning("Aucune tâche à ajouter pour le moment.");
      }
    },
    onError: (error) => {
      console.error("Impossible de préparer les tâches:", error);
      toast.error("Impossible de préparer les tâches pour le moment.");
    },
  });

  if (detailQuery.isLoading || tasksQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <KrewThinkingState context="generic" customMessage="Chargement des tâches…" delayMs={0} />
      </main>
    );
  }

  if (!detailQuery.data || detailQuery.isError || tasksQuery.isError) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-10">
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "voyage" }}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Retour au voyage
        </Link>
        <p className="text-sm text-muted-foreground">Impossible de charger les tâches pour le moment.</p>
      </main>
    );
  }

  const data = detailQuery.data as any;
  const trip = data.trip as any;
  const isAdmin = Boolean(data.isOwner);
  const completedTrip =
    getTripLifecycleState({
      datesLocked: Boolean(trip.dates_locked ?? trip.datesLocked),
      startDate: trip.start_date ?? null,
      endDate: trip.end_date ?? null,
    }) === "completed";
  const userId = data.userId as string;
  const participants = ((data.participants ?? []) as any[]).filter(
    (participant) =>
      Boolean(participant.user_id) &&
      !participant.placeholder &&
      participant.status !== "absent" &&
      participant.status !== "refuse",
  );
  const tasks = tasksQuery.data ?? [];
  const hasItinerary = Boolean(trip.group_itinerary?.days?.length);
  const completed = tasks.filter((task) => task.status === "done").length;
  const identifiedActiveCount = participants.length;
  const missingParticipants = Math.max(
    0,
    Number(trip.participants_count || 0) - identifiedActiveCount,
  );

  const renderStatus = (task: TripTask) => {
    const canEdit = !completedTrip && (isAdmin || task.assigned_participant?.user_id === userId);
    if (!canEdit) {
      return <span className={statusClass(task.status)}>{STATUS_LABEL[task.status]}</span>;
    }
    return (
      <select
        aria-label={`Statut de ${task.title}`}
        value={task.status}
        disabled={statusMutation.isPending}
        onChange={(event) =>
          statusMutation.mutate({ taskId: task.id, status: event.target.value as TaskStatus })
        }
        className={cn(statusClass(task.status), "bg-background focus:outline-none focus:ring-1 focus:ring-primary")}
      >
        <option value="todo">À faire</option>
        <option value="in_progress">En cours</option>
        <option value="done">Terminé</option>
      </select>
    );
  };

  const renderAssignee = (task: TripTask) => {
    if (completedTrip || !isAdmin) {
      return (
        <span className="rounded-full border border-border/60 bg-surface px-2.5 py-1 text-xs">
          {task.assigned_participant
            ? task.assigned_participant.display_name ||
              task.assigned_participant.email?.split("@")[0] ||
              "Participant"
            : "Non attribué"}
        </span>
      );
    }
    return (
      <select
        aria-label={`Responsable de ${task.title}`}
        value={task.assigned_participant_id || ""}
        disabled={reassignMutation.isPending}
        onChange={(event) =>
          reassignMutation.mutate({
            taskId: task.id,
            participantId: event.target.value || null,
          })
        }
        className="rounded-xl border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="">Non attribué</option>
        {participants.map((participant) => (
          <option key={participant.id} value={participant.id}>
            {participant.display_name || participant.email?.split("@")[0] || "Participant"}
          </option>
        ))}
      </select>
    );
  };

  const taskDate = (task: TripTask) =>
    task.day_date
      ? new Date(`${task.day_date}T12:00:00`).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
        })
      : "Préparation";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        search={{ view: "voyage" }}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour au parcours
      </Link>

      <header className="relative border-b border-border/45 pb-5 pr-20 sm:pr-24">
        <img
          src="/brand/otter-states/trip-preparation.png"
          alt=""
          className="pointer-events-none absolute right-0 top-0 w-[72px] object-contain opacity-90 sm:w-[88px]"
        />
        <h1 className="flex items-center gap-2 font-display text-[30px] font-normal text-foreground sm:text-[36px]">
          <KrewIcon name="tasks" tone="plum" size="sm" className="size-5" />
          {completedTrip ? "Tâches du voyage" : isAdmin ? "Répartir les tâches" : "Les tâches du groupe"}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {completedTrip
            ? "Historique des tâches du voyage, avec leur responsable et leur dernier statut."
            : isAdmin
              ? "Attribue les actions utiles pour préparer le voyage et suis leur avancement."
              : "Retrouve les tâches du groupe. Tu peux mettre à jour uniquement celles qui te sont attribuées."}
        </p>
        {tasks.length > 0 && !completedTrip ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <KrewMark type={completed === tasks.length ? "check" : "scribble"} tone="sage" size="sm" className="size-4" />
            {completed}/{tasks.length} terminée{tasks.length > 1 ? "s" : ""}
          </p>
        ) : null}
      </header>

      {isAdmin && !completedTrip && missingParticipants > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <UserPlus className="size-4 text-primary" />
              {missingParticipants} participant{missingParticipants > 1 ? "s" : ""} encore à inviter
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Invite-les avant de leur attribuer une tâche.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/trips/$tripId/invite" params={{ tripId }}>
              Inviter le groupe
            </Link>
          </Button>
        </div>
      ) : null}

      {!hasItinerary ? (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {completedTrip
            ? "Aucun planning ni historique de tâches n’a été conservé pour ce voyage."
            : "Le planning doit être prêt avant de préparer les tâches du voyage."}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <p>{completedTrip ? "Aucune tâche n’a été conservée pour ce voyage." : "Aucune tâche pour le moment."}</p>
          {isAdmin && !completedTrip ? (
            <KrewStatefulButton
              className="mt-4 w-full sm:w-auto"
              idleLabel="Préparer les tâches"
              loadingLabel="Préparation…"
              successLabel="Tâches prêtes"
              errorLabel="Réessayer"
              resetAfterMs={1400}
              onAction={() => generateMutation.mutateAsync()}
            />
          ) : null}
        </div>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {tasks.map((task) => (
              <article key={task.id} className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {taskDate(task)}{task.start_time ? ` · ${task.start_time}` : ""}
                  </p>
                  <h2 className="mt-1 text-sm font-semibold text-foreground">{task.title}</h2>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>{renderAssignee(task)}</div>
                  <div>{renderStatus(task)}</div>
                </div>
                {task.booking_url ? (
                  <a
                    href={task.booking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline"
                  >
                    Voir / réserver →
                  </a>
                ) : null}
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
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
                {tasks.map((task) => (
                  <tr key={task.id} className="border-b border-border/40">
                    <td className="py-3 pr-3 text-xs font-medium text-muted-foreground">
                      {taskDate(task)} {task.start_time ? `· ${task.start_time}` : ""}
                    </td>
                    <td className="py-3 pr-3 font-semibold text-foreground">{task.title}</td>
                    <td className="py-3 pr-3">{renderAssignee(task)}</td>
                    <td className="py-3 pr-3">{renderStatus(task)}</td>
                    <td className="py-3 text-right">
                      {task.booking_url ? (
                        <a
                          href={task.booking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Voir / réserver →
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {isAdmin && !completedTrip && hasItinerary && tasks.length > 0 ? (
        <div className="border-t border-border/45 pt-4">
          <KrewStatefulButton
            variant="outline"
            idleLabel="Actualiser les tâches"
            loadingLabel="Actualisation…"
            successLabel="Tâches actualisées"
            errorLabel="Réessayer"
            onAction={() => generateMutation.mutateAsync()}
          />
        </div>
      ) : null}
    </main>
  );
}