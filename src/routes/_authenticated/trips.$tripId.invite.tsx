import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/trips/$tripId/invite")({
  head: () => ({ meta: [{ title: "Inviter le groupe — KREW" }] }),
});
