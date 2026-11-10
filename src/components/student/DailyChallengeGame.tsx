import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { buildDailyChallenge, todayKey } from "@/lib/language-games";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Daily challenge: the same five questions for everyone on a given day, picked
 * from the built-in phrase bank. The score is for this session only.
 */
export function DailyChallengeGame({ phrases }: { phrases?: { en: string; ar: string }[] }) {
  const { t, formatNumber } = useI18n();
  const day = todayKey();
  const questions = useMemo(
    () => buildDailyChallenge(day, phrases && phrases.length >= 3 ? phrases : undefined),
    [day, phrases],
  );
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = questions[index];

  const answer = (option: number) => {
    if (chosen !== null) return;
    setChosen(option);
    if (option === question.correctIndex) setScore((value) => value + 1);
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setChosen(null);
  };

  if (finished) {
    const percent = Math.round((score / Math.max(1, questions.length)) * 100);
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid size-24 place-items-center rounded-full bg-gradient-to-br from-nq-yellow to-[#F0A31C] text-4xl">
          {percent >= 80 ? "🥇" : percent >= 50 ? "⭐" : "💪"}
        </div>
        <div>
          <p className="text-lg font-black">
            {formatNumber(score)} / {formatNumber(questions.length)}
          </p>
          <p className="text-sm text-muted-foreground">{t("games.session_only")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => {
            setIndex(0);
            setChosen(null);
            setScore(0);
            setFinished(false);
          }}
        >
          <RotateCcw className="size-4" aria-hidden />
          {t("games.play_again")}
        </Button>
        <p className="rounded-xl border border-border/60 bg-muted/30 p-3 text-[11px] leading-5 text-muted-foreground">
          {t("games.daily.tomorrow")}
        </p>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
        <span>
          {t("games.question_of", {
            current: formatNumber(index + 1),
            total: formatNumber(questions.length),
          })}
        </span>
        <span>
          {formatNumber(score)} / {formatNumber(questions.length)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gradient-to-r from-nq-yellow via-nq-blue to-nq-violet transition-[width] duration-500"
          style={{ width: `${((index + (chosen === null ? 0 : 1)) / questions.length) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl bg-secondary/60 p-4 text-center">
        <p className="text-xs text-muted-foreground">{question.promptAr}</p>
        <p dir="ltr" className="mt-1 text-xl font-black">
          {question.phraseEn}
        </p>
      </div>

      <div className="grid gap-2">
        {question.options.map((option, optionIndex) => {
          const isCorrect = chosen !== null && optionIndex === question.correctIndex;
          const isWrong = chosen === optionIndex && optionIndex !== question.correctIndex;
          return (
            <button
              key={option.textAr}
              type="button"
              onClick={() => answer(optionIndex)}
              disabled={chosen !== null}
              className={cn(
                "flex min-h-14 items-center gap-2 rounded-2xl border-2 px-4 py-3 text-start text-[15px] font-bold transition-colors",
                isCorrect
                  ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : isWrong
                    ? "border-rose-400 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                    : "border-border bg-card hover:border-primary/40",
              )}
            >
              {isCorrect ? (
                <Check className="size-4 shrink-0" aria-hidden />
              ) : isWrong ? (
                <X className="size-4 shrink-0" aria-hidden />
              ) : null}
              {option.textAr}
            </button>
          );
        })}
      </div>

      {chosen !== null ? (
        <div className="space-y-2">
          <p
            className={cn(
              "text-center text-sm font-bold",
              chosen === question.correctIndex ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {chosen === question.correctIndex
              ? t("games.feedback.correct")
              : t("games.feedback.wrong")}
          </p>
          <Button type="button" className="w-full gap-2" onClick={next}>
            {index + 1 >= questions.length ? t("games.see_result") : t("games.next_question")}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
