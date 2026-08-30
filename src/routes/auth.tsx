import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/krew/Logo";
import { KrewIcon, KrewMark, KrewOrganicBlob } from "@/components/krew/visual-language";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Record<string, any> => search,
  head: () => ({
    meta: [
      { title: "Connexion — KREW" },
      { name: "description", content: "Connecte-toi à KREW pour retrouver ou organiser tes voyages de groupe." },
      { property: "og:title", content: "Connexion — KREW" },
      { property: "og:description", content: "Retrouve tes voyages de groupe sur KREW." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const AUTH_INPUT_CLASS =
  "h-11 rounded-[10px] border-border/70 bg-background px-3 text-[15px] shadow-none transition-colors focus-visible:border-primary/55 focus-visible:ring-2 focus-visible:ring-primary/10";

function AuthPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showConfirmationSent, setShowConfirmationSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { next, mode } = Route.useSearch();

  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const isRecovery = mode === "recovery";
  const returnUrl = () => typeof window === "undefined" ? undefined : safeNext ? `${window.location.origin}${safeNext}` : window.location.origin;

  function goAfterAuth() {
    if (safeNext) {
      window.location.assign(safeNext);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  useEffect(() => {
    if (!isRecovery && !loading && isAuthenticated) goAfterAuth();
  }, [isAuthenticated, isRecovery, loading, safeNext]);

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
      else if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) userMessage = "Ton adresse e-mail n'a pas encore été confirmée. Confirme ton inscription avec le lien reçu.";
      toast.error(userMessage);
      return;
    }
    goAfterAuth();
  }

  async function requestPasswordReset() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Renseigne ton adresse e-mail pour recevoir le lien de réinitialisation.");
      return;
    }

    setResetBusy(true);
    const redirectTo = typeof window === "undefined"
      ? undefined
      : `${window.location.origin}/auth?mode=recovery`;
    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      redirectTo ? { redirectTo } : undefined,
    );
    setResetBusy(false);

    if (error) {
      console.error("Erreur de réinitialisation du mot de passe Supabase:", error);
      toast.error("Impossible d’envoyer le lien de réinitialisation pour le moment.");
      return;
    }

    setResetEmailSent(true);
    toast.success("Lien de réinitialisation envoyé");
  }

  async function updateRecoveredPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Choisis un mot de passe d’au moins 6 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      console.error("Erreur de mise à jour du mot de passe Supabase:", error);
      toast.error("Ce lien a peut-être expiré. Demande un nouveau lien de réinitialisation.");
      return;
    }

    toast.success("Mot de passe mis à jour");
    navigate({ to: "/dashboard", replace: true });
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

    goAfterAuth();
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
      toast.success("E-mail de confirmation envoyé");
    }
  }

  if (isRecovery) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <KrewOrganicBlob tone="sage" variant="soft" className="pointer-events-none absolute -left-16 -top-16 h-[260px] w-[340px] opacity-35" />
        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[560px] flex-col justify-center">
          <Link to="/" className="mb-10 w-fit"><Logo size="lg" withTagline /></Link>
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="font-display text-[36px] font-normal leading-[0.98] text-foreground sm:text-[44px]">Choisis un nouveau mot de passe</h1>
              <p className="text-[15px] leading-relaxed text-muted-foreground">Une fois enregistré, tu retrouveras directement tes voyages.</p>
            </div>
            <form onSubmit={updateRecoveredPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="recovery-password" className="text-[13px] font-medium text-foreground">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input id="recovery-password" type={showPassword ? "text" : "password"} required minLength={6} autoComplete="new-password" className={`${AUTH_INPUT_CLASS} pr-11`} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recovery-password-confirm" className="text-[13px] font-medium text-foreground">Confirmer le mot de passe</Label>
                <Input id="recovery-password-confirm" type={showPassword ? "text" : "password"} required minLength={6} autoComplete="new-password" className={AUTH_INPUT_CLASS} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer mon mot de passe"}</Button>
            </form>
            <Link to="/auth" className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-semibold text-muted-foreground transition-colors hover:text-primary">
              <ArrowLeft className="size-4" /> Demander un nouveau lien
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (showConfirmationSent) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <KrewOrganicBlob tone="sage" variant="soft" className="pointer-events-none absolute -left-16 -top-16 h-[260px] w-[340px] opacity-35" />
        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[720px] flex-col justify-center">
          <Link to="/" className="mb-10 w-fit"><Logo size="lg" withTagline /></Link>
          <div className="max-w-[560px] space-y-6">
            <div className="flex size-11 items-center justify-center rounded-full bg-sage/15 text-primary">
              <KrewIcon name="message" tone="plum" size="md" className="size-5" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-[36px] font-normal leading-[0.98] text-foreground sm:text-[44px]">Compte créé</h1>
              <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">Vérifie ta boîte mail pour confirmer ton adresse e-mail.</p>
            </div>
            <p className="max-w-[520px] border-l-2 border-sage/50 pl-4 text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
              Un e-mail de confirmation a été envoyé à <strong className="break-all text-foreground">{email}</strong>. Clique sur le lien présent dans cet e-mail pour activer ton compte KREW.
            </p>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button onClick={resendConfirmationEmail} disabled={resending}>
                {resending ? "Renvoi en cours…" : "Renvoyer l'e-mail"}
              </Button>
              <button
                type="button"
                onClick={() => setShowConfirmationSent(false)}
                className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-semibold text-muted-foreground transition-colors hover:text-primary"
              >
                <ArrowLeft className="size-4" /> Retour à la connexion
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(300px,0.82fr)_minmax(480px,1.18fr)]">
      <section className="relative overflow-hidden border-b border-border/45 bg-sage/[0.07] px-4 py-7 sm:px-6 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-10 lg:py-10 xl:px-14">
        <KrewOrganicBlob tone="sage" variant="soft" className="pointer-events-none absolute -left-24 top-[18%] h-[280px] w-[390px] opacity-45" />
        <div className="relative z-10 mx-auto flex h-full w-full max-w-[520px] flex-col lg:justify-between">
          <Link to="/" className="w-fit"><Logo size="lg" withTagline /></Link>

          <div className="mt-9 grid grid-cols-[minmax(0,1fr)_82px] items-end gap-4 lg:mt-0 lg:block">
            <div className="max-w-[420px]">
              <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">La team. Le plan. Le moment.</p>
              <h1 className="mt-2 font-display text-[34px] font-normal leading-[0.98] tracking-[-0.02em] text-foreground sm:text-[42px] lg:text-[50px]">
                Retrouve ton voyage, simplement.
              </h1>
              <p className="mt-4 max-w-[390px] text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
                Connecte-toi pour retrouver tes voyages de groupe et poursuivre l’organisation là où tu l’as laissée.
              </p>
            </div>
            <img
              src="/brand/otter-states/lets-go.png"
              alt=""
              className="pointer-events-none w-[82px] justify-self-end object-contain lg:mt-10 lg:w-[118px]"
            />
          </div>
        </div>
      </section>

      <section className="flex min-h-[calc(100vh-220px)] items-center px-4 py-10 sm:px-6 lg:min-h-screen lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-[520px]">
          <div className="mb-8 space-y-2">
            <div className="relative inline-block pb-2">
              <h2 className="font-display text-[32px] font-normal leading-tight text-foreground sm:text-[36px]">Bienvenue sur KREW</h2>
              <KrewMark type="underline-wave" tone="sage" size="sm" className="pointer-events-none absolute -bottom-1 left-0 h-3 w-[120px] opacity-70" />
            </div>
            <p className="text-[14px] text-muted-foreground sm:text-[15px]">Choisis simplement si tu veux te connecter ou créer ton compte.</p>
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="mb-7 flex h-auto w-full justify-start gap-7 rounded-none border-b border-border/55 bg-transparent p-0">
              <TabsTrigger
                value="signin"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 text-[14px] font-semibold text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                Connexion
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 text-[14px] font-semibold text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                Créer un compte
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-0">
              <form onSubmit={signIn} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[13px] font-medium text-foreground">Adresse e-mail</Label>
                  <Input id="email" type="email" required autoComplete="email" className={AUTH_INPUT_CLASS} value={email} onChange={(e) => { setEmail(e.target.value); setResetEmailSent(false); }} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="password" className="text-[13px] font-medium text-foreground">Mot de passe</Label>
                    <button type="button" onClick={requestPasswordReset} disabled={resetBusy} className="text-[12px] font-semibold text-primary hover:underline disabled:opacity-60">
                      {resetBusy ? "Envoi…" : "Mot de passe oublié ?"}
                    </button>
                  </div>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" className={`${AUTH_INPUT_CLASS} pr-11`} value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button
                      type="button"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {resetEmailSent ? <p className="text-[12px] leading-relaxed text-muted-foreground">Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé.</p> : null}
                </div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-0">
              <form onSubmit={signUp} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[13px] font-medium text-foreground">Prénom / pseudo</Label>
                  <Input id="name" autoComplete="name" className={AUTH_INPUT_CLASS} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2" className="text-[13px] font-medium text-foreground">Adresse e-mail</Label>
                  <Input id="email2" type="email" required autoComplete="email" className={AUTH_INPUT_CLASS} value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2" className="text-[13px] font-medium text-foreground">Mot de passe</Label>
                  <div className="relative">
                    <Input id="password2" type={showPassword ? "text" : "password"} required minLength={6} autoComplete="new-password" className={`${AUTH_INPUT_CLASS} pr-11`} value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button
                      type="button"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">6 caractères minimum.</p>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Création…" : "Créer mon compte"}</Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-7 text-center text-[12px] leading-relaxed text-muted-foreground">
            En continuant, tu acceptes les <Link to="/cgu" className="underline underline-offset-2 hover:text-primary">conditions d’utilisation</Link> et la <Link to="/confidentialite" className="underline underline-offset-2 hover:text-primary">politique de confidentialité</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
