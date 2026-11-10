import { KindBadge, ProgressRing, StatusBadge } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  Clock,
  ListChecks,
  Play,
  RotateCw,
  Timer,
  Trophy,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

export type StudentAssessmentRow = {
  assessmentId: string;
  titleEn: string;
  titleAr: string;
  kind: string;
  subjectNameEn: string;
  subjectNameAr: string;
  teacherName: string;
  durationMinutes: number;
  maxScore: number;
  attemptsAllowed: number;
  attemptsUsed: number;
  openAt?: number | null;
  closeAt?: number | null;
  status: string;
  statusReasonEn: string;
  statusReasonAr: string;
  canStart: boolean;
  activeAttemptId?: string | null;
  bestPercentage?: number | null;
  releasedAttemptId?: string | null;
};

/** Stable subject accent so the same subject always keeps the same colour. */
const TINTS: [string, string][] = [
  ["#3478F6", "#7957E8"],
  ["#34D6C8", "#3478F6"],
  ["#7957E8", "#FF7A70"],
  ["#FFC94A", "#FF9F45"],
  ["#34D6C8", "#7957E8"],
];

function tintFor(key: string): [string, string] {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 9973;
  }
  return TINTS[hash % TINTS.length];
}

/** Coarse, low-frequency countdown — one tick a minute is plenty. */
function useTimeLeft(target?: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [target]);
  if (!target) return null;
  return target - now;
}

function humanizeLeft(ms: number, lang: "en" | "ar") {
  const minutes = Math.floor(Math.abs(ms) / 60000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  if (lang === "ar") {
    if (days > 0) return `${days} يوم ${hours > 0 ? `و${hours} ساعة` : ""}`.trim();
    if (hours > 0) return `${hours} ساعة ${mins > 0 ? `و${mins} دقيقة` : ""}`.trim();
    return `${Math.max(1, mins)} دقيقة`;
  }
  if (days > 0) return `${days}d ${hours > 0 ? `${hours}h` : ""}`.trim();
  if (hours > 0) return `${hours}h ${mins > 0 ? `${mins}m` : ""}`.trim();
  return `${Math.max(1, mins)}m`;
}

export function AssessmentCard({
  row,
  index = 0,
  featured = false,
}: {
  row: StudentAssessmentRow;
  index?: number;
  featured?: boolean;
}) {
  const { t, lang, pick, formatDate, formatNumber } = useI18n();
  const reduce = useReducedMotion();
  const title = pick(row.titleEn, row.titleAr);
  const [from, to] = tintFor(row.subjectNameEn);
  const left = useTimeLeft(row.closeAt);
  const hasScore = row.bestPercentage !== null && row.bestPercentage !== undefined;
  const urgent = row.status === "in_progress" || row.canStart;
  const overdue =
    row.status === "missed" ||
    (typeof left === "number" && left < 0 && row.status !== "completed");

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay: Math.min(index * 0.05, 0.25) }}
      className={cn(
        "nq-card nq-card-hover group relative flex flex-col gap-3 overflow-hidden p-4",
        featured && "ring-1 ring-primary/25",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ backgroundImage: `linear-gradient(90deg, ${from}, ${to})` }}
      />

      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindBadge kind={row.kind} />
            <StatusBadge status={row.status} />
            {overdue ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                <Clock className="size-3" aria-hidden />
                {t("homework.overdue")}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 line-clamp-2 text-sm leading-6 font-bold tracking-tight">
            {title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            <span
              className="me-1.5 inline-block size-1.5 rounded-full align-middle"
              style={{ background: from }}
              aria-hidden
            />
            {pick(row.subjectNameEn, row.subjectNameAr)} · {row.teacherName}
          </p>
        </div>
        {hasScore ? (
          <ProgressRing
            value={row.bestPercentage ?? 0}
            size={56}
            stroke={5}
            label={t("student.best")}
            className="text-muted-foreground"
          >
            <span className="text-[11px] font-extrabold tabular-nums">
              {formatNumber(Math.round(row.bestPercentage ?? 0))}%
            </span>
          </ProgressRing>
        ) : (
          <span
            className="grid size-11 shrink-0 place-items-center rounded-2xl text-white"
            style={{ backgroundImage: `linear-gradient(140deg, ${from}, ${to})` }}
            aria-hidden
          >
            {row.kind === "homework" ? (
              <ListChecks className="size-5" />
            ) : (
              <Trophy className="size-5" />
            )}
          </span>
        )}
      </div>

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-1.5">
          <Timer className="size-3.5" aria-hidden />
          {formatNumber(row.durationMinutes)} {t("common.min")}
        </div>
        <div className="inline-flex items-center gap-1.5">
          <ListChecks className="size-3.5" aria-hidden />
          {formatNumber(row.maxScore)} {t("common.marks")}
        </div>
        {row.closeAt ? (
          <div
            className={cn(
              "inline-flex items-center gap-1.5",
              overdue && "font-semibold text-destructive",
            )}
          >
            <CalendarClock className="size-3.5" aria-hidden />
            {formatDate(row.closeAt, true)}
          </div>
        ) : null}
      </dl>

      {left !== null && (row.canStart || row.status === "upcoming") ? (
        <p
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
            left < 0
              ? "bg-destructive/10 text-destructive"
              : left < 24 * 60 * 60 * 1000
                ? "bg-nq-coral/12 text-[#C2410C] dark:text-[#FFB4AC]"
                : "bg-nq-turquoise/12 text-[#0B7F76] dark:text-nq-turquoise",
          )}
        >
          <Clock className="size-3" aria-hidden />
          {left < 0
            ? t("student.deadline_passed")
            : t("student.deadline_left", { time: humanizeLeft(left, lang) })}
        </p>
      ) : null}

      <p className="text-xs leading-5 text-muted-foreground">
        {pick(row.statusReasonEn, row.statusReasonAr)}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {row.activeAttemptId ? (
          <Button asChild size="sm" className="group/cta gap-1.5 shadow-sm">
            <Link to={`/assessments/${row.assessmentId}/take`}>
              <RotateCw className="size-3.5" aria-hidden />
              {t("student.continue")}
              <ArrowRight className="size-3.5 transition-transform group-hover/cta:translate-x-0.5 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        ) : row.canStart ? (
          <Button asChild size="sm" className="group/cta gap-1.5 shadow-sm">
            <Link to={`/assessments/${row.assessmentId}`}>
              <Play className="size-3.5" aria-hidden />
              {row.kind === "homework" ? t("homework.submit_now") : t("student.start")}
              <ArrowRight className="size-3.5 transition-transform group-hover/cta:translate-x-0.5 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        ) : null}
        {row.releasedAttemptId ? (
          <Button asChild size="sm" variant="outline">
            <Link to={`/results/${row.releasedAttemptId}`}>{t("student.review")}</Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="ghost" className="ms-auto">
          <Link to={`/assessments/${row.assessmentId}`}>{t("student.details")}</Link>
        </Button>
      </div>

      {urgent ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -end-8 -bottom-8 size-20 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
          style={{ background: `radial-gradient(circle, ${to}, transparent 70%)` }}
        />
      ) : null}
    </motion.article>
  );
}
