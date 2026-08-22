import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/krew/Logo";
import { KrewOrganicBlob } from "@/components/krew/visual-language/KrewOrganicBlob";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Record<string, any> => search,
  head: () => ({
    meta: [
      { title: "Connexion — KREW, l'organisateur de voyages de groupe" },
      { name: "description", content: "Connecte-toi à KREW pour créer, organiser et voter en groupe sur ton prochain EVG, EVJF ou week-end entre ami·e·s." },
      { property: "og:title", content: "Connexion — KREW" },
      { property: "og:description", content: "Accède à tes voyages de groupe organisés par KREW." },
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
  const [showConfirmationSent, setShowConfirmationSent] = useState(false);
  const [resending, setResending] = useState(false);
  const { next } = Route.useSearch();

  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const returnUrl = () => typeof window === "undefined" ? undefined : safeNext ? `${window.location.origin}${safeNext}` : window.location.origin;

  function goAfterAuth() {
    if (next && next.startsWith("/")) navigate({ to: next as any, replace: true });
    else navigate({ to: "/dashboard", replace: true });
  }

  useEffect(() => {
    if (!loading && isAuthenticated) goAfterAuth();
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
      if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials") || msg.includes("credentials")) userMessage = "Identifiants incorrects. Vérifie ton adresse e-mail et ton mot de passe.";
      else if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) userMessage = "Ton adresse e-mail n'a pas encore été confirmée. Pense à valider ton inscription via le lien reçu.";
      toast.error(userMessage);
      return;
    }
    goAfterAuth();
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const options: { emailRedirectTo?: string; data: { full_name: string } } = { data: { full_name: fullName } };
    const rUrl = returnUrl();
    if (rUrl !== undefined) options.emailRedirectTo = rUrl;

    const { data, error } = await supabase.auth.signUp({ email, password, options });
    if (error) {
      setBusy(false);
      console.error("Erreur d'inscription Supabase:", error);
      let userMessage = "Impossible de créer le compte. Une erreur est survenue.";
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already_registered") || msg.includes("email already") || msg.includes("user already exists")) userMessage = "Cette adresse e-mail est déjà utilisée pour un autre compte.";
      else if (msg.includes("password should be") || msg.includes("weak_password") || msg.includes("password is too weak")) userMessage = "Le mot de passe choisi est trop simple ou trop court (minimum 6 caractères).";
      toast.error(userMessage);
      return;
    }

    setBusy(false);
    if (data.user && !data.session) {
      setShowConfirmationSent(true);
      return;
    }

    navigate({ to: "/dashboard" });
  }

  async function resendConfirmationEmail() {
    setResending(true);
    const resendOptions: { emailRedirectTo?: string } = {};
    const rUrl = returnUrl();
    if (rUrl !== undefined) resendOptions.emailRedirectTo = rUrl;

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: resendOptions,
    });
    setResending(false);

    if (error) {
      console.error("Erreur d'envoi d'email de confirmation:", error);
      toast.error("Impossible de renvoyer l'e-mail de confirmation pour le moment.");
    } else {
      toast.success("Un nouvel e-mail de confirmation a été envoyé !");
    }
  }

  if (showConfirmationSent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
        <KrewOrganicBlob
          tone="sage"
          variant="soft"
          className="absolute -top-10 -left-10 w-[240px] h-[180px] opacity-40 pointer-events-none"
        />
        <div className="w-full max-w-md relative z-10">
          <Link to="/" className="mb-8 flex justify-center">
            <Logo size="lg" withTagline />
          </Link>
          <div className="rounded-xl border border-border/60 bg-card p-6 sm:p-8 text-center space-y-6 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-3xl font-normal text-foreground">Compte créé !</h2>
              <p className="text-sm text-muted-foreground font-sans">
                Vérifie ta boîte mail pour confirmer ton adresse e-mail.
              </p>
            </div>
            <div className="rounded-xl border border-border/40 bg-muted/30 p-4 text-left text-sm text-muted-foreground leading-relaxed">
              Un e-mail de confirmation a été envoyé à <strong className="text-foreground">{email}</strong>. Clique sur le lien présent dans cet e-mail pour activer ton compte KREW.
            </div>
            <div className="space-y-3 pt-2">
              <Button
                size="lg"
                className="w-full"
                onClick={resendConfirmationEmail}
                disabled={resending}
              >
                {resending ? "Renvoi en cours..." : "Renvoyer l'e-mail de confirmation"}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="w-full gap-2"
                onClick={() => setShowConfirmationSent(false)}
              >
                <ArrowLeft className="h-4 w-4" /> Retour à la connexion
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      <KrewOrganicBlob
        tone="sage"
        variant="soft"
        className="absolute -top-10 -left-10 w-[260px] h-[200px] opacity-40 pointer-events-none"
      />
      <div className="w-full max-w-md relative z-10 space-y-6">
        <Link to="/" className="flex justify-center"><Logo size="lg" withTagline /></Link>
        <div className="text-center space-y-1">
          <h1 className="font-display text-[32px] font-normal leading-tight text-foreground relative inline-block">
            Bienvenue sur KREW
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="sm"
              className="absolute left-0 -bottom-1.5 w-[110px] pointer-events-none"
            />
          </h1>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-6 sm:p-8 shadow-sm">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2 bg-muted/40 p-1"><TabsTrigger value="signin">Connexion</TabsTrigger><TabsTrigger value="signup">Créer un compte</TabsTrigger></TabsList>
            <TabsContent value="signin" className="mt-6">
              <form onSubmit={signIn} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="password">Mot de passe</Label><Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" size="lg" className="w-full font-medium" disabled={busy}>Se connecter</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="mt-6">
              <form onSubmit={signUp} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="name">Prénom / pseudo</Label><Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="email2">Email</Label><Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="password2">Mot de passe</Label><Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" size="lg" className="w-full font-medium" disabled={busy}>Créer mon compte</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}
