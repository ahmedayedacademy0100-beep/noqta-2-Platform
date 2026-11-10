import {
  DataList,
  EmptyState,
  ErrorNotice,
  Field,
  LoadingBlock,
  PageHeader,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { correctAnswerParts, hasStoredAnswer, storedAnswerText } from "@/lib/answers";
import { describeError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Clock, Loader2, RotateCcw, Send, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

/** Did the student pick this option? Choice keys and boolean answers differ. */
function isChosen(
  item: {
    response: {
      selectedKeys: string[];
      booleanAnswer?: boolean;
    };
    snapshot?: {
      options: { key: string; textEn: string; textAr: string }[];
    };
  },
  option: { key: string; textEn: string; textAr: string },
): boolean {
  if (item.response.selectedKeys.includes(option.key)) return true;
  const answer = item.response.booleanAnswer;
  if (answer === undefined) return false;
  const key = option.key.trim().toLowerCase();
  if (key === "true") return answer;
  if (key === "false") return !answer;
  const text = `${option.textEn} ${option.textAr}`.toLowerCase();
  const saysFalse = /(false|خطأ|خطا|خاطئ)/.test(text);
  const saysTrue = /(true|صح)/.test(text);
  if (saysFalse && !saysTrue) return !answer;
  if (saysTrue && !saysFalse) return answer;
  return false;
}

export default function GradingDetail() {
  const { t, pick, formatDate, lang } = useI18n();
  const { attemptId } = useParams<{ attemptId: string }>();
  const data = useQuery(
    api.assessments.attemptForGrading,
    attemptId ? { attemptId: attemptId as never } : "skip",
  );
  const gradeAnswer = useMutation(api.assessments.gradeAnswer);
  const releaseResults = useMutation(api.assessments.releaseResults);
  const reopenAttempt = useMutation(api.assessments.reopenAttempt);

  const [marks, setMarks] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [hydrated, setHydrated] = useState(false);

  // Seed the editable marks once the attempt loads; queued during render so the
  // teacher never sees an empty box for an already graded answer.
  if (data && !hydrated) {
    setMarks((prev) => {
      const next = { ...prev };
      for (const item of data.items) {
        if (next[item.answerId] === undefined) {
          next[item.answerId] =
            item.awardedMarks !== undefined ? String(item.awardedMarks) : "";
        }
      }
      return next;
    });
    setFeedback((prev) => {
      const next = { ...prev };
      for (const item of data.items) {
        if (next[item.answerId] === undefined) next[item.answerId] = item.feedback ?? "";
      }
      return next;
    });
    setHydrated(true);
  }

  const pendingItems = useMemo(
    () => (data ? data.items.filter((item) => item.needsManualGrading) : []),
    [data],
  );

  if (data === undefined) return <LoadingBlock />;
  if (!data) return <ErrorNotice error={null} />;

  const { attempt, assessment, student } = data;

  const run = async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (message) toast.success(message);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={`${student.name} · ${t("take.attempt_of", { n: attempt.attemptNumber })}`}
        title={pick(assessment.titleEn, assessment.titleAr)}
        subtitle={`${t("common.due")} ${formatDate(attempt.submittedAt, true)} · ${t("teacher.grading.history")}: v${attempt.snapshotVersion}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={attempt.status} />
            <Button
              variant="outline"
              className="gap-2"
              disabled={busy}
              onClick={() =>
                void run(
                  () => releaseResults({ assessmentId: assessment._id }),
                  t("common.saved"),
                )
              }
            >
              <Send className="size-4" aria-hidden />
              {t("teacher.grading.release")}
            </Button>
          </div>
        }
      />

      {error ? <ErrorNotice error={error} /> : null}

      <SectionCard title={t("common.score")}>
        <DataList
          items={[
            {
              label: t("results.score"),
              value: `${attempt.score} / ${attempt.maxScore} (${Math.round(attempt.percentage)}%)`,
            },
            {
              label: t("teacher.awaiting_grading"),
              value: `${attempt.pendingManualCount}`,
            },
            {
              label: t("teacher.grading.released"),
              value: attempt.releasedAt
                ? formatDate(attempt.releasedAt, true)
                : t("teacher.grading.not_released"),
            },
            { label: t("assessment.pass_threshold"), value: `${assessment.passThreshold}%` },
          ]}
        />
      </SectionCard>

      {pendingItems.length === 0 ? (
        <EmptyState title={t("teacher.no_grading")} icon={CheckCircle2} />
      ) : null}

      <ol className="space-y-4">
        {data.items.map((item, index) => {
          const isCorrection = item.awardedMarks !== undefined;
          // Decided from the stored response, not from the rendered text: an
          // answer that exists is never labelled "not answered".
          const answered = hasStoredAnswer(item.response);
          const answerText = storedAnswerText(
            item.response,
            item.snapshot?.options ?? [],
            { yes: t("take.true"), no: t("take.false") },
            lang,
          );
          const correctText = correctAnswerParts(
            item.snapshot?.options ?? [],
            item.snapshot?.acceptedAnswers,
            lang,
          ).join("\n");
          return (
            <li key={item.answerId} className="surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {index + 1} · {item.snapshot ? t(`qtype.${item.snapshot.type}`) : ""} ·{" "}
                    {item.marks} {t("common.marks")}
                    {item.autoGraded ? ` · ${t("teacher.grading.auto")}` : ""}
                  </p>
                  <p className="mt-1.5 text-sm font-medium">
                    {item.snapshot
                      ? pick(item.snapshot.promptEn, item.snapshot.promptAr)
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {item.isCorrect === true ? (
                    <span className="chip border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="me-1 size-3.5" aria-hidden />
                      {t("results.correct")}
                    </span>
                  ) : item.isCorrect === false ? (
                    <span className="chip border-destructive/40 bg-destructive/10 text-destructive">
                      <XCircle className="me-1 size-3.5" aria-hidden />
                      {t("results.incorrect")}
                    </span>
                  ) : item.needsManualGrading ? (
                    <span className="chip border-chart-4/40 bg-chart-4/10 text-chart-4">
                      <Clock className="me-1 size-3.5" aria-hidden />
                      {t("teacher.awaiting_grading")}
                    </span>
                  ) : answered ? (
                    <span className="chip">{t("teacher.grading.manual")}</span>
                  ) : (
                    <span className="chip">{t("teacher.grading.unanswered")}</span>
                  )}
                  <span className="font-semibold">
                    {item.awardedMarks ?? "—"} / {item.marks}
                  </span>
                </div>
              </div>

              {/* Full answer sheet: every option, what the student picked and
                  which option was the correct one. */}
              <div className="mt-3 space-y-3">
                {item.snapshot?.imageUrl ? (
                  <img
                    src={item.snapshot.imageUrl}
                    alt={t("take.image_alt")}
                    className="max-h-48 rounded-xl border border-border/60"
                  />
                ) : null}

                {item.snapshot && item.snapshot.options.length > 0 ? (
                  <ul className="space-y-1.5">
                    {item.snapshot.options.map((option) => {
                      const chosen = isChosen(item, option);
                      const isRight = option.correct;
                      return (
                        <li
                          key={option.key}
                          className={cn(
                            "flex flex-wrap items-center gap-2 rounded-xl border p-2.5 text-sm",
                            isRight && chosen
                              ? "border-emerald-500/50 bg-emerald-500/10"
                              : isRight
                                ? "border-emerald-500/30 bg-emerald-500/5"
                                : chosen
                                  ? "border-destructive/40 bg-destructive/10"
                                  : "border-border/60 bg-background",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold uppercase",
                              isRight
                                ? "bg-emerald-500 text-white"
                                : chosen
                                  ? "bg-destructive text-white"
                                  : "bg-muted text-muted-foreground",
                            )}
                            aria-hidden
                          >
                            {option.key}
                          </span>
                          <span className="min-w-0 flex-1">
                            {pick(option.textEn, option.textAr)}
                          </span>
                          {isRight ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="size-3" aria-hidden />
                              {t("teacher.grading.correct_option")}
                            </span>
                          ) : null}
                          {chosen ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                isRight
                                  ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
                                  : "bg-destructive/15 text-destructive",
                              )}
                            >
                              {t("teacher.grading.student_pick")}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-background p-3 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("results.your_answer")}
                    </p>
                    <p className="mt-1 whitespace-pre-line">
                      {answerText || t("teacher.grading.unanswered")}
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      {t("results.correct_answer")}
                    </p>
                    <p className="mt-1 whitespace-pre-line">
                      {correctText || t("teacher.grading.no_model_answer")}
                    </p>
                  </div>
                </div>

                {pick(
                  item.snapshot?.feedbackEn ?? "",
                  item.snapshot?.feedbackAr ?? "",
                ) ? (
                  <p className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                    {pick(
                      item.snapshot?.feedbackEn ?? "",
                      item.snapshot?.feedbackAr ?? "",
                    )}
                  </p>
                ) : null}
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[160px_1fr_auto] lg:items-end">
                <Field
                  label={`${t("teacher.grading.award")} (${t("teacher.grading.max", { max: item.marks })})`}
                >
                  <Input
                    type="number"
                    min={0}
                    max={item.marks}
                    step={0.5}
                    value={marks[item.answerId] ?? ""}
                    onChange={(event) =>
                      setMarks((prev) => ({
                        ...prev,
                        [item.answerId]: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label={t("results.teacher_feedback")}>
                  <Textarea
                    rows={2}
                    value={feedback[item.answerId] ?? ""}
                    onChange={(event) =>
                      setFeedback((prev) => ({
                        ...prev,
                        [item.answerId]: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Button
                  className="gap-2"
                  disabled={busy || marks[item.answerId] === undefined || marks[item.answerId] === ""}
                  onClick={() =>
                    void run(
                      () =>
                        gradeAnswer({
                          answerId: item.answerId,
                          awardedMarks: Number(marks[item.answerId]),
                          feedback: feedback[item.answerId] || undefined,
                          reason: isCorrection
                            ? reasons[item.answerId] || t("teacher.grading.correction")
                            : undefined,
                        }),
                      t("common.saved"),
                    )
                  }
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {t("teacher.grading.save_grade")}
                </Button>
              </div>

              {isCorrection ? (
                <div className="mt-3">
                  <Field
                    label={t("teacher.grading.correction_reason")}
                    hint={t("teacher.grading.correction_hint")}
                  >
                    <Input
                      value={reasons[item.answerId] ?? ""}
                      onChange={(event) =>
                        setReasons((prev) => ({
                          ...prev,
                          [item.answerId]: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={t("teacher.grading.history")}>
          {data.records.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.none_yet")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.records.map((record) => (
                <li key={record._id} className="flex items-start justify-between gap-3">
                  <div>
                    <p>
                      {record.kind === "correction"
                        ? t("teacher.grading.correction")
                        : record.kind === "auto_grade"
                          ? t("teacher.grading.auto")
                          : record.kind === "release"
                            ? t("teacher.grading.release")
                            : record.kind === "reopen"
                              ? t("teacher.grading.reopen")
                              : t("teacher.grading.manual")}
                      {record.newMarks !== undefined
                        ? ` · ${record.newMarks}`
                        : ""}
                    </p>
                    {record.reason ? (
                      <p className="text-xs text-muted-foreground">{record.reason}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(record.createdAt, true)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t("assessment.attempts")}>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <RotateCcw className="size-4" aria-hidden />
                {t("teacher.grading.reopen")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("teacher.grading.reopen")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {pick(
                    "Reopening keeps every existing grade on record, marks the attempt in progress again and notifies the student.",
                    "إعادة الفتح تحفظ كل الدرجات السابقة، وتعيد المحاولة إلى حالة التنفيذ، وتُشعر الطالب.",
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <form
                id="reopen-form"
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  void run(
                    () =>
                      reopenAttempt({
                        attemptId: attempt._id,
                        extraMinutes: Number(formData.get("extraMinutes") ?? 15),
                        reason: String(formData.get("reason") ?? ""),
                      }),
                    t("common.saved"),
                  );
                }}
              >
                <Field label={t("teacher.grading.reopen_minutes")} required>
                  <Input
                    name="extraMinutes"
                    type="number"
                    min={1}
                    max={240}
                    defaultValue={15}
                    required
                  />
                </Field>
                <Field label={t("teacher.grading.reopen_reason")} required>
                  <Textarea name="reason" rows={2} required />
                </Field>
              </form>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction type="submit" form="reopen-form">
                  <Clock className="size-4" aria-hidden />
                  {t("teacher.grading.reopen")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="mt-3 text-xs text-muted-foreground">
            {pick(
              "Grade changes are recorded with your name, the previous mark, the new mark and your reason.",
              "تُسجَّل تغييرات الدرجات باسمك مع الدرجة السابقة والجديدة والسبب.",
            )}
          </p>
          {error ? (
            <p className="mt-2 text-sm text-destructive">
              {describeError(error, t, lang)}
            </p>
          ) : null}
        </SectionCard>
      </div>

      <Button variant="ghost" size="sm" asChild>
        <Link to="/teacher/grading">{t("teacher.grading.queue")}</Link>
      </Button>
    </>
  );
}
