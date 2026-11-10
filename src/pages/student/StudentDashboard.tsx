import {
  Celebration,
  EmptyState,
  LinkCard,
  LoadingBlock,
  ProgressRing,
  Reveal,
  SectionCard,
} from "@/components/app/ui";
import { Mascot } from "@/components/student/Mascot";
import { StudentAvatar } from "@/components/student/StudentAvatar";
import {
  ChallengeCard,
  LevelBadge,
  Medal,
  StatTile,
  StreakPill,
  XpPill,
} from "@/components/student/gamification-ui";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useProfile } from "@/hooks/use-profile";
import { useI18n } from "@/i18n";
import { levelStateFor } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Flame,
  Gamepad2,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AssessmentCard, type StudentAssessmentRow } from "./AssessmentCard";

function todayKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toDateString();
}

function greetingKey(hour: number) {
  if (hour < 12) return "student.hero.morning";
  if (hour < 17) return "student.hero.afternoon";
  return "student.hero.evening";
}

export default function StudentDashboard() {
  const { t, pick, formatDate, formatNumber } = useI18n();
  const { profile } = useProfile();
  const data = useQuery(api.student.home, {});
  const game = useQuery(api.student.gamification, {});
  const reduce = useReducedMotion();

  const rows = useMemo(() => {
    if (!data) return [] as StudentAssessmentRow[];
    const all = [
      ...data.inProgress,
      ...data.quizzes,
      ...data.homework,
      ...data.upcoming,
      ...data.missed,
    ] as StudentAssessmentRow[];
    const seen = new Set<string>();
    return all.filter((row) => {
      if (seen.has(row.assessmentId)) return false;
      seen.add(row.assessmentId);
      return true;
    });
  }, [data]);

  /** Missions = whatever the student can actually act on right now. */
  const missions = useMemo(() => {
    const active = rows.filter((row) => row.status === "in_progress");
    const ready = rows
      .filter((row) => row.canStart && row.status === "available")
      .sort((a, b) => (a.closeAt ?? Infinity) - (b.closeAt ?? Infinity));
    const upcoming = rows.filter((row) => row.status === "upcoming");
    return [...active, ...ready, ...upcoming].slice(0, 3);
  }, [rows]);

  const nextDeadline = data?.calendar[0];
  const points = data?.student.points ?? profile?.points ?? 0;
  const streak = data?.student.streak ?? profile?.streak ?? 0;
  const level = levelStateFor(points);

  const earnedBadges = game?.achievements.filter((row) => row.earnedAt !== null) ?? [];
  const lockedBadges = game?.achievements.filter((row) => row.earnedAt === null) ?? [];
  const nextBadge = lockedBadges[0];

  const celebratedRecently = useMemo(() => {
    if (!data || data.recentResults.length === 0) return false;
    const latest = data.recentResults[0];
    if (typeof latest.submittedAt !== "number") return false;
    return Boolean(
      latest.passed && new Date(latest.submittedAt).toDateString() === todayKey(),
    );
  }, [data]);

  // Confetti is a one-time reward per result, not a loop on every visit.
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (!celebratedRecently) return;
    const attemptId = data?.recentResults[0]?.attemptId ?? "unknown";
    const key = `nq.celebrated.${attemptId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Private mode without storage: still show the single burst.
    }
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      setCelebrate(true);
      timer = window.setTimeout(() => setCelebrate(false), 4200);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [celebratedRecently, data]);

  if (data === undefined) return <LoadingBlock />;

  const firstName = (profile?.name ?? data.student.name ?? "").split(" ")[0];

  return (
    <div className="space-y-7">
      <Celebration show={celebrate} />

      {/* ------------------------------- Hero -------------------------------- */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="nq-hero nq-dots relative overflow-hidden rounded-[28px] p-5 text-white shadow-[0_34px_90px_-56px_rgb(17_28_61/0.95)] sm:p-7"
      >
        <span
          aria-hidden
          className="nq-aurora pointer-events-none absolute inset-0 opacity-45"
        />
        <span
          aria-hidden
          className="absolute -end-10 -top-16 size-56 rounded-full bg-nq-violet/30 blur-3xl animate-drift"
        />
        <span
          aria-hidden
          className="absolute -bottom-20 start-1/3 size-56 rounded-full bg-nq-turquoise/20 blur-3xl animate-drift [animation-delay:1.6s]"
        />

        <div className="relative grid gap-6 lg:grid-cols-[1.55fr_auto] lg:items-center">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-wide backdrop-blur">
              <span className="size-1.5 rounded-full bg-nq-turquoise" aria-hidden />
              {t("nq.level", { level: formatNumber(level.level) })}
            </span>
            <div className="mt-3 flex items-center gap-3">
              <StudentAvatar
                avatar={profile?.avatar}
                name={profile?.name ?? data.student.name}
                size="sm"
                className="ring-white/40"
              />
              <h1 className="text-[26px] leading-tight font-black tracking-tight sm:text-4xl">
                {t(greetingKey(new Date().getHours()), { name: firstName })}
              </h1>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
              {t("student.hero.line")}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <XpPill points={points} className="border-white/25 bg-white/12 text-white" />
              <StreakPill streak={streak} className="border-white/25 bg-white/12 text-white" />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold text-white/90">
                <Award className="size-3.5 text-nq-yellow" aria-hidden />
                {t("student.hero.badge_hint")} {formatNumber(earnedBadges.length)}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Button
                asChild
                size="lg"
                className="gap-2 border-0 bg-white text-nq-navy shadow-[0_14px_34px_-16px_rgb(0_0_0/0.7)] hover:bg-white hover:brightness-100"
              >
                <Link to={missions.length > 0 ? "/assessments" : "/games"}>
                  {missions.length > 0 ? t("student.hero.cta") : t("games.play")}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Link>
              </Button>
              {nextDeadline ? (
                <Link
                  to={`/assessments/${nextDeadline.assessmentId}`}
                  className="inline-flex max-w-full items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-white/85 backdrop-blur transition-colors hover:bg-white/16"
                >
                  <CalendarClock className="size-4 shrink-0" aria-hidden />
                  <span className="max-w-40 truncate">
                    {pick(nextDeadline.titleEn, nextDeadline.titleAr)}
                  </span>
                  <span className="shrink-0 text-white/55">
                    {formatDate(nextDeadline.dueAt, true)}
                  </span>
                </Link>
              ) : null}
            </div>

            <div className="mt-6 max-w-md">
              <div className="flex items-center justify-between text-[11px] font-semibold text-white/60">
                <span>{t("nq.momentum")}</span>
                <span>
                  {t("nq.level_next", {
                    points: formatNumber(level.remaining),
                    level: formatNumber(level.level + 1),
                  })}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/15">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-nq-turquoise via-nq-blue to-nq-yellow"
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${Math.max(level.progress, 4)}%` }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          </div>

          {/* Mascot + level medallion */}
          <div className="relative flex items-center justify-center gap-3 sm:gap-5 lg:justify-end">
            <span
              aria-hidden
              className="absolute inset-x-2 bottom-4 h-24 rounded-full bg-nq-blue/25 blur-2xl"
            />
            <Mascot
              size={168}
              mood={streak >= 3 ? "cheer" : "happy"}
              title={t("app.name")}
              className="relative drop-shadow-[0_24px_40px_rgb(8_14_38/0.55)]"
            />
            <div className="relative flex flex-col items-center gap-2">
              <LevelBadge
                points={points}
                level={level.level}
                progress={level.progress}
                size={112}
              />
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/85 backdrop-blur">
                {formatNumber(points)} {t("student.xp")}
              </span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ------------------------------ Stats -------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          label={t("student.points")}
          value={points}
          hint={t("nq.points_hint")}
          icon={Sparkles}
          tone="gold"
        />
        <StatTile
          index={1}
          label={t("student.streak")}
          value={streak}
          hint={streak > 0 ? t("student.streak_keep") : t("student.streak_none")}
          icon={Flame}
          tone="coral"
        />
        <StatTile
          index={2}
          label={t("student.average")}
          value={
            data.averagePercent === null
              ? "—"
              : `${formatNumber(Math.round(data.averagePercent))}%`
          }
          hint={t("nq.average")}
          icon={Target}
          tone="turquoise"
        />
        <StatTile
          index={3}
          label={t("student.completed")}
          value={data.counts.completed}
          hint={`${formatNumber(data.counts.available)} ${t("student.available")}`}
          icon={CheckCircle2}
          tone="blue"
        />
      </div>

      {/* ---------------------------- Missions ------------------------------- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-black tracking-tight">{t("student.missions")}</h2>
            <p className="text-sm text-muted-foreground">{t("student.missions_sub")}</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/assessments">
              {t("nav.assessments")}
              <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        </div>

        {missions.length === 0 ? (
          <EmptyState
            title={t("nq.clear")}
            icon={Sparkles}
            action={
              <Button asChild size="sm" variant="outline">
                <Link to="/results">{t("nav.results")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {missions.map((row, index) => (
              <AssessmentCard key={row.assessmentId} row={row} index={index} featured />
            ))}
          </div>
        )}
      </section>

      {/* -------------------- Challenges + rewards rail ---------------------- */}
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-black tracking-tight">{t("student.challenges")}</h2>
            <p className="text-sm text-muted-foreground">{t("student.challenges_sub")}</p>
          </div>
          {game === undefined ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="nq-card h-32 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ChallengeCard
                index={0}
                icon={Sparkles}
                title={t("challenges.daily")}
                description={t("challenges.daily_body")}
                current={game.challenges.daily.submitted}
                target={game.challenges.daily.target}
                rewardXp={game.challenges.daily.rewardXp}
              />
              <ChallengeCard
                index={1}
                icon={ClipboardList}
                title={t("challenges.weekly")}
                description={t("challenges.weekly_body")}
                current={game.challenges.weekly.submitted}
                target={game.challenges.weekly.target}
                rewardXp={game.challenges.weekly.rewardXp}
              />
              <ChallengeCard
                index={2}
                icon={Flame}
                title={t("challenges.streak")}
                description={t("challenges.streak_body")}
                current={game.challenges.streak.current}
                target={game.challenges.streak.target}
                rewardXp={game.challenges.streak.rewardXp}
              />
            </div>
          )}

          {/* Tasks centre */}
          <SectionCard
            title={t("student.tasks")}
            description={t("student.tasks_sub")}
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link to="/assessments">{t("common.all")}</Link>
              </Button>
            }
            className="mt-2"
          >
            {rows.length === 0 ? (
              <EmptyState title={t("student.tasks.empty")} icon={ClipboardList} />
            ) : (
              <ul className="divide-y divide-border/60">
                {rows
                  .slice()
                  .sort((a, b) => (a.closeAt ?? Infinity) - (b.closeAt ?? Infinity))
                  .slice(0, 6)
                  .map((row) => (
                    <li key={row.assessmentId}>
                      <Link
                        to={`/assessments/${row.assessmentId}`}
                        className="group flex flex-wrap items-center gap-3 py-3 transition-colors hover:text-primary"
                      >
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-xl",
                            row.kind === "homework"
                              ? "bg-nq-turquoise/15 text-[#0B7F76] dark:text-nq-turquoise"
                              : "bg-primary/10 text-primary",
                          )}
                          aria-hidden
                        >
                          {row.kind === "homework" ? (
                            <BookOpenCheck className="size-4" />
                          ) : (
                            <ClipboardList className="size-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">
                            {pick(row.titleEn, row.titleAr)}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {pick(row.subjectNameEn, row.subjectNameAr)} ·{" "}
                            {row.closeAt ? formatDate(row.closeAt, true) : t("common.none_yet")}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                          {t(`status.${row.status}`)}
                        </span>
                        <ArrowRight
                          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </SectionCard>
        </section>

        <aside className="space-y-4">
          {/* Next badge */}
          <div className="nq-card relative overflow-hidden p-5">
            <span
              aria-hidden
              className="absolute -end-8 -top-10 size-28 rounded-full bg-nq-yellow/25 blur-2xl"
            />
            <div className="relative flex items-center gap-2">
              <Trophy className="size-4 text-amber-500" aria-hidden />
              <h3 className="text-sm font-black">{t("student.hero.next_badge")}</h3>
            </div>
            {nextBadge ? (
              <div className="relative mt-3 flex items-center gap-3">
                <Medal
                  code={nextBadge.code}
                  icon={nextBadge.icon}
                  title={pick(nextBadge.titleEn, nextBadge.titleAr)}
                  description={pick(nextBadge.descriptionEn, nextBadge.descriptionAr)}
                  earned={false}
                  size="md"
                  className="w-24 shrink-0 border-0 bg-transparent p-0"
                />
                <div className="min-w-0">
                  <p className="text-xs leading-5 text-muted-foreground">
                    {pick(nextBadge.descriptionEn, nextBadge.descriptionAr)}
                  </p>
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-nq-yellow/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-nq-yellow">
                    +{formatNumber(nextBadge.points)} {t("student.xp")}
                  </p>
                </div>
              </div>
            ) : (
              <p className="relative mt-3 text-xs text-muted-foreground">
                {t("student.hero.no_badge")}
              </p>
            )}
            <Button asChild variant="outline" size="sm" className="relative mt-4 w-full justify-between">
              <Link to="/achievements">
                {t("achievements.title")}
                <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
              </Link>
            </Button>
          </div>

          {/* Average ring */}
          <div className="nq-card p-5 text-center">
            <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              {t("nq.average")}
            </p>
            <div className="mt-3 flex justify-center">
              <ProgressRing
                value={data.averagePercent ?? 0}
                size={124}
                stroke={10}
                label={t("nq.average")}
              >
                {data.averagePercent === null ? (
                  <span className="text-sm font-semibold text-muted-foreground">—</span>
                ) : (
                  <span className="flex flex-col items-center">
                    <span className="text-2xl font-black tabular-nums">
                      {formatNumber(Math.round(data.averagePercent))}%
                    </span>
                    <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                      {t("student.average")}
                    </span>
                  </span>
                )}
              </ProgressRing>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">{t("nq.xp_hint")}</p>
          </div>

          {/* Deadlines */}
          <SectionCard title={t("nq.deadlines")}>
            {data.calendar.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("nq.no_deadlines")}</p>
            ) : (
              <ul className="space-y-2">
                {data.calendar.slice(0, 4).map((item) => (
                  <li key={item.assessmentId}>
                    <LinkCard
                      to={`/assessments/${item.assessmentId}`}
                      title={pick(item.titleEn, item.titleAr)}
                      tone={t(`kind.${item.kind}`)}
                      meta={
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="size-3.5" aria-hidden />
                          {formatDate(item.dueAt, true)}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </aside>
      </div>

      {/* ---------------------------- Games band ----------------------------- */}
      <Reveal>
        <Link
          to="/games"
          className="nq-card nq-card-hover group relative flex flex-col gap-4 overflow-hidden p-5 sm:flex-row sm:items-center"
        >
          <span aria-hidden className="nq-aurora absolute inset-0 opacity-10" />
          <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-nq-turquoise to-nq-blue text-white shadow-[0_16px_30px_-18px_rgb(52_120_246/0.9)]">
            <Gamepad2 className="size-6" aria-hidden />
          </span>
          <div className="relative min-w-0 flex-1">
            <h3 className="text-base font-black">{t("student.games_cta")}</h3>
            <p className="text-sm text-muted-foreground">{t("student.games_cta_sub")}</p>
          </div>
          <span className="relative inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
            {t("games.play")}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden />
          </span>
        </Link>
      </Reveal>

      {/* ---------------------------- Achievements --------------------------- */}
      <SectionCard
        title={t("achievements.title")}
        description={
          game
            ? t("student.achievements_cta_sub", {
                earned: formatNumber(game.totals.earned),
                total: formatNumber(game.totals.available),
              })
            : undefined
        }
        actions={
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/achievements">
              {t("achievements.title")}
              <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        }
      >
        {game === undefined ? (
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="size-16 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : game.achievements.length === 0 ? (
          <EmptyState title={t("achievements.empty")} icon={Award} />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {game.achievements.slice(0, 6).map((badge) => (
              <Medal
                key={badge.code}
                code={badge.code}
                icon={badge.icon}
                title={pick(badge.titleEn, badge.titleAr)}
                description={pick(badge.descriptionEn, badge.descriptionAr)}
                earned={badge.earnedAt !== null}
                earnedAtLabel={
                  badge.earnedAt
                    ? t("achievements.earned_on", { date: formatDate(badge.earnedAt) })
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* -------------------------- Recent results --------------------------- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-black tracking-tight">
            {t("student.recent_results")}
          </h2>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/results">
              {t("nav.results")}
              <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        </div>

        {data.recentResults.length === 0 ? (
          <EmptyState title={t("student.no_results")} icon={Target} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.recentResults.map((result, index) => (
              <Reveal key={result.attemptId} delay={index * 0.06}>
                <Link
                  to={`/results/${result.attemptId}`}
                  className="nq-card nq-card-hover group flex items-center gap-4 p-4"
                >
                  <ProgressRing value={result.percentage} size={62} stroke={6}>
                    <span className="text-xs font-extrabold tabular-nums">
                      {formatNumber(Math.round(result.percentage))}%
                    </span>
                  </ProgressRing>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {pick(result.titleEn, result.titleAr)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {pick(result.subjectNameEn, result.subjectNameAr)}
                    </span>
                    <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold">
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5",
                          result.passed
                            ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {result.letter}
                      </span>
                      <span className="text-muted-foreground">
                        {t("nq.score")} {formatNumber(result.score)}/{formatNumber(result.maxScore)}
                      </span>
                    </span>
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                    aria-hidden
                  />
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {data.inProgress.length > 0 ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-24 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-nq-yellow/40 bg-nq-yellow/15 p-4 backdrop-blur-md lg:bottom-6"
        >
          <Sparkles className="size-5 shrink-0 text-amber-600 dark:text-nq-yellow" aria-hidden />
          <p className="min-w-0 flex-1 text-sm font-semibold">{t("student.in_progress")}</p>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/assessments">
              {t("nq.keep_going")}
              <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        </motion.div>
      ) : null}
    </div>
  );
}
