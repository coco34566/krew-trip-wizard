import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { installGlobalErrorMonitoring } from "./lib/error-monitoring";
import { initializeProductAnalyticsConsent } from "./lib/product-analytics";

export const getRouter = () => {
  const queryClient = new QueryClient();

  if (typeof window !== "undefined") {
    initializeProductAnalyticsConsent();
    installGlobalErrorMonitoring();
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
