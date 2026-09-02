import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import "@/styles/krew-mobile-review.css";
import { Logo } from "./Logo";

export function SiteHeader() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isInternalPage = pathname === "/dashboard" || pathname === "/account" || pathname.startsWith("/trips/");

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true, search: {} });
  }

  const initials = (user?.email ?? "K").slice(0, 2).toUpperCase();
  const tripCtaClassName = "h-10 min-h-10 shrink-0 rounded-xl px-4 py-0 text-sm font-medium leading-none shadow-none sm:px-5";

  const publicLinks = (
    <>
      <DropdownMenuItem asChild><Link to="/a-propos">À propos</Link></DropdownMenuItem>
      <DropdownMenuItem asChild><Link to="/tarifs">Tarifs</Link></DropdownMenuItem>
      <DropdownMenuItem asChild><Link to="/faq">FAQ</Link></DropdownMenuItem>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      <div
        className={cn(
          "mx-auto flex max-w-[1280px] items-center justify-between sm:h-16 sm:px-6 lg:px-10",
          isInternalPage ? "h-[60px] px-3" : "h-16 px-4",
        )}
      >
        <div className={cn("flex min-w-0 items-center", isInternalPage ? "gap-4 sm:gap-8" : "gap-8")}>
          <Link to="/" aria-label="Accueil KREW" className="inline-flex min-h-10 items-center transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Logo size={isInternalPage ? "sm" : "md"} className={cn(isInternalPage && "sm:h-10")} />
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-muted-foreground" aria-label="Navigation principale">
            <Link to="/a-propos" className="hover:text-foreground transition-colors">À propos</Link>
            <Link to="/tarifs" className="hover:text-foreground transition-colors">Tarifs</Link>
            <Link to="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
          </nav>
        </div>

        <nav aria-label="Actions du compte" className={cn("flex shrink-0 items-center", isInternalPage ? "gap-1 sm:gap-2.5" : "gap-1.5 sm:gap-2.5")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="md:hidden text-muted-foreground hover:text-foreground" aria-label="Ouvrir le menu">
                <Menu className={cn(isInternalPage ? "size-[18px]" : "size-5")} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Découvrir KREW</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {publicLinks}
            </DropdownMenuContent>
          </DropdownMenu>

          {loading ? null : user ? (
            <>
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex min-h-10 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Mes voyages
              </Link>
              <Button asChild className={tripCtaClassName}>
                <Link to="/trips/new" className="inline-flex h-full min-w-max items-center justify-center whitespace-nowrap text-center leading-none">Nouveau voyage</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "ml-0.5 inline-flex items-center justify-center rounded-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:ml-1 sm:size-11",
                      isInternalPage ? "size-10" : "size-11",
                    )}
                    aria-label="Menu du compte"
                  >
                    <Avatar className={cn("border border-border", isInternalPage ? "size-8 sm:size-9" : "size-9")}>
                      <AvatarFallback className="bg-surface text-xs font-semibold text-foreground">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate text-xs text-muted-foreground">{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/dashboard">Mes voyages</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/account">Mon compte</Link></DropdownMenuItem>
                  <DropdownMenuSeparator className="md:hidden" />
                  <div className="md:hidden">{publicLinks}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 size-4" /> Se déconnecter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                search={{}}
                className="hidden sm:inline-flex min-h-10 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Connexion
              </Link>
              <Button asChild className={tripCtaClassName}>
                <Link to="/auth" search={{}} className="inline-flex h-full min-w-max items-center justify-center whitespace-nowrap text-center leading-none">Créer un voyage</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
