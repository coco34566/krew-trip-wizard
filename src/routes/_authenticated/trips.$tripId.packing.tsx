import { createFileRoute } from "@tanstack/react-router";

import { TripPackingPage } from "@/components/krew/TripPackingPage";

export const Route = createFileRoute("/_authenticated/trips/$tripId/packing")({
  component: TripPackingRoute,
});

function TripPackingRoute() {
  const { tripId } = Route.useParams();
  return <TripPackingPage tripId={tripId} />;
}
