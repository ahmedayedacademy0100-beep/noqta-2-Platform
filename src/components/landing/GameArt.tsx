import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useId } from "react";

/** Every game that appears in the public home-page showcase. */
export type LandingGameArtKey =
  | "memory"
  | "sprint"
  | "situations"
  | "daily"
  | "sentence"
  | "odd"
  | "gap";

/**
 * Card artwork for a landing game.
 *
 * The owner can point a game at their own image from Admin → Settings; when no
 * image is set the card falls back to a layered illustration built from the
 * game's own accent gradient and icon, so every card still reads as its own
 * game instead of a plain icon tile.
 */
export function GameArt({
  artKey,
  icon: Icon,
  gradient,
  image,
  className,
}: {
  artKey: LandingGameArtKey;
  icon: LucideIcon;
  gradient: string;
  image?: string | null;
  className?: string;
}) {
  const patternId = useId();
  return (
    <div
      className={cn(
        "relative h-32 w-full overflow-hidden rounded-2xl bg-gradient-to-br",
        gradient,
        className,
      )}
    >
      {image ? (
        <>
          <img
            src={image}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent"
          />
        </>
      ) : (
        <>
          <svg aria-hidden className="absolute inset-0 size-full opacity-20">
            <defs>
              <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.4" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${patternId})`} />
          </svg>
          <span
            aria-hidden
            className="absolute -end-6 -top-8 size-28 rounded-full bg-white/25 blur-2xl"
          />
          <span
            aria-hidden
            className="absolute -start-8 -bottom-10 size-24 rounded-full bg-black/15 blur-2xl"
          />
          <Icon
            aria-hidden
            className="absolute end-5 top-1/2 size-14 -translate-y-1/2 text-white/95 drop-shadow-[0_10px_18px_rgb(0_0_0/0.28)]"
          />
          <span
            aria-hidden
            className="absolute start-5 bottom-4 h-1.5 w-16 rounded-full bg-white/35"
          />
          <span
            aria-hidden
            className="absolute start-5 bottom-4 h-1.5 w-8 rounded-full bg-white/80"
          />
        </>
      )}
      <span className="sr-only">{artKey}</span>
    </div>
  );
}
