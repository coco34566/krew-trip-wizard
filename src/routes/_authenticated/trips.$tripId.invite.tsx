import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/trips/$tripId/invite")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/trips/$tripId",
      params: { tripId: params.tripId },
      search: { view: "todo", section: undefined },
      hash: "group-section",
    });
  },
  component: () => null,
});
