import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { getTripAvailability, submitMyAvailability } from "@/lib/availability.functions";

export const Route = createFileRoute("/_authenticated/trips/$tripId/availability")({
  head: () => ({
    meta: [
      { title: "Disponibilités — Krew" },
      { name: "description", content: "Indique tes dates et vois le résultat provisoire du groupe." },
    ],
  }),
  component: AvailabilityPage,
});

function parseDateList(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{4}-\d{2}-\d{2}/.test(s))
    .map((s) => s.slice(0, 10));
}

function AvailabilityPage() {
  const { tripId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchAvail = useServerFn(getTripAvailability);
  const submit = useServerFn(submitMyAvailability);

  const { data, isLoading, error } = useQuery({
    queryKey: ["trip-availability", tripId],
    queryFn: () => fetchAvail({ data: { tripId } }),
  });

  const [availableRaw, setAvailableRaw] = useState("");
  const [blockedRaw, setBlockedRaw] = useState("");
  const [flexDays, setFlexDays] = useState(1);
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (data?.mine && !hydrated) {
      setAvailableRaw((data.mine.availableDates ?? []).join(", "));
      setBlockedRaw((data.mine.blockedDates ?? []).join(", "));
      setFlexDays(data.mine.flexDays ?? 1);
      setNotes(data.mine.notes ?? "");
      setHydrated(true);
    }
  }, [data?.mine, hydrated]);

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          tripId,
          availableDates: parseDateList(availableRaw),
          blockedDates: parseDateList(blockedRaw),
          flexDays,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(res.isUpdate ? "Disponibilités mises à jour" : "Disponibilités enregistrées");
      queryClient.invalidateQueries({ queryKey: ["trip-availability", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? e);
      if (msg.includes("trip_availability") || msg.includes("schema")) {
        toast.error("Table disponibilités absente — applique la migration SQL");
      } else {
        toast.error(msg.slice(0, 120) || "Enregistrement impossible");
      }
    },
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-muted-foreground">
        {(error as Error)?.message ?? "Impossible de charger les disponibilités."}
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to="/trips/$tripId" params={{ tripId }}>
              Retour au hub
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  const provisionalLabel =
    data.windows[0]
      ? `${new Date(data.windows[0].start).toLocaleDateString("fr-FR")} → ${new Date(data.windows[0].end).toLocaleDateString("fr-FR")}`
      : "Pas encore de fenêtre commune";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour au hub
      </Link>

      <header className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Disponibilités · résumé live</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{data.trip.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.answered}/{data.expected} ont indiqué leurs dates · résultat{" "}
          {data.answered < data.expected ? "provisoire" : "à jour"}
        </p>
      </header>

      <section className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Résumé des disponibilités</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Meilleure fenêtre actuelle : <strong className="text-foreground">{provisionalLabel}</strong>
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {data.windows.map((w, i) => (
            <li
              key={`${w.start}-${w.end}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-surface/40 px-3 py-2 text-sm"
            >
              <span>
                {i === 0 ? "⭐ " : ""}
                {new Date(w.start).toLocaleDateString("fr-FR")} →{" "}
                {new Date(w.end).toLocaleDateString("fr-FR")}
                <span className="text-muted-foreground"> · {w.nights} nuit(s)</span>
              </span>
              <Badge variant={w.coverageRatio >= 0.8 ? "success" : "lagoon"}>
                {w.covered}/{w.total} dispo · {Math.round(w.coverageRatio * 100)} %
              </Badge>
            </li>
          ))}
          {data.windows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              En attente des premières réponses pour calculer une date.
            </p>
          ) : null}
        </ul>
      </section>

      <section className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Mes disponibilités</h2>
        <p className="text-xs text-muted-foreground">
          Format des dates : AAAA-MM-JJ, séparées par des virgules. Lié à ton compte uniquement.
        </p>
        <div>
          <Label>Dates où je suis disponible</Label>
          <Input
            className="mt-1"
            value={availableRaw}
            onChange={(e) => setAvailableRaw(e.target.value)}
            placeholder="2026-09-18, 2026-09-19, 2026-09-20"
          />
        </div>
        <div>
          <Label>Dates impossibles</Label>
          <Input
            className="mt-1"
            value={blockedRaw}
            onChange={(e) => setBlockedRaw(e.target.value)}
            placeholder="2026-09-12, 2026-09-13"
          />
        </div>
        <div>
          <Label className="mb-2 block">Flexibilité : ± {flexDays} jour(s)</Label>
          <Slider min={0} max={7} step={1} value={[flexDays]} onValueChange={([v]) => setFlexDays(v ?? 0)} />
        </div>
        <div>
          <Label>Notes (optionnel)</Label>
          <Textarea
            className="mt-1"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex. : je préfère un week-end, OK pour partir le jeudi soir…"
          />
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full"
          size="lg"
        >
          {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
          {data.mine ? "Mettre à jour mes disponibilités" : "Enregistrer mes disponibilités"}
        </Button>
      </section>
    </main>
  );
}
