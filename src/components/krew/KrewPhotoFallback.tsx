import { KrewMark } from "./visual-language/KrewMark";
import { cn } from "@/lib/utils";

interface KrewPhotoFallbackProps {
  className?: string;
  aspectRatio?: "4/3" | "3/2" | "16/9" | "square" | "auto";
  type?: "accommodation" | "activity" | "destination" | "generic";
}

export function KrewPhotoFallback({
  className,
  aspectRatio = "4/3",
  type = "generic",
}: KrewPhotoFallbackProps) {
  const aspectClass =
    aspectRatio === "4/3"
      ? "aspect-[4/3]"
      : aspectRatio === "3/2"
        ? "aspect-[3/2]"
        : aspectRatio === "16/9"
          ? "aspect-video"
          : aspectRatio === "square"
            ? "aspect-square"
            : "";

  const markType =
    type === "accommodation"
      ? "sparkle"
      : type === "activity"
        ? "arrow"
        : type === "destination"
          ? "sparkle"
          : "sparkle";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-xl bg-muted p-4 border border-border/40 text-muted-foreground/60 select-none",
        aspectClass,
        className,
      )}
    >
      <div className="flex flex-col items-center justify-center gap-2">
        <KrewMark type={markType} tone="sage" size="md" className="opacity-60" />
      </div>
    </div>
  );
}
