import {
  DataList,
  ErrorNotice,
  LoadingBlock,
  SectionCard,
  StatusBadge,
} from "@/components/app/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { describeError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  ListChecks,
  Loader2,
  Play,
  Timer,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

export default function StudentAssessmentDetail() {
  const { t, lang, pick, formatDate, formatNumber } = useI18n();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const start = useMutation(api.attempts.start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const data = useQuery(
    api.student.assessmentDetail,
    assessmentId ? { assessmentId: assessmentId as never } : "skip",
  );

  if (data === undefined) return <LoadingBlock />;
  if (data === null || !data) {
    return <ErrorNotice error={null} />;
  }

  const { assessment, state, attempts } = data;

  const handleStart = async () => {
    setBusy(true);
    setError(null);
    try {
      await start({ assessmentId: assessment._id });
      navigate(`/assessments/${assessment._id}/take`);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  const activeAttempt = attempts.find((a) => a.status === "in_progress");
  const best = attempts
    .filter((attempt) => attempt.releasedAt)
    .reduce<number | null>(
      (top, attempt) =>
        top === null || attempt.percentage > top ? attempt.percentage : top,
      null,
    );

  const facts = [
    {
      icon: Timer,
      label: t("assessment.duration"),
      value: `${formatNumber(assessment.durationMinutes)} ${t("common.min")}`,
    },
    {
      icon: ListChecks,
      label: t("assessment.questions_count", { count: assessment.questionCount }),
      value: assessment.questionTypes.map((type) => t(`qtype.${type}`)).join(" · "),
    },
    {
      icon: Trophy,
      label: t("assessment.marks_total"),
      value: `${formatNumber(assessment.maxScore)} ${t("common.marks")}`,
    },
    {
      icon: ClipboardList,
      label: t("assessment.attempts"),
      value: `${formatNumber(attempts.length)} / ${formatNumber(assessment.attemptsAllowed)}`,
    },
  ];

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ms-2 gap-1.5">
        <Link to="/assessments">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t("nav.assessments")}
        </Link>
      </Button>

      {/* ------------------------------ Briefing ------------------------------ */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="nq-card relative overflow-hidden p-5 sm:p-6"
      >
        <span aria-hidden className="nq-gradient absolute inset-x-0 top-0 h-1.5" />
        <span
          aria-hidden
          className="absolute -end-16 -top-16 size-44 rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="nq-gradient-soft inline-flex items-center gap-1.5 rounded-full border border-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary">
                {pick(assessment.subjectNameEn, assessment.subjectNameAr)}
              </span>
              <span className="chip">{t(`kind.${assessment.kind}`)}</span>
              <StatusBadge status={state.status} />
            </div>
            <h1 className="mt-3 text-xl leading-tight font-extrabold tracking-tight sm:text-2xl">
              {pick(assessment.titleEn, assessment.titleAr)}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("common.teacher")}: <span className="font-medium">{assessment.teacherName}</span>
              {assessment.closeAt ? (
                <>
                  {" · "}
                  {t("assessment.deadline")} {formatDate(assessment.closeAt, true)}
                </>
              ) : null}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {activeAttempt ? (
                <Button asChild size="lg" className="gap-2">
                  <Link to={`/assessments/${assessment._id}/take`}>
                    <Play className="size-4" aria-hidden />
                    {t("student.continue")}
                  </Link>
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="lg" className="gap-2" disabled={!state.canStart}>
                      <Play className="size-4" aria-hidden />
                      {t("student.start")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("assessment.start_confirm.title")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("assessment.start_confirm.body", {
                          minutes: assessment.durationMinutes,
                        })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleStart} disabled={busy}>
                        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                        {t("assessment.start_confirm.button")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {best !== null ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Trophy className="size-3.5" aria-hidden />
                  {t("student.best")} {formatNumber(Math.round(best))}%
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid w-full shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-4 lg:w-[360px] lg:grid-cols-2">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-2xl border border-border/70 bg-secondary/40 p-3"
              >
                <fact.icon className="size-3.5 text-primary" aria-hidden />
                <p className="mt-1.5 text-sm font-bold">{fact.value}</p>
                <p className="truncate text-[10px] font-medium text-muted-foreground">
                  {fact.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {error ? <ErrorNotice error={error} /> : null}

      {!state.canStart && state.status !== "in_progress" ? (
        <div className="flex items-start gap-2 rounded-2xl border border-nq-yellow/40 bg-nq-yellow/10 p-4 text-sm">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-nq-yellow"
            aria-hidden
          />
          <div>
            <p className="font-semibold">{t("assessment.cannot_start")}</p>
            <p className="mt-0.5 text-muted-foreground">
              {pick(state.reasonEn, state.reasonAr)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard title={t("assessment.instructions")}>
          <p className="text-sm leading-7 whitespace-pre-line text-muted-foreground">
            {pick(assessment.instructionsEn ?? "", assessment.instructionsAr ?? "") ||
              t("common.none_yet")}
          </p>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-primary/5 p-3 text-xs text-muted-foreground">
            <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            {t("nq.focus_hint")}
          </div>
        </SectionCard>

        <SectionCard title={t("assessment.details.title")}>
          <DataList
            items={[
              {
                label: t("assessment.deadline"),
                value: assessment.closeAt ? formatDate(assessment.closeAt, true) : "—",
              },
              {
                label: t("common.opens"),
                value: assessment.openAt ? formatDate(assessment.openAt, true) : "—",
              },
              {
                label: t("assessment.pass_threshold"),
                value: `${assessment.passThreshold}%`,
              },
              {
                label: t("assessment.release_policy"),
                value: t(`assessment.release.${assessment.releasePolicy}`),
              },
              {
                label: t("assessment.answers_visible"),
                value: assessment.showAnswersToStudents
                  ? t("assessment.answers_visible.yes")
                  : t("assessment.answers_visible.no"),
              },
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard title={t("assessment.attempts")}>
        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("common.none_yet")}</p>
        ) : (
          <ul className="space-y-2">
            {attempts.map((attempt) => (
              <li
                key={attempt.attemptId}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3 text-sm transition-colors hover:bg-secondary/60",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-card text-xs font-bold">
                    {formatNumber(attempt.attemptNumber)}
                  </span>
                  <div className="min-w-0">
                    <StatusBadge status={attempt.status} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {attempt.status === "in_progress"
                        ? "—"
                        : `${formatNumber(attempt.score)}/${formatNumber(attempt.maxScore)} (${formatNumber(Math.round(attempt.percentage))}%)`}
                      {" · "}
                      {formatDate(attempt.submittedAt ?? undefined, true)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {attempt.status === "in_progress" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/assessments/${assessment._id}/take`}>
                        {t("student.continue")}
                      </Link>
                    </Button>
                  ) : null}
                  {attempt.releasedAt ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/results/${attempt.attemptId}`}>{t("results.title")}</Link>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("results.not_released")}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {error ? (
        <p className="text-sm text-destructive">{describeError(error, t, lang)}</p>
      ) : null}
    </div>
  );
}
