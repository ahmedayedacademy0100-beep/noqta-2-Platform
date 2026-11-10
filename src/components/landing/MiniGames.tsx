import { DailyChallengeGame } from "@/components/student/DailyChallengeGame";
import { SituationsGame } from "@/components/student/SituationsGame";
import { GameArt, type LandingGameArtKey } from "@/components/landing/GameArt";
import { GapFillGame, OddOneOutGame, SentenceGame } from "@/components/landing/ExtraGames";
import type { CopyFn } from "@/components/landing/LandingCopy";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TiltCard } from "@/components/app/TiltCard";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  Brain,
  CalendarCheck,
  ListOrdered,
  PenLine,
  RotateCcw,
  Shapes,
  Sparkles,
  Timer,
  MessagesSquare,
  Trophy,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/* -------------------------------------------------------------------------- */
/* Memory match                                                               */
/* -------------------------------------------------------------------------- */

const PAIRS = [
  { id: "p1", left: "7 × 8", right: "56" },
  { id: "p2", left: "9 × 6", right: "54" },
  { id: "p3", left: "12 × 4", right: "48" },
  { id: "p4", left: "81 ÷ 9", right: "9" },
  { id: "p5", left: "15 + 27", right: "42" },
  { id: "p6", left: "100 − 37", right: "63" },
];

type MemoryCard = { uid: string; pairId: string; text: string; side: "left" | "right" };

/** Questions the platform owner can rewrite from Admin → Settings. */
export type LandingGameContent = {
  memory?: { left: string; right: string }[];
  sprint?: {
    promptEn: string;
    promptAr: string;
    options: { en: string; ar: string }[];
    correct: number;
  }[];
  situations?: {
    titleEn: string;
    titleAr: string;
    phrases: { en: string; ar: string }[];
  }[];
  daily?: { en: string; ar: string }[];
  sentence?: { sentenceEn: string; sentenceAr: string }[];
  odd?: {
    promptEn: string;
    promptAr: string;
    options: { en: string; ar: string }[];
    correct: number;
  }[];
  gap?: {
    sentenceEn: string;
    sentenceAr: string;
    options: { en: string; ar: string }[];
    correct: number;
  }[];
} | null;

/** Owner artwork per game; empty values fall back to the built-in art. */
export type LandingGameImages = Partial<Record<LandingGameArtKey, string>> | null;

/** Deterministic shuffle so the deck never changes during a render pass. */
function shuffleCards(cards: MemoryCard[], seed: number): MemoryCard[] {
  const out = [...cards];
  let state = seed;
  for (let index = out.length - 1; index > 0; index -= 1) {
    state = (state * 9301 + 49297) % 233280;
    const pick = Math.floor((state / 233280) * (index + 1));
    [out[index], out[pick]] = [out[pick], out[index]];
  }
  return out;
}

export function MemoryGame({ pairs }: { pairs?: { left: string; right: string }[] }) {
  const { t } = useI18n();
  // Owner-authored pairs replace the built-in deck when enough are provided.
  const bank = useMemo(
    () =>
      pairs && pairs.length >= 3
        ? pairs.map((pair, index) => ({ id: `p${index}`, left: pair.left, right: pair.right }))
        : PAIRS,
    [pairs],
  );
  const [seed, setSeed] = useState(17);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);

  const deck = useMemo(
    () =>
      shuffleCards(
        bank.flatMap((pair) => [
          { uid: `${pair.id}-l`, pairId: pair.id, text: pair.left, side: "left" as const },
          { uid: `${pair.id}-r`, pairId: pair.id, text: pair.right, side: "right" as const },
        ]),
        seed,
      ),
    [seed, bank],
  );

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const won = matched.length === bank.length;

  const reset = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setSeed((value) => value + 1);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setBusy(false);
  };

  const flip = (card: MemoryCard) => {
    if (busy || won) return;
    if (flipped.includes(card.uid) || matched.includes(card.pairId)) return;
    const next = [...flipped, card.uid];
    setFlipped(next);
    if (next.length < 2) return;
    setMoves((value) => value + 1);
    const [first, second] = next.map((uid) => deck.find((item) => item.uid === uid)!);
    if (first.pairId === second.pairId) {
      setMatched((value) => [...value, first.pairId]);
      setFlipped([]);
      return;
    }
    setBusy(true);
    timer.current = window.setTimeout(() => {
      setFlipped([]);
      setBusy(false);
    }, 760);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Sparkles className="size-4 text-nq-violet" aria-hidden />
            {t("landing.games.matched", {
              count: matched.length,
              total: bank.length,
            })}
          </span>
          <span className="text-muted-foreground">
            {t("landing.games.moves")}: {moves}
          </span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={reset}>
          <RotateCcw className="size-3.5" aria-hidden />
          {t("landing.games.newGame")}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {deck.map((card) => {
          const isOpen = flipped.includes(card.uid) || matched.includes(card.pairId);
          return (
            <button
              key={card.uid}
              type="button"
              onClick={() => flip(card)}
              aria-label={isOpen ? card.text : t("landing.games.card_hidden")}
              className="group h-20 [perspective:800px] sm:h-24"
            >
              <span
                data-flipped={isOpen}
                className="nq-flip-card relative block h-full w-full"
              >
                <span className="nq-flip-face absolute inset-0 grid place-items-center rounded-xl border border-border/70 bg-gradient-to-br from-nq-blue/12 to-nq-violet/16 text-primary transition-colors group-hover:border-primary/40">
                  <Brain className="size-5 opacity-70" aria-hidden />
                </span>
                <span
                  className={cn(
                    "nq-flip-face nq-flip-back absolute inset-0 grid place-items-center rounded-xl border-2 px-1 text-center text-sm font-extrabold tabular-nums sm:text-base",
                    matched.includes(card.pairId)
                      ? "border-emerald-400/70 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"
                      : "border-primary/40 bg-card text-foreground",
                  )}
                >
                  {card.text}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {won ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm">
          <Trophy className="size-5 shrink-0 text-emerald-500" aria-hidden />
          <p className="flex-1 font-semibold">
            {t("landing.games.won", { moves })}
          </p>
          <Button size="sm" onClick={reset}>
            {t("landing.games.again")}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("landing.games.memory_hint")}</p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sprint quiz                                                                */
/* -------------------------------------------------------------------------- */

const SPRINT_DURATION = 45;

type SprintQuestion = {
  en: string;
  ar: string;
  options: { en: string; ar: string }[];
  correct: number;
};

const SPRINT_BANK: SprintQuestion[] = [
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
  },
  {
    en: "Which planet is known as the Red Planet?",
    ar: "أي كوكب يُعرف بالكوكب الأحمر؟",
    options: [
      { en: "Venus", ar: "الزهرة" },
      { en: "Mars", ar: "المريخ" },
      { en: "Jupiter", ar: "المشتري" },
      { en: "Mercury", ar: "عطارد" },
    ],
    correct: 1,
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
  },
  {
    en: "8 × 7 = ?",
    ar: "٨ × ٧ = ؟",
    options: [
      { en: "48", ar: "٤٨" },
      { en: "54", ar: "٥٤" },
      { en: "56", ar: "٥٦" },
      { en: "64", ar: "٦٤" },
    ],
    correct: 2,
  },
  {
    en: "Which of these is a renewable energy source?",
    ar: "أي مما يلي مصدر طاقة متجددة؟",
    options: [
      { en: "Coal", ar: "الفحم" },
      { en: "Solar", ar: "الشمس" },
      { en: "Diesel", ar: "الديزل" },
      { en: "Natural gas", ar: "الغاز الطبيعي" },
    ],
    correct: 1,
  },
  {
    en: "The largest ocean on Earth is…",
    ar: "أكبر محيط على الأرض هو…",
    options: [
      { en: "Atlantic", ar: "الأطلسي" },
      { en: "Indian", ar: "الهندي" },
      { en: "Pacific", ar: "الهادئ" },
      { en: "Arctic", ar: "المتجمد الشمالي" },
    ],
    correct: 2,
  },
  {
    en: "√81 = ?",
    ar: "√٨١ = ؟",
    options: [
      { en: "7", ar: "٧" },
      { en: "8", ar: "٨" },
      { en: "9", ar: "٩" },
      { en: "11", ar: "١١" },
    ],
    correct: 2,
  },
  {
    en: "A triangle's interior angles add up to…",
    ar: "مجموع زوايا المثلث الداخلية يساوي…",
    options: [
      { en: "90°", ar: "٩٠°" },
      { en: "180°", ar: "١٨٠°" },
      { en: "270°", ar: "٢٧٠°" },
      { en: "360°", ar: "٣٦٠°" },
    ],
    correct: 1,
  },
  {
    en: "Which gas do plants absorb for photosynthesis?",
    ar: "أي غاز تمتصه النباتات في البناء الضوئي؟",
    options: [
      { en: "Oxygen", ar: "الأكسجين" },
      { en: "Nitrogen", ar: "النيتروجين" },
      { en: "Carbon dioxide", ar: "ثاني أكسيد الكربون" },
      { en: "Hydrogen", ar: "الهيدروجين" },
    ],
    correct: 2,
  },
  {
    en: "The past tense of “write” is…",
    ar: "الماضي من الفعل «write» هو…",
    options: [
      { en: "writed", ar: "writed" },
      { en: "wrote", ar: "wrote" },
      { en: "written", ar: "written" },
      { en: "writing", ar: "writing" },
    ],
    correct: 1,
  },
];

export function SprintGame({ bank }: { bank?: SprintQuestion[] }) {
  const { t, pick } = useI18n();
  const questions = bank && bank.length > 0 ? bank : SPRINT_BANK;
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(SPRINT_DURATION);
  const [score, setScore] = useState(0);
  const [index, setIndex] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const endsAt = useRef(0);
  const storageKey = "nq.game.sprint.best";

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
      setTime(left);
      if (left === 0) {
        setRunning(false);
        setBest((previous) => {
          const next = Math.max(previous ?? 0, score);
          try {
            window.localStorage.setItem(storageKey, String(next));
          } catch {
            // Storage can be unavailable in private mode — the score still shows.
          }
          return next;
        });
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, score, storageKey]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      const parsed = stored === null ? null : Number(stored);
      if (parsed !== null && Number.isFinite(parsed)) {
        const frame = requestAnimationFrame(() => setBest(parsed));
        return () => cancelAnimationFrame(frame);
      }
    } catch {
      // Ignore storage failures.
    }
  }, [storageKey]);

  const start = () => {
    setScore(0);
    setIndex(0);
    setTime(SPRINT_DURATION);
    endsAt.current = Date.now() + SPRINT_DURATION * 1000;
    setRunning(true);
  };

  const answer = (choice: number) => {
    if (!running) return;
    if (choice === questions[index].correct) {
      setScore((value) => value + 1);
      setIndex((value) => (value + 1) % questions.length);
    } else {
      setTime((value) => Math.max(1, value - 2));
      endsAt.current -= 2000;
    }
  };

  const question = questions[index];
  const finished = !running && time === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm font-semibold">
          <span className="inline-flex items-center gap-1.5">
            <Timer className="size-4 text-nq-turquoise" aria-hidden />
            {time}s
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Zap className="size-4 text-nq-yellow" aria-hidden />
            {t("landing.games.score")}: {score}
          </span>
          {best !== null ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Trophy className="size-3.5" aria-hidden />
              {t("landing.games.best")}: {best}
            </span>
          ) : null}
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={start}>
          <RotateCcw className="size-3.5" aria-hidden />
          {running ? t("landing.games.restart") : t("landing.games.start")}
        </Button>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gradient-to-r from-nq-turquoise via-nq-blue to-nq-violet transition-[width] duration-500"
          style={{ width: `${(time / SPRINT_DURATION) * 100}%` }}
        />
      </div>

      {!running && time === SPRINT_DURATION ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/30 p-6 text-center">
          <Zap className="mx-auto size-8 text-primary" aria-hidden />
          <p className="mt-3 text-sm font-semibold">{t("landing.games.sprint_intro")}</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-muted-foreground">
            {t("landing.games.sprint_rules")}
          </p>
          <Button className="mt-4 gap-2" onClick={start}>
            <Zap className="size-4" aria-hidden />
            {t("landing.games.start")}
          </Button>
        </div>
      ) : finished ? (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-6 text-center">
          <Trophy className="mx-auto size-8 text-emerald-500" aria-hidden />
          <p className="mt-3 text-lg font-extrabold">
            {t("landing.games.sprint_result", { score })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("landing.games.best")}: {best ?? score}
          </p>
          <Button className="mt-4 gap-2" onClick={start}>
            <RotateCcw className="size-4" aria-hidden />
            {t("landing.games.again")}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-base leading-7 font-bold sm:text-lg">
            {pick(question.en, question.ar)}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {question.options.map((option, optionIndex) => (
              <button
                key={`${index}-${optionIndex}`}
                type="button"
                onClick={() => answer(optionIndex)}
                className="rounded-xl border border-border/70 bg-card px-3 py-2.5 text-start text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5"
              >
                {pick(option.en, option.ar)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Showcase                                                                   */
/* -------------------------------------------------------------------------- */

export function GameShowcase({
  className,
  copy,
  content,
  images,
}: {
  className?: string;
  copy?: CopyFn;
  content?: LandingGameContent;
  images?: LandingGameImages;
}) {
  const { t: translate } = useI18n();
  // Owner-edited wording when provided, otherwise the shipped translation.
  const t = copy ?? translate;
  const [open, setOpen] = useState<LandingGameArtKey | null>(null);

  const games = [
    {
      id: "memory" as const,
      title: t("landing.games.memory.title"),
      body: t("landing.games.memory.body"),
      icon: Brain,
      gradient: "from-nq-violet to-nq-blue",
      meta: t("landing.games.memory.meta"),
    },
    {
      id: "sprint" as const,
      title: t("landing.games.sprint.title"),
      body: t("landing.games.sprint.body"),
      icon: Zap,
      gradient: "from-nq-turquoise to-nq-blue",
      meta: t("landing.games.sprint.meta"),
    },
    {
      id: "situations" as const,
      title: t("landing.games.situations.title"),
      body: t("landing.games.situations.body"),
      icon: MessagesSquare,
      gradient: "from-nq-coral to-nq-violet",
      meta: t("landing.games.situations.meta"),
    },
    {
      id: "daily" as const,
      title: t("landing.games.daily.title"),
      body: t("landing.games.daily.body"),
      icon: CalendarCheck,
      gradient: "from-nq-yellow to-nq-coral",
      meta: t("landing.games.daily.meta"),
    },
    {
      id: "sentence" as const,
      title: t("landing.games.sentence.title"),
      body: t("landing.games.sentence.body"),
      icon: ListOrdered,
      gradient: "from-nq-blue to-nq-turquoise",
      meta: t("landing.games.sentence.meta"),
    },
    {
      id: "odd" as const,
      title: t("landing.games.odd.title"),
      body: t("landing.games.odd.body"),
      icon: Shapes,
      gradient: "from-nq-violet to-nq-coral",
      meta: t("landing.games.odd.meta"),
    },
    {
      id: "gap" as const,
      title: t("landing.games.gap.title"),
      body: t("landing.games.gap.body"),
      icon: PenLine,
      gradient: "from-nq-turquoise to-nq-yellow",
      meta: t("landing.games.gap.meta"),
    },
  ];

  const active = games.find((game) => game.id === open);

  return (
    <>
      <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
        {games.map((game) => (
          <TiltCard key={game.id} className="h-full" intensity={7}>
            <div className="nq-card flex h-full flex-col gap-3 p-3 sm:p-4">
              <GameArt
                artKey={game.id}
                icon={game.icon}
                gradient={game.gradient}
                image={images?.[game.id]}
              />
              <div className="min-w-0 flex-1 px-1">
                <h3 className="text-base font-extrabold">{game.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {game.body}
                </p>
                <p className="mt-2 text-xs font-semibold text-primary">{game.meta}</p>
              </div>
              <Button
                variant="outline"
                className="w-full justify-between gap-2"
                onClick={() => setOpen(game.id)}
              >
                {t("landing.games.play")}
                <span className="text-xs text-muted-foreground">3D</span>
              </Button>
            </div>
          </TiltCard>
        ))}
      </div>

      <Dialog open={open !== null} onOpenChange={(value) => !value && setOpen(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
            <DialogDescription>{active?.body}</DialogDescription>
          </DialogHeader>
          {open === "memory" ? <MemoryGame pairs={content?.memory} /> : null}
          {open === "sprint" ? (
            <SprintGame
              bank={content?.sprint?.map((question) => ({
                en: question.promptEn,
                ar: question.promptAr,
                options: question.options,
                correct: question.correct,
              }))}
            />
          ) : null}
          {open === "situations" ? <SituationsGame situations={content?.situations} /> : null}
          {open === "daily" ? <DailyChallengeGame phrases={content?.daily} /> : null}
          {open === "sentence" ? <SentenceGame items={content?.sentence} /> : null}
          {open === "odd" ? <OddOneOutGame items={content?.odd} /> : null}
          {open === "gap" ? <GapFillGame items={content?.gap} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
