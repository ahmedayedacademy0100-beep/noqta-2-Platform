import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { describeError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { Check, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type MemoryPair = { left: string; right: string };
type SprintQuestion = {
  promptEn: string;
  promptAr: string;
  options: { en: string; ar: string }[];
  correct: number;
};
type SituationDraft = {
  titleEn: string;
  titleAr: string;
  phrases: { en: string; ar: string }[];
};
type Phrase = { en: string; ar: string };
type SentenceDraft = { sentenceEn: string; sentenceAr: string };
type OddDraft = {
  promptEn: string;
  promptAr: string;
  options: Phrase[];
  correct: number;
};
type GapDraft = {
  sentenceEn: string;
  sentenceAr: string;
  options: Phrase[];
  correct: number;
};
type GamesDraft = {
  memory: MemoryPair[];
  sprint: SprintQuestion[];
  situations: SituationDraft[];
  daily: Phrase[];
  sentence: SentenceDraft[];
  odd: OddDraft[];
  gap: GapDraft[];
};
type Tab = keyof GamesDraft;

type TabKey =
  | "admin.games.tab.memory"
  | "admin.games.tab.sprint"
  | "admin.games.tab.situations"
  | "admin.games.tab.daily"
  | "admin.games.tab.sentence"
  | "admin.games.tab.odd"
  | "admin.games.tab.gap";

export type LandingGamesSettings = {
  memory?: MemoryPair[];
  sprint?: SprintQuestion[];
  situations?: SituationDraft[];
  daily?: Phrase[];
  sentence?: SentenceDraft[];
  odd?: OddDraft[];
  gap?: GapDraft[];
} | null;

type ImageKey = "memory" | "sprint" | "situations" | "daily" | "sentence" | "odd" | "gap";
type ImageDraft = Record<ImageKey, string>;
export type LandingGameImages = Partial<Record<ImageKey, string>> | null;

type GameTitleKey =
  | "landing.games.memory.title"
  | "landing.games.sprint.title"
  | "landing.games.situations.title"
  | "landing.games.daily.title"
  | "landing.games.sentence.title"
  | "landing.games.odd.title"
  | "landing.games.gap.title";

const IMAGE_FIELDS: { id: ImageKey; key: GameTitleKey }[] = [
  { id: "memory", key: "landing.games.memory.title" },
  { id: "sprint", key: "landing.games.sprint.title" },
  { id: "situations", key: "landing.games.situations.title" },
  { id: "daily", key: "landing.games.daily.title" },
  { id: "sentence", key: "landing.games.sentence.title" },
  { id: "odd", key: "landing.games.odd.title" },
  { id: "gap", key: "landing.games.gap.title" },
];

const TABS: { id: Tab; key: TabKey }[] = [
  { id: "memory", key: "admin.games.tab.memory" },
  { id: "sprint", key: "admin.games.tab.sprint" },
  { id: "situations", key: "admin.games.tab.situations" },
  { id: "daily", key: "admin.games.tab.daily" },
  { id: "sentence", key: "admin.games.tab.sentence" },
  { id: "odd", key: "admin.games.tab.odd" },
  { id: "gap", key: "admin.games.tab.gap" },
];

const emptyDraft = (): GamesDraft => ({
  memory: [],
  sprint: [],
  situations: [],
  daily: [],
  sentence: [],
  odd: [],
  gap: [],
});

const emptyImages = (): ImageDraft => ({
  memory: "",
  sprint: "",
  situations: "",
  daily: "",
  sentence: "",
  odd: "",
  gap: "",
});

function normalizeImages(value?: LandingGameImages): ImageDraft {
  const base = emptyImages();
  if (!value) return base;
  for (const key of Object.keys(base) as ImageKey[]) base[key] = value[key] ?? "";
  return base;
}

function normalize(value?: LandingGamesSettings): GamesDraft {
  return {
    memory: value?.memory ?? [],
    sprint: value?.sprint ?? [],
    situations: value?.situations ?? [],
    daily: value?.daily ?? [],
    sentence: value?.sentence ?? [],
    odd: value?.odd ?? [],
    gap: value?.gap ?? [],
  };
}

const emptySprint = (): SprintQuestion => ({
  promptEn: "",
  promptAr: "",
  options: [
    { en: "", ar: "" },
    { en: "", ar: "" },
    { en: "", ar: "" },
  ],
  correct: 0,
});

const emptyOdd = (): OddDraft => ({
  promptEn: "",
  promptAr: "",
  options: [
    { en: "", ar: "" },
    { en: "", ar: "" },
    { en: "", ar: "" },
    { en: "", ar: "" },
  ],
  correct: 0,
});

const emptyGap = (): GapDraft => ({
  sentenceEn: "",
  sentenceAr: "",
  options: [
    { en: "", ar: "" },
    { en: "", ar: "" },
    { en: "", ar: "" },
  ],
  correct: 0,
});

/** Owner editor for the questions and artwork of the seven games on the home page. */
export function LandingGamesEditor({
  settings,
}: {
  settings: {
    landingGames?: LandingGamesSettings;
    landingGameImages?: LandingGameImages;
  };
}) {
  const { t, lang } = useI18n();
  const saveSettings = useMutation(api.admin.updateSettings);
  const [draft, setDraft] = useState<GamesDraft>(() => normalize(settings.landingGames));
  const [images, setImages] = useState<ImageDraft>(() =>
    normalizeImages(settings.landingGameImages),
  );
  const [tab, setTab] = useState<Tab>("memory");
  const [busy, setBusy] = useState(false);

  const save = async (
    games: GamesDraft | Record<string, never>,
    imageDraft: ImageDraft | Record<string, never>,
  ) => {
    setBusy(true);
    try {
      await saveSettings({
        landingGames: games as GamesDraft,
        landingGameImages: imageDraft as ImageDraft,
      });
      toast.success(t("admin.games.saved"));
    } catch (cause) {
      toast.error(describeError(cause, t, lang));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm(t("admin.games.reset_confirm"))) return;
    setDraft(emptyDraft());
    setImages(emptyImages());
    await save({}, {});
    toast.success(t("admin.games.reset_done"));
  };

  const patchSprint = (questionIndex: number, patch: Partial<SprintQuestion>) =>
    setDraft((current) => ({
      ...current,
      sprint: current.sprint.map((item, index) =>
        index === questionIndex ? { ...item, ...patch } : item,
      ),
    }));

  const patchOption = (
    questionIndex: number,
    optionIndex: number,
    value: Partial<{ en: string; ar: string }>,
  ) =>
    setDraft((current) => ({
      ...current,
      sprint: current.sprint.map((item, index) =>
        index === questionIndex
          ? {
              ...item,
              options: item.options.map((inner, innerIndex) =>
                innerIndex === optionIndex ? { ...inner, ...value } : inner,
              ),
            }
          : item,
      ),
    }));

  const patchSituation = (index: number, patch: Partial<SituationDraft>) =>
    setDraft((current) => ({
      ...current,
      situations: current.situations.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    }));

  const patchSentence = (index: number, patch: Partial<SentenceDraft>) =>
    setDraft((current) => ({
      ...current,
      sentence: current.sentence.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    }));

  const patchOdd = (index: number, patch: Partial<OddDraft>) =>
    setDraft((current) => ({
      ...current,
      odd: current.odd.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    }));

  const patchOddOption = (index: number, optionIndex: number, value: Partial<Phrase>) =>
    setDraft((current) => ({
      ...current,
      odd: current.odd.map((item, position) =>
        position === index
          ? {
              ...item,
              options: item.options.map((option, at) =>
                at === optionIndex ? { ...option, ...value } : option,
              ),
            }
          : item,
      ),
    }));

  const patchGap = (index: number, patch: Partial<GapDraft>) =>
    setDraft((current) => ({
      ...current,
      gap: current.gap.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    }));

  const patchGapOption = (index: number, optionIndex: number, value: Partial<Phrase>) =>
    setDraft((current) => ({
      ...current,
      gap: current.gap.map((item, position) =>
        position === index
          ? {
              ...item,
              options: item.options.map((option, at) =>
                at === optionIndex ? { ...option, ...value } : option,
              ),
            }
          : item,
      ),
    }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 p-3">
        <p className="text-sm font-bold">{t("admin.games.images.title")}</p>
        <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
          {t("admin.games.images.hint")}
        </p>
        <div className="mt-3 space-y-2">
          {IMAGE_FIELDS.map((field) => (
            <div key={field.id} className="grid items-center gap-2 sm:grid-cols-[9rem_1fr_auto]">
              <span className="text-xs font-semibold">{t(field.key)}</span>
              <Input
                dir="ltr"
                value={images[field.id]}
                placeholder={t("admin.games.images.url")}
                onChange={(event) =>
                  setImages((current) => ({ ...current, [field.id]: event.target.value }))
                }
              />
              <div className="flex items-center gap-2">
                {images[field.id] ? (
                  <img
                    src={images[field.id]}
                    alt=""
                    className="size-10 shrink-0 rounded-lg border border-border/60 object-cover"
                  />
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!images[field.id]}
                  onClick={() => setImages((current) => ({ ...current, [field.id]: "" }))}
                >
                  {t("admin.games.images.clear")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
              tab === item.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {t(item.key)}
          </button>
        ))}
      </div>

      {tab === "memory" ? (
        <div className="space-y-2">
          {draft.memory.map((pair, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={pair.left}
                placeholder={t("admin.games.memory_left")}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    memory: current.memory.map((item, position) =>
                      position === index ? { ...item, left: event.target.value } : item,
                    ),
                  }))
                }
              />
              <Input
                dir="ltr"
                value={pair.right}
                placeholder={t("admin.games.memory_right")}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    memory: current.memory.map((item, position) =>
                      position === index ? { ...item, right: event.target.value } : item,
                    ),
                  }))
                }
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                aria-label={t("common.delete")}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    memory: current.memory.filter((_, position) => position !== index),
                  }))
                }
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                memory: [...current.memory, { left: "", right: "" }],
              }))
            }
          >
            <Plus className="size-3.5" aria-hidden />
            {t("admin.games.add_pair")}
          </Button>
        </div>
      ) : null}

      {tab === "sprint" ? (
        <div className="space-y-3">
          {draft.sprint.map((question, questionIndex) => (
            <div key={questionIndex} className="rounded-2xl border border-border/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">
                  {t("teacher.games.question")} {questionIndex + 1}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-destructive"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      sprint: current.sprint.filter((_, index) => index !== questionIndex),
                    }))
                  }
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {t("common.delete")}
                </Button>
              </div>
              <div className="mt-2 grid gap-2">
                <Input
                  value={question.promptAr}
                  placeholder={t("teacher.games.prompt_ar")}
                  onChange={(event) => patchSprint(questionIndex, { promptAr: event.target.value })}
                />
                <Input
                  dir="ltr"
                  value={question.promptEn}
                  placeholder={t("teacher.games.prompt_en")}
                  onChange={(event) => patchSprint(questionIndex, { promptEn: event.target.value })}
                />
              </div>
              <div className="mt-3 space-y-2">
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-pressed={question.correct === optionIndex}
                      aria-label={t("teacher.games.correct")}
                      onClick={() => patchSprint(questionIndex, { correct: optionIndex })}
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-black",
                        question.correct === optionIndex
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      <Check className="size-3.5" aria-hidden />
                    </button>
                    <Input
                      value={option.ar}
                      placeholder={t("teacher.games.option_ar")}
                      onChange={(event) =>
                        patchOption(questionIndex, optionIndex, { ar: event.target.value })
                      }
                    />
                    <Input
                      dir="ltr"
                      value={option.en}
                      placeholder={t("teacher.games.option_en")}
                      onChange={(event) =>
                        patchOption(questionIndex, optionIndex, { en: event.target.value })
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
                      patchSprint(questionIndex, {
                        options: [...question.options, { en: "", ar: "" }],
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
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              setDraft((current) => ({ ...current, sprint: [...current.sprint, emptySprint()] }))
            }
          >
            <Plus className="size-3.5" aria-hidden />
            {t("teacher.games.add_question")}
          </Button>
        </div>
      ) : null}

      {tab === "situations" ? (
        <div className="space-y-3">
          {draft.situations.map((situation, situationIndex) => (
            <div key={situationIndex} className="rounded-2xl border border-border/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">
                  {t("admin.games.situation")} {situationIndex + 1}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-destructive"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      situations: current.situations.filter(
                        (_, position) => position !== situationIndex,
                      ),
                    }))
                  }
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {t("common.delete")}
                </Button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Input
                  value={situation.titleAr}
                  placeholder={t("teacher.games.title_ar")}
                  onChange={(event) =>
                    patchSituation(situationIndex, { titleAr: event.target.value })
                  }
                />
                <Input
                  dir="ltr"
                  value={situation.titleEn}
                  placeholder={t("teacher.games.title_en")}
                  onChange={(event) =>
                    patchSituation(situationIndex, { titleEn: event.target.value })
                  }
                />
              </div>
              <div className="mt-3 space-y-2">
                {situation.phrases.map((phrase, phraseIndex) => (
                  <div key={phraseIndex} className="flex items-center gap-2">
                    <Input
                      dir="ltr"
                      value={phrase.en}
                      placeholder={t("admin.games.phrase_en")}
                      onChange={(event) =>
                        patchSituation(situationIndex, {
                          phrases: situation.phrases.map((inner, innerIndex) =>
                            innerIndex === phraseIndex
                              ? { ...inner, en: event.target.value }
                              : inner,
                          ),
                        })
                      }
                    />
                    <Input
                      value={phrase.ar}
                      placeholder={t("admin.games.phrase_ar")}
                      onChange={(event) =>
                        patchSituation(situationIndex, {
                          phrases: situation.phrases.map((inner, innerIndex) =>
                            innerIndex === phraseIndex
                              ? { ...inner, ar: event.target.value }
                              : inner,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  onClick={() =>
                    patchSituation(situationIndex, {
                      phrases: [...situation.phrases, { en: "", ar: "" }],
                    })
                  }
                >
                  <Plus className="size-3.5" aria-hidden />
                  {t("admin.games.add_phrase")}
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                situations: [
                  ...current.situations,
                  { titleAr: "", titleEn: "", phrases: [{ en: "", ar: "" }, { en: "", ar: "" }] },
                ],
              }))
            }
          >
            <Plus className="size-3.5" aria-hidden />
            {t("admin.games.add_situation")}
          </Button>
        </div>
      ) : null}

      {tab === "daily" ? (
        <div className="space-y-2">
          {draft.daily.map((phrase, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                dir="ltr"
                value={phrase.en}
                placeholder={t("admin.games.phrase_en")}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    daily: current.daily.map((item, position) =>
                      position === index ? { ...item, en: event.target.value } : item,
                    ),
                  }))
                }
              />
              <Input
                value={phrase.ar}
                placeholder={t("admin.games.phrase_ar")}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    daily: current.daily.map((item, position) =>
                      position === index ? { ...item, ar: event.target.value } : item,
                    ),
                  }))
                }
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                aria-label={t("common.delete")}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    daily: current.daily.filter((_, position) => position !== index),
                  }))
                }
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              setDraft((current) => ({ ...current, daily: [...current.daily, { en: "", ar: "" }] }))
            }
          >
            <Plus className="size-3.5" aria-hidden />
            {t("admin.games.add_phrase")}
          </Button>
        </div>
      ) : null}

      {tab === "sentence" ? (
        <div className="space-y-2">
          {draft.sentence.map((item, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                dir="ltr"
                value={item.sentenceEn}
                placeholder={t("admin.games.sentence_en")}
                onChange={(event) => patchSentence(index, { sentenceEn: event.target.value })}
              />
              <Input
                value={item.sentenceAr}
                placeholder={t("admin.games.sentence_ar")}
                onChange={(event) => patchSentence(index, { sentenceAr: event.target.value })}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                aria-label={t("common.delete")}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    sentence: current.sentence.filter((_, position) => position !== index),
                  }))
                }
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                sentence: [...current.sentence, { sentenceEn: "", sentenceAr: "" }],
              }))
            }
          >
            <Plus className="size-3.5" aria-hidden />
            {t("admin.games.add_sentence")}
          </Button>
        </div>
      ) : null}

      {tab === "odd" ? (
        <div className="space-y-3">
          {draft.odd.map((question, questionIndex) => (
            <div key={questionIndex} className="rounded-2xl border border-border/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">
                  {t("teacher.games.question")} {questionIndex + 1}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-destructive"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      odd: current.odd.filter((_, position) => position !== questionIndex),
                    }))
                  }
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {t("common.delete")}
                </Button>
              </div>
              <div className="mt-2 grid gap-2">
                <Input
                  value={question.promptAr}
                  placeholder={t("teacher.games.prompt_ar")}
                  onChange={(event) => patchOdd(questionIndex, { promptAr: event.target.value })}
                />
                <Input
                  dir="ltr"
                  value={question.promptEn}
                  placeholder={t("teacher.games.prompt_en")}
                  onChange={(event) => patchOdd(questionIndex, { promptEn: event.target.value })}
                />
              </div>
              <div className="mt-3 space-y-2">
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-pressed={question.correct === optionIndex}
                      aria-label={t("teacher.games.correct")}
                      onClick={() => patchOdd(questionIndex, { correct: optionIndex })}
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-black",
                        question.correct === optionIndex
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      <Check className="size-3.5" aria-hidden />
                    </button>
                    <Input
                      dir="ltr"
                      value={option.en}
                      placeholder={t("teacher.games.option_en")}
                      onChange={(event) =>
                        patchOddOption(questionIndex, optionIndex, { en: event.target.value })
                      }
                    />
                    <Input
                      value={option.ar}
                      placeholder={t("teacher.games.option_ar")}
                      onChange={(event) =>
                        patchOddOption(questionIndex, optionIndex, { ar: event.target.value })
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
                      patchOdd(questionIndex, {
                        options: [...question.options, { en: "", ar: "" }],
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
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setDraft((current) => ({ ...current, odd: [...current.odd, emptyOdd()] }))}
          >
            <Plus className="size-3.5" aria-hidden />
            {t("admin.games.add_odd")}
          </Button>
        </div>
      ) : null}

      {tab === "gap" ? (
        <div className="space-y-3">
          <p className="text-[11px] leading-5 text-muted-foreground">{t("admin.games.gap_hint")}</p>
          {draft.gap.map((item, index) => (
            <div key={index} className="rounded-2xl border border-border/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">
                  {t("teacher.games.question")} {index + 1}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-destructive"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      gap: current.gap.filter((_, position) => position !== index),
                    }))
                  }
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {t("common.delete")}
                </Button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Input
                  dir="ltr"
                  value={item.sentenceEn}
                  placeholder={t("admin.games.sentence_en")}
                  onChange={(event) => patchGap(index, { sentenceEn: event.target.value })}
                />
                <Input
                  value={item.sentenceAr}
                  placeholder={t("admin.games.sentence_ar")}
                  onChange={(event) => patchGap(index, { sentenceAr: event.target.value })}
                />
              </div>
              <div className="mt-3 space-y-2">
                {item.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-pressed={item.correct === optionIndex}
                      aria-label={t("teacher.games.correct")}
                      onClick={() => patchGap(index, { correct: optionIndex })}
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-black",
                        item.correct === optionIndex
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      <Check className="size-3.5" aria-hidden />
                    </button>
                    <Input
                      dir="ltr"
                      value={option.en}
                      placeholder={t("teacher.games.option_en")}
                      onChange={(event) =>
                        patchGapOption(index, optionIndex, { en: event.target.value })
                      }
                    />
                    <Input
                      value={option.ar}
                      placeholder={t("teacher.games.option_ar")}
                      onChange={(event) =>
                        patchGapOption(index, optionIndex, { ar: event.target.value })
                      }
                    />
                  </div>
                ))}
                {item.options.length < 4 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    onClick={() =>
                      patchGap(index, { options: [...item.options, { en: "", ar: "" }] })
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
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setDraft((current) => ({ ...current, gap: [...current.gap, emptyGap()] }))}
          >
            <Plus className="size-3.5" aria-hidden />
            {t("admin.games.add_gap")}
          </Button>
        </div>
      ) : null}

      <p className="text-[11px] leading-5 text-muted-foreground">{t("admin.games.hint")}</p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="gap-2" disabled={busy} onClick={() => void save(draft, images)}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {t("common.save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={busy}
          onClick={() => void reset()}
        >
          <RotateCcw className="size-4" aria-hidden />
          {t("admin.games.reset")}
        </Button>
      </div>
    </div>
  );
}
