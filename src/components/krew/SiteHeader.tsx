import { Link, useNavigate } from "@tanstack/react-router";
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
import { Logo } from "./Logo";

export function SiteHeader() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true, search: {} });
  }

  const initials = (user?.email ?? "K").slice(0, 2).toUpperCase();

  const publicLinks = (
    <>
      <DropdownMenuItem asChild>
        <Link to="/a-propos">À propos</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to="/tarifs">Tarifs</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to="/faq">FAQ</Link>
      </DropdownMenuItem>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-8">
          <Link to="/" className="transition-opacity hover:opacity-85">
            <Logo />
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-muted-foreground">
            <Link to="/a-propos" className="hover:text-foreground transition-colors">
              À propos
            </Link>
            <Link to="/tarifs" className="hover:text-foreground transition-colors">
              Tarifs
            </Link>
            <Link to="/faq" className="hover:text-foreground transition-colors">
              FAQ
            </Link>
          </nav>
        </div>

        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="md:hidden size-10 rounded-xl text-muted-foreground hover:text-foreground"
                aria-label="Ouvrir le menu"
              >
                <Menu className="size-5" />
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
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex text-muted-foreground hover:text-foreground">
                <Link to="/dashboard">Mes voyages</Link>
              </Button>
              <Button asChild size="sm" className="h-10 min-h-10 shrink-0 rounded-xl px-3 sm:px-4 text-xs sm:text-sm font-medium leading-none">
                <Link to="/trips/new" className="inline-flex min-w-max items-center justify-center whitespace-nowrap text-center leading-none">
                  Nouveau voyage
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-1 cursor-pointer outline-none" aria-label="Menu du compte">
                    <Avatar className="size-9 border border-border">
                      <AvatarFallback className="bg-surface text-xs font-semibold text-foreground">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard">Mes voyages</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account">Mon compte</Link>
                  </DropdownMenuItem>
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
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex px-2 text-xs text-muted-foreground hover:text-foreground sm:px-3 sm:text-sm">
                <Link to="/auth" search={{}}>Connexion</Link>
              </Button>
              <Button asChild size="sm" className="h-10 min-h-10 shrink-0 rounded-xl px-3 sm:px-4 text-xs sm:text-sm font-medium leading-none">
                <Link to="/auth" search={{}} className="inline-flex min-w-max items-center justify-center whitespace-nowrap text-center leading-none">
                  Créer un voyage
                </Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
