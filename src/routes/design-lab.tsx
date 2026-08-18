import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  KrewAnnotation,
  KrewConnector,
  KrewHighlight,
  KrewMark,
  KrewPhotoOverlay,
  type KrewMarkType,
} from "@/components/krew/visual-language";

export const Route = createFileRoute("/design-lab")({
  head: () => ({ meta: [{ title: "KREW Visual Language" }] }),
  component: DesignLab,
});

const marks: Array<{ type: KrewMarkType; label: string }> = [
  { type: "circle", label: "Cercle" }, { type: "underline", label: "Soulignement" },
  { type: "arrow", label: "Flèche" }, { type: "sparkle", label: "Étincelle" },
  { type: "heart", label: "Cœur" }, { type: "check", label: "Coche" },
  { type: "connector", label: "Connexion" }, { type: "highlight", label: "Surlignage" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-t border-border pt-8 sm:pt-10"><h2 className="font-display text-2xl sm:text-3xl">{title}</h2><div className="mt-6">{children}</div></section>;
}

function DesignLab() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <header className="max-w-2xl pb-12 sm:pb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Design Lab</p>
          <h1 className="mt-3 font-display text-4xl sm:text-6xl">KREW Visual Language</h1>
          <p className="mt-4 text-lg text-muted-foreground">Le voyage se dessine à plusieurs.</p>
        </header>
        <div className="space-y-14 sm:space-y-20">
          <Section title="Les marques">
            <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-4">
              {marks.map(({ type, label }) => <div key={type} className="min-w-0"><p className="mb-3 text-sm font-medium">{label}</p><div className="flex min-h-16 items-center gap-2"><KrewMark type={type} tone="plum" size="sm" rotation={-2} /><KrewMark type={type} tone="plum" size="lg" rotation={2} /></div><div className="mt-2 flex min-h-12 items-center gap-2"><KrewMark type={type} tone="sage" size="sm" /><KrewMark type={type} tone="sage" size="md" /></div></div>)}
            </div>
          </Section>
          <Section title="Avec du texte">
            <div className="grid gap-8 sm:grid-cols-2">
              <div className="relative inline-flex w-fit items-center py-5 text-2xl font-semibold"><span>89 % pour votre groupe</span><KrewMark type="underline" tone="plum" size="lg" className="absolute -bottom-1 left-5 w-40 max-w-[80%]" /></div>
              <p className="py-5 text-xl font-medium"><KrewHighlight>5 personnes disponibles ensemble</KrewHighlight></p>
              <div className="flex items-center gap-2 py-5 text-xl font-semibold"><KrewMark type="check" tone="plum" size="sm" /> C’est décidé</div>
              <div className="flex items-center gap-3 py-5"><span>Paris</span><KrewConnector tone="plum" dashed className="w-28" /><span>Lisbonne</span></div>
            </div>
          </Section>
          <Section title="Composition">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative py-8"><h3 className="font-display text-3xl">Le plan prend forme</h3><KrewMark type="underline" tone="plum" size="lg" className="mt-[-0.2rem] w-36" /></div>
              <div className="relative py-8"><span className="text-lg font-medium">Le choix du groupe</span><KrewMark type="circle" tone="plum" size="lg" rotation={-4} className="absolute left-5 top-4 h-14 w-44" /></div>
              <div className="flex items-center justify-between gap-2 py-8"><span className="text-sm">Départ</span><KrewConnector tone="sage" className="min-w-16 flex-1" /><span className="text-sm">Le moment</span></div>
              <div className="py-8"><KrewAnnotation tone="plum" mark="arrow">notre week-end ?</KrewAnnotation></div>
              <div className="flex items-center gap-2 py-8"><KrewMark type="check" tone="plum" size="sm" /><span className="font-medium">Dates trouvées</span></div>
              <div className="py-8 text-lg"><KrewHighlight tone="sage">Toute la team est dispo</KrewHighlight></div>
            </div>
          </Section>
          <Section title="Photo + KREW">
            <p className="mb-6 max-w-2xl text-sm text-muted-foreground">Aucune nouvelle image n’est téléchargée pour ce laboratoire. Le bloc neutre teste uniquement la superposition et le responsive.</p>
            <div className="grid gap-5 sm:grid-cols-3">
              <KrewPhotoOverlay alt="Zone photo neutre de démonstration" />
              <KrewPhotoOverlay alt="Zone photo neutre avec marque KREW"><KrewMark type="circle" tone="plum" size="lg" rotation={-4} className="absolute bottom-5 right-5 h-20 w-28" /></KrewPhotoOverlay>
              <KrewPhotoOverlay alt="Zone photo neutre avec annotation KREW"><div className="absolute bottom-5 left-5 rounded-md bg-background/90 px-3 py-2"><KrewAnnotation tone="plum" mark="arrow">un détail à remarquer</KrewAnnotation></div></KrewPhotoOverlay>
            </div>
          </Section>
          <Section title="Densité">
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="min-h-44 border-t border-border py-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trop peu</p><p className="mt-7 font-display text-2xl">Lisbonne</p><p className="mt-2 text-sm text-muted-foreground">Presque aucune signature KREW.</p></div>
              <div className="relative min-h-44 border-t border-primary py-5"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Bon niveau</p><p className="mt-7 font-display text-2xl">Lisbonne</p><KrewMark type="underline" tone="plum" size="md" className="mt-[-0.2rem]" /><KrewAnnotation tone="sage" mark="check" className="mt-3">choix du groupe</KrewAnnotation></div>
              <div className="relative min-h-44 overflow-hidden border-t border-border py-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trop — à ne pas reproduire</p><p className="mt-7 font-display text-2xl">Lisbonne</p><KrewMark type="circle" tone="plum" size="lg" className="absolute left-2 top-12 w-36" /><KrewMark type="sparkle" tone="sage" size="md" className="absolute right-4 top-12" /><KrewMark type="heart" tone="plum" size="sm" className="absolute bottom-3 right-16" /><KrewMark type="arrow" tone="sage" size="lg" className="absolute bottom-2 left-20" /></div>
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
