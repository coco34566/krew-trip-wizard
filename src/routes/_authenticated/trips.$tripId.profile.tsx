import { createFileRoute } from "@tanstack/react-router";

import { TripProfilePage } from "@/components/krew/TripProfilePage";

export const Route = createFileRoute("/_authenticated/trips/$tripId/profile")({
  component: ProfileRoute,
});

function ProfileRoute() {
  const { tripId } = Route.useParams();
  return <TripProfilePage tripId={tripId} />;
}
