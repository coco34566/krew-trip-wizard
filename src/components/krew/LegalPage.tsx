import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Logo } from "@/components/krew/Logo";
import { SiteHeader } from "@/components/krew/SiteHeader";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dernière mise à jour : 7 août 2026
        </p>
        <article className="prose-krew mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
          {children}
        </article>
        <nav className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
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
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4">
          <Logo size="sm" variant="wordmark" />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} KREW</p>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-muted-foreground">{children}</div>
    </section>
  );
}
