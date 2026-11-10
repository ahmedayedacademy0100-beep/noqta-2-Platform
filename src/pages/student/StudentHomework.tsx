import { EmptyState, LoadingBlock, PageHeader, Reveal } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquareQuote,
  Play,
  Timer,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import type { StudentAssessmentRow } from "./AssessmentCard";

type Group = {
  id: "overdue" | "todo" | "submitted" | "graded";
  title: string;
  hint: string;
  tone: string;
  icon: typeof Clock;
  rows: StudentAssessmentRow[];
};

export default function StudentHomework() {
  const { t, pick, formatDate, formatNumber } = useI18n();
  const data = useQuery(api.student.home, {});

  const rows = useMemo(
    () => ((data?.homework ?? []) as StudentAssessmentRow[]).slice(),
    [data],
  );

  if (data === undefined) return <LoadingBlock />;

  const overdue = rows.filter((row) => row.status === "missed");
  const graded = rows.filter(
    (row) => row.status === "completed" && row.releasedAttemptId,
  );
  const submitted = rows.filter(
    (row) => row.status === "completed" && !row.releasedAttemptId,
  );
  const todo = rows.filter(
    (row) =>
      row.status !== "missed" && row.status !== "completed",
  );

  const groups: Group[] = [
    {
      id: "todo",
      title: t("homework.pending"),
      hint: pick("Still open for submission.", "ما زالت مفتوحة للتسليم."),
      tone: "from-nq-blue to-nq-violet",
      icon: Clock,
      rows: todo,
    },
    {
      id: "overdue",
      title: t("homework.overdue"),
      hint: pick(
        "Deadline passed before a submission was recorded.",
        "انتهى الموعد قبل تسجيل تسليم.",
      ),
      tone: "from-nq-coral to-[#E2554B]",
      icon: TriangleAlert,
      rows: overdue,
    },
    {
      id: "submitted",
      title: t("homework.submitted"),
      hint: t("homework.waiting_note"),
      tone: "from-nq-turquoise to-[#12A79B]",
      icon: CheckCircle2,
      rows: submitted,
    },
    {
      id: "graded",
      title: t("homework.graded"),
      hint: t("homework.graded_note"),
      tone: "from-emerald-400 to-teal-500",
      icon: MessageSquareQuote,
      rows: graded,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("nav.homework")}
        title={t("homework.title")}
        subtitle={t("homework.subtitle")}
        actions={
          <span className="chip gap-1.5">
            <BookOpenCheck className="size-3.5 text-primary" aria-hidden />
            {formatNumber(rows.length)}
          </span>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title={t("homework.empty")}
          body={pick(
            "When a teacher assigns homework it will appear here with its deadline.",
            "عندما يسند المعلم واجباً سيظهر هنا مع موعده النهائي.",
          )}
          icon={BookOpenCheck}
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/assessments">{t("nav.assessments")}</Link>
            </Button>
          }
        />
      ) : (
        groups
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <section key={group.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-xl bg-gradient-to-br text-white",
                    group.tone,
                  )}
                >
                  <group.icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-black tracking-tight">
                    {group.title}
                    <span className="ms-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                      {formatNumber(group.rows.length)}
                    </span>
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">{group.hint}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {group.rows.map((row, index) => (
                  <Reveal key={row.assessmentId} delay={index * 0.04}>
                    <article className="nq-card nq-card-hover flex h-full flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-sm leading-6 font-bold">
                            {pick(row.titleEn, row.titleAr)}
                          </h3>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <UserRound className="size-3" aria-hidden />
                              {row.teacherName}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <BookOpenCheck className="size-3" aria-hidden />
                              {pick(row.subjectNameEn, row.subjectNameAr)}
                            </span>
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
                            group.id === "graded"
                              ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                              : group.id === "overdue"
                                ? "bg-destructive/10 text-destructive"
                                : group.id === "submitted"
                                  ? "bg-nq-turquoise/15 text-[#0B7F76] dark:text-nq-turquoise"
                                  : "bg-primary/10 text-primary",
                          )}
                        >
                          {group.title}
                        </span>
                      </div>

                      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        {row.closeAt ? (
                          <div className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3" aria-hidden />
                            {formatDate(row.closeAt, true)}
                          </div>
                        ) : null}
                        <div className="inline-flex items-center gap-1">
                          <Timer className="size-3" aria-hidden />
                          {formatNumber(row.durationMinutes)} {t("common.min")}
                        </div>
                        <div className="inline-flex items-center gap-1">
                          <FileText className="size-3" aria-hidden />
                          {formatNumber(row.maxScore)} {t("common.marks")}
                        </div>
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
                              {t("homework.submit_now")}
                            </Link>
                          </Button>
                        ) : null}
                        {row.releasedAttemptId ? (
                          <Button asChild size="sm" className="gap-1.5">
                            <Link to={`/results/${row.releasedAttemptId}`}>
                              {t("homework.view_feedback")}
                              <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
                            </Link>
                          </Button>
                        ) : null}
                        <Button asChild size="sm" variant="ghost" className="ms-auto">
                          <Link to={`/assessments/${row.assessmentId}`}>
                            {t("student.details")}
                          </Link>
                        </Button>
                      </div>
                    </article>
                  </Reveal>
                ))}
              </div>
            </section>
          ))
      )}

      <p className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-[11px] leading-5 text-muted-foreground">
        <FileText className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
        {t("homework.no_attachments")}
      </p>
    </div>
  );
}
