import type { ComponentProps } from "react";

import { TripHubDashboard as TripHubDashboardLegacy } from "./TripHubDashboard";

type Props = ComponentProps<typeof TripHubDashboardLegacy>;

/**
 * Keeps Krew Pulse on the centralized questionnaire denominator.
 * The legacy dashboard still contains a historical participants_count fallback;
 * routing this import through the entry point makes that fallback resolve to the
 * already-centralized progressTotal instead of estimated invitation capacity.
 */
export function TripHubDashboard(props: Props) {
  const progressTotal = Number.isFinite(props.progressTotal)
    ? Math.max(0, props.progressTotal)
    : 0;

  return (
    <TripHubDashboardLegacy
      {...props}
      progressTotal={progressTotal}
      trip={{
        ...props.trip,
        participants_count: progressTotal,
      }}
    />
  );
}
