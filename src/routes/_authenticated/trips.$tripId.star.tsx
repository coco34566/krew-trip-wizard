import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { getStarPreferences, submitStarPreferences } from "@/lib/star-preferences.functions";
import {
  AMBIANCES,
  STAR_DEAL_BREAKERS,
  STAR_WANTED_ACTIVITIES,
} from "@/lib/krew/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trips/$tripId/star")({
  head: () => ({
    meta: [{ title: "Préférences de la star — Krew" }],
  }),
  component: StarQuestionnaire,
});

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-2xl border px-3 py-2 text-sm transition-colors",
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border bg-surface/60 text-muted-foreground hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

function toggle(list: string[], set: (v: string[]) => void, value: string) {
  set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
}

function StarQuestionnaire() {
  const { tripId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchStar = useServerFn(getStarPreferences);
  const submit = useServerFn(submitStarPreferences);

  const { data, isLoading } = useQuery({
    queryKey: ["star-prefs", tripId],
    queryFn: () => fetchStar({ data: { tripId } }),
  });

  const [wanted, setWanted] = useState<string[]>([]);
  const [breakers, setBreakers] = useState<string[]>([]);
  const [ambiances, setAmbiances] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (data?.preferences && !hydrated) {
      setWanted(data.preferences.wantedActivities);
      setBreakers(data.preferences.dealBreakers);
      setAmbiances(data.preferences.ambiances);
      setNotes(data.preferences.notes ?? "");
      setHydrated(true);
    }
  }, [data, hydrated]);

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          tripId,
          wantedActivities: wanted,
          dealBreakers: breakers,
          ambiances,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(res.isUpdate ? "Préférences de la star mises à jour" : "Préférences de la star enregistrées");
      queryClient.invalidateQueries({ queryKey: ["star-prefs", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? e).slice(0, 120)),
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </main>
    );
  }

  if (!data?.trip.hasStar) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-muted-foreground">
          Ce type de voyage n’a pas de personne principale (star).
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/trips/$tripId" params={{ tripId }}>
            Retour à Mon Voyage
          </Link>
        </Button>
      </main>
    );
  }

  const starName = data.trip.celebratedPerson || "la personne principale";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour à Mon Voyage
      </Link>

      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
        Préférences de la star
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Complément dédié à <strong>{starName}</strong> — ne remplace pas le questionnaire du groupe.
        Ces préférences pèsent davantage dans les recommandations.
      </p>

      <section className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Activités souhaitées</h2>
        <div className="flex flex-wrap gap-2">
          {STAR_WANTED_ACTIVITIES.map((a) => (
            <Chip key={a} active={wanted.includes(a)} onClick={() => toggle(wanted, setWanted, a)}>
              {a}
            </Chip>
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Ce qu’elle / il refuse absolument</h2>
        <div className="flex flex-wrap gap-2">
          {STAR_DEAL_BREAKERS.map((a) => (
            <Chip
              key={a}
              active={breakers.includes(a)}
              onClick={() => toggle(breakers, setBreakers, a)}
            >
              {a}
            </Chip>
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Ambiance recherchée</h2>
        <div className="flex flex-wrap gap-2">
          {AMBIANCES.map((a) => (
            <Chip
              key={a.value}
              active={ambiances.includes(a.value)}
              onClick={() => toggle(ambiances, setAmbiances, a.value)}
            >
              {a.emoji} {a.label}
            </Chip>
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-2 rounded-2xl border border-border bg-card p-5">
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Précisions utiles pour le groupe…"
        />
      </section>

      <Button
        className="mt-6 w-full"
        size="lg"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles className="size-4" />}
        {data.preferences ? "Mettre à jour" : "Enregistrer les préférences de la star"}
      </Button>
    </main>
  );
}
