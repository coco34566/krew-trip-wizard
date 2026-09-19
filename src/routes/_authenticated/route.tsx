import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { AffiliateClickTracker } from "@/components/krew/AffiliateClickTracker";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      throw redirect({ to: "/auth", search: { next: location.href } });
    }
    return { user: data.session.user };
  },
  component: () => (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      <AffiliateClickTracker />
      <SiteHeader />
      <Outlet />
    </div>
  ),
});