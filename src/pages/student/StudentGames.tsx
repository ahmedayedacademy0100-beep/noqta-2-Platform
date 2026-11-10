import { PageHeader, Reveal } from "@/components/app/ui";
import { TiltCard } from "@/components/app/TiltCard";
import { MemoryGame, SprintGame } from "@/components/landing/MiniGames";
import { ClassGamePlayer } from "@/components/student/ClassGamePlayer";
import { typeKey as gameTypeKey } from "@/components/teacher/gameTemplates";
import { DailyChallengeGame } from "@/components/student/DailyChallengeGame";
import { SituationsGame } from "@/components/student/SituationsGame";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  Brain,
  CalendarCheck,
  Gauge,
  Languages,
  Loader2,
  Play,
  Sparkles,
  Timer,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";

const SPRINT_BEST_KEY = "nq.game.sprint.best";

type GameId = "memory" | "sprint" | "situations" | "daily";

export default function StudentGames() {
  const { t, pick, formatNumber } = useI18n();
  const [open, setOpen] = useState<GameId | null>(null);
  const [activeClassGame, setActiveClassGame] = useState<Id<"class_games"> | null>(null);
  const classGames = useQuery(api.games.myClassGames, {});
  const [sprintBest, setSprintBest] = useState<number | null>(() => {
    try {
      const stored = window.localStorage.getItem(SPRINT_BEST_KEY);
      const parsed = stored === null ? null : Number(stored);
      return parsed !== null && Number.isFinite(parsed) ? parsed : null;
    } catch {
      // Storage can be unavailable in private mode; the games still work.
    }
    return null;
  });

  /** Re-read the stored best score when a game dialog closes. */
  const closeGame = () => {
    setOpen(null);
    setActiveClassGame(null);
    try {
      const stored = window.localStorage.getItem(SPRINT_BEST_KEY);
      const parsed = stored === null ? null : Number(stored);
      if (parsed !== null && Number.isFinite(parsed)) setSprintBest(parsed);
    } catch {
      // Keep the previous value.
    }
  };

  const games: {
    id: GameId;
    title: string;
    body: string;
    icon: typeof Brain;
    gradient: string;
    glow: string;
    category: string;
    difficulty: string;
    meta: string;
    best: string;
  }[] = [
    {
      id: "situations",
      title: t("games.situations.title"),
      body: t("games.situations.body"),
      icon: Languages,
      gradient: "from-nq-blue via-[#4C7DFF] to-nq-violet",
      glow: "nq-glow-blue",
      category: t("games.category.language"),
      difficulty: t("games.difficulty.easy"),
      meta: pick("6 situations · 24 phrases", "٦ مواقف · ٢٤ جملة"),
      best: t("games.best_none"),
    },
    {
      id: "daily",
      title: t("games.daily.title"),
      body: t("games.daily.body"),
      icon: CalendarCheck,
      gradient: "from-nq-yellow via-[#F7A928] to-nq-coral",
      glow: "nq-glow-gold",
      category: t("games.category.daily"),
      difficulty: t("games.difficulty.medium"),
      meta: pick("5 questions · new set daily", "٥ أسئلة · تتغير كل يوم"),
      best: t("games.best_none"),
    },
    {
      id: "memory",
      title: t("landing.games.memory.title"),
      body: t("landing.games.memory.body"),
      icon: Brain,
      gradient: "from-nq-violet via-[#5B63F0] to-nq-blue",
      glow: "nq-glow-violet",
      category: t("games.category.memory"),
      difficulty: t("games.difficulty.easy"),
      meta: pick("6 pairs · 12 cards", "٦ أزواج · ١٢ بطاقة"),
      best: t("games.best_none"),
    },
    {
      id: "sprint",
      title: t("landing.games.sprint.title"),
      body: t("landing.games.sprint.body"),
      icon: Zap,
      gradient: "from-nq-turquoise via-nq-blue to-nq-violet",
      glow: "nq-glow-blue",
      category: t("games.category.speed"),
      difficulty: t("games.difficulty.medium"),
      meta: pick("45 seconds · mixed subjects", "٤٥ ثانية · مواد متنوعة"),
      best:
        sprintBest === null
          ? t("games.best_none")
          : `${formatNumber(sprintBest)} ${t("landing.games.score")}`,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("nav.games")}
        title={t("games.title")}
        subtitle={t("games.subtitle")}
        actions={
          <span className="chip gap-1.5">
            <Sparkles className="size-3.5 text-nq-yellow" aria-hidden />
            {formatNumber(games.length)}
          </span>
        }
      />

      <div className="nq-scene grid gap-4 sm:grid-cols-2">
        {games.map((game, index) => (
          <Reveal key={game.id} delay={index * 0.06}>
            <TiltCard className="h-full" intensity={8}>
              <article
                className={cn(
                  "nq-card relative flex h-full flex-col overflow-hidden p-0",
                  game.glow,
                )}
              >
                {/* Illustration area: a layered 3D stage, no image request. */}
                <div
                  className={cn(
                    "nq-sparkle-field relative grid h-40 place-items-center bg-gradient-to-br",
                    game.gradient,
                  )}
                >
                  <span
                    aria-hidden
                    className="absolute inset-x-6 bottom-3 h-8 rounded-full bg-black/25 blur-xl"
                  />
                  <span className="relative grid size-20 place-items-center rounded-[26px] border border-white/30 bg-white/15 text-white shadow-[0_20px_40px_-20px_rgb(0_0_0/0.7)] backdrop-blur-sm nq-depth">
                    <game.icon className="size-10" aria-hidden />
                  </span>
                  <span className="absolute end-3 top-3 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
                    {game.category}
                  </span>
                  <span className="absolute start-3 bottom-3 inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
                    <Gauge className="size-3" aria-hidden />
                    {game.difficulty}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="min-w-0">
                    <h2 className="text-base font-black">{game.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{game.body}</p>
                  </div>

                  <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <div className="inline-flex items-center gap-1">
                      <Timer className="size-3" aria-hidden />
                      {game.meta}
                    </div>
                    <div className="inline-flex items-center gap-1">
                      <Trophy className="size-3 text-amber-500" aria-hidden />
                      {t("games.best")}: {game.best}
                    </div>
                  </dl>

                  <Button
                    className="mt-auto w-full justify-between gap-2"
                    onClick={() => setOpen(game.id)}
                  >
                    {t("games.play")}
                    <Play className="size-4" aria-hidden />
                  </Button>
                </div>
              </article>
            </TiltCard>
          </Reveal>
        ))}
      </div>

      {/* ------------------------- Teacher class games ------------------------ */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black tracking-tight">
            <Users className="size-5 text-primary" aria-hidden />
            {t("games.class.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("games.class.body")}</p>
        </div>

        {classGames === undefined ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("common.loading")}
          </div>
        ) : classGames.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/25 p-6 text-center">
            <p className="text-3xl">🎯</p>
            <p className="mt-2 text-sm font-bold">{t("games.class.none")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("games.class.none_body")}</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {classGames.map((game) => (
              <article key={game.gameId} className="nq-card nq-card-hover flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black">{pick(game.titleEn, game.titleAr)}</h3>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {pick(game.classNameEn, game.classNameAr)} · {game.teacherName}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                      {t(gameTypeKey(game.gameType))}
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                      {formatNumber(game.questionCount)} {t("teacher.games.questions")}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {game.bestScore === null
                    ? t("games.class.not_played")
                    : `${t("games.best")}: ${formatNumber(game.bestScore)} / ${formatNumber(game.questionCount)}`}
                  {game.attempts > 0
                    ? ` · ${formatNumber(game.attempts)} ${t("games.attempts")}`
                    : ""}
                </p>
                <Button
                  size="sm"
                  className="mt-auto w-full justify-between gap-2"
                  onClick={() => setActiveClassGame(game.gameId)}
                >
                  {t("games.play")}
                  <Play className="size-4" aria-hidden />
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="rounded-xl border border-border/60 bg-muted/30 p-3 text-[11px] leading-5 text-muted-foreground">
        {t("games.note")}
      </p>

      <Dialog open={open !== null} onOpenChange={(value) => !value && closeGame()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {open === "memory"
                ? t("landing.games.memory.title")
                : open === "sprint"
                  ? t("landing.games.sprint.title")
                  : open === "situations"
                    ? t("games.situations.title")
                    : t("games.daily.title")}
            </DialogTitle>
            <DialogDescription>
              {open === "memory"
                ? t("landing.games.memory.body")
                : open === "sprint"
                  ? t("landing.games.sprint.body")
                  : open === "situations"
                    ? t("games.situations.body")
                    : t("games.daily.body")}
            </DialogDescription>
          </DialogHeader>
          {open === "memory" ? <MemoryGame /> : null}
          {open === "sprint" ? <SprintGame /> : null}
          {open === "situations" ? <SituationsGame /> : null}
          {open === "daily" ? <DailyChallengeGame /> : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeClassGame !== null}
        onOpenChange={(value) => !value && setActiveClassGame(null)}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("games.class.title")}</DialogTitle>
            <DialogDescription>{t("games.class.play_hint")}</DialogDescription>
          </DialogHeader>
          {activeClassGame ? <ClassGamePlayer gameId={activeClassGame} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
