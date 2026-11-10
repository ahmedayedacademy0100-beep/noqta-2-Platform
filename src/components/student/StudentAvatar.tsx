import { AvatarDefinition, avatarById } from "@/lib/avatars";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "size-8 text-base rounded-xl",
  sm: "size-10 text-xl rounded-2xl",
  md: "size-14 text-2xl rounded-[18px]",
  lg: "size-[88px] text-5xl rounded-[26px]",
} as const;

/**
 * A student's chosen avatar. Falls back to the first letter of their name so a
 * profile without an avatar still looks intentional.
 */
export function StudentAvatar({
  avatar,
  name,
  size = "md",
  className,
}: {
  avatar?: string | null;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const found: AvatarDefinition | null = avatarById(avatar);
  const initial = name.trim().charAt(0).toUpperCase() || "؟";

  return (
    <span
      aria-hidden
      className={cn(
        "relative grid shrink-0 place-items-center bg-gradient-to-br font-black text-white shadow-[0_14px_28px_-16px_rgb(17_28_61/0.65)] ring-2 ring-white/50",
        found ? found.gradient : "from-nq-blue to-nq-violet",
        SIZES[size],
        className,
      )}
    >
      {found ? found.emoji : initial}
    </span>
  );
}
