import type { CopyFn } from "@/components/landing/LandingCopy";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Check, RotateCcw, Sparkles, X } from "lucide-react";
import { useState } from "react";

type DemoQuestion = {
  en: string;
  ar: string;
  options: { en: string; ar: string }[];
  correct: number;
  hintEn: string;
  hintAr: string;
};

const QUESTIONS: DemoQuestion[] = [
  {
    en: "What is 15% of 200?",
    ar: "كم يساوي ١٥٪ من ٢٠٠؟",
    options: [
      { en: "15", ar: "١٥" },
      { en: "20", ar: "٢٠" },
      { en: "30", ar: "٣٠" },
      { en: "45", ar: "٤٥" },
    ],
    correct: 2,
    hintEn: "15% means 15 out of every 100, so 200 × 0.15 = 30.",
    hintAr: "١٥٪ تعني ١٥ من كل ١٠٠، إذن ٢٠٠ × ٠٫١٥ = ٣٠.",
  },
  {
    en: "Which planet is called the Red Planet?",
    ar: "أي كوكب يُلقّب بالكوكب الأحمر؟",
    options: [
      { en: "Venus", ar: "الزهرة" },
      { en: "Mars", ar: "المريخ" },
      { en: "Jupiter", ar: "المشتري" },
      { en: "Mercury", ar: "عطارد" },
    ],
    correct: 1,
    hintEn: "Iron oxide (rust) on its surface gives Mars its red colour.",
    hintAr: "أكسيد الحديد (الصدأ) على سطحه يمنح المريخ لونه الأحمر.",
  },
  {
    en: "The chemical symbol for water is…",
    ar: "الرمز الكيميائي للماء هو…",
    options: [
      { en: "CO₂", ar: "CO₂" },
      { en: "O₂", ar: "O₂" },
      { en: "H₂O", ar: "H₂O" },
      { en: "NaCl", ar: "NaCl" },
    ],
    correct: 2,
    hintEn: "Two hydrogen atoms and one oxygen atom: H₂O.",
    hintAr: "ذرتا هيدروجين وذرة أكسجين واحدة: H₂O.",
  },
  {
    en: "Which is a renewable energy source?",
    ar: "أي مما يلي يُعد مصدر طاقة متجددة؟",
    options: [
      { en: "Coal", ar: "الفحم" },
      { en: "Solar", ar: "الطاقة الشمسية" },
      { en: "Diesel", ar: "الديزل" },
      { en: "Natural gas", ar: "الغاز الطبيعي" },
    ],
    correct: 1,
    hintEn: "Sunlight is replenished naturally, unlike fossil fuels.",
    hintAr: "ضوء الشمس يتجدد طبيعياً، بعكس الوقود الأحفوري.",
  },
];

/**
 * A real, playable quiz on the landing page: instant feedback, one explanation
 * per answer, and no account required. It mirrors the in-app question flow so
 * visitors know exactly what they are signing up for.
 */
export function DemoQuiz({ copy }: { copy?: CopyFn }) {
  const { t: translate, pick } = useI18n();
  // Owner-edited wording when provided, otherwise the shipped translation.
  const t = copy ?? translate;
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = QUESTIONS[index];
  const answered = chosen !== null;
  const isCorrect = chosen === question.correct;

  const choose = (option: number) => {
    if (answered) return;
    setChosen(option);
    if (option === question.correct) setScore((value) => value + 1);
  };

  const next = () => {
    if (index + 1 >= QUESTIONS.length) {
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setChosen(null);
  };

  const restart = () => {
    setIndex(0);
    setChosen(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    const perfect = score === QUESTIONS.length;
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-6 text-center sm:p-8">
        <span className="nq-gradient mx-auto grid size-16 place-items-center rounded-3xl text-white shadow-[0_18px_40px_-24px_rgb(65_105_255/0.9)]">
          <Sparkles className="size-7" aria-hidden />
        </span>
        <h3 className="mt-4 text-xl font-extrabold">
          {perfect ? t("landing.demo.perfect") : t("landing.demo.done")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("landing.demo.result", { score, total: QUESTIONS.length })}
        </p>
        <div className="mx-auto mt-4 flex max-w-xs items-center justify-center gap-1.5">
          {QUESTIONS.map((_, dot) => (
            <span
              key={dot}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                dot < score ? "bg-emerald-500" : "bg-secondary",
              )}
            />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="outline" className="gap-2" onClick={restart}>
            <RotateCcw className="size-4" aria-hidden />
            {t("landing.demo.restart")}
          </Button>
          <Button asChild>
            <a href="/auth">{t("landing.cta.start")}</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-[0_24px_60px_-46px_rgb(23_27_56/0.55)] sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
          <Sparkles className="size-3" aria-hidden />
          {t("landing.demo.badge")}
        </span>
        <span className="text-xs font-semibold text-muted-foreground">
          {t("landing.demo.progress", {
            current: index + 1,
            total: QUESTIONS.length,
          })}
        </span>
      </div>

      <div
        className="mt-3 flex gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={QUESTIONS.length}
        aria-valuenow={index + 1}
      >
        {QUESTIONS.map((_, dot) => (
          <span
            key={dot}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              dot <= index ? "bg-primary" : "bg-secondary",
            )}
          />
        ))}
      </div>

      <h3 className="mt-5 text-lg leading-8 font-extrabold sm:text-xl">
        {pick(question.en, question.ar)}
      </h3>

      <div className="mt-4 grid gap-2">
        {question.options.map((option, optionIndex) => {
          const selected = chosen === optionIndex;
          const correct = answered && optionIndex === question.correct;
          const wrong = answered && selected && !correct;
          return (
            <button
              key={`${index}-${optionIndex}`}
              type="button"
              onClick={() => choose(optionIndex)}
              disabled={answered}
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-start text-sm font-semibold transition-all",
                !answered &&
                  "border-border/70 bg-background hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5",
                correct && "border-emerald-400/70 bg-emerald-500/10",
                wrong && "border-destructive/50 bg-destructive/10",
                answered && !correct && !wrong && "border-border/50 opacity-60",
              )}
            >
              <span>{pick(option.en, option.ar)}</span>
              {correct ? (
                <Check className="size-4 shrink-0 text-emerald-500" aria-hidden />
              ) : null}
              {wrong ? (
                <X className="size-4 shrink-0 text-destructive" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>

      {answered ? (
        <div className="mt-4 space-y-3" aria-live="polite">
          <div
            className={cn(
              "rounded-2xl border p-3 text-sm leading-6",
              isCorrect
                ? "border-emerald-400/50 bg-emerald-500/10"
                : "border-amber-400/50 bg-amber-400/10",
            )}
          >
            <p className="font-bold">
              {isCorrect ? t("landing.demo.correct") : t("landing.demo.wrong")}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {pick(question.hintEn, question.hintAr)}
            </p>
          </div>
          <Button className="w-full gap-2" onClick={next}>
            {index + 1 >= QUESTIONS.length
              ? t("landing.demo.show_result")
              : t("landing.demo.next")}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          {t("landing.demo.pick")}
        </p>
      )}
    </div>
  );
}
