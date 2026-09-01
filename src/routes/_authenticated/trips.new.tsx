import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { createTrip } from "@/lib/trips.functions";
import {
  EVENT_TYPES,
  PARTICIPANTS_DEFAULT,
  PARTICIPANTS_MAX,
  PARTICIPANTS_MIN,
  STAR_EVENT_TYPES,
  getTripTypeImage,
} from "@/lib/krew/constants";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { cn } from "@/lib/utils";

const CREATE_TRIP_INPUT_CLASS =
  "h-12 rounded-xl border-border/70 bg-background text-base shadow-none transition-colors focus-visible:border-primary/55 focus-visible:ring-2 focus-visible:ring-primary/10";
const CREATE_TRIP_NUMBER_INPUT_CLASS = `${CREATE_TRIP_INPUT_CLASS} pr-16 font-mono`;
const SELECTABLE_FRAME_CLASS =
  "border transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:border-primary/55 focus-visible:ring-2 focus-visible:ring-primary/10";
const SELECTABLE_FRAME_SELECTED_CLASS = "border-primary/55 bg-primary/5 ring-2 ring-primary/10";
const TRIP_TYPE_SELECTED_CLASS = "border-primary ring-2 ring-primary/10";
const SELECTABLE_FRAME_IDLE_CLASS =
  "border-border/70 bg-background hover:border-primary/35 hover:bg-primary/[0.02]";

function clampParticipants(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return PARTICIPANTS_DEFAULT;
  return Math.min(PARTICIPANTS_MAX, Math.max(PARTICIPANTS_MIN, n));
}

export const Route = createFileRoute("/_authenticated/trips/new")({
  head: () => ({
    meta: [
      { title: "Créer un voyage — KREW" },
      {
        name: "description",
        content: "Crée ton voyage de groupe : nom, type d'événement, participants.",
      },
    ],
  }),
  component: NewTripPage,
});

function SectionHeading({
  step,
  icon,
  title,
  description,
}: {
  step: string;
  icon: "party" | "group" | "calendar";
  title: string;
  description: string;
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-[64px_1fr] sm:gap-5">
      <div className="flex items-center gap-2 sm:block">
        <span className="font-mono text-xs tracking-[0.16em] text-muted-foreground">{step}</span>
        <KrewIcon name={icon} tone="sage" size="sm" className="size-4.5 sm:mt-2.5" />
      </div>
      <div>
        <h2 className="font-display text-[28px] leading-[1.05] tracking-tight text-foreground sm:text-[30px]">
          {title}
        </h2>
        <p className="mt-1.5 max-w-[560px] text-sm leading-[1.45] text-muted-foreground sm:text-[15px]">
          {description}
        </p>
      </div>
    </div>
  );
}

function NewTripPage() {
  const navigate = useNavigate();
  const create = useServerFn(createTrip);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("weekend");
  const [participantsInput, setParticipantsInput] = useState(String(PARTICIPANTS_DEFAULT));
  const participants = clampParticipants(participantsInput);
  const [celebratedPerson, setCelebratedPerson] = useState("");
  const [organizerFirstName, setOrganizerFirstName] = useState("");
  const [durationDaysInput, setDurationDaysInput] = useState("3");
  const [groupAgeRange, setGroupAgeRange] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeEventTypes = EVENT_TYPES.filter((t) =>
    ["evg", "evjf", "anniversaire", "weekend"].includes(t.value),
  );
  const upcomingEventTypes = EVENT_TYPES.filter((t) =>
    ["voyage_groupe", "famille", "seminaire", "retraite"].includes(t.value),
  );
  const needsStar = STAR_EVENT_TYPES.has(eventType as any);

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Donne un nom au voyage (2 caractères minimum).");
      throw new Error("Nom de voyage manquant");
    }
    if (!organizerFirstName.trim()) {
      toast.error("Indique ton prénom.");
      throw new Error("Prénom organisateur manquant");
    }
    if (needsStar && !celebratedPerson.trim()) {
      toast.error("Indique le prénom de la Star.");
      throw new Error("Prénom de la Star manquant");
    }
    if (!groupAgeRange) {
      toast.error("Indique la tranche d’âge du groupe.");
      throw new Error("Tranche d’âge manquante");
    }

    setSubmitting(true);
    try {
      const days = Math.max(2, Number(durationDaysInput) || 3);
      const durationNights = Math.max(1, days - 1);
      const trip = await create({
        data: {
          name: name.trim(),
          eventType: eventType as any,
          participants,
          organizerFirstName: organizerFirstName.trim(),
          celebratedPerson: celebratedPerson.trim() || undefined,
          budgetPerPerson: 400,
          groupAgeRange: groupAgeRange as "18-25" | "25-35" | "35-45" | "45-60" | "60+",
          ambiances: [],
          activityCategories: [],
          letKrewDecide: true,
          maxDistanceKm: 2000,
          excludedCountries: [],
          durationNights,
          needsCityCenter: true,
          dietaryConstraints: [],
        },
      });

      const id = (trip as any).tripId ?? (trip as any).id;
      if (!id) throw new Error("Le voyage a été créé mais son identifiant est introuvable.");

      queryClient.invalidateQueries({ queryKey: ["my-trips"] });
      await navigate({ to: "/trips/$tripId/invite", params: { tripId: id } });
    } catch (err: any) {
      console.error("Impossible de créer le voyage:", err);
      toast.error("Impossible de créer le voyage pour le moment. Réessaie dans un instant.");
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[51.25rem] px-4 pb-12 pt-4 sm:px-6 sm:pb-14 sm:pt-6 lg:px-8">
      <Link
        to="/dashboard"
        className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Mes voyages
      </Link>

      <header className="relative mt-4 sm:mt-5">
        <div className="grid grid-cols-[minmax(0,1fr)_72px] items-start gap-4 sm:grid-cols-[minmax(0,1fr)_88px] sm:gap-6">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-primary/75">Nouveau voyage</p>
            <div className="relative inline-block max-w-full pb-2">
              <h1 className="font-display text-[40px] font-normal leading-[0.98] tracking-tight text-foreground sm:text-[50px] lg:text-[52px]">
                On lance la Krew.
              </h1>
              <KrewMark
                type="underline-wave"
                tone="sage"
                size="md"
                className="pointer-events-none absolute -bottom-1 left-0 w-[155px] max-w-[80%] opacity-70 sm:w-[184px]"
              />
            </div>
            <p className="mt-3 max-w-[520px] text-[15px] leading-[1.5] text-muted-foreground sm:text-base">
              Donne-nous juste les bases. Le groupe complètera le reste ensemble ensuite.
            </p>
          </div>
          <img
            src="/brand/otter-states/lets-go.png"
            alt=""
            className="pointer-events-none h-auto w-full max-w-[72px] justify-self-end object-contain sm:max-w-[88px]"
          />
        </div>
      </header>

      <form onSubmit={(event) => void onSubmit(event).catch(() => undefined)} className="mt-8 sm:mt-9">
        <section className="border-b border-border/70 pb-8 sm:pb-9">
          <SectionHeading
            step="01"
            icon="party"
            title="Le voyage"
            description="Un nom, une occasion, et c’est parti. Pas besoin d’avoir déjà choisi la destination."
          />

          <div className="mt-6 max-w-[560px] space-y-2 sm:mt-7">
            <Label htmlFor="name" className="text-[15px] font-semibold text-foreground">
              Comment vous l’appelez ?
            </Label>
            <Input
              id="name"
              className={CREATE_TRIP_INPUT_CLASS}
              placeholder="Ex. Week-end à 8 / EVG de Jules"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="mt-7 sm:mt-8">
            <Label className="mb-2 block text-[15px] font-semibold text-foreground">C’est quoi le plan ?</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {activeEventTypes.map((t) => {
                const imgUrl = getTripTypeImage(t.value);
                const selected = eventType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setEventType(t.value)}
                    className={cn(
                      "group relative min-h-[122px] overflow-hidden rounded-[14px] text-left",
                      SELECTABLE_FRAME_CLASS,
                      selected ? TRIP_TYPE_SELECTED_CLASS : SELECTABLE_FRAME_IDLE_CLASS,
                    )}
                  >
                    {imgUrl ? (
                      <>
                        <img
                          src={imgUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/5" />
                        <div className="absolute inset-x-0 bottom-0 z-10 p-3.5">
                          <span className="text-sm font-semibold leading-tight text-white">{t.label}</span>
                        </div>
                      </>
                    ) : (
                      <span className="p-4 text-sm font-medium text-foreground">{t.label}</span>
                    )}
                    {selected ? (
                      <span className="absolute right-2.5 top-2.5 z-20 inline-flex size-7 items-center justify-center rounded-full bg-white shadow-sm" aria-hidden="true">
                        <KrewIcon name="check" tone="plum" size="sm" className="size-3.5" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-[1.4] text-muted-foreground">
              <span className="font-medium">Bientôt :</span>
              {upcomingEventTypes.map((t, index) => (
                <span key={t.value} className="inline-flex items-center gap-2">
                  {index > 0 ? <span aria-hidden="true">·</span> : null}
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/70 py-8 sm:py-9">
          <SectionHeading
            step="02"
            icon="group"
            title="La team"
            description="On pose la taille et le profil du groupe. Les invitations viennent juste après."
          />

          {needsStar ? (
            <div className="mt-6 max-w-[420px] space-y-2 sm:mt-7">
              <Label htmlFor="star" className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                <KrewIcon name="favorite" tone="plum" size="sm" className="size-4 shrink-0" />
                Qui est la Star ?
              </Label>
              <Input
                id="star"
                className={CREATE_TRIP_INPUT_CLASS}
                placeholder="Son prénom"
                value={celebratedPerson}
                onChange={(e) => setCelebratedPerson(e.target.value)}
              />
              <p className="text-xs leading-[1.4] text-muted-foreground">
                Ses préférences compteront davantage dans les recommandations.
              </p>
            </div>
          ) : null}

          <div className={cn("grid gap-6 sm:grid-cols-2 sm:gap-x-7", needsStar ? "mt-7" : "mt-6 sm:mt-7")}>
            <div className="space-y-2">
              <Label htmlFor="orga" className="text-[15px] font-semibold text-foreground">
                Ton prénom <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="orga"
                className={CREATE_TRIP_INPUT_CLASS}
                placeholder="Ex. Camille"
                value={organizerFirstName}
                onChange={(e) => setOrganizerFirstName(e.target.value)}
                required
                aria-required="true"
                aria-describedby="orga-help"
              />
              <p id="orga-help" className="text-xs leading-[1.4] text-muted-foreground">
                Pour que le groupe sache qui organise et te reconnaisse dans les réponses.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="n" className="text-[15px] font-semibold text-foreground">
                Vous serez combien ?
              </Label>
              <div className="relative max-w-[180px]">
                <Input
                  id="n"
                  type="number"
                  min={PARTICIPANTS_MIN}
                  max={PARTICIPANTS_MAX}
                  className={CREATE_TRIP_NUMBER_INPUT_CLASS}
                  value={participantsInput}
                  onChange={(e) => setParticipantsInput(e.target.value.replace(/[^\d]/g, ""))}
                  onBlur={() => setParticipantsInput(String(clampParticipants(participantsInput)))}
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-muted-foreground">
                  pers.
                </span>
              </div>
              <p className="text-xs leading-[1.4] text-muted-foreground">
                {needsStar
                  ? `Compte bien la Star ${celebratedPerson ? `(${celebratedPerson})` : ""} dans le total.`
                  : `Entre ${PARTICIPANTS_MIN} et ${PARTICIPANTS_MAX}. Tu pourras inviter tout le monde ensuite.`}
              </p>
            </div>
          </div>

          <div className="mt-7 sm:mt-8">
            <Label className="mb-2 block text-[15px] font-semibold text-foreground">Et côté âge ?</Label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
              {["18-25", "25-35", "35-45", "45-60", "60+"].map((age) => {
                const selected = groupAgeRange === age;
                return (
                  <button
                    key={age}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setGroupAgeRange(age)}
                    className={cn(
                      "min-h-11 rounded-[14px] px-3 py-2.5 text-center text-sm font-medium",
                      SELECTABLE_FRAME_CLASS,
                      selected
                        ? `${SELECTABLE_FRAME_SELECTED_CLASS} text-foreground`
                        : `${SELECTABLE_FRAME_IDLE_CLASS} text-foreground/80`,
                    )}
                  >
                    {age} ans
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-8 sm:py-9">
          <SectionHeading
            step="03"
            icon="calendar"
            title="Le rythme"
            description="Une durée suffit pour commencer. Les dates exactes seront trouvées avec le groupe."
          />

          <div className="mt-6 sm:mt-7">
            <div className="max-w-[380px] space-y-2">
              <Label htmlFor="durationDays" className="text-[15px] font-semibold text-foreground">
                Combien de jours ?
              </Label>
              <div className="relative max-w-[180px]">
                <Input
                  id="durationDays"
                  type="number"
                  min={2}
                  max={31}
                  className={CREATE_TRIP_NUMBER_INPUT_CLASS}
                  value={durationDaysInput}
                  onChange={(e) => setDurationDaysInput(e.target.value.replace(/[^\d]/g, ""))}
                  onBlur={() => {
                    const val = Math.max(2, Number(durationDaysInput) || 3);
                    setDurationDaysInput(String(val));
                  }}
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-muted-foreground">
                  jours
                </span>
              </div>
              <p className="text-xs leading-[1.4] text-muted-foreground">
                Par exemple, 3 jours correspondent à 2 nuits.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between sm:pt-7">
          <p className="max-w-[430px] text-sm leading-[1.45] text-muted-foreground">
            Ensuite, tu invites la Krew et chacun renseigne ses disponibilités et ses préférences.
          </p>
          <KrewStatefulButton
            type="button"
            className="max-w-full"
            idleLabel="Créer et inviter la Krew"
            loadingLabel="Création…"
            successLabel="Voyage créé"
            errorLabel="Réessayer"
            onAction={() => onSubmit()}
          />
        </div>
      </form>
    </main>
  );
}
