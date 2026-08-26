import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Logo } from "@/components/krew/Logo";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 sm:py-12">
        <div className="relative inline-block">
          <h1 className="font-display text-3xl sm:text-4xl font-normal tracking-tight leading-tight text-foreground">{title}</h1>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="sm"
            className="absolute left-0 -bottom-1.5 w-[110px] sm:w-[130px] pointer-events-none"
          />
        </div>
        <p className="mt-3 text-sm font-mono text-muted-foreground">
          Dernière mise à jour : 7 août 2026
        </p>
        <article className="prose-krew mt-8 space-y-7 text-sm sm:text-base leading-relaxed text-foreground/90">
          {children}
        </article>
        <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-3 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link to="/mentions-legales" className="hover:text-primary">
            Mentions légales
          </Link>
          <Link to="/cgu" className="hover:text-primary">
            CGU
          </Link>
          <Link to="/confidentialite" className="hover:text-primary">
            Confidentialité
          </Link>
          <Link to="/" className="hover:text-primary">
            Accueil
          </Link>
        </nav>
      </main>
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-3xl flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6">
          <Logo size="sm" variant="wordmark" />
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} KREW</p>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 text-lg sm:text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-2.5 text-muted-foreground">{children}</div>
    </section>
  );
}
