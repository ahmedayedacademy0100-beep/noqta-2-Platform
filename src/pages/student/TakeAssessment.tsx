import { FullscreenToggle } from "@/components/app/FullscreenToggle";
import {
  Celebration,
  ErrorNotice,
  LoadingBlock,
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { formatCountdown } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  Flag,
  Loader2,
  RefreshCw,
  Timer,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

type Response = {
  selectedKeys: string[];
  text?: string;
  blanks?: string[];
  booleanAnswer?: boolean;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Only the fields that carry a value are sent. An explicit `undefined` inside a
 * nested object is not a Convex value, and a malformed save is a silent loss of
 * whatever the student just typed or picked.
 */
function cleanResponse(response: Response | undefined) {
  const clean: Response = { selectedKeys: response?.selectedKeys ?? [] };
  const text = response?.text;
  if (text !== undefined) clean.text = text;
  const blanks = response?.blanks;
  if (blanks !== undefined) clean.blanks = blanks;
  const booleanAnswer = response?.booleanAnswer;
  if (booleanAnswer !== undefined) clean.booleanAnswer = booleanAnswer;
  return clean;
}

export default function TakeAssessment() {
  const { t, pick, isRtl } = useI18n();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const startMutation = useMutation(api.attempts.start);
  const saveAnswer = useMutation(api.attempts.saveAnswer);
  const submitMutation = useMutation(api.attempts.submit);
  const submitOnExpiry = useMutation(api.attempts.submitOnExpiry);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startError, setStartError] = useState<unknown>(null);
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [submitted, setSubmitted] = useState<{
    pendingManualCount: number;
    releasedAt?: number;
  } | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [blockedBySave, setBlockedBySave] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const dirty = useRef<Set<string>>(new Set());
  const hydrated = useRef(false);
  const submittedRef = useRef(false);
  const offsetRef = useRef(0);
  // The answers a save must write are read from these refs, never from a
  // render closure: a flush can be triggered from an effect that still holds
  // the *previous* render's state, and saving that would silently overwrite a
  // fresh answer with the old (often empty) one.
  const responsesRef = useRef<Record<string, Response>>({});
  const flaggedRef = useRef<Record<string, boolean>>({});

  // Start (or resume) the attempt once, then keep its id in state.
  useEffect(() => {
    if (!assessmentId || attemptId) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await startMutation({ assessmentId: assessmentId as never });
        if (!cancelled) setAttemptId(result.attemptId);
      } catch (error) {
        if (!cancelled) setStartError(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assessmentId, attemptId, startMutation]);

  const state = useQuery(
    api.attempts.state,
    attemptId ? { attemptId: attemptId as never } : "skip",
  );

  const items = useMemo(() => state?.items ?? [], [state]);

  // Hydrate local answers once so re-renders never overwrite typing.
  useEffect(() => {
    if (!state || hydrated.current) return;
    const initial: Record<string, Response> = {};
    const initialFlags: Record<string, boolean> = {};
    for (const item of state.items) {
      initial[item.assessmentQuestionId] = {
        selectedKeys: item.response.selectedKeys ?? [],
        text: item.response.text,
        blanks: item.response.blanks,
        booleanAnswer: item.response.booleanAnswer,
      };
      initialFlags[item.assessmentQuestionId] = item.flagged;
    }
    responsesRef.current = initial;
    flaggedRef.current = initialFlags;
    setResponses(initial);
    setFlagged(initialFlags);
    offsetRef.current = state.serverNow - Date.now();
    hydrated.current = true;
  }, [state]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  /**
   * Writes every pending answer. Returns false when something is still unsaved,
   * so the caller can refuse to submit rather than lose work silently.
   */
  const flush = useCallback(async () => {
    if (!attemptId) return true;
    if (dirty.current.size === 0) return true;
    const ids = [...dirty.current];
    dirty.current.clear();
    setSaveStatus("saving");
    let failed = false;
    for (const id of ids) {
      try {
        const response = responsesRef.current[id] ?? { selectedKeys: [] };
        await saveAnswer({
          attemptId: attemptId as never,
          assessmentQuestionId: id as never,
          response: cleanResponse(response),
          flagged: flaggedRef.current[id] ?? false,
        });
        setLastSavedAt(Date.now());
      } catch {
        // Keep the answer pending: the retry loop and the next interaction
        // both try again, and the submit button stays blocked while any answer
        // is unsaved.
        dirty.current.add(id);
        failed = true;
      }
    }
    setSaveStatus(failed ? "error" : "saved");
    if (!failed) setBlockedBySave(false);
    return !failed;
  }, [attemptId, saveAnswer]);

  // Debounced autosave on every change.
  useEffect(() => {
    if (dirty.current.size === 0) return;
    const timer = setTimeout(() => void flush(), 900);
    return () => clearTimeout(timer);
  }, [responses, flagged, flush]);

  // Safety nets on top of the debounce: periodic retry, and a save as soon as
  // the tab is hidden or the connection comes back (mobile browsers freeze
  // timers in background tabs, and a frozen tab must not swallow answers).
  // They stop as soon as the attempt is no longer accepting answers.
  const attemptStatus = state?.attempt.status;
  useEffect(() => {
    if (attemptStatus && attemptStatus !== "in_progress") return;
    const retry = () => void flush();
    const interval = setInterval(retry, 15000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") retry();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flush, attemptStatus]);

  const expire = useCallback(async () => {
    if (!attemptId || submittedRef.current) return;
    submittedRef.current = true;
    try {
      // Last-chance save: only the server can decide whether the deadline still
      // allows it, and a rejected save changes nothing.
      await flush();
      const result = await submitOnExpiry({ attemptId: attemptId as never });
      setSubmitted({
        pendingManualCount:
          "pendingManualCount" in result ? result.pendingManualCount : 0,
        releasedAt: result.releasedAt ?? undefined,
      });
    } catch (error) {
      submittedRef.current = false;
      setSubmitError(error);
    }
  }, [attemptId, submitOnExpiry, flush]);

  // Client ticker; the authoritative deadline still lives on the server.
  useEffect(() => {
    if (!state) return;
    const tick = () => {
      const remaining = state.attempt.expiresAt - (Date.now() + offsetRef.current);
      setTimeLeft(Math.max(0, remaining));
      if (remaining <= 0 && state.attempt.status === "in_progress" && !submittedRef.current) {
        void expire();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state, expire]);

  // Save what is pending when the tab closes or the user leaves the page.
  useEffect(() => {
    const handler = () => {
      void flush();
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      void flush();
    };
  }, [flush]);

  const goTo = useCallback(
    (index: number) => {
      if (items.length === 0) return;
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      setCurrent(clamped);
      document.getElementById(`question-${clamped}`)?.focus();
    },
    [items.length],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (typing) return;
      if (event.key === "ArrowRight") goTo(current + (isRtl ? -1 : 1));
      if (event.key === "ArrowLeft") goTo(current - (isRtl ? -1 : 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, goTo, isRtl]);

  const answeredCount = useMemo(
    () =>
      items.filter((item) => {
        const response = responses[item.assessmentQuestionId];
        if (!response) return false;
        if (response.selectedKeys?.length) return true;
        if (response.booleanAnswer !== undefined) return true;
        if ((response.text ?? "").trim().length > 0) return true;
        if ((response.blanks ?? []).some((b) => b.trim().length > 0)) return true;
        return false;
      }).length,
    [items, responses],
  );

  const handleSubmit = async () => {
    if (!attemptId || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitError(null);
    setBlockedBySave(false);
    try {
      // Every answer must reach the server before an attempt is finalised.
      // A failed save pauses the submission instead of discarding the answers.
      const saved = await flush();
      if (!saved) {
        const retry = await flush();
        if (!retry) {
          submittedRef.current = false;
          setBlockedBySave(true);
          return;
        }
      }
      const result = await submitMutation({ attemptId: attemptId as never });
      setSubmitted({
        pendingManualCount:
          "pendingManualCount" in result ? result.pendingManualCount : 0,
        releasedAt: result.releasedAt ?? undefined,
      });
    } catch (error) {
      submittedRef.current = false;
      setSubmitError(error);
    }
  };

  const update = (id: string, patch: Partial<Response>) => {
    const next = {
      ...responsesRef.current,
      [id]: { ...responsesRef.current[id], selectedKeys: [], ...patch },
    };
    responsesRef.current = next;
    dirty.current.add(id);
    setResponses(next);
  };

  const toggleFlag = (id: string) => {
    const next = { ...flaggedRef.current, [id]: !flaggedRef.current[id] };
    flaggedRef.current = next;
    dirty.current.add(id);
    setFlagged(next);
  };

  if (startError) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorNotice error={startError} />
        <Button variant="ghost" className="mt-4" asChild>
          <Link to="/assessments">{t("take.back_to_list")}</Link>
        </Button>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }

  const { assessment, attempt } = state;
  const isDone = submitted !== null || attempt.status !== "in_progress";
  const currentItem = items[current];

  if (isDone) {
    const released = submitted?.releasedAt ?? attempt.releasedAt;
    return (
      <div className="nq-hero relative grid min-h-dvh place-items-center p-6">
        <Celebration show={items.length > 0} />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md rounded-3xl border border-white/15 bg-white/95 p-8 text-center shadow-2xl backdrop-blur dark:bg-card/95"
        >
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-br from-nq-blue to-nq-violet text-white shadow-[0_16px_36px_-18px_rgb(65_105_255/0.9)]">
            <CheckCircle2 className="size-8" aria-hidden />
          </span>
          <h1 className="mt-5 text-xl font-extrabold tracking-tight">
            {t("take.submitted.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("take.submitted.body")}
          </p>
          {(submitted?.pendingManualCount ?? attempt.pendingManualCount) > 0 ? (
            <p className="mt-3 rounded-xl bg-nq-yellow/12 px-3 py-2 text-xs font-medium text-amber-700 dark:text-nq-yellow">
              {t("take.pending_manual", {
                count: submitted?.pendingManualCount ?? attempt.pendingManualCount,
              })}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-2">
            {released ? (
              <Button asChild size="lg">
                <Link to={`/results/${attempt._id}`}>{t("take.view_results")}</Link>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("results.not_released")}
              </p>
            )}
            <Button variant="outline" onClick={() => navigate("/assessments")}>
              {t("take.back_to_list")}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const lowTime = timeLeft <= 60 * 1000;

  return (
    <div className="nq-safe-x min-h-dvh overflow-x-clip bg-[var(--nq-soft)]">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-card/88 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 xl:max-w-7xl">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/assessments"
              aria-label={t("take.back_to_list")}
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-border/70 bg-card text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold tracking-tight">
                {pick(assessment.titleEn, assessment.titleAr)}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {t("take.attempt_of", { n: attempt.attemptNumber })} ·{" "}
                {t("take.progress", { current: current + 1, total: items.length })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              role="timer"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-bold tabular-nums transition-colors",
                lowTime
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border/70 bg-secondary/60 text-foreground",
              )}
              aria-live="polite"
              aria-label={t("take.time_left")}
            >
              <Timer
                className={cn("size-4", lowTime && "animate-pulse")}
                aria-hidden
              />
              {formatCountdown(timeLeft)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {!online ? (
                <>
                  <CloudOff className="size-3.5" aria-hidden />
                  {t("take.autosave.offline")}
                </>
              ) : saveStatus === "saving" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  {t("take.autosave.saving")}
                </>
              ) : saveStatus === "error" ? (
                <>
                  <AlertTriangle className="size-3.5 text-destructive" aria-hidden />
                  {t("take.autosave.error")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 text-emerald-500" aria-hidden />
                  {t("take.autosave.saved")}
                </>
              )}
            </span>
            <FullscreenToggle className="size-8" />
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void flush()}>
              <RefreshCw className="size-3.5" aria-hidden />
              {t("common.save")}
            </Button>
          </div>
        </div>
        {/* Answer progress: a gentle nudge that encourages finishing. */}
        <div className="h-1.5 w-full bg-border/50" aria-hidden>
          <motion.div
            className="h-full bg-gradient-to-r from-nq-blue via-nq-violet to-nq-turquoise"
            initial={false}
            animate={{ width: `${items.length ? (answeredCount / items.length) * 100 : 0}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_260px] xl:max-w-7xl 2xl:grid-cols-[1fr_320px] 2xl:gap-8">
        <section className="space-y-4">
          {submitError ? <ErrorNotice error={submitError} /> : null}

          {blockedBySave ? (
            <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden
              />
              <span>{t("take.submit_blocked")}</span>
            </div>
          ) : null}

          {currentItem ? (
            <motion.article
              key={currentItem.assessmentQuestionId}
              initial={{ opacity: 0, x: isRtl ? -18 : 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="nq-card overflow-hidden p-5 sm:p-7"
              aria-labelledby="question-heading"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                      {t("take.progress", { current: current + 1, total: items.length })}
                    </span>
                    <span className="chip gap-1.5 font-semibold">
                      {currentItem.marks} {t("common.marks")}
                    </span>
                  </div>
                  <h2
                    id="question-heading"
                    tabIndex={-1}
                    className="mt-3 text-lg leading-8 font-semibold tracking-tight sm:text-xl sm:leading-9"
                  >
                    {pick(currentItem.snapshot.promptEn, currentItem.snapshot.promptAr)}
                  </h2>
                  {pick(
                    currentItem.snapshot.instructionsEn ?? "",
                    currentItem.snapshot.instructionsAr ?? "",
                  ) ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {pick(
                        currentItem.snapshot.instructionsEn ?? "",
                        currentItem.snapshot.instructionsAr ?? "",
                      )}
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant={flagged[currentItem.assessmentQuestionId] ? "default" : "outline"}
                  className="shrink-0 gap-1.5"
                  aria-pressed={Boolean(flagged[currentItem.assessmentQuestionId])}
                  onClick={() => toggleFlag(currentItem.assessmentQuestionId)}
                >
                  <Flag className="size-3.5" aria-hidden />
                  {flagged[currentItem.assessmentQuestionId]
                    ? t("take.unflag")
                    : t("take.flag")}
                </Button>
              </div>

              {currentItem.snapshot.imageUrl ? (
                <img
                  src={currentItem.snapshot.imageUrl}
                  alt={t("take.image_alt")}
                  className="mt-4 max-h-56 w-auto rounded-xl border border-border/60"
                />
              ) : null}

              <div className="mt-6">
                <QuestionInput
                  item={currentItem}
                  response={responses[currentItem.assessmentQuestionId]}
                  onChange={(patch) => update(currentItem.assessmentQuestionId, patch)}
                />
              </div>
            </motion.article>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
            >
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
              {t("common.previous")}
            </Button>
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
              {answeredCount} / {items.length}
            </span>
            {current < items.length - 1 ? (
              <Button size="lg" className="gap-2" onClick={() => goTo(current + 1)}>
                {t("common.next")}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="gap-2">{t("take.submit")}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("take.submit_confirm.title")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("take.submit_confirm.body", {
                        answered: answeredCount,
                        total: items.length,
                      })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleSubmit()}>
                      {t("take.submit_confirm.button")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("take.shortcuts")}</p>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="nq-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">{t("take.palette")}</h2>
              <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                {answeredCount}/{items.length}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-8 gap-1.5 lg:grid-cols-5">
              {items.map((item, index) => {
                const response = responses[item.assessmentQuestionId];
                const isAnswered =
                  Boolean(response?.selectedKeys?.length) ||
                  response?.booleanAnswer !== undefined ||
                  (response?.text ?? "").trim().length > 0 ||
                  (response?.blanks ?? []).some((b) => b.trim().length > 0);
                const isFlagged = flagged[item.assessmentQuestionId];
                return (
                  <motion.button
                    key={item.assessmentQuestionId}
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    animate={index === current ? { scale: 1.06 } : { scale: 1 }}
                    onClick={() => goTo(index)}
                    aria-label={`${t("take.progress", { current: index + 1, total: items.length })}`}
                    className={cn(
                      "grid size-9 place-items-center rounded-lg border text-xs font-semibold transition-colors",
                      index === current
                        ? "nq-gradient border-transparent text-white shadow-[0_6px_14px_-8px_rgb(65_105_255/0.9)]"
                        : isFlagged
                          ? "border-nq-yellow/60 bg-nq-yellow/15 text-amber-700 dark:text-nq-yellow"
                          : isAnswered
                            ? "border-nq-turquoise/45 bg-nq-turquoise/12 text-cyan-700 dark:text-nq-turquoise"
                            : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-secondary",
                    )}
                  >
                    {index + 1}
                  </motion.button>
                );
              })}
            </div>
            <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-nq-turquoise/70" />
                {t("take.answered")} · {answeredCount}
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2.5 rounded-full border border-border" />
                {t("take.unanswered")} · {items.length - answeredCount}
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-nq-yellow/70" />
                {t("take.flagged")}
              </li>
            </ul>
          </div>

          <div className="nq-card p-4 text-sm">
            <p className="text-muted-foreground">{t("results.score")}</p>
            <p className="mt-1 font-medium">
              {attempt.maxScore} {t("common.marks")}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {lastSavedAt
                ? t("take.saved_at", {
                    time: new Date(lastSavedAt).toLocaleTimeString(
                      isRtl ? "ar-EG" : "en-GB",
                    ),
                  })
                : t("take.autosave.saved")}
            </p>
            <StatusBadge status={attempt.status} className="mt-3" />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="lg" className="w-full">
                {t("take.submit")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("take.submit_confirm.title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("take.submit_confirm.body", {
                    answered: answeredCount,
                    total: items.length,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleSubmit()}>
                  {t("take.submit_confirm.button")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </aside>
      </main>
    </div>
  );
}

type Item = {
  assessmentQuestionId: string;
  marks: number;
  snapshot: {
    type: string;
    promptEn: string;
    promptAr: string;
    instructionsEn?: string;
    instructionsAr?: string;
    imageUrl?: string;
  };
  options: { key: string; textEn: string; textAr: string }[];
};

function QuestionInput({
  item,
  response,
  onChange,
}: {
  item: Item;
  response?: Response;
  onChange: (patch: Partial<Response>) => void;
}) {
  const { t, pick } = useI18n();
  const type = item.snapshot.type;
  const selected = response?.selectedKeys ?? [];

  if (type === "mcq_single" || type === "image") {
    return (
      <fieldset className="space-y-2.5">
        <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("take.choose_one")}
        </legend>
        {item.options.map((option, index) => {
          const isSelected = selected.includes(option.key);
          return (
            <label
              key={option.key}
              className={cn(
                "group flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition-all duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
                isSelected
                  ? "border-nq-turquoise/60 bg-nq-turquoise/8 shadow-[0_10px_26px_-22px_rgb(34_211_238/0.9)]"
                  : "border-border bg-card hover:-translate-y-px hover:border-primary/30 hover:bg-secondary/40",
              )}
            >
              <input
                type="radio"
                name={item.assessmentQuestionId}
                checked={isSelected}
                onChange={() => onChange({ selectedKeys: [option.key] })}
                className="sr-only"
              />
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-lg border text-xs font-bold transition-colors",
                  isSelected
                    ? "border-transparent bg-nq-turquoise text-nq-navy"
                    : "border-border bg-secondary/60 text-muted-foreground group-hover:text-foreground",
                )}
                aria-hidden
              >
                {String.fromCharCode(65 + index)}
              </span>
              <span className="min-w-0 flex-1 pt-0.5 leading-6">
                {pick(option.textEn, option.textAr)}
              </span>
              {isSelected ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-cyan-600 dark:text-nq-turquoise"
                  aria-hidden
                />
              ) : null}
            </label>
          );
        })}
      </fieldset>
    );
  }

  if (type === "mcq_multi") {
    return (
      <fieldset className="space-y-2.5">
        <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("take.choose_many")}
        </legend>
        {item.options.map((option, index) => {
          const isSelected = selected.includes(option.key);
          return (
            <label
              key={option.key}
              className={cn(
                "group flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition-all duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
                isSelected
                  ? "border-nq-turquoise/60 bg-nq-turquoise/8 shadow-[0_10px_26px_-22px_rgb(34_211_238/0.9)]"
                  : "border-border bg-card hover:-translate-y-px hover:border-primary/30 hover:bg-secondary/40",
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() =>
                  onChange({
                    selectedKeys: isSelected
                      ? selected.filter((key) => key !== option.key)
                      : [...selected, option.key],
                  })
                }
                className="sr-only"
              />
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-lg border text-xs font-bold transition-colors",
                  isSelected
                    ? "border-transparent bg-nq-turquoise text-nq-navy"
                    : "border-border bg-secondary/60 text-muted-foreground group-hover:text-foreground",
                )}
                aria-hidden
              >
                {String.fromCharCode(65 + index)}
              </span>
              <span className="min-w-0 flex-1 pt-0.5 leading-6">
                {pick(option.textEn, option.textAr)}
              </span>
              {isSelected ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-cyan-600 dark:text-nq-turquoise"
                  aria-hidden
                />
              ) : null}
            </label>
          );
        })}
      </fieldset>
    );
  }

  if (type === "true_false") {
    return (
      <fieldset className="space-y-2">
        <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("take.true_false")}
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { value: true, label: t("take.true"), icon: CheckCircle2 },
            { value: false, label: t("take.false"), icon: XCircle },
          ].map((option) => {
            const isSelected = response?.booleanAnswer === option.value;
            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onChange({ booleanAnswer: option.value, selectedKeys: [] })}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border px-4 py-4 text-base font-semibold transition-all duration-200",
                  isSelected
                    ? "border-nq-turquoise/60 bg-nq-turquoise/10 text-cyan-700 shadow-[0_10px_26px_-22px_rgb(34_211_238/0.9)] dark:text-nq-turquoise"
                    : "border-border bg-card hover:-translate-y-px hover:border-primary/30 hover:bg-secondary/40",
                )}
              >
                <option.icon className="size-5" aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (type === "fill_blank") {
    return (
      <div>
        <Input
          value={(response?.blanks ?? [])[0] ?? ""}
          onChange={(event) =>
            onChange({ blanks: [event.target.value], selectedKeys: [] })
          }
          placeholder={t("take.type_answer")}
          className="h-11 rounded-xl"
        />
        <p className="mt-2 text-xs text-muted-foreground">{t("take.blanks_hint")}</p>
      </div>
    );
  }

  // short_answer, essay
  return (
    <Textarea
      value={response?.text ?? ""}
      onChange={(event) =>
        onChange({ text: event.target.value, selectedKeys: [] })
      }
      placeholder={t("take.type_answer")}
      rows={type === "essay" ? 8 : 3}
      className="rounded-xl"
    />
  );
}
