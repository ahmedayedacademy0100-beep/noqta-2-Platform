import { CountUp, Reveal } from "@/components/app/ui";
import { useI18n } from "@/i18n";
import { toneForCode, type BadgeTone } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import {
  Award,
  Flame,
  Footprints,
  Lock,
  PenLine,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

/* -------------------------------------------------------------------------- */
/* Small reward chips                                                         */
/* -------------------------------------------------------------------------- */

export function XpPill({
  points,
  className,
  size = "md",
}: {
  points: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const { t, formatNumber } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-nq-yellow/50 bg-nq-yellow/15 font-extrabold text-amber-700 dark:text-nq-yellow",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        className,
      )}
      title={t("student.points")}
    >
      <Sparkles className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
      <span className="tabular-nums">{formatNumber(points)}</span>
      <span className="font-semibold opacity-70">{t("student.xp")}</span>
    </span>
  );
}

export function StreakPill({
  streak,
  className,
}: {
  streak: number;
  className?: string;
}) {
  const { t, formatNumber } = useI18n();
  const alive = streak > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold",
        alive
          ? "border-nq-coral/45 bg-nq-coral/12 text-[#C2410C] dark:text-[#FFB4AC]"
          : "border-border/70 bg-muted/60 text-muted-foreground",
        className,
      )}
      title={t("student.streak")}
    >
      <Flame
        className={cn("size-3.5", alive && "animate-twinkle")}
        aria-hidden
      />
      <span className="tabular-nums">{formatNumber(streak)}</span>
      <span className="font-semibold opacity-70">{t("student.days")}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Level badge                                                                */
/* -------------------------------------------------------------------------- */

export function LevelBadge({
  points,
  progress,
  level,
  size = 96,
  caption,
}: {
  points: number;
  level: number;
  progress: number;
  size?: number;
  caption?: string;
}) {
  const { t, formatNumber } = useI18n();
  const reduce = useReducedMotion();
  const stroke = Math.max(6, Math.round(size * 0.075));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${t("nq.level", { level: formatNumber(level) })} · ${points} ${t("student.xp")}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(255 255 255 / 0.22)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#nq-level-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduce ? false : { strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset: circumference - (clamped / 100) * circumference,
          }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
        <defs>
          <linearGradient id="nq-level-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D6C8" />
            <stop offset="55%" stopColor="#3478F6" />
            <stop offset="100%" stopColor="#FFC94A" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none text-white">
        <span>
          <span className="block text-[9px] font-bold tracking-[0.16em] opacity-70 uppercase">
            {caption ?? t("nq.level_short")}
          </span>
          <span className="mt-0.5 block text-xl font-black tabular-nums">
            {formatNumber(level)}
          </span>
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Medals                                                                     */
/* -------------------------------------------------------------------------- */

const MEDAL_ICONS: Record<string, LucideIcon> = {
  footprints: Footprints,
  target: Target,
  pen: PenLine,
  flame: Flame,
  award: Award,
  star: Star,
  trophy: Trophy,
};

const TONE_STYLES: Record<
  BadgeTone,
  { gradient: string; ring: string; glow: string; text: string }
> = {
  gold: {
    gradient: "linear-gradient(145deg,#FFE39A 0%,#FFC94A 42%,#F0A31C 100%)",
    ring: "ring-nq-yellow/50",
    glow: "nq-glow-gold",
    text: "text-[#7A4A02]",
  },
  blue: {
    gradient: "linear-gradient(145deg,#9FC3FF 0%,#3478F6 46%,#1E4EC4 100%)",
    ring: "ring-nq-blue/45",
    glow: "nq-glow-blue",
    text: "text-white",
  },
  violet: {
    gradient: "linear-gradient(145deg,#C9B6FF 0%,#7957E8 46%,#4B32B8 100%)",
    ring: "ring-nq-violet/45",
    glow: "nq-glow-violet",
    text: "text-white",
  },
  turquoise: {
    gradient: "linear-gradient(145deg,#A8F6EF 0%,#34D6C8 46%,#0E9C93 100%)",
    ring: "ring-nq-turquoise/50",
    glow: "nq-glow-blue",
    text: "text-[#04443F]",
  },
  coral: {
    gradient: "linear-gradient(145deg,#FFC4BE 0%,#FF7A70 46%,#D6433A 100%)",
    ring: "ring-nq-coral/50",
    glow: "nq-glow-violet",
    text: "text-[#5C1510]",
  },
};

export function Medal({
  code,
  icon = "award",
  title,
  description,
  earned,
  earnedAtLabel,
  size = "md",
  className,
}: {
  code: string;
  icon?: string;
  title: string;
  description?: string;
  earned: boolean;
  earnedAtLabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const Icon = MEDAL_ICONS[icon] ?? Award;
  const tone = TONE_STYLES[toneForCode(code)];
  const dimension =
    size === "lg" ? "size-24" : size === "sm" ? "size-12" : "size-16";
  const iconSize = size === "lg" ? "size-9" : size === "sm" ? "size-5" : "size-7";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn(
        "group flex h-full flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors",
        earned
          ? "border-border/70 bg-card hover:border-primary/35"
          : "border-dashed border-border/80 bg-muted/25",
        className,
      )}
      title={description}
    >
      <span className="relative grid place-items-center">
        {earned ? (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full opacity-45 blur-lg"
            style={{ background: tone.gradient }}
          />
        ) : null}
        <span
          className={cn(
            "relative grid place-items-center rounded-full ring-4 transition-transform duration-300",
            dimension,
            earned
              ? cn(tone.ring, tone.glow, "group-hover:-translate-y-0.5 group-hover:scale-[1.04]")
              : "ring-border/60",
          )}
          style={
            earned
              ? { background: tone.gradient }
              : { background: "var(--muted)" }
          }
        >
          {earned ? (
            <Icon className={cn(iconSize, tone.text)} aria-hidden />
          ) : (
            <Lock className="size-5 text-muted-foreground/70" aria-hidden />
          )}
          {earned ? (
            <span
              aria-hidden
              className="absolute inset-x-2 top-1.5 h-1/3 rounded-full bg-white/35 blur-[2px]"
            />
          ) : null}
        </span>
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-xs leading-tight font-bold",
            earned ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {title}
        </span>
        {earned && earnedAtLabel ? (
          <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
            {earnedAtLabel}
          </span>
        ) : null}
        {!earned && description ? (
          <span className="mt-0.5 line-clamp-2 block text-[10px] leading-4 text-muted-foreground/80">
            {description}
          </span>
        ) : null}
      </span>
      <span className="sr-only">
        {earned ? t("achievements.unlocked") : t("achievements.locked")}
      </span>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Challenges                                                                 */
/* -------------------------------------------------------------------------- */

export function ChallengeCard({
  title,
  description,
  current,
  target,
  rewardXp,
  icon: Icon = Target,
  index = 0,
}: {
  title: string;
  description: string;
  current: number;
  target: number;
  rewardXp: number;
  icon?: LucideIcon;
  index?: number;
}) {
  const { t, formatNumber } = useI18n();
  const reduce = useReducedMotion();
  const safeTarget = Math.max(1, target);
  const clamped = Math.max(0, Math.min(current, safeTarget));
  const percent = (clamped / safeTarget) * 100;
  const done = clamped >= safeTarget;

  return (
    <Reveal delay={index * 0.05} className="h-full">
      <div
        className={cn(
          "nq-card relative flex h-full flex-col gap-3 overflow-hidden p-4",
          done && "ring-1 ring-emerald-400/40",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-2xl text-white",
              done
                ? "bg-gradient-to-br from-emerald-400 to-teal-500"
                : "nq-gradient",
            )}
          >
            {done ? <Trophy className="size-5" aria-hidden /> : <Icon className="size-5" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{title}</p>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
              {description}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-nq-yellow/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-nq-yellow">
            <Zap className="size-3" aria-hidden />+{formatNumber(rewardXp)}
          </span>
        </div>

        <div className="mt-auto space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
            <span>
              {formatNumber(clamped)} / {formatNumber(safeTarget)}
            </span>
            <span>{done ? t("challenges.done") : `${Math.round(percent)}%`}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className={cn(
                "h-full rounded-full",
                done
                  ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                  : "bg-gradient-to-r from-nq-turquoise via-nq-blue to-nq-violet",
              )}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${done ? 100 : Math.max(percent, 3)}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat tile                                                                  */
/* -------------------------------------------------------------------------- */

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
  index = 0,
  footer,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: "blue" | "violet" | "turquoise" | "gold" | "coral";
  index?: number;
  footer?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const tones: Record<string, string> = {
    blue: "from-nq-blue to-[#2f5fd0]",
    violet: "from-nq-violet to-[#5b3fd0]",
    turquoise: "from-nq-turquoise to-[#12a79b]",
    gold: "from-nq-yellow to-[#f0a31c]",
    coral: "from-nq-coral to-[#e2554b]",
  };
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.06, 0.3) }}
      className="nq-card nq-card-hover nq-press relative overflow-hidden p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          <p className="mt-1 text-2xl font-black tracking-tight tabular-nums">
            {typeof value === "number" ? <CountUp value={value} /> : value}
          </p>
          {hint ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white",
            tones[tone],
          )}
        >
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </motion.div>
  );
}
