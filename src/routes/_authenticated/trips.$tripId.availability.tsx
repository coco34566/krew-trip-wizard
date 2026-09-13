import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/trips/$tripId/availability")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/trips/$tripId/questionnaire",
      params: { tripId: params.tripId },
    });
  },
});
