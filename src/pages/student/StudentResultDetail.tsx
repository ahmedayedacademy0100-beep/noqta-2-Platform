import {
  Celebration,
  CountUp,
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  Meter,
  ProgressRing,
  Reveal,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { correctAnswerParts, storedAnswerText } from "@/lib/answers";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Info,
  Printer,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

export default function StudentResultDetail() {
  const { t, pick, lang, formatDate, formatNumber } = useI18n();
  const { attemptId } = useParams<{ attemptId: string }>();
  const reduce = useReducedMotion();
  const data = useQuery(
    api.student.resultDetail,
    attemptId ? { attemptId: attemptId as never } : "skip",
  );
  const [celebrate, setCelebrate] = useState(false);

  const passed = Boolean(data && data.released && data.attempt.passed);
  useEffect(() => {
    if (!passed || !attemptId) return;
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
  }, [passed, attemptId]);

  if (data === undefined) return <LoadingBlock />;
  if (!data) return <ErrorNotice error={null} />;

  const { attempt, assessment, answerCounts } = data;
  const title = pick(assessment.titleEn, assessment.titleAr);

  return (
    <div className="space-y-6">
      <Celebration show={celebrate} />

      <Button variant="ghost" size="sm" asChild className="-ms-2 gap-1.5 no-print">
        <Link to="/results">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t("results.title")}
        </Link>
      </Button>

      {/* --------------------------- Score hero --------------------------- */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="nq-card relative overflow-hidden p-5 sm:p-7"
      >
        <span aria-hidden className="nq-gradient absolute inset-x-0 top-0 h-1.5" />
        <span
          aria-hidden
          className={cn(
            "absolute -end-14 -top-16 size-44 rounded-full blur-3xl",
            attempt.passed ? "bg-emerald-500/15" : "bg-nq-coral/15",
          )}
        />

        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <ProgressRing
            value={attempt.percentage}
            size={136}
            stroke={11}
            label={`${Math.round(attempt.percentage)}%`}
          >
            <span className="flex flex-col items-center">
              <span className="text-2xl font-extrabold tabular-nums">
                <CountUp
                  value={Math.round(attempt.percentage)}
                  format={(n) => `${formatNumber(Math.round(n))}%`}
                />
              </span>
              <span className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                {t("results.percentage")}
              </span>
            </span>
          </ProgressRing>

          <div className="min-w-0 flex-1 text-center sm:text-start">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="chip">{t(`kind.${assessment.kind}`)}</span>
              <StatusBadge status={attempt.status} />
              {data.released ? (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    attempt.passed
                      ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                      : "bg-destructive/10 text-destructive",
                  )}
                >
                  {attempt.passed ? t("results.pass") : t("results.fail")}
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-xl leading-tight font-extrabold tracking-tight sm:text-2xl">
              {title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("take.attempt_of", { n: attempt.attemptNumber })} ·{" "}
              {formatDate(attempt.submittedAt ?? undefined, true)}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="rounded-xl border border-border/70 bg-secondary/50 px-3 py-1.5 text-xs font-semibold">
                {t("results.score")}: {formatNumber(attempt.score)} /{" "}
                {formatNumber(attempt.maxScore)}
              </span>
              <span className="rounded-xl border border-border/70 bg-secondary/50 px-3 py-1.5 text-xs font-semibold">
                {t("assessment.pass_threshold")}: {formatNumber(assessment.passThreshold)}%
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 no-print"
                onClick={() => window.print()}
              >
                <Printer className="size-4" aria-hidden />
                {t("common.print")}
              </Button>
            </div>
          </div>
        </div>
      </motion.section>

      {!data.released ? (
        <div className="flex items-start gap-2 rounded-2xl border border-border/70 bg-secondary/40 p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-chart-3" aria-hidden />
          <span>{t("results.not_released")}</span>
        </div>
      ) : null}

      {attempt.autoSubmitted ? (
        <p className="text-xs text-muted-foreground">{t("results.auto_submitted")}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("results.score")}
          value={`${formatNumber(attempt.score)} / ${formatNumber(attempt.maxScore)}`}
          icon={Target}
          tone="primary"
        />
        <StatCard
          label={t("results.percentage")}
          value={`${formatNumber(Math.round(attempt.percentage))}%`}
          icon={TrendingUp}
          tone="accent"
        />
        <StatCard
          label={t("common.status")}
          value={attempt.passed ? t("results.pass") : t("results.fail")}
          hint={`${t("assessment.pass_threshold")}: ${assessment.passThreshold}%`}
        />
        <StatCard
          label={t("results.answer_review")}
          value={`${formatNumber(answerCounts.graded)} / ${formatNumber(answerCounts.total)}`}
          hint={
            answerCounts.pending > 0
              ? t("take.pending_manual", { count: answerCounts.pending })
              : t("take.autosave.saved")
          }
        />
      </div>

      {data.released && data.weaknesses.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title={t("results.strong")}>
            {data.strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.none_yet")}</p>
            ) : (
              <div className="space-y-3">
                {data.strengths.map((topic) => (
                  <Meter
                    key={topic.topicId}
                    label={pick(topic.nameEn, topic.nameAr)}
                    value={topic.percentage}
                  />
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title={t("results.weak")}>
            <div className="space-y-3">
              {data.weaknesses.map((topic) => (
                <Meter
                  key={topic.topicId}
                  label={pick(topic.nameEn, topic.nameAr)}
                  value={topic.percentage}
                />
              ))}
            </div>
          </SectionCard>
        </div>
      ) : null}

      <SectionCard title={t("results.suggested")}>
        <p className="text-sm leading-6 text-muted-foreground">
          {data.weaknesses.length === 0
            ? t("results.no_suggestions")
            : t("results.suggested.body", {
                topics: data.weaknesses
                  .map((topic) => pick(topic.nameEn, topic.nameAr))
                  .join(" · "),
              })}
        </p>
      </SectionCard>

      <SectionCard title={t("results.answer_review")}>
        {!data.canReviewAnswers ? (
          <EmptyState
            title={t("results.answer_review.hidden")}
            body={
              attempt.pendingManualCount > 0 ? t("results.awaiting_manual") : undefined
            }
          />
        ) : (
          <ol className="space-y-3">
            {data.items.map((item, index) => {
              // Built from the stored response, so a recorded choice is never
              // displayed as "unanswered" (option text falls back language →
              // language → key).
              const answerText = storedAnswerText(
                item.response,
                item.options,
                { yes: t("take.true"), no: t("take.false") },
                lang,
              );
              const correctText = correctAnswerParts(
                item.options,
                item.acceptedAnswers,
                lang,
              ).join("\n");
              return (
                <Reveal as="li" key={item.assessmentQuestionId} delay={index * 0.03}>
                  <div
                    className={cn(
                      "rounded-2xl border p-4",
                      item.isCorrect === true
                        ? "border-emerald-500/25 bg-emerald-500/5"
                        : item.isCorrect === false
                          ? "border-destructive/25 bg-destructive/5"
                          : "border-border/70 bg-secondary/30",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {t("take.progress", {
                            current: item.order + 1,
                            total: data.items.length,
                          })}{" "}
                          · {t(`qtype.${item.type}`)}
                        </p>
                        <p className="mt-1.5 text-sm font-semibold">
                          {pick(item.promptEn, item.promptAr)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-card px-2 py-1 text-sm font-bold tabular-nums">
                        {item.awardedMarks ?? 0} / {item.marks}
                      </span>
                    </div>

                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={t("take.image_alt")}
                        className="mt-3 max-h-40 rounded-xl border border-border/60"
                      />
                    ) : null}

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/60 bg-card p-3">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {t("results.your_answer")}
                        </p>
                        <p className="mt-1 text-sm whitespace-pre-line">
                          {answerText || t("take.unanswered")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-card p-3">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {t("results.correct_answer")}
                        </p>
                        <p className="mt-1 text-sm whitespace-pre-line">
                          {correctText || t("teacher.grading.no_model_answer")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                      {item.isCorrect === true ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3.5" aria-hidden />
                          {t("results.correct")}
                        </span>
                      ) : item.isCorrect === false ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-destructive">
                          <XCircle className="size-3.5" aria-hidden />
                          {t("results.incorrect")}
                        </span>
                      ) : null}
                      {item.feedback ? (
                        <span className="text-muted-foreground">
                          {t("results.teacher_feedback")}: {item.feedback}
                        </span>
                      ) : null}
                      {pick(item.modelFeedbackEn ?? "", item.modelFeedbackAr ?? "") ? (
                        <span className="text-muted-foreground">
                          {pick(item.modelFeedbackEn ?? "", item.modelFeedbackAr ?? "")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </ol>
        )}
      </SectionCard>

      <Button variant="ghost" size="sm" asChild className="no-print">
        <Link to="/results">{t("results.title")}</Link>
      </Button>
    </div>
  );
}
