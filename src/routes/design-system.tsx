import { createFileRoute } from "@tanstack/react-router";
import { KrewIcon, KrewMark, KrewProgressRing, type KrewIconName, type KrewMarkType } from "@/components/krew/visual-language";

export const Route = createFileRoute("/design-system")({ component: DesignSystemPage });

const marks: KrewMarkType[] = [
  "circle","circle-loose","circle-double","underline","underline-wave","underline-double",
  "arrow","arrow-curved","arrow-loop","arrow-down","sparkle","heart","check","connector",
  "connector-curve","connector-dotted","highlight","bracket","corner","cross","plus","burst",
  "scribble","tape","stamp-circle","route","pin-line",
];

const icons: KrewIconName[] = [
  "calendar","group","budget","pin","map","luggage","camera","home","hotel","bed","tent",
  "mountain","water","sun","city","food","drink","plane","train","car","bus","walk","bike","boat",
  "departure","arrival","checklist","task","time","invitation","vote","preferences","availability",
  "trip-profile","locked","unlocked","notification","share","check","waiting","in-progress","to-decide",
  "favorite","recommended","booked","attention","compass","route","beach","nature","music","party",
  "ticket","cost","team","message","search","plus","edit","delete","external",
];

function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <header className="mb-12 max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">KREW visual library</p>
          <h1 className="mt-2 font-display text-5xl font-normal leading-none text-primary sm:text-7xl">Le langage visuel KREW</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Catalogue interne des gestes graphiques et pictogrammes réutilisables. Cette page sert uniquement à visualiser la bibliothèque.</p>
        </header>

        <section className="mb-16">
          <div className="mb-6 flex items-end justify-between gap-4 border-b border-primary/15 pb-3">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Annotations</p><h2 className="font-display text-4xl text-primary">KrewMarks</h2></div>
            <span className="font-mono text-xs text-muted-foreground">{marks.length} marks</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {marks.map((mark, index) => (
              <div key={mark} className="flex min-h-28 flex-col items-center justify-center gap-4 border-b border-primary/10 py-4">
                <KrewMark type={mark} tone={index % 3 === 1 ? "sage" : index % 3 === 2 ? "ink" : "plum"} size="lg" />
                <code className="text-center font-mono text-[10px] text-muted-foreground">{mark}</code>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <div className="mb-6 flex items-end justify-between gap-4 border-b border-primary/15 pb-3">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Pictogrammes</p><h2 className="font-display text-4xl text-primary">KrewIcons</h2></div>
            <span className="font-mono text-xs text-muted-foreground">{icons.length} icons</span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
            {icons.map((icon, index) => (
              <div key={icon} className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-2xl bg-muted/35 px-2 py-3">
                <KrewIcon name={icon} size="lg" tone={index % 3 === 1 ? "sage" : index % 3 === 2 ? "ink" : "plum"} />
                <code className="max-w-full break-words text-center font-mono text-[9px] leading-tight text-muted-foreground">{icon}</code>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-6 border-b border-primary/15 pb-3"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Progression</p><h2 className="font-display text-4xl text-primary">Progress rings</h2></div>
          <div className="flex flex-wrap items-end gap-8">
            {[25, 50, 75, 100].map(value => <div key={value} className="flex flex-col items-center gap-2"><KrewProgressRing value={value} size={72}/><code className="font-mono text-[10px] text-muted-foreground">{value}%</code></div>)}
          </div>
        </section>
      </div>
    </main>
  );
}
