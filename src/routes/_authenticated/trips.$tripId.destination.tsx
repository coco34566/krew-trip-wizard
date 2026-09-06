import { createFileRoute } from "@tanstack/react-router";

import { TripDestinationPage } from "@/components/krew/TripDestinationPage";

export const Route = createFileRoute("/_authenticated/trips/$tripId/destination")({
  component: DestinationRoute,
});

function DestinationRoute() {
  const { tripId } = Route.useParams();
  return <TripDestinationPage tripId={tripId} />;
}
