import { useState } from "react";

import { cn } from "@/lib/utils";

type KrewAvatarSize = "xs" | "sm" | "md";

const SIZE_CLASSES: Record<KrewAvatarSize, string> = {
  xs: "size-7 text-[11px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
};

type KrewAvatarProps = {
  name?: string | null;
  avatarUrl?: string | null;
  size?: KrewAvatarSize;
  className?: string;
  decorative?: boolean;
};

export function KrewAvatar({
  name,
  avatarUrl,
  size = "sm",
  className,
  decorative = true,
}: KrewAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const label = String(name || "Participant").trim() || "Participant";
  const initial = Array.from(label)[0]?.toLocaleUpperCase("fr") || "K";
  const showImage = Boolean(avatarUrl && !imageFailed);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-sage/35 bg-sage/16 font-mono font-semibold text-primary",
        SIZE_CLASSES[size],
        className,
      )}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `Photo de ${label}`}
    >
      {showImage ? (
        <img
          src={avatarUrl!}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}

type KrewAvatarStackMember = {
  id?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
};

type KrewAvatarStackProps = {
  members: KrewAvatarStackMember[];
  max?: number;
  size?: KrewAvatarSize;
  className?: string;
};

export function KrewAvatarStack({
  members,
  max = 5,
  size = "sm",
  className,
}: KrewAvatarStackProps) {
  const visible = members.slice(0, max);
  const hidden = Math.max(0, members.length - visible.length);

  if (members.length === 0) return null;

  return (
    <div
      className={cn("flex items-center", className)}
      aria-label={`${members.length} membre${members.length > 1 ? "s" : ""} dans le groupe`}
    >
      {visible.map((member, index) => (
        <KrewAvatar
          key={member.id || `${member.name || "participant"}-${index}`}
          name={member.name}
          avatarUrl={member.avatarUrl}
          size={size}
          className={cn("ring-2 ring-background", index > 0 && "-ml-2")}
        />
      ))}
      {hidden > 0 ? (
        <span
          className={cn(
            "-ml-2 inline-flex shrink-0 items-center justify-center rounded-full border border-sage/35 bg-background font-mono font-semibold text-primary ring-2 ring-background",
            SIZE_CLASSES[size],
          )}
          aria-hidden="true"
        >
          +{hidden}
        </span>
      ) : null}
    </div>
  );
}
