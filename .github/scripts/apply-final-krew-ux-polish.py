from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, got {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, repl: str, label: str) -> str:
    out, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 regex match, got {count}")
    return out


# Landing page.
p = "src/routes/index.tsx"
s = read(p)
s = replace_once(
    s,
    '<div className="flex flex-wrap items-center gap-3 pt-2 relative">\n                  <KrewNote variant="margin" tone="cream" rotation={-1} className="absolute -top-7 right-0 sm:hidden text-sm px-2 py-1 pointer-events-none">le plan prend forme ici</KrewNote>',
    '<div className="flex flex-wrap items-center gap-3 pt-2 relative">\n                  <div className="basis-full sm:hidden">\n                    <KrewNote variant="tape" tone="cream" rotation={-1} size="sm" className="w-fit text-sm pointer-events-none">Le plan prend forme ici</KrewNote>\n                  </div>',
    "landing hero note",
)
s = replace_once(
    s,
    '<div className="pt-2 relative"><KrewNote variant="tape" tone="sage" rotation={1} className="absolute -top-7 left-1/2 -translate-x-1/2 sm:hidden text-sm px-2 py-1 pointer-events-none">prêts à partir ?</KrewNote><Button asChild size="xl" className="h-12 min-h-12 rounded-xl px-8 py-0 text-base font-medium leading-none shadow-none"><Link to="/trips/new" className="inline-flex h-full items-center justify-center whitespace-nowrap text-center leading-none">Créer mon voyage</Link></Button></div>',
    '<div className="pt-2 relative"><div className="mb-4 flex justify-center sm:hidden"><KrewNote variant="tape" tone="sage" rotation={1} size="sm" className="w-fit text-sm pointer-events-none">Prêts à partir ?</KrewNote></div><Button asChild size="xl" className="h-12 min-h-12 rounded-xl px-8 py-0 text-base font-medium leading-none shadow-none"><Link to="/trips/new" className="inline-flex h-full items-center justify-center whitespace-nowrap text-center leading-none">Créer mon voyage</Link></Button></div>',
    "landing ready note",
)
write(p, s)

# Mes voyages — structural responsive cleanup.
p = "src/routes/_authenticated/dashboard.tsx"
s = read(p)
featured = '''function FeaturedTrip({ trip, onCancel }: { trip: Trip; onCancel: (tripId: string) => void }) {
  const image = tripImage(trip);
  return (
    <article className="relative isolate grid gap-5 overflow-visible sm:grid-cols-[minmax(0,1.18fr)_minmax(220px,.82fr)] sm:items-center sm:gap-7 lg:gap-9">
      <KrewOrganicBlob tone="sage" variant="soft" className="absolute -left-5 top-8 h-[300px] w-[72%] opacity-45 -z-10" />
      <KrewOrganicBlob tone="plum" variant="soft" className="absolute right-0 bottom-0 h-[220px] w-[48%] opacity-[.045] -z-10" />
      <div className="relative mx-auto w-[94%] max-w-[560px] rotate-[-1.25deg] bg-[#fffefa] p-3 pb-5 shadow-[0_16px_32px_-18px_rgba(42,25,37,.28)] ring-1 ring-black/[.06] sm:mx-0 sm:w-full">
        <div className="absolute -top-3 left-[38%] z-10 hidden sm:block"><KrewNote variant="tape" tone="cream" rotation={1} className="min-w-[74px] px-3 py-1 text-transparent select-none">tape</KrewNote></div>
        <div className="absolute right-5 top-5 z-30" onClick={(event) => event.stopPropagation()}><ArchiveControl trip={trip} onCancel={onCancel} compact /></div>
        <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="group block">
          <div className="aspect-[4/3] overflow-hidden bg-surface/60 sm:aspect-[16/11]">
            {image ? <img src={image} alt={eventTypeLabel(trip.event_type)} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" /> : <KrewPhotoFallback className="size-full" type="destination" aspectRatio="16/9" />}
          </div>
          <div className="px-2 pb-1 pt-4">
            <p className="break-words font-handwriting text-[24px] leading-[1.05] text-primary sm:text-[28px]">{trip.name}</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] text-muted-foreground sm:text-[13px]">
              <span className="font-mono uppercase tracking-[.08em]">{eventTypeLabel(trip.event_type)}</span>
              <span className="font-handwriting text-[15px] text-sage">La KREW se prépare</span>
            </div>
          </div>
        </Link>
      </div>
      <div className="relative min-w-0 px-1 sm:px-0">
        <KrewNote variant="label" tone="sage" rotation={2} className="mb-3 inline-flex min-w-0 px-2.5 py-1 text-xs">À suivre maintenant</KrewNote>
        <div className="space-y-2 text-[13px] text-muted-foreground sm:text-sm">
          {trip.destination_name ? <p className="flex min-w-0 items-start gap-2 font-medium text-foreground"><KrewIcon name="destination" tone="plum" size="sm" className="mt-0.5 size-4 shrink-0" /><span className="break-words">{trip.destination_name}</span></p> : null}
          {trip.start_date ? <p className="flex items-start gap-2"><KrewIcon name="calendar" tone="muted" size="sm" className="mt-0.5 size-4 shrink-0" /><span>{new Date(trip.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span></p> : null}
          <p className="flex items-center gap-2"><KrewIcon name="group" tone="muted" size="sm" className="size-4 shrink-0" />{trip.participants_count} participants</p>
          {trip.star_name ? <p className="flex min-w-0 items-start gap-2"><KrewIcon name="star" tone="plum" size="sm" className="mt-0.5 size-4 shrink-0" /><span className="break-words">Star : {trip.star_name}</span></p> : null}
        </div>
        <div className="relative mt-5 border-t border-dashed border-sage/45 pt-4">
          <KrewNote variant="margin" rotation={-2} className="mb-1 text-sage">Prochaine action</KrewNote>
          <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="group inline-flex max-w-full items-center gap-2 font-display text-[19px] leading-tight text-primary sm:text-[22px]"><span className="break-words">{nextActionFor(trip)}</span><KrewMark type="arrow-right" tone="plum" size="md" className="h-5 w-8 shrink-0 transition-transform group-hover:translate-x-1" /></Link>
        </div>
      </div>
      <KrewMark type="sparkle" tone="plum" size="sm" rotation={6} className="absolute right-[4%] bottom-[4%] hidden sm:block opacity-30 pointer-events-none" />
      <img src="/brand/otter-states/trip-progress.png" alt="" className="absolute -bottom-5 left-[4%] hidden w-[82px] h-auto object-contain pointer-events-none lg:block" />
    </article>
  );
}
'''
s = regex_once(s, r'function FeaturedTrip\(.*?\n}\n\n(?=function NotebookTrip)', featured + "\n", "featured trip restructure")
s = replace_once(
    s,
    'const rotations = ["md:rotate-[-1.4deg]", "md:rotate-[1.1deg] md:translate-y-3", "md:rotate-[-.7deg] md:-translate-y-1"];',
    'const rotations = ["rotate-[-1deg] md:rotate-[-1.4deg]", "rotate-[.8deg] translate-y-1 md:rotate-[1.1deg] md:translate-y-3", "rotate-[-.6deg] -translate-y-1 md:rotate-[-.7deg]"];',
    "mobile notebook rhythm",
)
write(p, s)

# Progress counts.
p = "src/components/krew/visual-language/KrewActionStack.tsx"
s = read(p)
s = replace_once(s, 'type Progress = {\n  label: string;\n  value: number;\n  tone?: "sage" | "plum";\n};', 'type Progress = {\n  label: string;\n  value: number;\n  current?: number;\n  total?: number;\n  tone?: "sage" | "plum";\n};', "progress type")
s = replace_once(s, '{value}%', '{item.current != null && item.total != null ? `${item.current}/${item.total}` : `${value}%`}', "progress display")
write(p, s)

# Overview + progress payloads and margins.
p = "src/components/krew/TripHubDashboard.tsx"
s = read(p)
s = s.replace('className="-mx-4 sm:mx-0 rounded-3xl border border-sage/25', 'className="mx-0 rounded-3xl border border-sage/25')
s = s.replace('className="-mx-4 sm:mx-0 my-4 sm:my-6 overflow-hidden relative space-y-3"', 'className="mx-0 my-4 sm:my-6 overflow-hidden relative space-y-3"')
s = replace_once(s, 'label: "Disponibilités",\n      value: Math.round((availabilityAnswered / availabilityExpected) * 100),\n      tone: "sage" as const,', 'label: "Disponibilités",\n      value: Math.round((availabilityAnswered / availabilityExpected) * 100),\n      current: availabilityAnswered,\n      total: availabilityExpected,\n      tone: "sage" as const,', "availability progress")
s = replace_once(s, 'label: "Préférences",\n      value: Math.round((progressAnswered / progressTotal) * 100),\n      tone: "plum" as const,', 'label: "Préférences",\n      value: Math.round((progressAnswered / progressTotal) * 100),\n      current: progressAnswered,\n      total: progressTotal,\n      tone: "plum" as const,', "preference progress")
s = replace_once(s, '<h1 className="relative z-10 font-display text-[42px] sm:text-[56px] font-normal leading-[0.94] tracking-tight text-foreground max-w-full break-words">', '<h1 className="relative z-10 inline-block max-w-full break-words rounded-[10px] bg-background/75 px-2.5 py-1.5 font-display text-[42px] font-normal leading-[0.94] tracking-tight text-foreground backdrop-blur-[2px] sm:text-[56px]">', "overview title")
write(p, s)

# Availability: calendar only, count/total, safer gutters.
p = "src/routes/_authenticated/trips.$tripId.availability.tsx"
s = read(p)
s = s.replace('  X,\n', '')
s = s.replace('import { KrewIcon, KrewNote, KrewProgressRing } from "@/components/krew/visual-language";', 'import { KrewIcon, KrewNote } from "@/components/krew/visual-language";')
s = s.replace('max-w-[820px] px-4 py-10 sm:px-6 lg:px-8', 'max-w-[820px] px-5 py-10 sm:px-7 lg:px-8')
s = s.replace('max-w-[820px] space-y-4 px-4 py-10 sm:px-6 lg:px-8', 'max-w-[820px] space-y-4 px-5 py-10 sm:px-7 lg:px-8')
s = s.replace('max-w-[820px] space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8', 'max-w-[820px] space-y-8 px-5 py-8 sm:px-7 sm:py-10 lg:px-8')
s = replace_once(s, '<KrewProgressRing value={data.answered} total={data.expected || 1} size={56} tone="sage" />', '<div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sage/18"><KrewIcon name="group" tone="sage" size="sm" className="size-5" /></div>', "availability ring")
s = regex_once(s, r'\n        <div className="space-y-3 border-y border-border/45 py-4">.*?</div>\n\n        <div className="space-y-2">\n          <Label className="text-\[14px\] font-semibold text-foreground">Notes', '\n        <div className="space-y-2">\n          <Label className="text-[14px] font-semibold text-foreground">Notes', "availability chips")
write(p, s)

# Participant questionnaire gutters.
p = "src/routes/_authenticated/trips.$tripId.questionnaire.tsx"
s = read(p)
s = s.replace('max-w-[820px] px-4 sm:px-6', 'max-w-[820px] px-5 sm:px-7')
s = s.replace('max-w-[820px] px-4 py-', 'max-w-[820px] px-5 py-')
write(p, s)

# Invite lifecycle.
p = "src/routes/_authenticated/trips.$tripId.invite.tsx"
s = read(p)
s = replace_once(s, 'const hasStar = Boolean(trip?.has_star || celebratedPerson);', 'const hasStar = Boolean(trip?.has_star || celebratedPerson);\n  const inviteStepCompleted = Boolean(\n    (trip?.group_logistics as any)?.inviteStepCompleted ||\n      (trip?.group_logistics as any)?.invite_step_completed ||\n      (trip as any)?.invite_step_completed,\n  );', "invite completed")
s = replace_once(s, '          Partage le lien, invite la team et vois en un coup d’œil qui doit encore répondre.', '          {inviteStepCompleted ? "La team est réunie. Tu peux relancer doucement les réponses qui manquent." : "Partage le lien, invite la team et vois en un coup d’œil qui doit encore répondre."}', "invite header")
s = replace_once(s, '      <section className="space-y-4 border-b border-border/55 pb-7">\n        <div className="space-y-1">\n          <h2 className="flex items-center gap-2 font-display text-[25px] font-normal text-foreground sm:text-[28px]">\n            <KrewIcon name="invite" tone="plum" size="sm" className="size-5" />\n            Partager le voyage', '      {!inviteStepCompleted ? (\n      <section className="space-y-4 border-b border-border/55 pb-7">\n        <div className="space-y-1">\n          <h2 className="flex items-center gap-2 font-display text-[25px] font-normal text-foreground sm:text-[28px]">\n            <KrewIcon name="invite" tone="plum" size="sm" className="size-5" />\n            Partager le voyage', "share open")
s = replace_once(s, '      </section>\n\n      {data.isOwner ? (\n        <section className="space-y-4 border-b border-border/55 pb-7">', '      </section>\n      ) : null}\n\n      {data.isOwner ? (\n        <section className="space-y-4 border-b border-border/55 pb-7">', "share close")
s = replace_once(s, '{trip.has_star || trip.celebrated_person || STAR_EVENT_TYPES.has(trip.event_type) ? (', '{!inviteStepCompleted && (trip.has_star || trip.celebrated_person || STAR_EVENT_TYPES.has(trip.event_type)) ? (', "star invite hide")
s = replace_once(s, '{missingParticipants.length} personne{missingParticipants.length > 1 ? "s" : ""} doivent encore répondre.', 'On avance bien : {missingParticipants.length} personne{missingParticipants.length > 1 ? "s" : ""} doivent encore répondre.', "reminder copy")
s = replace_once(s, 'Relancer sur WhatsApp', 'Relancer gentiment via WhatsApp', "reminder button")
write(p, s)

# Expose Star cost setting.
p = "src/lib/star-preferences.functions.ts"
s = read(p)
s = replace_once(s, 'const starMode = (trip.data.group_logistics as any)?.star_mode ?? "secret";\n    const isAdmin = isTripAdmin(trip.data, userId);', 'const starMode = (trip.data.group_logistics as any)?.star_mode ?? "secret";\n    const starPaysShare = (trip.data.group_logistics as any)?.star_pays_share !== false;\n    const isAdmin = isTripAdmin(trip.data, userId);', "star pays read")
s = s.replace('        starMode,\n      };', '        starMode,\n        starPaysShare,\n      };', 1)
s = replace_once(s, '      starMode,\n    };', '      starMode,\n      starPaysShare,\n    };', "star return")
write(p, s)

# Star questionnaire role recap and rhythm.
p = "src/routes/_authenticated/trips.$tripId.star.tsx"
s = read(p)
s = s.replace('max-w-[820px] px-4 sm:px-6 py-', 'max-w-[820px] px-5 sm:px-7 py-')
s = s.replace('max-w-[820px] px-4 sm:px-6 py-8 sm:py-10 space-y-8', 'max-w-[820px] px-5 sm:px-7 lg:px-8 py-8 sm:py-10 space-y-9')
role_block = '''      <section className="space-y-5 border-y border-border/50 py-6">
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-normal text-foreground">Rôle de la Star</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Ces choix ont été définis lors de l’invitation et servent de cadre au questionnaire.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-7">
          <div className="space-y-2">
            <p className="text-base font-semibold leading-snug text-foreground">Comment participe {starName} à l’organisation ?</p>
            <p className="text-sm leading-relaxed text-muted-foreground">Mode secret · tu complètes ses réponses à sa place.</p>
          </div>
          <div className="space-y-2">
            <p className="text-base font-semibold leading-snug text-foreground">La Star participe-t-elle aux frais ?</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{data.starPaysShare ? "Oui, sa part reste incluse." : "Non, sa part est répartie entre le groupe."}</p>
          </div>
        </div>
      </section>
'''
s = replace_once(s, '      <div className="pt-4">\n        {/* 1. Envies & ambiance */}', role_block + '\n      <div className="pt-2">\n        {/* 1. Envies & ambiance */}', "star recap")
s = s.replace('border-b border-border/50 pb-8 mb-8 space-y-6', 'border-b border-border/50 pb-9 mb-9 space-y-8')
s = s.replace('space-y-4 pt-2', 'space-y-5 pt-3')
s = s.replace('pb-8 mb-8 space-y-4 font-sans border-b', 'pb-9 mb-9 space-y-6 font-sans border-b')
s = s.replace('pb-8 mb-8 space-y-4 font-sans', 'pb-9 mb-9 space-y-6 font-sans')
s = s.replace('space-y-4 pb-8 mb-8 border-b', 'space-y-6 pb-9 mb-9 border-b')
write(p, s)

# Transport timing card.
p = "src/components/krew/TransportTimePrefsCard.tsx"
s = read(p)
s = s.replace('useState, useEffect, useMemo', 'useState, useEffect')
s = s.replace('import { computeGroupTimeWindow } from "@/lib/krew/engine";\n', '')
s = regex_once(s, r'\n  const \{ data: groupPrefs \} = useQuery\(\{.*?\n  \}\);\n\n  const groupWindow = useMemo\(.*?\);', '', "transport summary query")
s = s.replace('      queryClient.invalidateQueries({ queryKey: ["group-transport-time-prefs", tripId] });\n', '')
s = regex_once(s, r'      <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">.*?</div>\n    </div>\n  \);', '''      <div className="flex justify-end border-t border-border/50 pt-4">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isMyPrefsLoading} className="w-full sm:w-auto">
          {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <KrewIcon name="check" tone="plum" size="sm" className="size-4" />}
          Enregistrer mes créneaux
        </Button>
      </div>
    </div>
  );''', "transport save")
write(p, s)

# Packing self assignment.
p = "src/components/krew/PackingListCard.tsx"
s = read(p)
s = s.replace('import { KrewNote } from "@/components/krew/visual-language/KrewNote";\n', 'import { KrewNote } from "@/components/krew/visual-language/KrewNote";\nimport { supabase } from "@/integrations/supabase/client";\n')
s = s.replace('participants?: { id: string; display_name?: string | null; email?: string | null }[];', 'participants?: { id: string; user_id?: string | null; display_name?: string | null; email?: string | null }[];')
s = replace_once(s, '  const [manualLabel, setManualLabel] = useState("");', '  const [currentUserId, setCurrentUserId] = useState<string | null>(null);\n  const [manualLabel, setManualLabel] = useState("");', "packing user state")
s = replace_once(s, '  useEffect(() => {\n    try {\n      const saved = localStorage.getItem(storageKey);', '  useEffect(() => {\n    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null)).catch(() => setCurrentUserId(null));\n  }, []);\n\n  useEffect(() => {\n    try {\n      const saved = localStorage.getItem(storageKey);', "packing current user")
s = replace_once(s, '{assignableParticipants.map((p) => (', '{assignableParticipants.filter((p) => !currentUserId || p.user_id !== currentUserId).map((p) => (', "packing filter")
write(p, s)

# Transport / planning / tasks CTAs in journey route.
p = "src/routes/_authenticated/trips.$tripId.index.tsx"
s = read(p)
s = regex_once(s, r'\n          <Button\n            variant="outline"\n            className="rounded-xl text-sm font-medium min-h-\[40px\] h-auto py-2 whitespace-normal text-center leading-tight"\n            disabled=\{!destinationSelected \|\| logisticsMutation.isPending\}\n            onClick=\{\(\) => logisticsMutation.mutate\(\)\}\n          >.*?Générer des propositions"\}\n          </Button>', '', "top transport CTA")
s = replace_once(s, '            Génère des propositions de transport pour le groupe.', '            Les trajets du groupe seront proposés ici.', "transport empty")
s = regex_once(s, r'\n            <div className="flex justify-end">\n              <Button asChild size="sm" className="rounded-xl font-medium text-xs">\n                <Link to="/trips/\$tripId" params=\{\{ tripId \}\} search=\{\{ view: "voyage", section: "planning" \}\}>\n                  Organiser le planning .*?</Button>\n            </div>\n', '\n', "early planning CTA")
bottom = '''        {destinationSelected ? (
          <div className="flex flex-col gap-2 border-t border-border/40 pt-4 sm:flex-row sm:items-center sm:justify-end">
            {data.isOwner ? (
              <Button disabled={logisticsMutation.isPending} onClick={() => logisticsMutation.mutate()} className="w-full sm:w-auto">
                {logisticsMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <KrewIcon name="transport" tone="plum" size="sm" className="size-4" />}
                {(trip as any).group_logistics?.transports?.length ? "Actualiser les trajets" : "Trouver les trajets"}
              </Button>
            ) : null}
            {(trip as any).group_logistics?.transports?.length ? (
              <Button asChild variant="ghost" className="w-full sm:w-auto">
                <Link to="/trips/$tripId" params={{ tripId }} search={{ view: "voyage", section: "planning" }}>
                  Continuer vers le planning <KrewMark type="arrow-right" tone="plum" size="sm" className="ml-1 size-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}'''
s = regex_once(s, r'        \{destinationSelected \? \(\n          <div className="pt-4 border-t border-border/40 flex justify-end">\n            <Button asChild className="rounded-xl font-medium h-11 text-sm sm:text-base">\n              <Link to="/trips/\$tripId" params=\{\{ tripId \}\} search=\{\{ view: "voyage", section: "planning" \}\}>\n                Organiser le planning .*?\n          </div>\n        \) : null\}', bottom, "bottom transport CTA")
s = replace_once(s, 'className="rounded-xl font-medium min-h-[40px] h-auto py-2 whitespace-normal text-center leading-tight"\n                disabled={itineraryMutation.isPending}', 'className="w-full sm:w-auto"\n                disabled={itineraryMutation.isPending}', "planning button")
s = replace_once(s, '? "Régénérer tout le planning"\n                  : "Générer le planning"', '? "Revoir le planning"\n                  : "Préparer le planning"', "planning wording")
s = replace_once(s, 'variant="hero"\n                  size="sm"\n                  onClick={() => generateTasksMutation.mutate()}\n                  className="mt-4 gap-1.5"', 'onClick={() => generateTasksMutation.mutate()}\n                  className="mt-4 w-full sm:w-auto"', "tasks button")
write(p, s)

route = read("src/routes/_authenticated/trips.$tripId.index.tsx")
for forbidden in ["Générer des propositions", "Régénérer tout le planning", "Générer le planning"]:
    if forbidden in route:
        raise SystemExit(f"Forbidden CTA wording still present: {forbidden}")

print("Scoped KREW UX corrections applied successfully")
