import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

import { PlanningMapSection } from "@/components/krew/PlanningMapSection";
import { TripTasksPage } from "@/components/krew/TripTasksPage";
import { TripTransportPage } from "@/components/krew/TripTransportPage";

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
  const showTasksPage = search.view === "voyage" && search.section === "tasks";
  const showTransportPage = search.view === "voyage" && search.section === "transport";

  return (
    <>
      {showTasksPage ? (
        <TripTasksPage tripId={tripId} />
      ) : showTransportPage ? (
        <TripTransportPage tripId={tripId} />
      ) : (
        <Outlet />
      )}
      {showPlanningMap ? <PlanningMapSection tripId={tripId} /> : null}
    </>
  );
}
