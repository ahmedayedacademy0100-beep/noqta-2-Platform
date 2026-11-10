import {
  EmptyState,
  Field,
  LoadingBlock,
  PageHeader,
  SectionCard,
} from "@/components/app/ui";
import { StudentAvatar } from "@/components/student/StudentAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  GAME_TEMPLATES,
  type GameTemplate,
  type GameType,
  typeKey as gameTypeKey,
} from "@/components/teacher/gameTemplates";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useI18n } from "@/i18n";
import { describeError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Eye,
  Gamepad2,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type DraftOption = { textEn: string; textAr: string; emoji: string };
type DraftQuestion = {
  promptEn: string;
  promptAr: string;
  phraseEn: string;
  options: DraftOption[];
  correctIndex: number;
};

const emptyQuestion = (): DraftQuestion => ({
  promptEn: "",
  promptAr: "",
  phraseEn: "",
  options: [
    { textEn: "", textAr: "", emoji: "" },
    { textEn: "", textAr: "", emoji: "" },
  ],
  correctIndex: 0,
});

type GameRow = {
  gameId: Id<"class_games">;
  classId: Id<"classes">;
  classNameEn: string;
  classNameAr: string;
  titleEn: string;
  titleAr: string;
  status: "open" | "closed";
  gameType: GameType;
  questions: {
    promptEn: string;
    promptAr: string;
    phraseEn?: string;
    options: { textEn: string; textAr: string; emoji?: string }[];
    correctIndex: number;
  }[];
  questionCount: number;
  players: number;
  averagePercent: number | null;
  createdAt: number;
};

export default function ClassGames() {
  const { t, pick, formatNumber, lang } = useI18n();
  const classes = useQuery(api.games.teacherClasses, {});
  const games = useQuery(api.games.myGames, {});
  const createGame = useMutation(api.games.createGame);
  const updateGame = useMutation(api.games.updateGame);
  const setStatus = useMutation(api.games.setGameStatus);
  const removeGame = useMutation(api.games.deleteGame);

  const [editing, setEditing] = useState<GameRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [classId, setClassId] = useState<string>("");
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [gameType, setGameType] = useState<GameType>("quiz");
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<GameRow | null>(null);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setClassId(classes?.[0]?.classId ?? "");
    setTitleAr("");
    setTitleEn("");
    setQuestions([emptyQuestion()]);
    setGameType("quiz");
  };

  const openEdit = (game: GameRow) => {
    setEditing(game);
    setCreating(true);
    setClassId(game.classId);
    setTitleAr(game.titleAr);
    setTitleEn(game.titleEn);
    setGameType(game.gameType);
    setQuestions(
      game.questions.map((question) => ({
        promptEn: question.promptEn,
        promptAr: question.promptAr,
        phraseEn: question.phraseEn ?? "",
        options: question.options.map((option) => ({
          textEn: option.textEn,
          textAr: option.textAr,
          emoji: option.emoji ?? "",
        })),
        correctIndex: question.correctIndex,
      })),
    );
  };

  /** Swaps in the starter questions of a game, keeping manual edits safe. */
  const applyType = (template: GameTemplate) => {
    setGameType(template.id);
    if (template.questions.length === 0) return;
    const hasContent = questions.some(
      (question) =>
        question.promptAr.trim().length > 0 ||
        question.promptEn.trim().length > 0 ||
        question.phraseEn.trim().length > 0 ||
        question.options.some(
          (option) => option.textAr.trim().length > 0 || option.textEn.trim().length > 0,
        ),
    );
    if (hasContent && !window.confirm(t("teacher.games.type_replace"))) return;
    setQuestions(template.questions.map((question) => ({
      ...question,
      options: question.options.map((option) => ({ ...option })),
    })));
    if (titleAr.trim().length === 0 && titleEn.trim().length === 0) {
      setTitleAr(template.titleAr);
      setTitleEn(template.titleEn);
    }
    toast.success(t("teacher.games.starter_loaded"));
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const patchQuestion = (index: number, patch: Partial<DraftQuestion>) => {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    );
  };

  const patchOption = (questionIndex: number, optionIndex: number, patch: Partial<DraftOption>) => {
    setQuestions((current) =>
      current.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              options: question.options.map((option, innerIndex) =>
                innerIndex === optionIndex ? { ...option, ...patch } : option,
              ),
            }
          : question,
      ),
    );
  };

  const submit = async () => {
    setBusy(true);
    try {
      const payload = questions.map((question) => ({
        promptEn: question.promptEn,
        promptAr: question.promptAr,
        phraseEn: question.phraseEn || undefined,
        options: question.options.map((option) => ({
          textEn: option.textEn,
          textAr: option.textAr,
          emoji: option.emoji || undefined,
        })),
        correctIndex: question.correctIndex,
      }));
      if (editing) {
        await updateGame({
          gameId: editing.gameId,
          titleEn,
          titleAr,
          gameType,
          questions: payload,
        });
      } else {
        if (!classId) {
          toast.error(t("teacher.games.need_class"));
          return;
        }
        await createGame({
          classId: classId as Id<"classes">,
          titleEn,
          titleAr,
          gameType,
          questions: payload,
        });
      }
      toast.success(editing ? t("teacher.games.saved") : t("teacher.games.created"));
      close();
    } catch (cause) {
      toast.error(describeError(cause, t, lang));
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (game: GameRow) => {
    try {
      await setStatus({
        gameId: game.gameId,
        status: game.status === "open" ? "closed" : "open",
      });
    } catch (cause) {
      toast.error(describeError(cause, t, lang));
    }
  };

  const deleteGame = async (game: GameRow) => {
    if (!window.confirm(t("teacher.games.confirm_delete"))) return;
    try {
      await removeGame({ gameId: game.gameId });
      toast.success(t("teacher.games.deleted"));
    } catch (cause) {
      toast.error(describeError(cause, t, lang));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("nav.teacher.games")}
        title={t("teacher.games.title")}
        subtitle={t("teacher.games.sub")}
        actions={
          <Button className="gap-2" onClick={openCreate} disabled={!classes || classes.length === 0}>
            <Plus className="size-4" aria-hidden />
            {t("teacher.games.create")}
          </Button>
        }
      />

      {games === undefined ? (
        <LoadingBlock />
      ) : games.length === 0 ? (
        <EmptyState
          title={t("teacher.games.empty")}
          body={t("teacher.games.empty_body")}
          icon={Gamepad2}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {games.map((game) => (
            <SectionCard
              key={game.gameId}
              title={pick(game.titleEn, game.titleAr)}
              description={`${pick(game.classNameEn, game.classNameAr)} · ${t(gameTypeKey(game.gameType))} · ${formatNumber(game.questionCount)} ${t("teacher.games.questions")}`}
              actions={
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-bold",
                    game.status === "open"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {game.status === "open" ? t("teacher.games.open") : t("teacher.games.closed")}
                </span>
              }
            >
              <div className="space-y-3">
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-secondary/60 p-2">
                    <dt className="text-muted-foreground">{t("teacher.games.players")}</dt>
                    <dd className="font-black tabular-nums">{formatNumber(game.players)}</dd>
                  </div>
                  <div className="rounded-xl bg-secondary/60 p-2">
                    <dt className="text-muted-foreground">{t("teacher.games.average")}</dt>
                    <dd className="font-black tabular-nums">
                      {game.averagePercent === null ? "—" : `${formatNumber(game.averagePercent)}%`}
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setViewing(game)}>
                    <Eye className="size-3.5" aria-hidden />
                    {t("teacher.games.results")}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(game)}>
                    <Pencil className="size-3.5" aria-hidden />
                    {t("common.edit")}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void toggleStatus(game)}>
                    {game.status === "open" ? (
                      <Lock className="size-3.5" aria-hidden />
                    ) : (
                      <LockOpen className="size-3.5" aria-hidden />
                    )}
                    {game.status === "open" ? t("teacher.games.close") : t("teacher.games.reopen")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive"
                    onClick={() => void deleteGame(game)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {/* ------------------------------ Builder ------------------------------ */}
      <Dialog open={creating} onOpenChange={(value) => !value && close()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("teacher.games.edit") : t("teacher.games.create")}
            </DialogTitle>
            <DialogDescription>{t("teacher.games.builder_hint")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Field label={t("teacher.games.type")}>
              <div className="grid gap-2 sm:grid-cols-2">
                {GAME_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  const active = gameType === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => applyType(template)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-start text-xs font-bold transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {t(template.titleKey)}
                    </button>
                  );
                })}
              </div>
            </Field>
            <p className="text-[11px] leading-5 text-muted-foreground">
              {t("teacher.games.type_hint")}
            </p>

            {!editing ? (
              <Field label={t("teacher.games.class")} required>
                <select
                  value={classId}
                  onChange={(event) => setClassId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">{t("teacher.games.need_class")}</option>
                  {(classes ?? []).map((cls) => (
                    <option key={cls.classId} value={cls.classId}>
                      {pick(cls.nameEn, cls.nameAr)}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("teacher.games.title_ar")} required>
                <Input value={titleAr} onChange={(event) => setTitleAr(event.target.value)} />
              </Field>
              <Field label={t("teacher.games.title_en")}>
                <Input
                  dir="ltr"
                  value={titleEn}
                  onChange={(event) => setTitleEn(event.target.value)}
                />
              </Field>
            </div>

            <div className="space-y-4">
              {questions.map((question, questionIndex) => (
                <div key={questionIndex} className="rounded-2xl border border-border/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">
                      {t("teacher.games.question")} {formatNumber(questionIndex + 1)}
                    </p>
                    {questions.length > 1 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-destructive"
                        onClick={() =>
                          setQuestions((current) =>
                            current.filter((_, index) => index !== questionIndex),
                          )
                        }
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        {t("common.delete")}
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-2">
                    <Input
                      placeholder={t("teacher.games.prompt_ar")}
                      value={question.promptAr}
                      onChange={(event) =>
                        patchQuestion(questionIndex, { promptAr: event.target.value })
                      }
                    />
                    <Input
                      dir="ltr"
                      placeholder={t("teacher.games.prompt_en")}
                      value={question.promptEn}
                      onChange={(event) =>
                        patchQuestion(questionIndex, { promptEn: event.target.value })
                      }
                    />
                    <Input
                      dir="ltr"
                      placeholder={t("teacher.games.phrase_en")}
                      value={question.phraseEn}
                      onChange={(event) =>
                        patchQuestion(questionIndex, { phraseEn: event.target.value })
                      }
                    />
                  </div>

                  <div className="mt-3 space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={t("teacher.games.correct")}
                          aria-pressed={question.correctIndex === optionIndex}
                          onClick={() =>
                            patchQuestion(questionIndex, { correctIndex: optionIndex })
                          }
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-black",
                            question.correctIndex === optionIndex
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          ✓
                        </button>
                        <Input
                          placeholder={t("teacher.games.option_ar")}
                          value={option.textAr}
                          onChange={(event) =>
                            patchOption(questionIndex, optionIndex, { textAr: event.target.value })
                          }
                        />
                        <Input
                          dir="ltr"
                          placeholder={t("teacher.games.option_en")}
                          value={option.textEn}
                          onChange={(event) =>
                            patchOption(questionIndex, optionIndex, { textEn: event.target.value })
                          }
                        />
                      </div>
                    ))}
                    {question.options.length < 4 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        onClick={() =>
                          patchQuestion(questionIndex, {
                            options: [
                              ...question.options,
                              { textEn: "", textAr: "", emoji: "" },
                            ],
                          })
                        }
                      >
                        <Plus className="size-3.5" aria-hidden />
                        {t("teacher.games.add_option")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setQuestions((current) => [...current, emptyQuestion()])}
              >
                <Plus className="size-4" aria-hidden />
                {t("teacher.games.add_question")}
              </Button>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button type="button" className="flex-1 gap-2" disabled={busy} onClick={() => void submit()}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------------ Results ------------------------------ */}
      <Dialog open={viewing !== null} onOpenChange={(value) => !value && setViewing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {viewing ? pick(viewing.titleEn, viewing.titleAr) : ""}
            </DialogTitle>
            <DialogDescription>{t("teacher.games.results_hint")}</DialogDescription>
          </DialogHeader>
          {viewing ? <GameResults gameId={viewing.gameId} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GameResults({ gameId }: { gameId: Id<"class_games"> }) {
  const { t, formatNumber } = useI18n();
  const rows = useQuery(api.games.gameResults, { gameId });
  if (rows === undefined) return <LoadingBlock />;
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">
        <Trophy className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <p className="mt-2">{t("teacher.games.no_results")}</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/60">
      {rows.map((row) => (
        <li key={row.studentId} className="flex items-center gap-3 py-2.5">
          <StudentAvatar avatar={row.avatar} name={row.name} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.name}</span>
          <span className="text-sm font-black tabular-nums">
            {formatNumber(row.score)} / {formatNumber(row.total)}
          </span>
        </li>
      ))}
    </ul>
  );
}
