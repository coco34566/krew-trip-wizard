import { createContext, useContext, type ReactNode } from "react";

import type { TripLifecycleState } from "./trip-lifecycle";

const TripLifecycleContext = createContext<TripLifecycleState>("future");

export function TripLifecycleProvider({
  lifecycle,
  children,
}: {
  lifecycle: TripLifecycleState;
  children: ReactNode;
}) {
  return <TripLifecycleContext.Provider value={lifecycle}>{children}</TripLifecycleContext.Provider>;
}

export function useTripLifecycleState(): TripLifecycleState {
  return useContext(TripLifecycleContext);
}
