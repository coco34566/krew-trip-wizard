import { createFileRoute } from "@tanstack/react-router";

import { TripPlanningPage } from "@/components/krew/TripPlanningPage";

export const Route = createFileRoute("/_authenticated/trips/$tripId/planning")({
  component: PlanningRoute,
});

function PlanningRoute() {
  const { tripId } = Route.useParams();
  return <TripPlanningPage tripId={tripId} />;
}
