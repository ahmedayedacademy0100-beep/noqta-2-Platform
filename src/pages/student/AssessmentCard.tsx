import { KindBadge, ProgressRing, StatusBadge } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarClock, ListChecks, Play, Timer } from "lucide-react";
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
const TINTS = [
  ["#4169FF", "#8B5CF6"],
  ["#22D3EE", "#4169FF"],
  ["#8B5CF6", "#FF7A70"],
  ["#FACC15", "#FF7A70"],
  ["#22D3EE", "#8B5CF6"],
];

function tintFor(key: string) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 9973;
  }
  return TINTS[hash % TINTS.length];
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
  const { t, pick, formatDate, formatNumber } = useI18n();
  const reduce = useReducedMotion();
  const title = pick(row.titleEn, row.titleAr);
  const [from, to] = tintFor(row.subjectNameEn);
  const urgent = row.status === "in_progress" || row.canStart;
  const hasScore =
    row.bestPercentage !== null && row.bestPercentage !== undefined;

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.05, 0.25) }}
      className={cn(
        "nq-card nq-card-hover nq-sheen group relative flex flex-col gap-3 overflow-hidden p-4",
        featured && "ring-1 ring-primary/25",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundImage: `linear-gradient(90deg, ${from}, ${to})` }}
      />

      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindBadge kind={row.kind} />
            <StatusBadge status={row.status} />
          </div>
          <h3 className="mt-2 truncate text-sm font-bold tracking-tight">{title}</h3>
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
        ) : null}
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
          <div className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5" aria-hidden />
            {t("common.due")} {formatDate(row.closeAt, true)}
          </div>
        ) : null}
      </dl>

      <p className="text-xs leading-5 text-muted-foreground">
        {pick(row.statusReasonEn, row.statusReasonAr)}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {row.activeAttemptId ? (
          <Button asChild size="sm" className="gap-1.5">
            <Link to={`/assessments/${row.assessmentId}/take`}>
              <Play className="size-3.5" aria-hidden />
              {t("student.continue")}
            </Link>
          </Button>
        ) : row.canStart ? (
          <Button asChild size="sm" className="gap-1.5">
            <Link to={`/assessments/${row.assessmentId}`}>
              <Play className="size-3.5" aria-hidden />
              {t("student.start")}
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
          className="absolute -end-8 -bottom-8 size-20 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
          style={{ background: `radial-gradient(circle, ${to}, transparent 70%)` }}
        />
      ) : null}
    </motion.article>
  );
}
