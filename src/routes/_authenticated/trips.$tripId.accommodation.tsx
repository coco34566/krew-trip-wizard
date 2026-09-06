import { createFileRoute } from "@tanstack/react-router";

import { TripAccommodationPage } from "@/components/krew/TripAccommodationPage";

export const Route = createFileRoute("/_authenticated/trips/$tripId/accommodation")({
  component: AccommodationRoute,
});

function AccommodationRoute() {
  const { tripId } = Route.useParams();
  return <TripAccommodationPage tripId={tripId} />;
}
