import { typeKey as gameTypeKey } from "@/components/teacher/gameTemplates";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useI18n } from "@/i18n";
import { describeError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Check, Loader2, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Result = {
  score: number;
  total: number;
  pointsAwarded: number;
  results: { correctIndex: number; chosen: number; correct: boolean }[];
};

/** Plays a teacher-authored class game; grading happens on the server. */
export function ClassGamePlayer({ gameId }: { gameId: Id<"class_games"> }) {
  const { t, pick, formatNumber, lang } = useI18n();
  const game = useQuery(api.games.gameForPlay, { gameId });
  const submitRun = useMutation(api.games.submitGameRun);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  if (game === undefined) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <Loader2 className="me-2 size-4 animate-spin" aria-hidden />
        {t("common.loading")}
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="mx-auto grid size-24 place-items-center rounded-full bg-gradient-to-br from-nq-turquoise to-nq-blue text-4xl">
            {result.score === result.total ? "🏆" : result.score > 0 ? "🎉" : "💪"}
          </div>
          <p className="mt-3 text-lg font-black">
            {formatNumber(result.score)} / {formatNumber(result.total)}
          </p>
          {result.pointsAwarded > 0 ? (
            <p className="text-sm font-bold text-amber-600">
              +{formatNumber(result.pointsAwarded)} {t("student.xp")}
            </p>
          ) : null}
        </div>

        <ol className="space-y-2">
          {game.questions.map((question, questionIndex) => {
            const row = result.results[questionIndex];
            return (
              <li
                key={questionIndex}
                className={cn(
                  "rounded-2xl border p-3 text-sm",
                  row?.correct
                    ? "border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30"
                    : "border-rose-300 bg-rose-50/70 dark:bg-rose-950/30",
                )}
              >
                <p className="flex items-start gap-2 font-bold">
                  {row?.correct ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0 text-rose-600" aria-hidden />
                  )}
                  {pick(question.promptEn, question.promptAr)}
                </p>
                {question.phraseEn ? (
                  <p dir="ltr" className="mt-1 text-xs font-semibold opacity-80">
                    {question.phraseEn}
                  </p>
                ) : null}
                <p className="mt-1 text-xs opacity-80">
                  {t("games.correct_answer")}:{" "}
                  <span className="font-bold">
                    {pick(
                      question.options[row?.correctIndex ?? 0]?.textAr ?? "—",
                      question.options[row?.correctIndex ?? 0]?.textAr ?? "—",
                    )}
                  </span>
                </p>
              </li>
            );
          })}
        </ol>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => {
            setAnswers([]);
            setIndex(0);
            setResult(null);
          }}
        >
          <RotateCcw className="size-4" aria-hidden />
          {t("games.play_again")}
        </Button>
      </div>
    );
  }

  const question = game.questions[index];
  if (!question) return null;
  const chosen = answers[index];

  const choose = (option: number) => {
    setAnswers((current) => {
      const next = [...current];
      next[index] = option;
      return next;
    });
  };

  const advance = async () => {
    if (index + 1 < game.questions.length) {
      setIndex(index + 1);
      return;
    }
    setBusy(true);
    try {
      const outcome = await submitRun({
        gameId,
        answers: game.questions.map((_, questionIndex) => answers[questionIndex] ?? -1),
      });
      setResult(outcome as Result);
    } catch (cause) {
      toast.error(describeError(cause, t, lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
        <span>
          {t("games.question_of", {
            current: formatNumber(index + 1),
            total: formatNumber(game.questions.length),
          })}
        </span>
        <span className="truncate">
          {pick(game.titleEn, game.titleAr)} · {t(gameTypeKey(game.gameType))}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gradient-to-r from-nq-violet via-nq-blue to-nq-turquoise transition-[width] duration-500"
          style={{ width: `${((index + (chosen === undefined ? 0 : 1)) / game.questions.length) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl bg-secondary/60 p-4">
        <p className="text-[15px] font-black">{pick(question.promptEn, question.promptAr)}</p>
        {question.phraseEn ? (
          <p dir="ltr" className="mt-1 text-lg font-black text-primary">
            {question.phraseEn}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        {question.options.map((option, optionIndex) => (
          <button
            key={optionIndex}
            type="button"
            onClick={() => choose(optionIndex)}
            className={cn(
              "flex min-h-14 items-center rounded-2xl border-2 px-4 py-3 text-start text-[15px] font-bold transition-colors",
              chosen === optionIndex
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            {option.emoji ? <span className="me-2 text-xl">{option.emoji}</span> : null}
            {pick(option.textEn, option.textAr)}
          </button>
        ))}
      </div>

      <Button
        type="button"
        className="w-full gap-2"
        disabled={chosen === undefined || busy}
        onClick={() => void advance()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {index + 1 >= game.questions.length ? t("games.submit_answers") : t("common.next")}
        <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
      </Button>
    </div>
  );
}
