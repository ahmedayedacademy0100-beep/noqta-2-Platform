import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  SITUATIONS,
  buildSituationQuiz,
  type GameQuestion,
  type Situation,
} from "@/lib/language-games";
import { ArrowRight, Check, RotateCcw, Volume2, X } from "lucide-react";
import { useMemo, useState } from "react";

type Phase = "pick" | "learn" | "quiz" | "result";

/**
 * Situations game: pick a real-life situation, hear each phrase read aloud,
 * then answer a short meaning quiz built from those same phrases.
 */
type SituationInput = {
  titleEn: string;
  titleAr: string;
  phrases: { en: string; ar: string }[];
};

const CUSTOM_EMOJI = ["🌍", "🍽️", "✈️", "💼", "🩺", "🛒"];

export function SituationsGame({ situations }: { situations?: SituationInput[] }) {
  const { t, pick, formatNumber } = useI18n();
  const [phase, setPhase] = useState<Phase>("pick");
  const [situation, setSituation] = useState<Situation | null>(null);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [speaking, setSpeaking] = useState<string | null>(null);

  // Owner-authored situations replace the built-in set when provided.
  const bank: Situation[] = useMemo(
    () =>
      situations && situations.length > 0
        ? situations.map((item, index) => ({
            id: `custom-${index}`,
            emoji: CUSTOM_EMOJI[index % CUSTOM_EMOJI.length],
            titleEn: item.titleEn,
            titleAr: item.titleAr,
            blurbEn: "",
            blurbAr: "",
            phrases: item.phrases,
          }))
        : SITUATIONS,
    [situations],
  );

  const pool = useMemo(
    () =>
      situations && situations.length > 0 ? situations.flatMap((item) => item.phrases) : undefined,
    [situations],
  );

  const questions: GameQuestion[] = useMemo(
    () => (situation ? buildSituationQuiz(situation, pool) : []),
    [situation, pool],
  );

  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.85;
      utterance.onend = () => setSpeaking(null);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setSpeaking(text);
    } catch {
      setSpeaking(null);
    }
  };

  const startQuiz = (next: Situation) => {
    setSituation(next);
    setIndex(0);
    setChosen(null);
    setScore(0);
    setPhase("quiz");
  };

  const answer = (option: number) => {
    if (chosen !== null) return;
    setChosen(option);
    if (option === questions[index]?.correctIndex) setScore((value) => value + 1);
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setPhase("result");
      return;
    }
    setIndex((value) => value + 1);
    setChosen(null);
  };

  if (phase === "pick") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("games.situations.pick")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {bank.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSituation(item);
                setPhase("learn");
              }}
              className="nq-card nq-card-hover nq-press flex items-center gap-3 p-3 text-start"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl">
                {item.emoji}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">
                  {pick(item.titleEn, item.titleAr)}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {item.blurbEn || item.blurbAr ? pick(item.blurbEn, item.blurbAr) : null}
                </span>
              </span>
              <ArrowRight className="ms-auto size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "learn" && situation) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold">
            {situation.emoji} {pick(situation.titleEn, situation.titleAr)}
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => {
              setPhase("pick");
              setSituation(null);
            }}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {t("common.back")}
          </Button>
        </div>

        <ul className="space-y-2">
          {situation.phrases.map((phrase) => (
            <li
              key={phrase.en}
              className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <p dir="ltr" className="truncate text-[15px] font-bold">
                  {phrase.en}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{phrase.ar}</p>
              </div>
              <button
                type="button"
                onClick={() => speak(phrase.en)}
                aria-label={t("games.listen")}
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-transform active:scale-95",
                  speaking === phrase.en && "animate-pulse",
                )}
              >
                <Volume2 className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        <Button type="button" className="w-full gap-2" onClick={() => startQuiz(situation)}>
          {t("games.start_quiz")}
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </Button>
      </div>
    );
  }

  if (phase === "quiz" && questions[index]) {
    const question = questions[index];
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
          <span>
            {t("games.question_of", {
              current: formatNumber(index + 1),
              total: formatNumber(questions.length),
            })}
          </span>
          <span>{formatNumber(score)} ✓</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-nq-turquoise via-nq-blue to-nq-violet transition-[width] duration-500"
            style={{ width: `${((index + (chosen === null ? 0 : 1)) / questions.length) * 100}%` }}
          />
        </div>

        <div className="rounded-2xl bg-secondary/60 p-4 text-center">
          <p className="text-xs text-muted-foreground">{question.promptAr}</p>
          <p dir="ltr" className="mt-1 text-xl font-black">
            {question.phraseEn}
          </p>
          {question.phraseEn ? (
            <button
              type="button"
              onClick={() => speak(question.phraseEn!)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary"
            >
              <Volume2 className="size-4" aria-hidden />
              {t("games.listen")}
            </button>
          ) : null}
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
                {pick(option.textAr, option.textAr)}
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

  if (phase === "result" && situation) {
    const percent = Math.round((score / Math.max(1, questions.length)) * 100);
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid size-24 place-items-center rounded-full bg-gradient-to-br from-nq-turquoise to-nq-blue text-4xl">
          {percent >= 80 ? "🏆" : percent >= 50 ? "🎉" : "💪"}
        </div>
        <div>
          <p className="text-lg font-black">
            {formatNumber(score)} / {formatNumber(questions.length)}
          </p>
          <p className="text-sm text-muted-foreground">{t("games.session_only")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => {
              setPhase("learn");
              setIndex(0);
              setChosen(null);
              setScore(0);
            }}
          >
            <Volume2 className="size-4" aria-hidden />
            {t("games.review_phrases")}
          </Button>
          <Button type="button" className="flex-1 gap-2" onClick={() => startQuiz(situation)}>
            <RotateCcw className="size-4" aria-hidden />
            {t("games.play_again")}
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setPhase("pick");
            setSituation(null);
          }}
        >
          {t("games.other_situation")}
        </Button>
      </div>
    );
  }

  return null;
}
