import {
  EmptyState,
  ErrorNotice,
  Field,
  LoadingBlock,
  PageHeader,
  SectionCard,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { parseCsv } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  Copy,
  FileUp,
  Library,
  Loader2,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type OptionDraft = { key: string; textEn: string; textAr: string; correct: boolean };

const OPTION_KEYS = ["a", "b", "c", "d", "e", "f"];

export default function QuestionBank() {
  const { t, pick, lang } = useI18n();
  const structure = useQuery(api.academics.structure, {});
  const banks = useQuery(api.questionBank.banks, {});
  const [bankId, setBankId] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [search, setSearch] = useState("");
  const questions = useQuery(api.questionBank.questions, {
    bankId: bankId === "all" ? undefined : (bankId as never),
    type: type === "all" ? undefined : (type as never),
    difficulty: difficulty === "all" ? undefined : (difficulty as never),
    search: search || undefined,
    includeArchived: false,
  });

  const createBank = useMutation(api.questionBank.createBank);
  const createQuestion = useMutation(api.questionBank.createQuestion);
  const updateQuestion = useMutation(api.questionBank.updateQuestion);
  const duplicateQuestion = useMutation(api.questionBank.duplicateQuestion);
  const archiveQuestion = useMutation(api.questionBank.archiveQuestion);
  const importQuestions = useMutation(api.questionBank.importQuestions);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState<null | (typeof questions extends undefined ? never : NonNullable<typeof questions>[number])>(null);
  const [openEditor, setOpenEditor] = useState(false);
  const [openBank, setOpenBank] = useState(false);
  const [openImport, setOpenImport] = useState(false);

  const subjects = structure?.subjects ?? [];
  const topics = structure?.topics ?? [];
  const myBanks = (banks ?? []).filter((bank) => bank.canEdit);

  const run = async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (message) toast.success(message);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t("teacher.question_bank.title")}
        subtitle={t("teacher.question_bank.subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Dialog open={openBank} onOpenChange={setOpenBank}>
              <DialogTrigger asChild>
                <Button variant="outline">{t("teacher.question_bank.new_bank")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("teacher.question_bank.new_bank")}</DialogTitle>
                  <DialogDescription>
                    {t("teacher.question_bank.share_hint")}
                  </DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    void run(async () => {
                      await createBank({
                        name: String(data.get("name") ?? ""),
                        visibility: (data.get("visibility") ?? "private") as never,
                        subjectId: (String(data.get("subjectId") ?? "") || undefined) as never,
                      });
                      setOpenBank(false);
                    }, t("common.saved"));
                  }}
                >
                  <Field label={t("common.name")} required>
                    <Input name="name" required minLength={2} />
                  </Field>
                  <Field label={t("teacher.question_bank.private")}>
                    <Select name="visibility" defaultValue="private">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">
                          {t("teacher.question_bank.private")}
                        </SelectItem>
                        <SelectItem value="shared">
                          {t("teacher.question_bank.shared")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t("common.subject")}>
                    <Select name="subjectId">
                      <SelectTrigger>
                        <SelectValue placeholder={t("common.none")} />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject._id} value={subject._id}>
                            {pick(subject.nameEn, subject.nameAr)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <DialogFooter>
                    <Button type="submit" disabled={busy}>
                      {t("common.create")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={openImport} onOpenChange={setOpenImport}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <FileUp className="size-4" aria-hidden />
                  {t("teacher.question_bank.import")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t("teacher.question_bank.import")}</DialogTitle>
                  <DialogDescription>
                    {t("teacher.question_bank.import_hint")}
                  </DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const targetBank = String(data.get("bankId") ?? "");
                    const file = data.get("file");
                    if (!(file instanceof File) || !targetBank) return;
                    void run(async () => {
                      const text = await file.text();
                      const rows = parseCsv(text);
                      const [header, ...body] = rows;
                      const index = (name: string) =>
                        header.findIndex((cell) => cell.trim() === name);
                      const parsed = body.map((row) => {
                        const optionsEn = (row[index("options_en")] ?? "")
                          .split("|")
                          .map((value) => value.trim())
                          .filter(Boolean);
                        const optionsAr = (row[index("options_ar")] ?? "")
                          .split("|")
                          .map((value) => value.trim());
                        const correct = (row[index("correct")] ?? "")
                          .split(";")
                          .map((value) => value.trim().toLowerCase())
                          .filter(Boolean);
                        return {
                          type: (row[index("type")] ?? "mcq_single").trim() as never,
                          promptEn: (row[index("prompt_en")] ?? "").trim(),
                          promptAr: (row[index("prompt_ar")] ?? "").trim(),
                          difficulty: ((row[index("difficulty")] ?? "medium").trim() ||
                            "medium") as never,
                          defaultMarks: Number(row[index("marks")] ?? 1) || 1,
                          options: optionsEn.map((value, optionIndex) => ({
                            key: OPTION_KEYS[optionIndex] ?? String(optionIndex),
                            textEn: value,
                            textAr: optionsAr[optionIndex] ?? value,
                            correct: correct.includes(
                              OPTION_KEYS[optionIndex] ?? String(optionIndex),
                            ),
                          })),
                          acceptedAnswers: (row[index("accepted_answers")] ?? "")
                            .split("|")
                            .map((value) => value.trim())
                            .filter(Boolean),
                          gradingMode: ((row[index("grading_mode")] ?? "auto").trim() ||
                            "auto") as never,
                        };
                      });
                      const result = await importQuestions({
                        bankId: targetBank as never,
                        rows: parsed,
                      });
                      toast.success(
                        t("teacher.question_bank.import_result", {
                          created: result.created,
                          failed: result.results.filter((r) => !r.ok).length,
                        }),
                      );
                      setOpenImport(false);
                    });
                  }}
                >
                  <Field label={t("teacher.question_bank.title")} required>
                    <Select name="bankId" required>
                      <SelectTrigger>
                        <SelectValue placeholder={t("common.none")} />
                      </SelectTrigger>
                      <SelectContent>
                        {myBanks.map((bank) => (
                          <SelectItem key={bank._id} value={bank._id}>
                            {bank.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="CSV" required>
                    <Input name="file" type="file" accept=".csv,text/csv" required />
                  </Field>
                  <DialogFooter>
                    <Button type="submit" disabled={busy}>
                      {t("teacher.question_bank.import")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              className="gap-2"
              disabled={myBanks.length === 0}
              onClick={() => {
                setEditing(null);
                setOpenEditor(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              {t("teacher.question_bank.new_question")}
            </Button>
          </div>
        }
      />

      {error ? <ErrorNotice error={error} /> : null}

      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("common.search")}
              className="ps-9"
            />
          </div>
          <Select value={bankId} onValueChange={setBankId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("teacher.question_bank.title")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {(banks ?? []).map((bank) => (
                <SelectItem key={bank._id} value={bank._id}>
                  {bank.name} {bank.canEdit ? "" : `· ${bank.ownerName}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder={t("common.type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {[
                "mcq_single",
                "mcq_multi",
                "true_false",
                "short_answer",
                "essay",
                "fill_blank",
                "image",
              ].map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`qtype.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder={t("common.difficulty")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {["easy", "medium", "hard"].map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`common.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {questions === undefined ? (
        <LoadingBlock />
      ) : questions.length === 0 ? (
        <EmptyState title={t("teacher.question_bank.empty")} icon={Library} />
      ) : (
        <ul className="space-y-3">
          {questions.map((question) => (
            <li key={question._id} className="surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {t(`qtype.${question.type}`)} · {t(`common.${question.difficulty}`)} ·{" "}
                    {question.defaultMarks} {t("common.marks")}
                    {question.topicNameEn
                      ? ` · ${pick(question.topicNameEn, question.topicNameAr ?? "")}`
                      : question.subjectNameEn
                        ? ` · ${pick(question.subjectNameEn, question.subjectNameAr ?? "")}`
                        : ""}
                  </p>
                  <p className="mt-1.5 text-sm font-medium">
                    {pick(question.promptEn, question.promptAr)}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {question.options.map((option) => (
                      <li
                        key={option.key}
                        className={
                          option.correct
                            ? "chip border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "chip"
                        }
                      >
                        {pick(option.textEn, option.textAr)}
                      </li>
                    ))}
                    {question.acceptedAnswers?.map((answer) => (
                      <li key={answer} className="chip">
                        {answer}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={!question.canEdit}
                    onClick={() => {
                      setEditing(question);
                      setOpenEditor(true);
                    }}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    {t("common.edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={!question.canEdit || busy}
                    onClick={() =>
                      void run(
                        () => duplicateQuestion({ questionId: question._id }),
                        t("common.saved"),
                      )
                    }
                  >
                    <Copy className="size-3.5" aria-hidden />
                    {t("teacher.question_bank.duplicate")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={!question.canEdit || busy}
                    onClick={() =>
                      void run(
                        () =>
                          archiveQuestion({
                            questionId: question._id,
                            archived: true,
                          }),
                        t("common.saved"),
                      )
                    }
                  >
                    <Archive className="size-3.5" aria-hidden />
                    {t("common.archive")}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <QuestionDialog
        open={openEditor}
        onOpenChange={setOpenEditor}
        banks={myBanks}
        subjects={subjects}
        topics={topics}
        initial={editing}
        busy={busy}
        onSubmit={(payload) =>
          run(async () => {
            if (editing) {
              await updateQuestion({ questionId: editing._id, ...payload } as never);
            } else {
              await createQuestion(payload as never);
            }
            setOpenEditor(false);
            setEditing(null);
          }, t("question.saved"))
        }
      />

      <p className="text-xs text-muted-foreground">
        {pick(
          "Editing a question never changes assessments that already took a snapshot of it.",
          "تعديل السؤال لا يغيّر التقييمات التي حفظت نسخة منه.",
        )}
        {lang ? "" : ""}
      </p>
    </>
  );
}

type QuestionRow = {
  _id: string;
  bankId: string;
  type: string;
  promptEn: string;
  promptAr: string;
  instructionsEn?: string;
  instructionsAr?: string;
  imageUrl?: string;
  subjectId?: string;
  topicId?: string;
  difficulty: string;
  defaultMarks: number;
  options: { key: string; textEn: string; textAr: string; correct: boolean }[];
  acceptedAnswers?: string[];
  gradingMode: string;
  feedbackEn?: string;
  feedbackAr?: string;
};

function QuestionDialog({
  open,
  onOpenChange,
  banks,
  subjects,
  topics,
  initial,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  banks: { _id: string; name: string }[];
  subjects: { _id: string; nameEn: string; nameAr: string }[];
  topics: { _id: string; nameEn: string; nameAr: string }[];
  initial: QuestionRow | null;
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const { t, pick } = useI18n();
  const [type, setType] = useState<string>(initial?.type ?? "mcq_single");
  const [options, setOptions] = useState<OptionDraft[]>(
    initial?.options?.length
      ? initial.options
      : [
          { key: "a", textEn: "", textAr: "", correct: true },
          { key: "b", textEn: "", textAr: "", correct: false },
        ],
  );
  const needsOptions = ["mcq_single", "mcq_multi", "true_false", "image"].includes(type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {initial ? t("common.edit") : t("teacher.question_bank.new_question")}
          </DialogTitle>
          <DialogDescription>{t("question.accepted_hint")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          key={initial?._id ?? "new"}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onSubmit({
              bankId: String(data.get("bankId")),
              type,
              promptEn: String(data.get("promptEn") ?? ""),
              promptAr: String(data.get("promptAr") ?? ""),
              instructionsEn: String(data.get("instructionsEn") ?? "") || undefined,
              instructionsAr: String(data.get("instructionsAr") ?? "") || undefined,
              imageUrl: String(data.get("imageUrl") ?? "") || undefined,
              subjectId: (String(data.get("subjectId") ?? "") || undefined) as never,
              topicId: (String(data.get("topicId") ?? "") || undefined) as never,
              difficulty: String(data.get("difficulty") ?? "medium"),
              defaultMarks: Number(data.get("defaultMarks") ?? 1),
              options: needsOptions
                ? options.filter((option) => option.textEn.trim() || option.textAr.trim())
                : [],
              acceptedAnswers: String(data.get("acceptedAnswers") ?? "")
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
              gradingMode: needsOptions
                ? "auto"
                : (String(data.get("gradingMode") ?? "auto") as string),
              feedbackEn: String(data.get("feedbackEn") ?? "") || undefined,
              feedbackAr: String(data.get("feedbackAr") ?? "") || undefined,
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("teacher.question_bank.title")} required>
              <Select name="bankId" defaultValue={initial?.bankId ?? banks[0]?._id} required>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.none")} />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank._id} value={bank._id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("common.type")} required>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "mcq_single",
                    "mcq_multi",
                    "true_false",
                    "short_answer",
                    "essay",
                    "fill_blank",
                    "image",
                  ].map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`qtype.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("teacher.builder.marks")} required>
              <Input
                name="defaultMarks"
                type="number"
                min={1}
                max={100}
                defaultValue={initial?.defaultMarks ?? 1}
                required
              />
            </Field>
          </div>

          <Field
            label={t("question.prompt_primary")}
            required
            hint={t("question.prompt_primary_hint")}
          >
            <Textarea name="promptEn" rows={2} defaultValue={initial?.promptEn} required />
          </Field>
          <Field label={t("question.translation")} hint={t("question.translation_hint")}>
            <Textarea
              name="promptAr"
              rows={2}
              defaultValue={initial?.promptAr}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("question.instructions_en")}>
              <Input name="instructionsEn" defaultValue={initial?.instructionsEn} />
            </Field>
            <Field label={t("question.instructions_ar")}>
              <Input
                name="instructionsAr"
                dir="rtl"
                defaultValue={initial?.instructionsAr}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("common.subject")}>
              <Select name="subjectId" defaultValue={initial?.subjectId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.none")} />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject._id} value={subject._id}>
                      {pick(subject.nameEn, subject.nameAr)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("common.topic")}>
              <Select name="topicId" defaultValue={initial?.topicId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.none")} />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((topic) => (
                    <SelectItem key={topic._id} value={topic._id}>
                      {pick(topic.nameEn, topic.nameAr)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("common.difficulty")}>
              <Select name="difficulty" defaultValue={initial?.difficulty ?? "medium"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["easy", "medium", "hard"].map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`common.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {type === "image" ? (
            <Field label={t("question.image_url")} required>
              <Input name="imageUrl" defaultValue={initial?.imageUrl} required />
            </Field>
          ) : (
            <Field label={t("question.image_url")}>
              <Input name="imageUrl" defaultValue={initial?.imageUrl} />
            </Field>
          )}

          {needsOptions ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("question.options")}</p>
              {options.map((option, index) => (
                <div key={option.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={option.correct}
                    onChange={(event) =>
                      setOptions((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, correct: event.target.checked }
                            : type === "mcq_multi"
                              ? item
                              : { ...item, correct: false },
                        ),
                      )
                    }
                    className="size-4 accent-primary"
                    aria-label={t("question.option_correct")}
                  />
                  <Input
                    value={option.textEn}
                    placeholder="English"
                    onChange={(event) =>
                      setOptions((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, textEn: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <Input
                    value={option.textAr}
                    placeholder="العربية"
                    dir="rtl"
                    onChange={(event) =>
                      setOptions((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, textAr: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={options.length >= OPTION_KEYS.length}
                onClick={() =>
                  setOptions((prev) => [
                    ...prev,
                    {
                      key: OPTION_KEYS[prev.length] ?? String(prev.length),
                      textEn: "",
                      textAr: "",
                      correct: false,
                    },
                  ])
                }
              >
                {t("question.add_option")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("question.accepted_answers")} hint={t("question.accepted_hint")}>
                <Input
                  name="acceptedAnswers"
                  defaultValue={initial?.acceptedAnswers?.join(", ")}
                />
              </Field>
              <Field label={t("question.grading_mode")}>
                <Select name="gradingMode" defaultValue={initial?.gradingMode ?? "auto"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t("question.grading_auto")}</SelectItem>
                    <SelectItem value="manual">{t("question.grading_manual")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("question.feedback_en")}>
              <Input name="feedbackEn" defaultValue={initial?.feedbackEn} />
            </Field>
            <Field label={t("question.feedback_ar")}>
              <Input name="feedbackAr" dir="rtl" defaultValue={initial?.feedbackAr} />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy} className="gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
