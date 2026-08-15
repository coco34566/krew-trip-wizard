import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

/** Session Supabase côté client (header, CTA, affichage conditionnel). */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Register the auth listener before doing any explicit session read.
    // Supabase emits INITIAL_SESSION after loading the persisted session from storage;
    // listening to that event avoids a startup race where the UI briefly concludes that
    // the user is signed out before the persisted session has been restored.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        setSession(null);
        setLoading(false);
        return;
      }

      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        setSession(next);
        setLoading(false);
      }
    });

    // Keep an explicit fallback for browsers where the initial auth event can be
    // delayed or missed during startup. getSession() also refreshes an expired
    // persisted session when possible.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (!error && data.session) {
        setSession(data.session);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user: User | null = session?.user ?? null;
  return { session, user, loading, isAuthenticated: !!user };
}
