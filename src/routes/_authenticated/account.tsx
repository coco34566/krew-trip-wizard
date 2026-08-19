import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Mon compte</h1>
        <p className="mt-2 text-muted-foreground">
          Gère les informations associées à ton compte KREW.
        </p>
      </div>

      <div className="space-y-10">
        <section className="space-y-4">
          <div className="border-b border-border/60 pb-2">
            <h2 className="text-lg font-semibold tracking-tight">Mes informations</h2>
            <p className="text-xs text-muted-foreground">Les informations associées à ton compte KREW.</p>
          </div>
          <div className="divide-y divide-border/40 text-sm">
            {firstName ? (
              <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-muted-foreground">Prénom</span>
                <span className="font-medium text-foreground">{firstName}</span>
              </div>
            ) : null}
            <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-muted-foreground">Adresse e-mail</span>
              <span className="font-medium text-foreground break-all">{user?.email ?? "—"}</span>
            </div>
            <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-muted-foreground">Date de création du compte</span>
              <span className="font-medium text-foreground">{createdAt}</span>
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-border/60 pt-8">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-destructive">Supprimer mon compte</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Supprime ton compte et les données personnelles qui n'ont plus de raison légale d'être conservées.
            </p>
          </div>

          <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>À savoir</AlertTitle>
            <AlertDescription>
              Certaines données peuvent être conservées lorsque la loi nous y oblige, notamment dans le cadre d'une obligation légale ou d'un litige.
            </AlertDescription>
          </Alert>

          {error ? (
            <p className="mt-2 text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            variant="destructive"
            className="mt-4"
            onClick={() => setOpen(true)}
            disabled={deleting}
          >
            <Trash2 className="mr-2 size-4" />
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
              {deleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
              {deleting ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
