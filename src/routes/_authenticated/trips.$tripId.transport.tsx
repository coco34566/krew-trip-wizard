import { createFileRoute } from "@tanstack/react-router";

import { TripTransportPage } from "@/components/krew/TripTransportPage";

export const Route = createFileRoute("/_authenticated/trips/$tripId/transport")({
  component: TransportRoute,
});

function TransportRoute() {
  const { tripId } = Route.useParams();
  return <TripTransportPage tripId={tripId} />;
}
