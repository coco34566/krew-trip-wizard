import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/krew/SiteHeader";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: {} });
    return { user: data.user };
  },
  component: () => (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      <SiteHeader />
      <Outlet />
    </div>
  ),
});