import { useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { KrewIcon, KrewMark, KrewNote } from "@/components/krew/visual-language";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  getKrewAwardResult,
  KREW_AWARD_CATEGORIES,
  type KrewAwardCategoryId,
} from "@/lib/krew/krew-awards";

type Participant = {
  id: string;
  user_id: string | null;
  email: string;
  display_name: string | null;
};

type AwardVote = {
  category: string;
  nominee_participant_id: string;
  voter_user_id: string;
};

type VoteChange = {
  category: KrewAwardCategoryId;
  nomineeParticipantId: string | null;
};

const NO_AWARD_CHOICE = "__no_award_choice__";

function participantName(participant: Participant) {
  const displayName = participant.display_name?.trim();
  if (displayName) return displayName;
  const emailName = participant.email.split("@")[0]?.trim();
  return emailName || "Membre de la Krew";
}

export function KrewAwards() {
  const { tripId } = useParams({ from: "/_authenticated/trips/$tripId/memories" });
  const queryClient = useQueryClient();
  const [savingCategories, setSavingCategories] = useState<Set<KrewAwardCategoryId>>(() => new Set());

  const { data: userId = null } = useQuery({
    queryKey: ["krew-awards-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ["krew-awards-participants", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_participants")
        .select("id,user_id,email,display_name")
        .eq("trip_id", tripId)
        .eq("status", "accepte")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Participant[];
    },
    enabled: Boolean(tripId),
  });

  const { data: votes = [], isLoading } = useQuery<AwardVote[]>({
    queryKey: ["krew-awards-votes", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_award_votes" as any)
        .select("category,nominee_participant_id,voter_user_id")
        .eq("trip_id", tripId);
      if (error) throw error;
      return (data ?? []) as unknown as AwardVote[];
    },
    enabled: Boolean(tripId && userId),
    retry: false,
  });

  const participantById = useMemo(
    () => new Map(participants.map((participant) => [participant.id, participant])),
    [participants],
  );

  const myVotes = useMemo(() => {
    const selections = new Map<string, string>();
    if (!userId) return selections;
    for (const vote of votes) {
      if (vote.voter_user_id === userId) selections.set(vote.category, vote.nominee_participant_id);
    }
    return selections;
  }, [userId, votes]);

  const saveVote = useMutation({
    mutationFn: async ({ category, nomineeParticipantId }: VoteChange) => {
      if (!userId) throw new Error("Utilisateur non connecté");

      if (nomineeParticipantId === null) {
        const { error } = await supabase
          .from("trip_award_votes" as any)
          .delete()
          .eq("trip_id", tripId)
          .eq("category", category)
          .eq("voter_user_id", userId);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("trip_award_votes" as any).upsert(
        {
          trip_id: tripId,
          category,
          nominee_participant_id: nomineeParticipantId,
          voter_user_id: userId,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "trip_id,category,voter_user_id" },
      );
      if (error) throw error;
    },
    onMutate: ({ category }) => {
      setSavingCategories((current) => {
        const next = new Set(current);
        next.add(category);
        return next;
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["krew-awards-votes", tripId] });
    },
    onError: (error) => {
      console.error("Impossible d'enregistrer le Krew Award:", error);
      toast.error("Impossible d’enregistrer ce choix pour le moment.");
    },
    onSettled: (_data, _error, { category }) => {
      setSavingCategories((current) => {
        const next = new Set(current);
        next.delete(category);
        return next;
      });
    },
  });

  if (participants.length < 2 || !userId) return null;

  return (
    <section aria-labelledby="krew-awards-title" className="relative mt-7 border-t border-dashed border-sage/35 pt-7">
      <KrewMark
        type="sparkle"
        tone="sage"
        size="md"
        className="pointer-events-none absolute right-1 top-5 h-7 w-7 opacity-55"
      />
      <div className="pr-9">
        <div className="flex items-center gap-2 text-primary">
          <KrewIcon name="group" tone="plum" size="sm" className="size-4" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[.15em]">Krew Awards</span>
        </div>
        <h2 id="krew-awards-title" className="mt-2 font-display text-[28px] font-normal leading-tight text-foreground sm:text-[31px]">
          Les petits titres de la Krew
        </h2>
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
          Facultatif : choisis un membre en quelques secondes. Deux votes suffisent pour faire apparaître un résultat.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {KREW_AWARD_CATEGORIES.map((category, index) => {
          const currentChoice = myVotes.get(category.id);
          const result = getKrewAwardResult(votes, category.id);
          const winnerNames = result.winnerParticipantIds
            .map((id) => participantById.get(id))
            .filter((participant): participant is Participant => Boolean(participant))
            .map(participantName);
          const isSaving = savingCategories.has(category.id);

          return (
            <div
              key={category.id}
              className="rounded-[20px_18px_22px_17px] border border-primary/10 bg-white/75 p-3.5 shadow-[0_10px_24px_-22px_rgba(42,25,37,.45)] sm:p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-handwriting text-[19px] leading-tight text-foreground">{category.label}</p>
                {currentChoice && !isSaving ? <Check className="mt-0.5 size-4 shrink-0 text-sage" aria-label="Choix enregistré" /> : null}
                {isSaving ? <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" aria-label="Enregistrement" /> : null}
              </div>

              <Select
                value={currentChoice ?? NO_AWARD_CHOICE}
                onValueChange={(value) =>
                  saveVote.mutate({
                    category: category.id,
                    nomineeParticipantId: value === NO_AWARD_CHOICE ? null : value,
                  })
                }
                disabled={isSaving}
              >
                <SelectTrigger className="mt-3 min-h-11 rounded-xl bg-background text-left" aria-label={`Attribuer ${category.label}`}>
                  <SelectValue placeholder="Choisir quelqu’un" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_AWARD_CHOICE}>Pas de choix</SelectItem>
                  {participants.map((participant) => (
                    <SelectItem key={participant.id} value={participant.id}>
                      {participantName(participant)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {result.revealed && winnerNames.length ? (
                <div className="mt-3 border-t border-dashed border-sage/25 pt-2.5">
                  <KrewNote variant="margin" rotation={index % 2 === 0 ? -1 : 1} className="text-sage">
                    {result.isTie ? `Ex æquo : ${winnerNames.join(" & ")}` : winnerNames[0]}
                  </KrewNote>
                </div>
              ) : (
                <p className="mt-2.5 text-[11px] text-muted-foreground">
                  {isLoading ? "On récupère les choix…" : "Le résultat apparaîtra quand la Krew aura un peu voté."}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
