import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile, type ProfileRole } from "@/hooks/use-profile";
import { useI18n } from "@/i18n";
import { describeError, isAccessDenied } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { ConvexError } from "convex/values";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Inbox,
  Lock,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import React, {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Navigate, useLocation } from "react-router";

/* -------------------------------------------------------------------------- */
/* Layout blocks                                                              */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.header
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-primary uppercase">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            {eyebrow}
          </div>
        ) : null}
        <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </motion.header>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card
      className={cn(
        "surface border-border/70 gap-0 rounded-2xl shadow-none",
        className,
      )}
    >
      {title || actions ? (
        <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/60 pb-4">
          <div className="min-w-0">
            {title ? (
              <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight">
                <span
                  className="h-4 w-1 rounded-full bg-gradient-to-b from-primary to-accent"
                  aria-hidden
                />
                {title}
              </CardTitle>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn("pt-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  index = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "accent" | "muted";
  /** Position in a row; drives the entrance stagger. */
  index?: number;
}) {
  const reduce = useReducedMotion();
  const toneClass = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-gradient-to-br from-primary to-accent text-white shadow-[0_8px_18px_-10px_rgb(65_105_255/0.9)]",
    accent: "bg-accent/15 text-accent",
    muted: "bg-secondary text-secondary-foreground",
  }[tone];
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: Math.min(index * 0.06, 0.3),
        ease: [0.16, 1, 0.3, 1],
      }}
      className="nq-card nq-card-hover p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-extrabold tracking-tight">
            {typeof value === "number" ? <CountUp value={value} /> : value}
          </p>
          {hint ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <motion.span
            whileHover={reduce ? undefined : { rotate: -6, scale: 1.06 }}
            className={cn("grid size-10 shrink-0 place-items-center rounded-xl", toneClass)}
          >
            <Icon className="size-[18px]" aria-hidden />
          </motion.span>
        ) : null}
      </div>
    </motion.div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
      <motion.span
        initial={reduce ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 18 }}
        className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/12 to-accent/12 text-primary"
      >
        <Icon className="size-5" aria-hidden />
      </motion.span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      {body ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground"
    >
      <span
        aria-hidden
        className="size-8 animate-spin rounded-full border-2 border-primary/15 border-t-primary"
      />
      {label ?? t("common.loading")}
    </div>
  );
}

export function ErrorNotice({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const { t, lang } = useI18n();
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <span>{describeError(error, t, lang)}</span>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}

export function Meter({
  value,
  label,
  hint,
}: {
  value: number;
  label?: string;
  hint?: string;
}) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      {label ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="truncate text-sm text-muted-foreground">{label}</span>
          <span className="text-sm font-bold tabular-nums">{Math.round(clamped)}%</span>
        </div>
      ) : null}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Motion & data-viz primitives                                               */
/* -------------------------------------------------------------------------- */

/**
 * Counts a number up on mount (and on change). Used for points, streaks and
 * scores so numbers feel earned rather than simply printed.
 */
export function CountUp({
  value,
  duration = 900,
  format,
}: {
  value: number;
  duration?: number;
  format?: (value: number) => string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const from = useRef(0);

  // Reduced motion renders the final value directly; the animation state is
  // only used when motion is allowed.
  useEffect(() => {
    if (reduce) {
      from.current = value;
      return;
    }
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(begin + (value - begin) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduce]);

  const shown = reduce ? value : display;
  return <>{format ? format(shown) : Math.round(shown)}</>;
}

/** Animated score/progress ring with the Noqta blue→violet sweep. */
export function ProgressRing({
  value,
  size = 76,
  stroke = 7,
  label,
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  children?: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const rawId = useId();
  const gradientId = `nq-ring-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(clamped)}%`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4169FF" />
            <stop offset="55%" stopColor="#6D63FF" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduce ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (clamped / 100) * circumference }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        {children ?? (
          <span className="text-sm font-extrabold tabular-nums">
            {Math.round(clamped)}%
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * A one-shot confetti burst for genuine milestones. Purely decorative, silenced
 * for reduced-motion users, and never attached to an exam in progress.
 */
export function Celebration({
  show,
  pieces = 26,
}: {
  show: boolean;
  pieces?: number;
}) {
  const reduce = useReducedMotion();
  const confetti = useMemo(
    () =>
      Array.from({ length: pieces }).map((_, index) => {
        const seed = (index * 9301 + 49297) % 233280;
        const ratio = seed / 233280;
        const colors = ["#4169FF", "#8B5CF6", "#22D3EE", "#FACC15", "#FF7A70"];
        return {
          id: index,
          left: 8 + ratio * 84,
          delay: (index % 7) * 0.06,
          duration: 1.9 + ratio * 1.1,
          drift: (ratio - 0.5) * 140,
          size: 6 + (index % 3) * 3,
          color: colors[index % colors.length],
          rotate: 180 + ratio * 540,
        };
      }),
    [pieces],
  );

  if (!show || reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {confetti.map((piece) => (
        <motion.span
          key={piece.id}
          className="absolute top-0 rounded-[2px]"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 1.6,
            background: piece.color,
          }}
          initial={{ y: -30, opacity: 0, rotate: 0 }}
          animate={{ y: "105vh", x: piece.drift, opacity: [0, 1, 1, 0], rotate: piece.rotate }}
          transition={{ duration: piece.duration, delay: piece.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/** Fade-and-rise wrapper with an optional stagger delay. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const reduce = useReducedMotion();
  const animation = {
    initial: reduce ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as const },
  };
  if (as === "li") {
    return (
      <motion.li {...animation} className={className}>
        {children}
      </motion.li>
    );
  }
  if (as === "section") {
    return (
      <motion.section {...animation} className={className}>
        {children}
      </motion.section>
    );
  }
  return (
    <motion.div {...animation} className={className}>
      {children}
    </motion.div>
  );
}

/** Small decorative sparkle cluster for achievement surfaces. */
export function Sparkle({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("pointer-events-none absolute", className)}>
      <Sparkles className="size-4 text-nq-yellow animate-twinkle" />
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                     */
/* -------------------------------------------------------------------------- */

const STATUS_TONES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-chart-3/15 text-chart-3",
  published: "bg-primary/10 text-primary",
  closed: "bg-secondary text-secondary-foreground",
  archived: "bg-muted text-muted-foreground",
  available: "bg-primary/12 text-primary ring-1 ring-primary/25",
  in_progress: "bg-nq-yellow/20 text-amber-700 dark:text-nq-yellow",
  submitted: "bg-chart-3/15 text-chart-3",
  graded: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  expired: "bg-destructive/10 text-destructive",
  completed: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  missed: "bg-destructive/10 text-destructive",
  upcoming: "bg-accent/12 text-accent",
  grading: "bg-chart-3/15 text-chart-3",
  active: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  suspended: "bg-destructive/10 text-destructive",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const text = label ?? t(`status.${status}`);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_TONES[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {text === `status.${status}` ? status : text}
    </span>
  );
}

export function RoleBadge({ role }: { role: ProfileRole }) {
  const { t } = useI18n();
  const tone =
    role === "super_admin"
      ? "bg-accent/12 text-accent"
      : role === "teacher"
        ? "bg-primary/10 text-primary"
        : "bg-secondary text-secondary-foreground";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tone)}>
      {t(`roles.${role}`)}
    </span>
  );
}

export function DemoBadge() {
  const { t } = useI18n();
  return (
    <Badge
      variant="outline"
      className="border-dashed border-chart-4/60 bg-chart-4/10 text-[10px] font-semibold tracking-wide text-chart-4 uppercase"
    >
      {t("common.demo_data")}
    </Badge>
  );
}

export function KindBadge({ kind }: { kind: string }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
      {t(`kind.${kind}`)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Access control screens                                                     */
/* -------------------------------------------------------------------------- */

export function ForbiddenScreen({ body }: { body?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="surface w-full max-w-md p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <Lock className="size-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-semibold">{t("forbidden.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {body ?? t("forbidden.body")}
        </p>
        <Button asChild className="mt-6 w-full">
          <Link to="/dashboard">{t("forbidden.cta")}</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Client-side convenience guard. It keeps the wrong portal out of the way, and
 * the backend independently rejects any request the role is not allowed to make.
 */
export function RoleGuard({
  roles,
  children,
}: {
  roles: ProfileRole[];
  children: ReactNode;
}) {
  const { isLoading, profile } = useProfile();
  const location = useLocation();

  if (isLoading) return <LoadingBlock />;
  if (!profile) {
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }
  if (!roles.includes(profile.role)) return <ForbiddenScreen />;
  return <>{children}</>;
}

/**
 * Convex hooks throw on a denied request. This boundary turns that into the
 * localized 403 / error panel instead of crashing the whole preview.
 */
export class QueryBoundary extends React.Component<
  { children: ReactNode },
  { error: unknown }
> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    console.warn("[QueryBoundary]", error);
  }

  render() {
    if (this.state.error !== null) {
      return (
        <BoundaryFallback
          error={this.state.error}
          reset={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

function BoundaryFallback({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  const { lang } = useI18n();
  const detail =
    error instanceof ConvexError
      ? ((error.data as { messageEn?: string; messageAr?: string } | undefined) ??
        undefined)
      : undefined;
  if (isAccessDenied(error)) {
    return (
      <ForbiddenScreen
        body={lang === "ar" ? detail?.messageAr : detail?.messageEn}
      />
    );
  }
  return (
    <div className="py-10">
      <ErrorNotice error={error} onRetry={reset} />
    </div>
  );
}

export function RequireProfile({ children }: { children: ReactNode }) {
  const { isLoading, signedIn, hasProfile } = useProfile();
  const location = useLocation();
  if (isLoading) return <LoadingBlock />;
  if (!signedIn) {
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }
  if (!hasProfile) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

export function LinkCard({
  to,
  title,
  meta,
  footer,
  tone,
}: {
  to: string;
  title: string;
  meta?: ReactNode;
  footer?: ReactNode;
  tone?: string;
}) {
  return (
    <Link
      to={to}
      className="surface group flex flex-col gap-3 p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-18px_rgb(15_23_42/0.35)] focus-visible:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {tone ? (
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {tone}
            </span>
          ) : null}
          <h3 className="truncate text-sm font-semibold tracking-tight">{title}</h3>
        </div>
        <ArrowUpRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5"
          aria-hidden
        />
      </div>
      {meta ? <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{meta}</div> : null}
      {footer}
    </Link>
  );
}

export function DataList({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 truncate text-sm">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
