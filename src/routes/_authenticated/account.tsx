import { useState } from "react";
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
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    setDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase.rpc("delete_my_account");

    if (deleteError) {
      setError("Impossible de supprimer votre compte pour le moment. Veuillez réessayer plus tard.");
      setDeleting(false);
      return;
    }

    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true, search: {} });
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Mon compte</h1>
        <p className="mt-2 text-muted-foreground">
          Gérez les informations associées à votre compte KREW.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Mes informations</CardTitle>
            <CardDescription>Les informations utilisées pour votre compte KREW.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Adresse e-mail</p>
              <p className="mt-1 break-all font-medium">{user?.email ?? "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supprimer mon compte</CardTitle>
            <CardDescription>
              Supprimez votre compte et les données personnelles qui n'ont plus de raison légale d'être conservées.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertTitle>À savoir</AlertTitle>
              <AlertDescription>
                Certaines données peuvent être conservées lorsque la loi nous y oblige, notamment dans le cadre d'une obligation légale ou d'un litige.
              </AlertDescription>
            </Alert>

            {error ? (
              <p className="mt-4 text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="button"
              variant="destructive"
              className="mt-6"
              onClick={() => setOpen(true)}
              disabled={deleting}
            >
              <Trash2 className="mr-2 size-4" />
              Supprimer mon compte
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={(nextOpen) => !deleting && setOpen(nextOpen)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer votre compte ?</DialogTitle>
            <DialogDescription>
              Cette action supprimera votre compte et les données personnelles qui n'ont plus de raison légale d'être conservées. Certaines données peuvent être conservées lorsque la loi l'exige.
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
