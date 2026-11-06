import { Field } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { describeError } from "@/lib/errors";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ChoiceType = "mcq_single" | "mcq_multi" | "true_false" | "image";
type QuestionType =
  | ChoiceType
  | "short_answer"
  | "essay"
  | "fill_blank";

type OptionDraft = { key: string; text: string; correct: boolean };

const OPTION_KEYS = ["a", "b", "c", "d", "e", "f"];

const CHOICE_TYPES: QuestionType[] = ["mcq_single", "mcq_multi", "true_false", "image"];

/** Text types the server can grade without a teacher. */
const AUTO_GRADABLE_TYPES: QuestionType[] = ["short_answer", "fill_blank"];

/**
 * Compact question composer used inside the assessment builder.
 *
 * A question only needs one language: the primary field is required and the
 * translation is optional. Everything typed here is written into a question row
 * and attached to the current assessment in a single call, so a teacher can
 * stack up as many questions as they need without leaving the page.
 */
export function QuestionComposer({
  assessmentId,
  defaultSubjectId,
  onAdded,
}: {
  assessmentId: string;
  defaultSubjectId?: string;
  onAdded?: (count: number) => void;
}) {
  const { t, pick } = useI18n();
  const createAndAdd = useMutation(api.assessments.createAndAddQuestions);

  const [type, setType] = useState<QuestionType>("mcq_single");
  const [prompt, setPrompt] = useState("");
  const [translation, setTranslation] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [marks, setMarks] = useState(1);
  const [options, setOptions] = useState<OptionDraft[]>(() => blankOptions("mcq_single"));
  const [accepted, setAccepted] = useState("");
  const [gradingMode, setGradingMode] = useState<"auto" | "manual">("auto");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [added, setAdded] = useState(0);

  const isChoice = CHOICE_TYPES.includes(type);
  const answerIsText = AUTO_GRADABLE_TYPES.includes(type);

  /**
   * True/false options need real labels: the server requires option text, and
   * these two are prefilled so the teacher never gets a rejection for leaving
   * them blank while still being able to reword them.
   */
  function blankOptions(next: QuestionType): OptionDraft[] {
    if (next === "true_false") {
      return [
        { key: "a", text: pick("True", "صحیح"), correct: true },
        { key: "b", text: pick("False", "خطأ"), correct: false },
      ];
    }
    return [
      { key: "a", text: "", correct: true },
      { key: "b", text: "", correct: false },
    ];
  }

  const changeType = (next: QuestionType) => {
    setType(next);
    setOptions(blankOptions(next));
    if (next === "essay") setGradingMode("manual");
    if (!AUTO_GRADABLE_TYPES.includes(next)) setGradingMode("auto");
    if (next !== "image") setImageUrl("");
  };

  const updateOption = (index: number, patch: Partial<OptionDraft>) =>
    setOptions((prev) =>
      prev.map((option, i) => (i === index ? { ...option, ...patch } : option)),
    );

  const toggleCorrect = (index: number, checked: boolean) =>
    setOptions((prev) =>
      prev.map((option, i) => {
        if (i !== index) {
          return type === "mcq_multi" ? option : { ...option, correct: false };
        }
        return { ...option, correct: checked };
      }),
    );

  const reset = () => {
    setPrompt("");
    setTranslation("");
    setOptions(blankOptions(type));
    setAccepted("");
    setImageUrl("");
  };

  const submit = async () => {
    if (prompt.trim().length < 3) {
      setError(t("question.required_prompt"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cleanedOptions = isChoice
        ? options
            .filter((option) => option.text.trim())
            .map((option, index) => ({
              key: OPTION_KEYS[index] ?? String(index),
              textEn: option.text,
              textAr: option.text,
              correct: option.correct,
            }))
        : [];
      if (isChoice && cleanedOptions.length < 2) {
        setError(t("question.required_options"));
        setBusy(false);
        return;
      }
      if (isChoice && !cleanedOptions.some((option) => option.correct)) {
        setError(t("question.required_options"));
        setBusy(false);
        return;
      }
      const acceptedAnswers = accepted
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (answerIsText && gradingMode === "auto" && acceptedAnswers.length === 0) {
        setError(t("question.required_accepted"));
        setBusy(false);
        return;
      }
      if (type === "image" && !imageUrl.trim()) {
        setError(t("question.required_image"));
        setBusy(false);
        return;
      }

      await createAndAdd({
        assessmentId: assessmentId as never,
        items: [
          {
            type,
            // The primary field is whatever language the teacher typed in; the
            // server mirrors it when the translation is left empty.
            promptEn: prompt,
            promptAr: translation,
            instructionsEn: undefined,
            instructionsAr: undefined,
            imageUrl: type === "image" ? imageUrl : undefined,
            subjectId: defaultSubjectId ? (defaultSubjectId as never) : undefined,
            difficulty,
            defaultMarks: marks,
            marks,
            options: cleanedOptions as never,
            acceptedAnswers: acceptedAnswers.length ? acceptedAnswers : undefined,
            // Choice and image questions are graded by the server; essays always
            // go to a teacher; short answers / blanks follow the teacher's choice.
            gradingMode: type === "essay" ? "manual" : answerIsText ? gradingMode : "auto",
            feedbackEn: undefined,
            feedbackAr: undefined,
          },
        ],
      });
      setAdded((count) => count + 1);
      onAdded?.(1);
      toast.success(t("question.saved"));
      reset();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
        {t("teacher.builder.write_hint")}
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("common.type")} required>
          <Select value={type} onValueChange={(value) => changeType(value as QuestionType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mcq_single">{t("qtype.mcq_single")}</SelectItem>
              <SelectItem value="mcq_multi">{t("qtype.mcq_multi")}</SelectItem>
              <SelectItem value="true_false">{t("qtype.true_false")}</SelectItem>
              <SelectItem value="short_answer">{t("qtype.short_answer")}</SelectItem>
              <SelectItem value="fill_blank">{t("qtype.fill_blank")}</SelectItem>
              <SelectItem value="essay">{t("qtype.essay")}</SelectItem>
              <SelectItem value="image">{t("qtype.image")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("common.difficulty")} required>
          <Select
            value={difficulty}
            onValueChange={(value) => setDifficulty(value as typeof difficulty)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">{t("common.easy")}</SelectItem>
              <SelectItem value="medium">{t("common.medium")}</SelectItem>
              <SelectItem value="hard">{t("common.hard")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("teacher.builder.marks")} required>
          <Input
            type="number"
            min={1}
            max={100}
            value={marks}
            onChange={(event) => setMarks(Number(event.target.value) || 1)}
          />
        </Field>
      </div>

      <Field label={t("question.prompt_primary")} required hint={t("question.prompt_primary_hint")}>
        <Textarea
          rows={3}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={pick("Type the question here…", "اكتب السؤال هنا…")}
        />
      </Field>

      <Field
        label={t("question.translation")}
        hint={t("question.translation_hint")}
      >
        <Textarea
          rows={2}
          value={translation}
          onChange={(event) => setTranslation(event.target.value)}
        />
      </Field>

      {type === "image" ? (
        <Field label={t("question.image_url")} required>
          <Input
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://…"
          />
        </Field>
      ) : null}

      {isChoice ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("question.options")}</p>
          <p className="text-xs text-muted-foreground">
            {t("question.options_hint")}
          </p>
          {options.map((option, index) => (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2"
            >
              <Checkbox
                checked={option.correct}
                onCheckedChange={(checked) => toggleCorrect(index, checked === true)}
                aria-label={t("question.option_correct")}
              />
              <Input
                value={option.text}
                onChange={(event) => updateOption(index, { text: event.target.value })}
                placeholder={`${t("common.option")} ${index + 1}`}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={options.length <= 2}
                onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                aria-label={t("common.delete")}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </motion.div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={options.length >= OPTION_KEYS.length}
            onClick={() =>
              setOptions((prev) => [
                ...prev,
                { key: OPTION_KEYS[prev.length] ?? String(prev.length), text: "", correct: false },
              ])
            }
          >
            <Plus className="size-4" aria-hidden />
            {t("question.add_option")}
          </Button>
        </div>
      ) : null}

      {answerIsText ? (
        <Field label={t("question.accepted_answers")} hint={t("question.accepted_hint")}>
          <Input
            value={accepted}
            onChange={(event) => setAccepted(event.target.value)}
            placeholder={pick("e.g. 12, 12.0", "مثال: ١٢، 12")}
          />
        </Field>
      ) : null}

      {answerIsText ? (
        <Field label={t("question.grading_mode")}>
          <Select
            value={gradingMode}
            onValueChange={(value) => setGradingMode(value as typeof gradingMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t("question.grading_auto")}</SelectItem>
              <SelectItem value="manual">{t("question.grading_manual")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">
          {typeof error === "string" ? error : describeError(error, t, "en")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void submit()} disabled={busy} className="gap-2">
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {t("teacher.builder.save_add_another")}
        </Button>
        {added > 0 ? (
          <span className="text-xs text-muted-foreground">
            {t("teacher.builder.added_count", { count: added })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
