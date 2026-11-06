import {
  Celebration,
  CountUp,
  EmptyState,
  LinkCard,
  LoadingBlock,
  Meter,
  ProgressRing,
  Reveal,
  SectionCard,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useProfile } from "@/hooks/use-profile";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Award,
  BellRing,
  BookOpenCheck,
  CalendarClock,
  ClipboardList,
  Flame,
  Play,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AssessmentCard, type StudentAssessmentRow } from "./AssessmentCard";

const LEVEL_STEP = 250;

const SUBJECT_TINTS = [
  { from: "#4169FF", to: "#8B5CF6" },
  { from: "#22D3EE", to: "#4169FF" },
  { from: "#8B5CF6", to: "#FF7A70" },
  { from: "#FACC15", to: "#FF7A70" },
  { from: "#22D3EE", to: "#8B5CF6" },
];

function todayKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toDateString();
}

export default function StudentDashboard() {
  const { t, pick, formatDate, formatNumber } = useI18n();
  const { profile } = useProfile();
  const data = useQuery(api.student.home, {});
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

  const subjects = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        nameEn: string;
        nameAr: string;
        total: number;
        open: number;
        average: number | null;
      }
    >();
    for (const row of rows) {
      const key = row.subjectNameEn;
      const existing = map.get(key);
      const average =
        data?.subjectProgress.find((s) => s.nameEn === row.subjectNameEn)
          ?.averagePercent ?? null;
      if (existing) {
        existing.total += 1;
        if (row.canStart) existing.open += 1;
      } else {
        map.set(key, {
          id: key,
          nameEn: row.subjectNameEn,
          nameAr: row.subjectNameAr,
          total: 1,
          open: row.canStart ? 1 : 0,
          average,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows, data]);

  const focus = useMemo(() => {
    const active = rows.filter((row) => row.status === "in_progress");
    const ready = rows.filter((row) => row.canStart && row.status === "available");
    return [...active, ...ready].slice(0, 4);
  }, [rows]);

  const nextDeadline = data?.calendar[0];

  const points = data?.student.points ?? profile?.points ?? 0;
  const streak = data?.student.streak ?? profile?.streak ?? 0;
  const level = Math.floor(points / LEVEL_STEP) + 1;
  const pointsIntoLevel = points % LEVEL_STEP;
  const levelProgress = (pointsIntoLevel / LEVEL_STEP) * 100;

  const celebratedRecently = useMemo(() => {
    if (!data || data.recentResults.length === 0) return false;
    const latest = data.recentResults[0];
    if (typeof latest.submittedAt !== "number") return false;
    return Boolean(
      latest.passed &&
        new Date(latest.submittedAt).toDateString() === todayKey(),
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
    setCelebrate(true);
    const timer = window.setTimeout(() => setCelebrate(false), 4200);
    return () => window.clearTimeout(timer);
  }, [celebratedRecently, data]);

  if (data === undefined) return <LoadingBlock />;

  const firstName = (profile?.name ?? "").split(" ")[0] || profile?.name || "";

  return (
    <div className="space-y-7">
      <Celebration show={celebrate} />

      {/* ------------------------------ Hero ------------------------------- */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="nq-hero nq-dots relative overflow-hidden rounded-3xl p-6 text-white shadow-[0_30px_80px_-50px_rgb(65_105_255/0.9)] sm:p-8"
      >
        {/* Brand decorations: the turquoise dot and the small yellow star. */}
        <span
          aria-hidden
          className="absolute -end-10 -top-12 size-44 rounded-full bg-nq-violet/35 blur-3xl animate-drift"
        />
        <span
          aria-hidden
          className="absolute -bottom-16 start-1/4 size-52 rounded-full bg-nq-turquoise/25 blur-3xl animate-drift [animation-delay:1.4s]"
        />
        <Sparkles
          aria-hidden
          className="absolute end-10 top-8 size-5 text-nq-yellow/90 animate-twinkle"
        />
        <span
          aria-hidden
          className="absolute end-24 bottom-12 size-2.5 rounded-full bg-nq-turquoise shadow-[0_0_18px_4px_rgb(34_211_238/0.5)]"
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase backdrop-blur">
              <span className="size-1.5 rounded-full bg-nq-turquoise" aria-hidden />
              {t("nq.level", { level: formatNumber(level) })}
            </div>
            <h1 className="mt-3 text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl">
              {t("student.greeting", { name: firstName })}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-white/70">
              {t("student.subtitle")}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Button
                asChild
                size="lg"
                className="gap-2 border-0 bg-white text-nq-navy shadow-[0_10px_30px_-12px_rgb(0_0_0/0.6)] hover:bg-white hover:brightness-100"
              >
                <Link to="/assessments">
                  {focus.length > 0 ? t("nq.jump_in") : t("nq.browse")}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Link>
              </Button>
              {nextDeadline ? (
                <Link
                  to={`/assessments/${nextDeadline.assessmentId}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-white/85 backdrop-blur transition-colors hover:bg-white/16"
                >
                  <CalendarClock className="size-4" aria-hidden />
                  <span className="max-w-44 truncate">
                    {pick(nextDeadline.titleEn, nextDeadline.titleAr)}
                  </span>
                  <span className="text-white/55">
                    {formatDate(nextDeadline.dueAt, true)}
                  </span>
                </Link>
              ) : null}
            </div>

            <div className="mt-6 max-w-sm">
              <div className="flex items-center justify-between text-[11px] font-medium text-white/60">
                <span>{t("nq.momentum")}</span>
                <span>
                  {t("nq.level_next", {
                    points: formatNumber(LEVEL_STEP - pointsIntoLevel),
                    level: formatNumber(level + 1),
                  })}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-nq-turquoise via-nq-blue to-nq-violet"
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${Math.max(levelProgress, 4)}%` }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          </div>

          {/* Points / streak / average: real numbers, counted up. */}
          <div className="grid shrink-0 grid-cols-3 gap-2.5 sm:gap-3 lg:w-[330px]">
            {[
              {
                icon: Sparkles,
                label: t("student.points"),
                value: points,
                hint: t("nq.points_hint"),
                tint: "text-nq-yellow",
              },
              {
                icon: Flame,
                label: t("student.streak"),
                value: streak,
                hint: t("nq.streak_hint"),
                tint: "text-nq-coral",
              },
              {
                icon: Target,
                label: t("student.average"),
                value:
                  data.averagePercent === null
                    ? null
                    : Math.round(data.averagePercent),
                hint: t("nq.average"),
                tint: "text-nq-turquoise",
                suffix: "%",
              },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + index * 0.08 }}
                className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md"
              >
                <stat.icon className={cn("size-4", stat.tint)} aria-hidden />
                <p className="mt-2 text-lg font-extrabold tabular-nums sm:text-xl">
                  {stat.value === null ? (
                    "—"
                  ) : (
                    <CountUp
                      value={stat.value}
                      format={(n) =>
                        `${formatNumber(Math.round(n))}${stat.suffix ?? ""}`
                      }
                    />
                  )}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-white/60">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* --------------------------- Today's focus -------------------------- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">{t("nq.today")}</h2>
            <p className="text-sm text-muted-foreground">{t("nq.today_sub")}</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/assessments">
              {t("nav.assessments")}
              <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        </div>

        {focus.length === 0 ? (
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
          <div className="grid gap-3 md:grid-cols-2">
            {focus.map((row, index) => (
              <AssessmentCard key={row.assessmentId} row={row} index={index} featured />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------- Subjects + column ------------------------ */}
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">{t("nq.subjects")}</h2>
              <p className="text-sm text-muted-foreground">{t("nq.subjects_sub")}</p>
            </div>
            {subjects.length === 0 ? (
              <EmptyState title={t("student.no_quiz")} icon={BookOpenCheck} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {subjects.map((subject, index) => {
                  const tint = SUBJECT_TINTS[index % SUBJECT_TINTS.length];
                  return (
                    <Reveal key={subject.id} delay={index * 0.05}>
                      <Link
                        to="/assessments"
                        className="nq-card nq-card-hover nq-sheen group flex h-full items-center gap-4 p-4"
                      >
                        <span
                          className="grid size-12 shrink-0 place-items-center rounded-2xl text-white shadow-[0_10px_22px_-14px_rgb(23_27_56/0.9)] transition-transform duration-300 group-hover:scale-105"
                          style={{
                            backgroundImage: `linear-gradient(135deg, ${tint.from}, ${tint.to})`,
                          }}
                        >
                          <BookOpenCheck className="size-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">
                            {pick(subject.nameEn, subject.nameAr)}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {t("nq.activities", {
                              count: formatNumber(subject.total),
                            })}
                          </span>
                          {subject.average !== null ? (
                            <span className="mt-2 block">
                              <Meter value={subject.average} />
                            </span>
                          ) : null}
                        </span>
                        <ArrowRight
                          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:text-primary rtl:rotate-180"
                          aria-hidden
                        />
                      </Link>
                    </Reveal>
                  );
                })}
              </div>
            )}
          </section>

          <SectionCard title={t("student.practice_quizzes")}>
            {data.quizzes.length === 0 ? (
              <EmptyState title={t("student.no_quiz")} icon={BookOpenCheck} />
            ) : (
              <div className="grid gap-3">
                {data.quizzes.slice(0, 4).map((row, index) => (
                  <AssessmentCard key={row.assessmentId} row={row} index={index} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={t("student.homework")}>
            {data.homework.length === 0 ? (
              <EmptyState title={t("student.no_homework")} icon={ClipboardList} />
            ) : (
              <div className="grid gap-3">
                {data.homework.slice(0, 4).map((row, index) => (
                  <AssessmentCard key={row.assessmentId} row={row} index={index} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <aside className="space-y-6">
          {/* Average ring */}
          <div className="nq-card overflow-hidden p-5 text-center">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("nq.average")}
            </p>
            <div className="mt-4 flex justify-center">
              <ProgressRing
                value={data.averagePercent ?? 0}
                size={132}
                stroke={10}
                label={t("nq.average")}
              >
                {data.averagePercent === null ? (
                  <span className="text-sm font-semibold text-muted-foreground">—</span>
                ) : (
                  <span className="flex flex-col items-center">
                    <span className="text-2xl font-extrabold tabular-nums">
                      <CountUp
                        value={Math.round(data.averagePercent)}
                        format={(n) => `${formatNumber(Math.round(n))}%`}
                      />
                    </span>
                    <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                      {t("student.average")}
                    </span>
                  </span>
                )}
              </ProgressRing>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 text-start">
              <div className="rounded-xl bg-secondary/60 p-2.5">
                <p className="text-[10px] font-medium text-muted-foreground">
                  {t("student.completed")}
                </p>
                <p className="text-base font-bold">{formatNumber(data.counts.completed)}</p>
              </div>
              <div className="rounded-xl bg-secondary/60 p-2.5">
                <p className="text-[10px] font-medium text-muted-foreground">
                  {t("student.missed")}
                </p>
                <p className="text-base font-bold">{formatNumber(data.counts.missed)}</p>
              </div>
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

          {/* Achievements */}
          <div className="nq-card relative overflow-hidden p-5">
            <span
              aria-hidden
              className="absolute -end-6 -top-6 size-24 rounded-full bg-nq-yellow/20 blur-2xl"
            />
            <div className="relative flex items-center gap-2">
              <Trophy className="size-4 text-nq-yellow" aria-hidden />
              <h3 className="text-sm font-bold">{t("nq.achievements")}</h3>
            </div>
            <p className="relative mt-1 text-xs text-muted-foreground">
              {t("nq.achievements_sub")}
            </p>
            {data.badges.length === 0 ? (
              <p className="relative mt-4 rounded-xl border border-dashed border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
                {t("student.no_badges")}
              </p>
            ) : (
              <ul className="relative mt-4 flex flex-wrap gap-2">
                {data.badges.map((badge) => (
                  <li
                    key={badge.code}
                    title={pick(badge.descriptionEn, badge.descriptionAr)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-nq-yellow/40 bg-nq-yellow/12 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-nq-yellow"
                  >
                    <Award className="size-3.5" aria-hidden />
                    {pick(badge.titleEn, badge.titleAr)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data.counts.unreadNotifications > 0 ? (
            <Link
              to="/notifications"
              className="nq-card nq-card-hover flex items-center gap-3 p-4"
            >
              <span className="relative grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <BellRing className="size-5" aria-hidden />
                <span className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full bg-nq-coral ring-2 ring-card" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{t("notifications.title")}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("notifications.unread", {
                    count: formatNumber(data.counts.unreadNotifications),
                  })}
                </span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden />
            </Link>
          ) : null}
        </aside>
      </div>

      {/* -------------------------- Recent results -------------------------- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-extrabold tracking-tight">
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                        {t("nq.score")} {result.score}/{result.maxScore}
                      </span>
                    </span>
                  </span>
                  <Play
                    className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:scale-110 rtl:rotate-180"
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
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-nq-yellow/35 bg-nq-yellow/10 p-4"
        >
          <Zap className="size-5 shrink-0 text-amber-600 dark:text-nq-yellow" aria-hidden />
          <p className="min-w-0 flex-1 text-sm font-medium">
            {t("student.in_progress")}
          </p>
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
