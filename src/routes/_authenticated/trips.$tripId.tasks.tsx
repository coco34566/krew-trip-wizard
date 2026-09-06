import { createFileRoute } from "@tanstack/react-router";

import { TripTasksPage } from "@/components/krew/TripTasksPage";

export const Route = createFileRoute("/_authenticated/trips/$tripId/tasks")({
  component: TasksRoute,
});

function TasksRoute() {
  const { tripId } = Route.useParams();
  return <TripTasksPage tripId={tripId} />;
}
