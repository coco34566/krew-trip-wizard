import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/krew/Logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const res: { next?: string } = {};
    if (typeof search.next === "string") {
      res.next = search.next;
    }
    return res;
  },
  head: () => ({
    meta: [
      { title: "Connexion — Krew, l'organisateur de voyages de groupe" },
      {
        name: "description",
        content:
          "Connecte-toi à Krew pour créer, organiser et voter en groupe sur ton prochain EVG, EVJF ou week-end entre ami·e·s.",
      },
      { property: "og:title", content: "Connexion — Krew" },
      { property: "og:description", content: "Accède à tes voyages de groupe organisés par Krew." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  const { next } = Route.useSearch();

  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const returnUrl = () =>
    typeof window === "undefined"
      ? undefined
      : safeNext
        ? `${window.location.origin}${safeNext}`
        : window.location.origin;

  function goAfterAuth() {
    if (next && next.startsWith("/")) {
      navigate({ to: next as any, replace: true });
    } else {
      navigate({ to: "/dashboard", replace: true });
    }
  }

  useEffect(() => {
    if (!loading && isAuthenticated) {
      if (next && next.startsWith("/")) {
        navigate({ to: next as any, replace: true });
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    }
  }, [isAuthenticated, loading, navigate, next]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      console.error("Erreur de connexion Supabase:", error);
      let userMessage = "Impossible de se connecter. Une erreur est survenue.";
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials") || msg.includes("credentials")) {
        userMessage = "Identifiants incorrects. Vérifie ton adresse e-mail et ton mot de passe.";
      } else if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
        userMessage = "Ton adresse e-mail n'a pas encore été confirmée. Pense à valider ton inscription via le lien reçu.";
      }
      toast.error(userMessage);
      return;
    }
    goAfterAuth();
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
    });
    setBusy(false);
    if (error) {
      console.error("Erreur d'inscription Supabase:", error);
      let userMessage = "Impossible de créer le compte. Une erreur est survenue.";
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already_registered") || msg.includes("email already") || msg.includes("user already exists")) {
        userMessage = "Cette adresse e-mail est déjà utilisée pour un autre compte.";
      } else if (msg.includes("password should be") || msg.includes("weak_password") || msg.includes("password is too weak")) {
        userMessage = "Le mot de passe choisi est trop simple ou trop court (minimum 6 caractères).";
      }
      toast.error(userMessage);
      return;
    }
    if (!data.session) {
      toast.success("Compte créé — confirme ton email pour continuer.");
      return;
    }
    navigate({ to: "/dashboard" });
  }

  async function googleSignIn() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: returnUrl()!,
    });
    if (result.error) {
      toast.error("Connexion Google impossible pour le moment.");
      return;
    }
    if (result.redirected) return;
    goAfterAuth();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-hero-gradient px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center">
          <Logo size="lg" withTagline />
        </Link>
        <div className="glass-panel rounded-3xl p-6 shadow-elevated sm:p-8">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2 bg-surface">
              <TabsTrigger value="signin">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Créer un compte</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={signIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                  Se connecter
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={signUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Prénom / pseudo</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Mot de passe</Label>
                  <Input
                    id="password2"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                  Créer mon compte
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="glass" size="lg" className="w-full" onClick={googleSignIn}>
            Continuer avec Google
          </Button>
        </div>
      </div>
    </main>
  );
}