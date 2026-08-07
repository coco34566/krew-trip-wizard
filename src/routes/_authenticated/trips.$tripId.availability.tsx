import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, CalendarDays, Lock, Unlock, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getTripAvailability,
  submitMyAvailability,
  chooseTripDates,
  unlockTripDates,
} from "@/lib/availability.functions";
import { cn } from "@/lib/utils";

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

function formatRange(start: string, end: string) {
  return `${new Date(start).toLocaleDateString("fr-FR")} → ${new Date(end).toLocaleDateString("fr-FR")}`;
}

function AvailabilityPage() {
  const { tripId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchAvail = useServerFn(getTripAvailability);
  const submit = useServerFn(submitMyAvailability);
  const choose = useServerFn(chooseTripDates);
  const unlock = useServerFn(unlockTripDates);

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["trip-availability", tripId] });
    queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
  };

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
      invalidate();
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

  const chooseMutation = useMutation({
    mutationFn: (w: { start: string; end: string }) =>
      choose({ data: { tripId, startDate: w.start, endDate: w.end } }),
    onSuccess: (res) => {
      toast.success(
        `Date verrouillée : ${formatRange(res.startDate, res.endDate)} — les recherches API utiliseront cette fenêtre`,
      );
      invalidate();
    },
    onError: (e: any) => toast.error(String(e?.message ?? e).slice(0, 140)),
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlock({ data: { tripId } }),
    onSuccess: () => {
      toast.success("Dates déverrouillées — tu peux en choisir une autre");
      invalidate();
    },
    onError: (e: any) => toast.error(String(e?.message ?? e).slice(0, 140)),
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

  const datesLocked = Boolean(data.trip.datesLocked);
  const lockedLabel =
    data.trip.lockedStart && data.trip.lockedEnd
      ? formatRange(data.trip.lockedStart, data.trip.lockedEnd)
      : null;

  const provisionalLabel = data.windows[0]
    ? formatRange(data.windows[0].start, data.windows[0].end)
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
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Disponibilités · résumé live
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{data.trip.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.answered}/{data.expected} ont indiqué leurs dates · résultat{" "}
          {data.answered < data.expected ? "provisoire" : "à jour"}
        </p>
      </header>

      {/* Date verrouillée */}
      {datesLocked && lockedLabel ? (
        <section className="mt-6 rounded-3xl border border-lagoon/40 bg-lagoon/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 size-5 text-lagoon" />
              <div>
                <h2 className="font-semibold">Date choisie (verrouillée)</h2>
                <p className="mt-1 text-sm">
                  <strong>{lockedLabel}</strong>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cette fenêtre alimente les recherches API (vols, hébergements, activités).
                </p>
              </div>
            </div>
            {data.isOwner ? (
              <Button
                variant="outline"
                size="sm"
                disabled={unlockMutation.isPending}
                onClick={() => {
                  if (window.confirm("Déverrouiller la date pour en choisir une autre ?")) {
                    unlockMutation.mutate();
                  }
                }}
              >
                {unlockMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Unlock className="size-4" />
                )}
                Déverrouiller
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Résumé des disponibilités</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Meilleure fenêtre actuelle :{" "}
              <strong className="text-foreground">{provisionalLabel}</strong>
              {datesLocked ? " (provisoire — la date verrouillée prime)" : ""}
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {data.windows.map((w, i) => {
            const isChosen =
              datesLocked &&
              data.trip.lockedStart === w.start &&
              data.trip.lockedEnd === w.end;
            return (
              <li
                key={`${w.start}-${w.end}`}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-sm",
                  isChosen
                    ? "border-lagoon/50 bg-lagoon/10"
                    : "border-border/70 bg-surface/40",
                )}
              >
                <span>
                  {i === 0 ? "⭐ " : ""}
                  {formatRange(w.start, w.end)}
                  <span className="text-muted-foreground"> · {w.nights} nuit(s)</span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={w.coverageRatio >= 0.8 ? "success" : "lagoon"}>
                    {w.covered}/{w.total} dispo · {Math.round(w.coverageRatio * 100)} %
                  </Badge>
                  {isChosen ? (
                    <Badge variant="success">
                      <Check className="mr-1 size-3" /> Choisie
                    </Badge>
                  ) : null}
                  {data.isOwner && !datesLocked ? (
                    <Button
                      size="sm"
                      variant={i === 0 ? "default" : "outline"}
                      disabled={chooseMutation.isPending}
                      onClick={() => chooseMutation.mutate({ start: w.start, end: w.end })}
                    >
                      {chooseMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Lock className="size-3.5" />
                      )}
                      Choisir cette date
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
          {data.windows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              En attente des premières réponses pour calculer une date.
            </p>
          ) : null}
        </ul>
        {data.isOwner && !datesLocked && data.windows.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Clique sur « Choisir cette date » pour figer la fenêtre et alimenter les recherches API.
            Tant que ce n&apos;est pas fait, les dates restent provisoires.
          </p>
        ) : null}
      </section>

      <section className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Mes disponibilités</h2>
        <p className="text-xs text-muted-foreground">
          Format des dates : AAAA-MM-JJ, séparées par des virgules. Lié à ton compte uniquement.
          {datesLocked
            ? " La date du voyage est verrouillée — tu peux toujours mettre à jour tes dispos pour info."
            : ""}
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
