import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Check, RotateCcw, Sparkles, Trophy, X } from "lucide-react";
import { useMemo, useState } from "react";

/* -------------------------------------------------------------------------- */
/* Content types + built-in sets                                              */
/* -------------------------------------------------------------------------- */

export type SentenceItem = { sentenceEn: string; sentenceAr: string };
export type Phrase = { en: string; ar: string };
export type OddItem = {
  promptEn: string;
  promptAr: string;
  options: Phrase[];
  correct: number;
};
export type GapItem = {
  sentenceEn: string;
  sentenceAr: string;
  options: Phrase[];
  correct: number;
};

/** Built-in sets; the owner can replace any of them from Admin → Settings. */
export const DEFAULT_SENTENCES: SentenceItem[] = [
  { sentenceEn: "I go to school every morning.", sentenceAr: "أذهب إلى المدرسة كل صباح." },
  { sentenceEn: "She reads a book before bed.", sentenceAr: "تقرأ كتابًا قبل النوم." },
  { sentenceEn: "We played football after class.", sentenceAr: "لعبنا كرة القدم بعد الحصة." },
  { sentenceEn: "Can you help me with this?", sentenceAr: "هل يمكنك مساعدتي في هذا؟" },
  { sentenceEn: "They will travel next week.", sentenceAr: "سيسافرون الأسبوع القادم." },
];

export const DEFAULT_ODD: OddItem[] = [
  {
    promptEn: "Which word is not a fruit?",
    promptAr: "أي كلمة ليست فاكهة؟",
    options: [
      { en: "Apple", ar: "تفاحة" },
      { en: "Banana", ar: "موزة" },
      { en: "Carrot", ar: "جزرة" },
      { en: "Grape", ar: "عنب" },
    ],
    correct: 2,
  },
  {
    promptEn: "Which word is not a movement?",
    promptAr: "أي كلمة ليست حركة؟",
    options: [
      { en: "Run", ar: "يجري" },
      { en: "Swim", ar: "يسبح" },
      { en: "Jump", ar: "يقفز" },
      { en: "Chair", ar: "كرسي" },
    ],
    correct: 3,
  },
  {
    promptEn: "Which word is not a colour?",
    promptAr: "أي كلمة ليست لونًا؟",
    options: [
      { en: "Red", ar: "أحمر" },
      { en: "Blue", ar: "أزرق" },
      { en: "Happy", ar: "سعيد" },
      { en: "Green", ar: "أخضر" },
    ],
    correct: 2,
  },
  {
    promptEn: "Which word is not a family member?",
    promptAr: "أي كلمة ليست فردًا من الأسرة؟",
    options: [
      { en: "Mother", ar: "أم" },
      { en: "Teacher", ar: "معلم" },
      { en: "Brother", ar: "أخ" },
      { en: "Sister", ar: "أخت" },
    ],
    correct: 1,
  },
  {
    promptEn: "Which word is not a means of transport?",
    promptAr: "أي كلمة ليست وسيلة مواصلات؟",
    options: [
      { en: "Bus", ar: "حافلة" },
      { en: "Train", ar: "قطار" },
      { en: "Spoon", ar: "ملعقة" },
      { en: "Car", ar: "سيارة" },
    ],
    correct: 2,
  },
];

export const DEFAULT_GAP: GapItem[] = [
  {
    sentenceEn: "I ___ to school by bus every day.",
    sentenceAr: "أذهب إلى المدرسة بالحافلة كل يوم.",
    options: [
      { en: "go", ar: "أذهب" },
      { en: "going", ar: "ذاهب" },
      { en: "goes", ar: "يذهب" },
    ],
    correct: 0,
  },
  {
    sentenceEn: "She ___ a new bike last week.",
    sentenceAr: "اشترت دراجة جديدة الأسبوع الماضي.",
    options: [
      { en: "buy", ar: "تشتري" },
      { en: "bought", ar: "اشترت" },
      { en: "buys", ar: "تشتري" },
      { en: "buying", ar: "شراء" },
    ],
    correct: 1,
  },
  {
    sentenceEn: "There ___ two cats in the garden.",
    sentenceAr: "هناك قطتان في الحديقة.",
    options: [
      { en: "is", ar: "يوجد (مفرد)" },
      { en: "are", ar: "يوجد (جمع)" },
      { en: "was", ar: "كان" },
    ],
    correct: 1,
  },
  {
    sentenceEn: "We have lived here ___ 2019.",
    sentenceAr: "نعيش هنا منذ ٢٠١٩.",
    options: [
      { en: "since", ar: "منذ" },
      { en: "for", ar: "لمدة" },
      { en: "from", ar: "من" },
    ],
    correct: 0,
  },
  {
    sentenceEn: "He is the ___ student in the class.",
    sentenceAr: "هو الطالب الأذكى في الصف.",
    options: [
      { en: "smart", ar: "ذكي" },
      { en: "smarter", ar: "أذكى (مقارنة)" },
      { en: "smartest", ar: "الأذكى" },
    ],
    correct: 2,
  },
];

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                              */
/* -------------------------------------------------------------------------- */

/** Deterministic shuffle so a round keeps its order across re-renders. */
function seededOrder(length: number, seed: number): number[] {
  const out = Array.from({ length }, (_, index) => index);
  let state = seed * 7919 + 13;
  for (let index = out.length - 1; index > 0; index -= 1) {
    state = (state * 9301 + 49297) % 233280;
    const target = Math.floor((state / 233280) * (index + 1));
    [out[index], out[target]] = [out[target], out[index]];
  }
  return out;
}

function GameHeader({
  round,
  total,
  score,
  onRestart,
}: {
  round: number;
  total: number;
  score: number;
  onRestart: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-4 font-semibold">
        <span className="text-muted-foreground">
          {t("landing.games.round", { current: round, total })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="size-4 text-nq-violet" aria-hidden />
          {t("landing.games.progress", { score })}
        </span>
      </div>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onRestart}>
        <RotateCcw className="size-3.5" aria-hidden />
        {t("landing.games.restart")}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Sentence builder                                                        */
/* -------------------------------------------------------------------------- */

export function SentenceGame({ items }: { items?: SentenceItem[] }) {
  const { t } = useI18n();

  const bank = useMemo(() => (items && items.length >= 2 ? items : DEFAULT_SENTENCES), [items]);
  const [round, setRound] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [status, setStatus] = useState<"idle" | "right" | "wrong">("idle");
  const [score, setScore] = useState(0);

  const item = bank[round % bank.length];
  const words = useMemo(() => item.sentenceEn.split(/\s+/).filter(Boolean), [item.sentenceEn]);
  const order = useMemo(() => seededOrder(words.length, round + 5), [words.length, round]);
  const remaining = order.filter((index) => !placed.includes(index));
  const complete = placed.length === words.length;

  const restart = () => {
    setRound(0);
    setPlaced([]);
    setStatus("idle");
    setScore(0);
  };
  const next = () => {
    setRound((value) => value + 1);
    setPlaced([]);
    setStatus("idle");
  };
  const check = () => {
    const answer = placed.map((index) => words[index]).join(" ");
    if (answer === words.join(" ")) {
      setStatus("right");
      setScore((value) => value + 1);
    } else {
      setStatus("wrong");
    }
  };

  return (
    <div className="space-y-4">
      <GameHeader round={round + 1} total={bank.length} score={score} onRestart={restart} />

      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">
          {t("landing.games.sentence.clue")}
        </p>
        <p className="text-sm font-semibold">{item.sentenceAr}</p>
      </div>

      <div
        dir="ltr"
        className="flex min-h-16 flex-wrap content-start gap-2 rounded-2xl border border-dashed border-border/80 bg-muted/25 p-3"
      >
        {placed.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t("landing.games.sentence.hint")}</span>
        ) : (
          placed.map((index, position) => (
            <button
              key={`${index}-${position}`}
              type="button"
              disabled={status === "right"}
              onClick={() => setPlaced((value) => value.filter((_, at) => at !== position))}
              className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:border-primary"
            >
              {words[index]}
            </button>
          ))
        )}
      </div>

      <div dir="ltr" className="flex flex-wrap gap-2">
        {remaining.map((index) => (
          <button
            key={index}
            type="button"
            disabled={status === "right"}
            onClick={() => setPlaced((value) => [...value, index])}
            className="rounded-xl border border-border/70 bg-card px-3 py-1.5 text-sm font-semibold transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            {words[index]}
          </button>
        ))}
      </div>

      {status === "right" ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm">
          <Trophy className="size-5 shrink-0 text-emerald-500" aria-hidden />
          <p className="flex-1 font-semibold">{t("landing.games.correct")}</p>
          <Button size="sm" onClick={next}>
            {t("landing.games.next")}
          </Button>
        </div>
      ) : status === "wrong" ? (
        <div className="flex items-center gap-3 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm">
          <X className="size-5 shrink-0 text-rose-500" aria-hidden />
          <p className="flex-1 font-semibold">{t("landing.games.wrong")}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPlaced([]);
              setStatus("idle");
            }}
          >
            {t("landing.games.clear")}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button className="gap-2" disabled={!complete} onClick={check}>
            <Check className="size-4" aria-hidden />
            {t("landing.games.check")}
          </Button>
          <Button
            variant="ghost"
            disabled={placed.length === 0}
            onClick={() => setPlaced([])}
          >
            {t("landing.games.clear")}
          </Button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Odd one out                                                             */
/* -------------------------------------------------------------------------- */

export function OddOneOutGame({ items }: { items?: OddItem[] }) {
  const { t, pick } = useI18n();
  const bank = useMemo(() => (items && items.length > 0 ? items : DEFAULT_ODD), [items]);
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const item = bank[round % bank.length];
  const answered = picked !== null;
  const isRight = picked === item.correct;

  const restart = () => {
    setRound(0);
    setPicked(null);
    setScore(0);
  };
  const next = () => {
    setRound((value) => value + 1);
    setPicked(null);
  };
  const choose = (index: number) => {
    if (answered) return;
    setPicked(index);
    if (index === item.correct) setScore((value) => value + 1);
  };

  return (
    <div className="space-y-4">
      <GameHeader round={round + 1} total={bank.length} score={score} onRestart={restart} />

      <p className="text-base leading-7 font-bold sm:text-lg">{pick(item.promptEn, item.promptAr)}</p>
      <p className="text-xs text-muted-foreground">{t("landing.games.odd.hint")}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        {item.options.map((option, index) => {
          const chosen = picked === index;
          const showRight = answered && index === item.correct;
          return (
            <button
              key={index}
              type="button"
              onClick={() => choose(index)}
              disabled={answered}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-start text-sm font-semibold transition-all",
                showRight
                  ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  : chosen
                    ? "border-rose-400/70 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                    : "border-border/70 bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5",
              )}
            >
              <span>{pick(option.en, option.ar)}</span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {pick(option.ar, option.en)}
              </span>
            </button>
          );
        })}
      </div>

      {answered ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3 text-sm",
            isRight
              ? "border-emerald-400/40 bg-emerald-500/10"
              : "border-rose-400/40 bg-rose-500/10",
          )}
        >
          {isRight ? (
            <Trophy className="size-5 shrink-0 text-emerald-500" aria-hidden />
          ) : (
            <X className="size-5 shrink-0 text-rose-500" aria-hidden />
          )}
          <p className="flex-1 font-semibold">
            {isRight
              ? t("landing.games.correct")
              : t("landing.games.wrong_answer", {
                  answer: pick(item.options[item.correct].en, item.options[item.correct].ar),
                })}
          </p>
          <Button size="sm" onClick={next}>
            {t("landing.games.next")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Fill the gap                                                            */
/* -------------------------------------------------------------------------- */

export function GapFillGame({ items }: { items?: GapItem[] }) {
  const { t } = useI18n();
  const bank = useMemo(() => (items && items.length > 0 ? items : DEFAULT_GAP), [items]);
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const item = bank[round % bank.length];
  const [before, after = ""] = item.sentenceEn.split(/\s*___\s*/);
  const answered = picked !== null;
  const isRight = picked === item.correct;

  const restart = () => {
    setRound(0);
    setPicked(null);
    setScore(0);
  };
  const next = () => {
    setRound((value) => value + 1);
    setPicked(null);
  };
  const choose = (index: number) => {
    if (answered) return;
    setPicked(index);
    if (index === item.correct) setScore((value) => value + 1);
  };

  return (
    <div className="space-y-4">
      <GameHeader round={round + 1} total={bank.length} score={score} onRestart={restart} />

      <p className="text-base leading-8 font-bold sm:text-lg" dir="ltr">
        {before}
        <span
          className={cn(
            "mx-1 inline-flex min-w-20 justify-center rounded-lg border-2 px-2 py-0.5 align-middle text-sm",
            answered
              ? isRight
                ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                : "border-rose-400/70 bg-rose-500/10 text-rose-600 dark:text-rose-300"
              : "border-dashed border-primary/50 bg-primary/5 text-primary",
          )}
        >
          {answered ? item.options[picked].en : "———"}
        </span>
        {after}
      </p>
      <p className="text-sm text-muted-foreground">{item.sentenceAr}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        {item.options.map((option, index) => {
          const chosen = picked === index;
          const showRight = answered && index === item.correct;
          return (
            <button
              key={index}
              type="button"
              onClick={() => choose(index)}
              disabled={answered}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-start text-sm font-semibold transition-all",
                showRight
                  ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  : chosen
                    ? "border-rose-400/70 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                    : "border-border/70 bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5",
              )}
            >
              <span dir="ltr">{option.en}</span>
              <span className="text-[11px] font-medium text-muted-foreground">{option.ar}</span>
            </button>
          );
        })}
      </div>

      {answered ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3 text-sm",
            isRight
              ? "border-emerald-400/40 bg-emerald-500/10"
              : "border-rose-400/40 bg-rose-500/10",
          )}
        >
          {isRight ? (
            <Trophy className="size-5 shrink-0 text-emerald-500" aria-hidden />
          ) : (
            <X className="size-5 shrink-0 text-rose-500" aria-hidden />
          )}
          <p className="flex-1 font-semibold">
            {isRight
              ? t("landing.games.correct")
              : t("landing.games.wrong_answer", { answer: item.options[item.correct].en })}
          </p>
          <Button size="sm" onClick={next}>
            {t("landing.games.next")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
