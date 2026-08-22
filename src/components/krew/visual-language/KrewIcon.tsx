import type { ComponentType } from "react";
import {
  CalendarDays, Users, Wallet, MapPin, Map, Luggage, Camera, Home, Hotel, BedDouble,
  TentTree, Mountain, Waves, Sun, Building2, Utensils, Wine, Plane, TrainFront, Car,
  BusFront, Footprints, Bike, Ship, LogIn, LogOut, ListChecks, ClipboardCheck, Clock3,
  MailPlus, Vote, SlidersHorizontal, CalendarCheck2, Sparkles, LockKeyhole, UnlockKeyhole,
  Bell, Share2, Check, CircleDashed, LoaderCircle, CircleHelp, Heart, BadgeCheck,
  BookmarkCheck, CircleAlert, Compass, Route, Palmtree, Trees, Music, PartyPopper,
  Ticket, Euro, UsersRound, MessageCircle, Search, Plus, Pencil, Trash2, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type KrewIconName =
  | "calendar" | "group" | "budget" | "pin" | "map" | "luggage" | "camera"
  | "home" | "hotel" | "bed" | "tent" | "mountain" | "water" | "sun" | "city"
  | "food" | "drink" | "plane" | "train" | "car" | "bus" | "walk" | "bike" | "boat"
  | "departure" | "arrival" | "checklist" | "task" | "time" | "invitation" | "vote"
  | "preferences" | "availability" | "trip-profile" | "locked" | "unlocked" | "notification"
  | "share" | "check" | "waiting" | "in-progress" | "to-decide" | "favorite" | "recommended"
  | "booked" | "attention" | "compass" | "route" | "beach" | "nature" | "music" | "party"
  | "ticket" | "cost" | "team" | "message" | "search" | "plus" | "edit" | "delete" | "external";

const ICONS: Record<KrewIconName, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  calendar: CalendarDays, group: Users, budget: Wallet, pin: MapPin, map: Map, luggage: Luggage,
  camera: Camera, home: Home, hotel: Hotel, bed: BedDouble, tent: TentTree, mountain: Mountain,
  water: Waves, sun: Sun, city: Building2, food: Utensils, drink: Wine, plane: Plane,
  train: TrainFront, car: Car, bus: BusFront, walk: Footprints, bike: Bike, boat: Ship,
  departure: LogOut, arrival: LogIn, checklist: ListChecks, task: ClipboardCheck, time: Clock3,
  invitation: MailPlus, vote: Vote, preferences: SlidersHorizontal, availability: CalendarCheck2,
  "trip-profile": Sparkles, locked: LockKeyhole, unlocked: UnlockKeyhole, notification: Bell,
  share: Share2, check: Check, waiting: CircleDashed, "in-progress": LoaderCircle,
  "to-decide": CircleHelp, favorite: Heart, recommended: BadgeCheck, booked: BookmarkCheck,
  attention: CircleAlert, compass: Compass, route: Route, beach: Palmtree, nature: Trees,
  music: Music, party: PartyPopper, ticket: Ticket, cost: Euro, team: UsersRound,
  message: MessageCircle, search: Search, plus: Plus, edit: Pencil, delete: Trash2, external: ExternalLink,
};

export function KrewIcon({ name, size = "md", tone = "ink", className }: {
  name: KrewIconName;
  size?: "sm" | "md" | "lg";
  tone?: "plum" | "sage" | "ink" | "muted";
  className?: string;
}) {
  const Icon = ICONS[name];
  return <Icon strokeWidth={1.8} className={cn(
    "shrink-0",
    size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5",
    tone === "plum" ? "text-primary" : tone === "sage" ? "text-sage" : tone === "muted" ? "text-muted-foreground" : "text-foreground",
    className,
  )} />;
}
