import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user?.id) return;

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled && !profileError) {
        setFirstName(data?.full_name?.trim() || null);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function handleDeleteAccount() {
    setDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase.rpc("delete_my_account");

    if (deleteError) {
      setError("Impossible de supprimer ton compte pour le moment. Réessaie plus tard.");
      setDeleting(false);
      return;
    }

    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true, search: {} });
  }

  const createdAt = user?.created_at
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(user.created_at))
    : "—";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8 space-y-1">
        <div className="relative inline-block">
          <h1 className="font-display text-[36px] sm:text-[44px] font-normal leading-tight text-foreground">Mon compte</h1>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="sm"
            className="absolute left-0 -bottom-1.5 w-[96px] pointer-events-none"
          />
        </div>
        <p className="mt-3 text-sm text-muted-foreground font-sans">
          Tes informations de compte et tes préférences générales.
        </p>
      </div>

      <div className="space-y-10">
        <section className="space-y-3">
          <div className="border-b border-border/60 pb-2.5">
            <h2 className="font-display text-xl sm:text-2xl font-normal text-foreground">Mes informations</h2>
          </div>
          <div className="divide-y divide-border/40 text-sm">
            {firstName ? (
              <div className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                <span className="text-muted-foreground">Prénom</span>
                <span className="font-medium text-foreground">{firstName}</span>
              </div>
            ) : null}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
              <span className="text-muted-foreground">Adresse e-mail</span>
              <span className="font-medium text-foreground break-all sm:text-right">{user?.email ?? "—"}</span>
            </div>
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
              <span className="text-muted-foreground">Compte créé le</span>
              <span className="font-medium text-foreground">{createdAt}</span>
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 pt-6 space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Gestion du compte</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              Tu peux supprimer définitivement ton compte. Certaines données peuvent être conservées si la loi l’exige.
            </p>
          </div>

          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="min-h-[40px] h-auto rounded-xl border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={() => setOpen(true)}
            disabled={deleting}
          >
            <Trash2 className="size-3.5 shrink-0" />
            Supprimer mon compte
          </Button>
        </section>
      </div>

      <Dialog open={open} onOpenChange={(nextOpen) => !deleting && setOpen(nextOpen)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ton compte ?</DialogTitle>
            <DialogDescription>
              Cette action supprimera ton compte et les données personnelles qui n'ont plus de raison légale d'être conservées. Certaines données peuvent être conservées lorsque la loi l'exige.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
              Annuler
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin shrink-0" /> : <Trash2 className="size-4 shrink-0" />}
              {deleting ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
