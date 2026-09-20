import { createFileRoute } from "@tanstack/react-router";

import { TripParticipantFeedbackPage } from "@/components/krew/TripParticipantFeedbackPage";

export const Route = createFileRoute("/_authenticated/trips/$tripId/feedback")({
  head: () => ({
    meta: [
      { title: "Retours du groupe — KREW" },
      {
        name: "description",
        content: "Résumé des réponses du groupe pour l’organisateur.",
      },
    ],
  }),
  component: FeedbackRoute,
});

function FeedbackRoute() {
  const { tripId } = Route.useParams();
  return <TripParticipantFeedbackPage tripId={tripId} />;
}
