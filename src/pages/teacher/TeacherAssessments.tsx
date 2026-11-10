import {
  EmptyState,
  ErrorNotice,
  Field,
  LoadingBlock,
  PageHeader,
  StatusBadge,
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
import { fromDateInputValue } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { ClipboardList, Loader2, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

export default function TeacherAssessments() {
  const { t, pick, formatDate } = useI18n();
  const navigate = useNavigate();
  const structure = useQuery(api.academics.structure, {});
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const list = useQuery(api.assessments.list, {
    search: search || undefined,
    status: status === "all" ? undefined : (status as never),
  });
  const create = useMutation(api.assessments.create);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = new FormData(event.currentTarget);
      const result = await create({
        kind: (data.get("kind") ?? "quiz") as never,
        titleEn: String(data.get("titleEn") ?? ""),
        titleAr: String(data.get("titleAr") ?? ""),
        instructionsEn: String(data.get("instructionsEn") ?? "") || undefined,
        instructionsAr: String(data.get("instructionsAr") ?? "") || undefined,
        subjectId: String(data.get("subjectId") ?? "") as never,
        durationMinutes: Number(data.get("durationMinutes") ?? 30),
        attemptsAllowed: Number(data.get("attemptsAllowed") ?? 1),
        passThreshold: Number(data.get("passThreshold") ?? 60),
        shuffleQuestions: data.get("shuffleQuestions") === "on",
        shuffleOptions: data.get("shuffleOptions") === "on",
        allowLate: false,
        releasePolicy: (data.get("releasePolicy") ?? "immediate") as never,
        showAnswersToStudents: data.get("showAnswers") === "on",
        openAt: fromDateInputValue(String(data.get("openAt") ?? "")),
        closeAt: fromDateInputValue(String(data.get("closeAt") ?? "")),
      });
      setOpen(false);
      navigate(`/teacher/assessments/${result.id}`);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  const subjects = structure?.subjects ?? [];
  const defaultDuration = 30;

  return (
    <>
      <PageHeader
        title={t("teacher.assessments.title")}
        subtitle={t("teacher.assessments.subtitle")}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" aria-hidden />
                {t("teacher.new_assessment")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t("teacher.new_assessment")}</DialogTitle>
                <DialogDescription>{t("teacher.builder.subtitle")}</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreate}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("common.type")} required>
                    <Select name="kind" defaultValue="quiz">
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
                    <Select name="subjectId" required>
                      <SelectTrigger>
                        <SelectValue placeholder={t("common.subject")} />
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
                </div>

                <Field
                  label={t("common.name")}
                  required
                  hint={t("question.prompt_primary_hint")}
                >
                  <Input name="titleEn" required minLength={3} />
                </Field>
                <Field label={t("question.translation")}>
                  <Input name="titleAr" dir="rtl" />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("question.instructions_en")}>
                    <Textarea name="instructionsEn" rows={2} />
                  </Field>
                  <Field label={t("question.instructions_ar")}>
                    <Textarea name="instructionsAr" rows={2} dir="rtl" />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t("assessment.duration")} required>
                    <Input
                      name="durationMinutes"
                      type="number"
                      min={1}
                      max={600}
                      defaultValue={defaultDuration}
                      required
                    />
                  </Field>
                  <Field label={t("assessment.attempts")} required>
                    <Input
                      name="attemptsAllowed"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={1}
                      required
                    />
                  </Field>
                  <Field label={t("assessment.pass_threshold")} required>
                    <Input
                      name="passThreshold"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={60}
                      required
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("common.opens")}>
                    <Input name="openAt" type="datetime-local" />
                  </Field>
                  <Field label={t("assessment.deadline")}>
                    <Input name="closeAt" type="datetime-local" />
                  </Field>
                </div>

                <Field label={t("assessment.release_policy")} required>
                  <Select name="releasePolicy" defaultValue="immediate">
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

                <div className="space-y-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="shuffleQuestions"
                      className="size-4 accent-primary"
                    />
                    {pick("Shuffle question order", "خلط ترتيب الأسئلة")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="shuffleOptions"
                      className="size-4 accent-primary"
                    />
                    {pick("Shuffle answer options", "خلط ترتيب الخيارات")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="showAnswers"
                      defaultChecked
                      className="size-4 accent-primary"
                    />
                    {t("assessment.answers_visible.yes")}
                  </label>
                </div>

                {error ? <ErrorNotice error={error} /> : null}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={busy} className="gap-2">
                    {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {t("common.create")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["all", "draft", "scheduled", "published", "closed", "archived"] as const).map(
            (option) => (
              <Button
                key={option}
                size="sm"
                variant={status === option ? "default" : "outline"}
                onClick={() => setStatus(option)}
              >
                {option === "all" ? t("common.all") : t(`status.${option}`)}
              </Button>
            ),
          )}
        </div>
        <div className="relative sm:w-64">
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
      </div>

      {list === undefined ? (
        <LoadingBlock />
      ) : list.length === 0 ? (
        <EmptyState title={t("teacher.assessments.empty")} icon={ClipboardList} />
      ) : (
        <div className="surface overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs text-muted-foreground">
                <th className="p-3 text-start font-medium">{t("common.name")}</th>
                <th className="p-3 text-start font-medium">{t("common.type")}</th>
                <th className="p-3 text-start font-medium">{t("common.subject")}</th>
                <th className="p-3 text-start font-medium">{t("common.status")}</th>
                <th className="p-3 text-start font-medium">{t("common.marks")}</th>
                <th className="p-3 text-start font-medium">{t("teacher.submissions")}</th>
                <th className="p-3 text-start font-medium">
                  {t("teacher.awaiting_grading")}
                </th>
                <th className="p-3 text-start font-medium">
                  {t("assessment.deadline")}
                </th>
                <th className="p-3 text-start font-medium" />
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row._id} className="border-b border-border/40">
                  <td className="p-3">
                    <Link
                      to={`/teacher/assessments/${row._id}`}
                      className="font-medium hover:underline"
                    >
                      {pick(row.titleEn, row.titleAr)}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {t("assessment.questions_count", { count: row.questionCount })} ·
                      v{row.version}
                    </p>
                  </td>
                  <td className="p-3">{t(`kind.${row.kind}`)}</td>
                  <td className="p-3 text-muted-foreground">
                    {pick(row.subjectNameEn, row.subjectNameAr)}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="p-3">{row.maxScore}</td>
                  <td className="p-3">
                    {row.submissions}/{row.assignedStudents}
                  </td>
                  <td className="p-3">
                    {row.awaitingGrading > 0 ? (
                      <span className="chip">{row.awaitingGrading}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {formatDate(row.closeAt ?? undefined, true)}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/teacher/assessments/${row._id}`}>
                          {t("common.edit")}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/teacher/analytics/${row._id}`}>
                          {t("teacher.analytics.title")}
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
