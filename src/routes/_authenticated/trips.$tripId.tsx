import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

import { PlanningMapSection } from "@/components/krew/PlanningMapSection";

/**
 * Layout parent du voyage : obligatoire pour que les routes enfants
 * (availability, questionnaire, invite, star, recap) s'affichent via <Outlet />.
 */
export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  component: TripLayout,
});

function TripLayout() {
  const { tripId } = Route.useParams();
  const location = useRouterState({ select: (state) => state.location });
  const search = location.search as Record<string, unknown>;
  const showPlanningMap = search.view === "voyage" && search.section === "planning";

  return (
    <>
      <Outlet />
      {showPlanningMap ? <PlanningMapSection tripId={tripId} /> : null}
    </>
  );
}
