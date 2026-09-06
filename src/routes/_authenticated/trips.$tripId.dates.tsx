import { createFileRoute } from "@tanstack/react-router";

import { TripDatesPage } from "@/components/krew/TripDatesPage";

export const Route = createFileRoute("/_authenticated/trips/$tripId/dates")({
  component: TripDatesRoute,
});

function TripDatesRoute() {
  const { tripId } = Route.useParams();
  return <TripDatesPage tripId={tripId} />;
}
