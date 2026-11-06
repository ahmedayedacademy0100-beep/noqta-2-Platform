import {
  DataList,
  EmptyState,
  ErrorNotice,
  Field,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/app/ui";
import { QuestionComposer } from "@/components/app/QuestionComposer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { describeError } from "@/lib/errors";
import { fromDateInputValue, toDateInputValue } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Loader2,
  PenLine,
  Plus,
  Rocket,
  Send,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

export default function AssessmentBuilder() {
  const { t, pick, formatDate } = useI18n();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const detail = useQuery(
    api.assessments.detail,
    assessmentId ? { assessmentId: assessmentId as never } : "skip",
  );
  const structure = useQuery(api.academics.structure, {});
  const classes = useQuery(api.assessments.assignableClasses, {});
  const students = useQuery(api.academics.studentPicker, {});
  const bankQuestions = useQuery(api.questionBank.questions, { includeArchived: false });

  const updateSettings = useMutation(api.assessments.update);
  const addQuestions = useMutation(api.assessments.addQuestions);
  const updateMarks = useMutation(api.assessments.updateQuestionMarks);
  const removeQuestion = useMutation(api.assessments.removeQuestion);
  const reorder = useMutation(api.assessments.reorderQuestions);
  const publish = useMutation(api.assessments.publish);
  const setStatus = useMutation(api.assessments.setStatus);
  const duplicate = useMutation(api.assessments.duplicate);
  const assignClasses = useMutation(api.assessments.assignClasses);
  const assignStudents = useMutation(api.assessments.assignStudents);
  const releaseResults = useMutation(api.assessments.releaseResults);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [writerOpen, setWriterOpen] = useState(false);
  const [pickedQuestions, setPickedQuestions] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!detail || hydrated) return;
    setSelectedClasses(detail.classes.map((c) => c.classId as string));
    setSelectedStudents(detail.students.map((s) => s.studentId as string));
    setHydrated(true);
  }, [detail, hydrated]);

  const subjects = structure?.subjects ?? [];
  const topics = structure?.topics ?? [];

  const run = async (action: () => Promise<unknown>, successMessage?: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (successMessage) toast.success(successMessage);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  const validation = useMemo(() => {
    if (!detail) return [] as { ok: boolean; label: string }[];
    return [
      {
        ok: detail.questions.length > 0,
        label: t("teacher.builder.no_questions"),
      },
      {
        ok: detail.assignedCount > 0,
        label: t("teacher.assign.none"),
      },
      {
        ok: detail.assessment.maxScore > 0,
        label: t("teacher.builder.max_score", { marks: detail.assessment.maxScore }),
      },
    ];
  }, [detail, t]);

  if (detail === undefined || null === detail || !detail) {
    return detail === undefined ? <LoadingBlock /> : <ErrorNotice error={null} />;
  }

  const { assessment, classes: assignedClasses } = detail;
  const locked = detail.attemptsCount > 0 && assessment.status !== "draft";

  return (
    <>
      <PageHeader
        eyebrow={`${pick(assessment.subjectNameEn, assessment.subjectNameAr)} · ${t(`kind.${assessment.kind}`)}`}
        title={pick(assessment.titleEn, assessment.titleAr)}
        subtitle={t("teacher.builder.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={assessment.status} />
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link to={`/teacher/analytics/${assessment._id}`}>
                {t("teacher.analytics.title")}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link to="/teacher/grading">
                <PenLine className="size-4" aria-hidden />
                {t("nav.teacher.grading")}
              </Link>
            </Button>
          </div>
        }
      />

      {error ? <ErrorNotice error={error} /> : null}

      {locked ? (
        <div className="flex items-start gap-2 rounded-xl border border-chart-4/40 bg-chart-4/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-chart-4" aria-hidden />
          <span>
            {t("teacher.builder.version_notice", {
              version: assessment.version + 1,
            })}
          </span>
        </div>
      ) : null}

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings">{t("teacher.builder.settings")}</TabsTrigger>
          <TabsTrigger value="questions">
            {t("teacher.builder.questions")} ({detail.questions.length})
          </TabsTrigger>
          <TabsTrigger value="assign">{t("teacher.builder.assign")}</TabsTrigger>
          <TabsTrigger value="publish">{t("common.publish")}</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <SectionCard>
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void run(
                  () =>
                    updateSettings({
                      assessmentId: assessment._id,
                      kind: (data.get("kind") ?? assessment.kind) as never,
                      titleEn: String(data.get("titleEn") ?? ""),
                      titleAr: String(data.get("titleAr") ?? ""),
                      instructionsEn: String(data.get("instructionsEn") ?? "") || undefined,
                      instructionsAr: String(data.get("instructionsAr") ?? "") || undefined,
                      subjectId: String(data.get("subjectId")) as never,
                      topicId: (String(data.get("topicId") ?? "") || undefined) as never,
                      durationMinutes: Number(data.get("durationMinutes")),
                      attemptsAllowed: Number(data.get("attemptsAllowed")),
                      passThreshold: Number(data.get("passThreshold")),
                      shuffleQuestions: data.get("shuffleQuestions") === "on",
                      shuffleOptions: data.get("shuffleOptions") === "on",
                      allowLate: data.get("allowLate") === "on",
                      releasePolicy: String(data.get("releasePolicy")) as never,
                      showAnswersToStudents: data.get("showAnswers") === "on",
                      openAt: fromDateInputValue(String(data.get("openAt") ?? "")),
                      closeAt: fromDateInputValue(String(data.get("closeAt") ?? "")),
                    }),
                  t("common.saved"),
                );
              }}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t("common.type")} required>
                  <Select name="kind" defaultValue={assessment.kind}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quiz">{t("kind.quiz")}</SelectItem>
                      <SelectItem value="exam">{t("kind.exam")}</SelectItem>
                      <SelectItem value="homework">{t("kind.homework")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("common.subject")} required>
                  <Select name="subjectId" defaultValue={assessment.subjectId}>
                    <SelectTrigger>
                      <SelectValue />
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
                  <Select name="topicId" defaultValue={assessment.topicId ?? undefined}>
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
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("common.name")} required hint={t("question.prompt_primary_hint")}>
                  <Input name="titleEn" defaultValue={assessment.titleEn} required minLength={3} />
                </Field>
                <Field label={t("question.translation")}>
                  <Input name="titleAr" defaultValue={assessment.titleAr} dir="rtl" />
                </Field>
                <Field label={t("question.instructions_en")}>
                  <Textarea
                    name="instructionsEn"
                    rows={2}
                    defaultValue={assessment.instructionsEn}
                  />
                </Field>
                <Field label={t("question.instructions_ar")}>
                  <Textarea
                    name="instructionsAr"
                    rows={2}
                    dir="rtl"
                    defaultValue={assessment.instructionsAr}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t("assessment.duration")} required>
                  <Input
                    name="durationMinutes"
                    type="number"
                    min={1}
                    max={600}
                    defaultValue={assessment.durationMinutes}
                    required
                  />
                </Field>
                <Field label={t("assessment.attempts")} required>
                  <Input
                    name="attemptsAllowed"
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={assessment.attemptsAllowed}
                    required
                  />
                </Field>
                <Field label={t("assessment.pass_threshold")} required>
                  <Input
                    name="passThreshold"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={assessment.passThreshold}
                    required
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t("common.opens")}>
                  <Input
                    name="openAt"
                    type="datetime-local"
                    defaultValue={toDateInputValue(assessment.openAt)}
                  />
                </Field>
                <Field label={t("assessment.deadline")}>
                  <Input
                    name="closeAt"
                    type="datetime-local"
                    defaultValue={toDateInputValue(assessment.closeAt)}
                  />
                </Field>
                <Field
                  label={t("assessment.release_policy")}
                  required
                  hint={t("assessment.release.quiz_note")}
                >
                  <Select name="releasePolicy" defaultValue={assessment.releasePolicy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">
                        {t("assessment.release.immediate")}
                      </SelectItem>
                      <SelectItem value="manual">
                        {t("assessment.release.manual")}
                      </SelectItem>
                      <SelectItem value="on_close">
                        {t("assessment.release.on_close")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="shuffleQuestions"
                    defaultChecked={assessment.shuffleQuestions}
                    className="size-4 accent-primary"
                  />
                  {pick("Shuffle question order", "خلط ترتيب الأسئلة")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="shuffleOptions"
                    defaultChecked={assessment.shuffleOptions}
                    className="size-4 accent-primary"
                  />
                  {pick("Shuffle answer options", "خلط ترتيب الخيارات")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allowLate"
                    defaultChecked={assessment.allowLate}
                    className="size-4 accent-primary"
                  />
                  {pick("Accept late submissions", "قبول التسليم المتأخر")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="showAnswers"
                    defaultChecked={assessment.showAnswersToStudents}
                    className="size-4 accent-primary"
                  />
                  {t("assessment.answers_visible.yes")}
                </label>
              </div>

              <Button type="submit" disabled={busy} className="gap-2">
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t("common.save")}
              </Button>
            </form>
          </SectionCard>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t("teacher.builder.max_score", { marks: assessment.maxScore })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Dialog open={writerOpen} onOpenChange={setWriterOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Sparkles className="size-4" aria-hidden />
                    {t("teacher.builder.write_question")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{t("teacher.builder.write_question")}</DialogTitle>
                    <DialogDescription>{t("teacher.builder.write_hint")}</DialogDescription>
                  </DialogHeader>
                  <QuestionComposer
                    assessmentId={assessment._id}
                    defaultSubjectId={assessment.subjectId}
                  />
                </DialogContent>
              </Dialog>
              <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Plus className="size-4" aria-hidden />
                  {t("teacher.builder.from_bank")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{t("teacher.builder.from_bank")}</DialogTitle>
                  <DialogDescription>
                    {t("teacher.question_bank.subtitle")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  {(bankQuestions ?? []).map((question) => (
                    <label
                      key={question._id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3 text-sm hover:bg-secondary/50"
                    >
                      <Checkbox
                        checked={pickedQuestions.includes(question._id)}
                        onCheckedChange={(checked) =>
                          setPickedQuestions((prev) =>
                            checked
                              ? [...prev, question._id]
                              : prev.filter((id) => id !== question._id),
                          )
                        }
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {pick(question.promptEn, question.promptAr)}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {t(`qtype.${question.type}`)} · {question.defaultMarks}{" "}
                          {t("common.marks")} ·{" "}
                          {question.topicNameEn ??
                            pick(question.subjectNameEn ?? "", question.subjectNameAr ?? "")}
                        </span>
                      </span>
                    </label>
                  ))}
                  {(bankQuestions ?? []).length === 0 ? (
                    <EmptyState
                      title={t("teacher.question_bank.empty")}
                      action={
                        <Button asChild variant="outline" size="sm">
                          <Link to="/teacher/question-bank">
                            {t("teacher.question_bank.title")}
                          </Link>
                        </Button>
                      }
                    />
                  ) : null}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPickerOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    disabled={busy || pickedQuestions.length === 0}
                    onClick={() => {
                      void run(
                        async () => {
                          await addQuestions({
                            assessmentId: assessment._id,
                            items: pickedQuestions.map((id) => ({
                              questionId: id as never,
                            })),
                          });
                          setPickedQuestions([]);
                          setPickerOpen(false);
                        },
                        t("common.saved"),
                      );
                    }}
                  >
                    {t("teacher.builder.add_question")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {detail.questions.length === 0 ? (
            <EmptyState
              title={t("teacher.builder.no_questions")}
              action={
                <Button className="gap-2" onClick={() => setWriterOpen(true)}>
                  <Sparkles className="size-4" aria-hidden />
                  {t("teacher.builder.write_question")}
                </Button>
              }
            />
          ) : (
            <ol className="space-y-3">
              <AnimatePresence initial={false}>
              {detail.questions.map((question, index) => (
                <motion.li
                  key={question._id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  className="surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {index + 1} · {t(`qtype.${question.snapshot.type}`)}
                        {question.snapshot.topicLabelEn
                          ? ` · ${pick(question.snapshot.topicLabelEn, question.snapshot.topicLabelAr ?? "")}`
                          : ""}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {pick(question.snapshot.promptEn, question.snapshot.promptAr)}
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {question.snapshot.options.map((option) => (
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
                        {question.snapshot.acceptedAnswers?.length ? (
                          <li className="chip">
                            {question.snapshot.acceptedAnswers.join(" / ")}
                          </li>
                        ) : null}
                      </ul>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={question.marks}
                        className="w-20"
                        onChange={(event) =>
                          void run(() =>
                            updateMarks({
                              assessmentQuestionId: question._id,
                              marks: Number(event.target.value) || 1,
                            }),
                          )
                        }
                        aria-label={t("teacher.builder.marks")}
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={index === 0 || busy}
                        onClick={() =>
                          void run(() => {
                            const ids = detail.questions.map((q) => q._id);
                            [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                            return reorder({
                              assessmentId: assessment._id,
                              orderedIds: ids as never,
                            });
                          })
                        }
                        aria-label={t("common.previous")}
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={index === detail.questions.length - 1 || busy}
                        onClick={() =>
                          void run(() => {
                            const ids = detail.questions.map((q) => q._id);
                            [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
                            return reorder({
                              assessmentId: assessment._id,
                              orderedIds: ids as never,
                            });
                          })
                        }
                        aria-label={t("common.next")}
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            removeQuestion({ assessmentQuestionId: question._id }),
                          )
                        }
                        aria-label={t("teacher.builder.remove")}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </motion.li>
              ))}
              </AnimatePresence>
            </ol>
          )}
        </TabsContent>

        <TabsContent value="assign" className="space-y-6">
          <SectionCard title={t("teacher.assign.classes")}>
            <div className="space-y-2">
              {(classes ?? []).map((cls) => (
                <label
                  key={cls._id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/70 p-3 text-sm hover:bg-secondary/50"
                >
                  <Checkbox
                    checked={selectedClasses.includes(cls._id)}
                    onCheckedChange={(checked) =>
                      setSelectedClasses((prev) =>
                        checked
                          ? [...prev, cls._id]
                          : prev.filter((id) => id !== cls._id),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {pick(cls.nameEn, cls.nameAr)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {cls.studentCount} {t("teacher.assigned_students")}
                    </span>
                  </span>
                </label>
              ))}
              {(classes ?? []).length === 0 ? (
                <EmptyState title={t("common.none_yet")} icon={Users} />
              ) : null}
            </div>
            <Button
              className="mt-4"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    assignClasses({
                      assessmentId: assessment._id,
                      classIds: selectedClasses as never,
                    }),
                  t("common.saved"),
                )
              }
            >
              {t("common.save")}
            </Button>
          </SectionCard>

          <SectionCard
            title={t("teacher.assign.students")}
            description={t("teacher.assign.assigned_count", {
              count: detail.assignedCount,
            })}
          >
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {(students ?? []).map((student) => (
                <label
                  key={student.userId}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/70 p-3 text-sm hover:bg-secondary/50"
                >
                  <Checkbox
                    checked={selectedStudents.includes(student.userId)}
                    onCheckedChange={(checked) =>
                      setSelectedStudents((prev) =>
                        checked
                          ? [...prev, student.userId]
                          : prev.filter((id) => id !== student.userId),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{student.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {student.email}
                    </span>
                  </span>
                </label>
              ))}
              {(students ?? []).length === 0 ? (
                <EmptyState title={t("teacher.students.empty")} icon={Users} />
              ) : null}
            </div>
            <Button
              className="mt-4"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    assignStudents({
                      assessmentId: assessment._id,
                      studentIds: selectedStudents as never,
                    }),
                  t("common.saved"),
                )
              }
            >
              {t("common.save")}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              {pick(
                "Students only see assessments that were assigned to them or to one of their classes.",
                "لا يرى الطلاب إلا التقييمات المسندة إليهم مباشرة أو إلى أحد صفوفهم.",
              )}
            </p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="publish" className="space-y-6">
          <SectionCard title={t("teacher.builder.validation_title")}>
            <ul className="space-y-2 text-sm">
              {validation.map((item) => (
                <li key={item.label} className="flex items-start gap-2">
                  {item.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-chart-4" aria-hidden />
                  )}
                  <span className={item.ok ? "text-muted-foreground" : ""}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                className="gap-2"
                disabled={busy || assessment.status === "archived"}
                onClick={() =>
                  void run(
                    () => publish({ assessmentId: assessment._id }),
                    t("teacher.published_ok"),
                  )
                }
              >
                <Rocket className="size-4" aria-hidden />
                {t("teacher.publish.now")}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={busy || assessment.status === "archived"}
                onClick={() =>
                  void run(
                    () => publish({ assessmentId: assessment._id, schedule: true }),
                    t("teacher.published_ok"),
                  )
                }
              >
                <Send className="size-4" aria-hidden />
                {t("teacher.publish.scheduled")}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => releaseResults({ assessmentId: assessment._id }),
                    t("common.saved"),
                  )
                }
              >
                {t("teacher.grading.release")}
              </Button>
            </div>
          </SectionCard>

          <SectionCard title={t("common.actions")}>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => setStatus({ assessmentId: assessment._id, status: "closed" }))}
              >
                {t("common.close_short")}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => setStatus({ assessmentId: assessment._id, status: "draft" }))}
              >
                {t("common.unpublish")}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    duplicate({ assessmentId: assessment._id }),
                  )
                }
              >
                <Copy className="size-4" aria-hidden />
                {t("common.duplicate")}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={busy}
                onClick={() => void run(() => setStatus({ assessmentId: assessment._id, status: "archived" }))}
              >
                <Archive className="size-4" aria-hidden />
                {t("common.archive")}
              </Button>
            </div>
            <DataList
              items={[
                {
                  label: t("common.status"),
                  value: <StatusBadge status={assessment.status} />,
                },
                {
                  label: t("common.marks"),
                  value: `${assessment.maxScore} (v${assessment.version})`,
                },
                {
                  label: t("teacher.submissions"),
                  value: `${detail.submissionsCount} / ${detail.attemptsCount}`,
                },
                {
                  label: t("teacher.grading.released"),
                  value: assessment.resultsReleasedAt
                    ? formatDate(assessment.resultsReleasedAt, true)
                    : t("teacher.grading.not_released"),
                },
                {
                  label: t("teacher.assign.classes"),
                  value: assignedClasses.map((c) => c.nameEn).join(", ") || "—",
                },
              ]}
            />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </>
  );
}
