import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Plus } from "lucide-react";

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

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 sm:px-6 lg:px-10">
        <div className="flex items-center gap-8">
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
        <nav className="flex items-center gap-2.5">
          {loading ? null : user ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex text-muted-foreground hover:text-foreground">
                <Link to="/dashboard">Mes voyages</Link>
              </Button>
              <Button asChild size="sm" className="rounded-xl font-medium">
                <Link to="/trips/new">
                  <Plus className="size-4" /> Nouveau voyage
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
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 size-4" /> Se déconnecter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Link to="/auth" search={{}}>Connexion</Link>
              </Button>
              <Button asChild size="sm" className="rounded-xl font-medium">
                <Link to="/auth" search={{}}>Créer mon voyage</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
