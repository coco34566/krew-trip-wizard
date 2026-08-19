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
      <div className="mx-auto max-w-[1280px] px-4 sm:px-5 lg:px-8 pt-10 lg:pt-14 pb-16">
        <Outlet />
      </div>
    </div>
  ),
});