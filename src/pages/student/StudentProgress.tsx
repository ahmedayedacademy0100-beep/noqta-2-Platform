import {
  EmptyState,
  LoadingBlock,
  Meter,
  PageHeader,
  ProgressRing,
  Reveal,
  SectionCard,
} from "@/components/app/ui";
import { LevelBadge, Medal, StatTile } from "@/components/student/gamification-ui";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { levelStateFor } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  CalendarDays,
  ChartLine,
  Flame,
  Layers,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { Link } from "react-router";

const WIDTH = 640;
const HEIGHT = 220;

export default function StudentProgress() {
  const { t, pick, formatNumber, formatDate } = useI18n();
  const data = useQuery(api.student.progress, {});
  const game = useQuery(api.student.gamification, {});
  const reduce = useReducedMotion();

  if (data === undefined) return <LoadingBlock />;

  const points = data.series;
  const maxIndex = Math.max(points.length - 1, 1);
  const path = points
    .map((point, index) => {
      const x = (index / maxIndex) * (WIDTH - 48) + 24;
      const y = HEIGHT - 26 - (point.percentage / 100) * (HEIGHT - 50);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const best = points.reduce((top, point) => Math.max(top, point.percentage), 0);
  const weakest = [...data.subjects]
    .filter((subject) => subject.averagePercent !== null)
    .sort((a, b) => (a.averagePercent ?? 0) - (b.averagePercent ?? 0))[0];
  const strongest = [...data.subjects]
    .filter((subject) => subject.averagePercent !== null)
    .sort((a, b) => (b.averagePercent ?? 0) - (a.averagePercent ?? 0))[0];

  const xp = levelStateFor(game?.points ?? 0);
  const maxActivity = Math.max(1, ...(game?.activity ?? []).map((row) => row.submitted));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("nav.progress")}
        title={t("results.progress_title")}
        subtitle={t("results.subtitle")}
      />

      {/* Plain-language summary: what the numbers actually mean. */}
      <div className="nq-card relative overflow-hidden p-5">
        <span aria-hidden className="nq-aurora absolute inset-0 opacity-[0.08]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <h2 className="text-base font-black">{t("results.progress_title")}</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {data.overall === null
                ? t("progress.explain.none")
                : data.overall >= 70
                  ? t("progress.explain.good", {
                      average: formatNumber(Math.round(data.overall)),
                      count: formatNumber(points.length),
                    })
                  : t("progress.explain.improve", {
                      average: formatNumber(Math.round(data.overall)),
                    })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {strongest ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 font-bold text-emerald-600 dark:text-emerald-400">
                  <Target className="size-3" aria-hidden />
                  {pick("Strongest", "الأقوى")}: {pick(strongest.nameEn, strongest.nameAr)}
                </span>
              ) : null}
              {weakest && weakest !== strongest ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-nq-coral/12 px-2.5 py-1 font-bold text-[#C2410C] dark:text-[#FFB4AC]">
                  <Layers className="size-3" aria-hidden />
                  {pick("Needs review", "يحتاج مراجعة")}: {pick(weakest.nameEn, weakest.nameAr)}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <LevelBadge
              points={xp.into}
              level={xp.level}
              progress={xp.progress}
              size={96}
            />
            <div className="text-xs">
              <p className="font-black tabular-nums text-foreground">
                {formatNumber(game?.points ?? 0)} {t("student.xp")}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {t("nq.level_next", {
                  points: formatNumber(xp.remaining),
                  level: formatNumber(xp.level + 1),
                })}
              </p>
              {game ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("achievements.badge_points")}: {formatNumber(game.totals.badgePoints)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          label={t("common.average")}
          value={data.overall === null ? "—" : `${formatNumber(Math.round(data.overall))}%`}
          hint={t("results.released")}
          icon={ChartLine}
          tone="blue"
        />
        <StatTile
          index={1}
          label={t("results.released")}
          value={points.length}
          hint={t("nav.results")}
          icon={BarChart3}
          tone="violet"
        />
        <StatTile
          index={2}
          label={t("student.best")}
          value={points.length === 0 ? "—" : `${formatNumber(Math.round(best))}%`}
          hint={t("nq.score")}
          icon={Trophy}
          tone="gold"
        />
        <StatTile
          index={3}
          label={t("student.streak")}
          value={game?.streak ?? 0}
          hint={t("student.days")}
          icon={Flame}
          tone="coral"
        />
      </div>

      <SectionCard
        title={t("results.progress_title")}
        description={
          data.overall === null
            ? undefined
            : t("results.trend", {
                average: Math.round(data.overall),
                count: points.length,
              })
        }
      >
        {points.length === 0 ? (
          <EmptyState title={t("results.empty")} icon={ChartLine} />
        ) : (
          <div className="nq-scrollbar overflow-x-auto">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="h-60 w-full min-w-[480px] text-foreground"
              role="img"
              aria-label={t("results.progress_title")}
            >
              <defs>
                <linearGradient id="nq-progress-line" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#34D6C8" />
                  <stop offset="55%" stopColor="#3478F6" />
                  <stop offset="100%" stopColor="#7957E8" />
                </linearGradient>
                <linearGradient id="nq-progress-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3478F6" stopOpacity="0.26" />
                  <stop offset="100%" stopColor="#3478F6" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 25, 50, 75, 100].map((line) => {
                const y = HEIGHT - 26 - (line / 100) * (HEIGHT - 50);
                return (
                  <g key={line}>
                    <line
                      x1={24}
                      x2={WIDTH - 24}
                      y1={y}
                      y2={y}
                      stroke="currentColor"
                      strokeOpacity={0.1}
                      strokeWidth={1}
                      strokeDasharray="4 6"
                    />
                    <text x={0} y={y + 4} fontSize={9} fill="currentColor" fillOpacity={0.45}>
                      {line}
                    </text>
                  </g>
                );
              })}
              {points.length > 1 ? (
                <motion.path
                  d={`${path} L${WIDTH - 24},${HEIGHT - 26} L24,${HEIGHT - 26} Z`}
                  fill="url(#nq-progress-fill)"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 0.35 }}
                />
              ) : null}
              <motion.path
                d={path}
                fill="none"
                stroke="url(#nq-progress-line)"
                strokeWidth={3.5}
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              />
              {points.map((point, index) => {
                const x = (index / maxIndex) * (WIDTH - 48) + 24;
                const y = HEIGHT - 26 - (point.percentage / 100) * (HEIGHT - 50);
                return (
                  <g key={`${point.at}-${index}`}>
                    <circle cx={x} cy={y} r={5} fill="var(--card)" stroke="url(#nq-progress-line)" strokeWidth={2.5} />
                    <title>{`${pick(point.titleEn, point.titleAr)} · ${Math.round(point.percentage)}%`}</title>
                  </g>
                );
              })}
            </svg>
            <div className="mt-2 flex justify-between px-1 text-[10px] text-muted-foreground">
              <span>{formatDate(points[0]?.at)}</span>
              <span>{formatDate(points[points.length - 1]?.at)}</span>
            </div>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <SectionCard title={t("student.subject_progress")}>
          {data.subjects.length === 0 ? (
            <EmptyState title={t("results.empty")} />
          ) : (
            <ul className="grid gap-3">
              {data.subjects.map((subject, index) => {
                const average = subject.averagePercent ?? 0;
                return (
                  <Reveal as="li" key={subject.subjectId} delay={index * 0.04}>
                    <div className="rounded-2xl border border-border/60 bg-secondary/25 p-4">
                      <div className="flex items-center gap-3">
                        <ProgressRing
                          value={average}
                          size={54}
                          stroke={5.5}
                          label={pick(subject.nameEn, subject.nameAr)}
                        >
                          <span className="text-[10px] font-extrabold tabular-nums">
                            {formatNumber(Math.round(average))}%
                          </span>
                        </ProgressRing>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">
                            {pick(subject.nameEn, subject.nameAr)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatNumber(subject.count)} {t("common.results")}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                            average >= 80
                              ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                              : average >= 60
                                ? "bg-nq-yellow/20 text-amber-700 dark:text-nq-yellow"
                                : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {average >= 80
                            ? pick("Excellent", "ممتاز")
                            : average >= 60
                              ? pick("Good", "جيد")
                              : pick("Review", "راجع")}
                        </span>
                      </div>
                      <div className="mt-3">
                        <Meter value={average} />
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-4">
          {/* Weekly activity, from real submission timestamps. */}
          <SectionCard title={t("student.recent_activity")}>
            {!game || game.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("nq.no_deadlines")}</p>
            ) : (
              <>
                <div className="flex h-28 items-end gap-1.5">
                  {game.activity.map((row) => {
                    const height = row.submitted === 0 ? 6 : Math.max(12, (row.submitted / maxActivity) * 100);
                    return (
                      <div key={row.day} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                        <div className="flex w-full flex-1 items-end">
                          <motion.div
                            initial={reduce ? false : { height: 0 }}
                            animate={{ height: `${height}%` }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className={cn(
                              "w-full rounded-t-lg",
                              row.submitted > 0
                                ? "bg-gradient-to-t from-nq-blue to-nq-turquoise"
                                : "bg-border",
                            )}
                            title={`${formatDate(new Date(row.day).getTime())} · ${row.submitted}`}
                          />
                        </div>
                        <span className="text-[9px] font-semibold text-muted-foreground tabular-nums">
                          {new Date(row.day).toLocaleDateString(undefined, { weekday: "narrow" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {pick(
                    "Each bar is how many assessments you submitted that day.",
                    "كل عمود يمثل عدد التقييمات التي سلّمتها في ذلك اليوم.",
                  )}
                </p>
              </>
            )}
          </SectionCard>

          <SectionCard
            title={t("achievements.title")}
            actions={
              <Link
                to="/achievements"
                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                {t("common.all")}
                <ArrowRight className="size-3 rtl:rotate-180" aria-hidden />
              </Link>
            }
          >
            {!game || game.totals.earned === 0 ? (
              <EmptyState title={t("achievements.empty")} icon={Award} />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {game.achievements
                    .filter((row) => row.earnedAt !== null)
                    .slice(0, 6)
                    .map((row) => (
                      <Medal
                        key={row.code}
                        code={row.code}
                        icon={row.icon}
                        title={pick(row.titleEn, row.titleAr)}
                        earned
                        size="sm"
                      />
                    ))}
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Activity className="size-3.5" aria-hidden />
                  {t("achievements.progress", {
                    earned: formatNumber(game.totals.earned),
                    total: formatNumber(game.totals.available),
                  })}
                </p>
              </>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard title={t("student.recent_results")}>
        {points.length === 0 ? (
          <EmptyState title={t("student.no_results")} icon={Target} />
        ) : (
          <ul className="divide-y divide-border/60">
            {[...points]
              .reverse()
              .slice(0, 6)
              .map((point, index) => (
                <li key={`${point.at}-${index}`} className="flex items-center gap-3 py-2.5">
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold text-white",
                      point.percentage >= 60 ? "bg-emerald-500" : "bg-nq-coral",
                    )}
                  >
                    {Math.round(point.percentage)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {pick(point.titleEn, point.titleAr)}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {formatDate(point.at, true)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums">
                    {formatNumber(Math.round(point.percentage))}%
                  </span>
                </li>
              ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
