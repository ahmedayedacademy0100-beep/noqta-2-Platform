import {
  DataList,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { useMutation, useQuery } from "convex/react";
import { Loader2, MessageCircle, Plus, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Per-class WhatsApp contact editor.
 *
 * Contact numbers are set per class ("Grade 7 – A"), not per teacher: the admin
 * decides which number a class's students reach from their floating button.
 */
function ClassWhatsappField({
  initial,
  disabled,
  onSave,
}: {
  initial: string;
  disabled: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const { t } = useI18n();
  // `edited` tracks only what the admin typed; otherwise the field follows the
  // stored class number.
  const [edited, setEdited] = useState<string | null>(null);
  const value = edited ?? initial;
  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(event) => setEdited(event.target.value)}
        placeholder="+201234567890"
        dir="ltr"
        inputMode="tel"
        className="w-40"
        aria-label={t("admin.classes.whatsapp")}
      />
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={disabled || value.trim() === initial}
        onClick={() => void onSave(value)}
      >
        <MessageCircle className="size-3.5" aria-hidden />
        {t("admin.classes.whatsapp_save")}
      </Button>
    </div>
  );
}

export default function AdminAcademics() {
  const { t, pick } = useI18n();
  const structure = useQuery(api.academics.structure, {});
  const [detailClassId, setDetailClassId] = useState<string | null>(null);
  const detail = useQuery(
    api.academics.classDetail,
    detailClassId ? { classId: detailClassId as never } : "skip",
  );
  const students = useQuery(api.academics.studentPicker, {});
  // Every active teacher account, not just the ones already on this roster —
  // the assign form needs something to choose from.
  const teachers = useQuery(api.academics.teacherPicker, {});

  const createYear = useMutation(api.academics.createAcademicYear);
  const setActiveYear = useMutation(api.academics.setActiveYear);
  const createGrade = useMutation(api.academics.createGrade);
  const createSubject = useMutation(api.academics.createSubject);
  const createTopic = useMutation(api.academics.createTopic);
  const createClass = useMutation(api.academics.createClass);
  const assignTeacher = useMutation(api.academics.assignTeacher);
  const removeTeacher = useMutation(api.academics.removeTeacherAssignment);
  const enrollStudent = useMutation(api.academics.enrollStudent);
  const removeStudent = useMutation(api.academics.removeStudentFromClass);
  const regenerateCode = useMutation(api.academics.regenerateJoinCode);
  const setClassWhatsapp = useMutation(api.academics.setClassWhatsapp);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Bumped after each assignment so the pickers remount with fresh defaults.
  const [assignNonce, setAssignNonce] = useState(0);

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

  if (structure === undefined) return <LoadingBlock />;
  if (!structure) return <ErrorNotice error={null} />;

  const years = structure.years;
  const grades = structure.grades;
  const subjects = structure.subjects;
  const topics = structure.topics;
  const classes = structure.classes;

  return (
    <>
      <PageHeader
        title={t("admin.academics.title")}
        subtitle={t("admin.academics.subtitle")}
      />

      {error ? <ErrorNotice error={error} /> : null}

      <Tabs defaultValue="classes" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="classes">{t("admin.academics.classes")}</TabsTrigger>
          <TabsTrigger value="years">{t("admin.academics.years")}</TabsTrigger>
          <TabsTrigger value="grades">{t("admin.academics.grades")}</TabsTrigger>
          <TabsTrigger value="subjects">{t("admin.academics.subjects")}</TabsTrigger>
          <TabsTrigger value="topics">{t("admin.academics.topics")}</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="space-y-4">
          <SectionCard
            title={t("admin.academics.classes")}
            actions={
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2" size="sm">
                    <Plus className="size-4" aria-hidden />
                    {t("admin.academics.add_class")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("admin.academics.add_class")}</DialogTitle>
                    <DialogDescription>{t("teacher.join_code_hint")}</DialogDescription>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void run(
                        () =>
                          createClass({
                            nameEn: String(data.get("nameEn") ?? ""),
                            nameAr: String(data.get("nameAr") ?? ""),
                            gradeId: String(data.get("gradeId")) as never,
                            academicYearId: String(data.get("academicYearId")) as never,
                            subjectId: (String(data.get("subjectId") ?? "") ||
                              undefined) as never,
                            homeroomTeacherId: undefined,
                            whatsapp: String(data.get("whatsapp") ?? "") || undefined,
                          }),
                        t("common.saved"),
                      );
                    }}
                  >
                    <Field label={t("common.name")} required>
                      <Input name="nameEn" required />
                    </Field>
                    <Field label={t("question.translation")}>
                      <Input name="nameAr" dir="rtl" />
                    </Field>
                    <Field
                      label={t("admin.classes.whatsapp")}
                      hint={t("admin.classes.whatsapp_hint")}
                    >
                      <Input name="whatsapp" dir="ltr" inputMode="tel" placeholder="+201234567890" />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label={t("admin.academics.grades")} required>
                        <Select name="gradeId" required>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {grades.map((grade) => (
                              <SelectItem key={grade._id} value={grade._id}>
                                {pick(grade.nameEn, grade.nameAr)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label={t("admin.academics.years")} required>
                        <Select
                          name="academicYearId"
                          defaultValue={years.find((y) => y.isActive)?._id}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {years.map((year) => (
                              <SelectItem key={year._id} value={year._id}>
                                {year.name}
                              </SelectItem>
                            ))}
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
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={busy}>
                        {t("common.create")}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            }
          >
            {classes.length === 0 ? (
              <EmptyState title={t("common.none_yet")} icon={Users} />
            ) : (
              <ul className="space-y-2">
                {classes.map((cls) => (
                  <li
                    key={cls._id}
                    className="surface-muted flex flex-wrap items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {pick(cls.nameEn, cls.nameAr)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cls.gradeNameEn ? pick(cls.gradeNameEn, cls.gradeNameAr ?? "") : ""} ·{" "}
                        {cls.studentCount} {t("teacher.assigned_students")} ·{" "}
                        {cls.homeroomTeacherName ?? t("common.none")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ClassWhatsappField
                        initial={cls.whatsapp}
                        disabled={busy}
                        onSave={(value) =>
                          run(
                            () =>
                              setClassWhatsapp({
                                classId: cls._id,
                                whatsapp: value,
                              }),
                            t("common.saved"),
                          )
                        }
                      />
                      <span className="chip font-mono tracking-widest">
                        {cls.joinCode}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDetailClassId(cls._id)}
                      >
                        {t("admin.academics.roster")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="years" className="space-y-4">
          <SectionCard
            title={t("admin.academics.years")}
            actions={
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="size-4" aria-hidden />
                    {t("admin.academics.add_year")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("admin.academics.add_year")}</DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void run(
                        () =>
                          createYear({
                            name: String(data.get("name") ?? ""),
                            startDate: String(data.get("startDate") ?? ""),
                            endDate: String(data.get("endDate") ?? ""),
                            makeActive: data.get("makeActive") === "on",
                          }),
                        t("common.saved"),
                      );
                    }}
                  >
                    <Field label={t("common.name")} required>
                      <Input name="name" placeholder="2027–2028" required />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Start" required>
                        <Input name="startDate" type="date" required />
                      </Field>
                      <Field label="End" required>
                        <Input name="endDate" type="date" required />
                      </Field>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="makeActive"
                        className="size-4 accent-primary"
                      />
                      {t("admin.academics.make_active")}
                    </label>
                    <DialogFooter>
                      <Button type="submit" disabled={busy}>
                        {t("common.create")}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            }
          >
            <ul className="space-y-2">
              {years.map((year) => (
                <li
                  key={year._id}
                  className="surface-muted flex items-center justify-between gap-3 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{year.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {year.startDate} → {year.endDate}
                    </p>
                  </div>
                  {year.isActive ? (
                    <span className="chip">{t("admin.academics.active_year")}</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => setActiveYear({ yearId: year._id }),
                          t("common.saved"),
                        )
                      }
                    >
                      {t("admin.academics.make_active")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="grades">
          <SectionCard
            title={t("admin.academics.grades")}
            actions={
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="size-4" aria-hidden />
                    {t("admin.academics.add_grade")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("admin.academics.add_grade")}</DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void run(
                        () =>
                          createGrade({
                            nameEn: String(data.get("nameEn") ?? ""),
                            nameAr: String(data.get("nameAr") ?? ""),
                            level: Number(data.get("level") ?? 7),
                            academicYearId: String(data.get("academicYearId")) as never,
                          }),
                        t("common.saved"),
                      );
                    }}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t("question.prompt_en")} required>
                        <Input name="nameEn" required />
                      </Field>
                      <Field label={t("question.prompt_ar")} required>
                        <Input name="nameAr" dir="rtl" required />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Level" required>
                        <Input name="level" type="number" min={1} max={12} required />
                      </Field>
                      <Field label={t("admin.academics.years")} required>
                        <Select
                          name="academicYearId"
                          defaultValue={years.find((y) => y.isActive)?._id}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {years.map((year) => (
                              <SelectItem key={year._id} value={year._id}>
                                {year.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={busy}>
                        {t("common.create")}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            }
          >
            <ul className="grid gap-2 sm:grid-cols-3">
              {grades.map((grade) => (
                <li key={grade._id} className="surface-muted p-3 text-sm">
                  <p className="font-medium">{pick(grade.nameEn, grade.nameAr)}</p>
                  <p className="text-xs text-muted-foreground">
                    Level {grade.level}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="subjects">
          <SectionCard
            title={t("admin.academics.subjects")}
            actions={
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="size-4" aria-hidden />
                    {t("admin.academics.add_subject")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("admin.academics.add_subject")}</DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void run(
                        () =>
                          createSubject({
                            nameEn: String(data.get("nameEn") ?? ""),
                            nameAr: String(data.get("nameAr") ?? ""),
                            code: String(data.get("code") ?? ""),
                            color: String(data.get("color") ?? "#3b6ef6"),
                          }),
                        t("common.saved"),
                      );
                    }}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t("question.prompt_en")} required>
                        <Input name="nameEn" required />
                      </Field>
                      <Field label={t("question.prompt_ar")} required>
                        <Input name="nameAr" dir="rtl" required />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t("common.code")} required>
                        <Input name="code" placeholder="MATH" required />
                      </Field>
                      <Field label="Color">
                        <Input name="color" type="color" defaultValue="#3b6ef6" />
                      </Field>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={busy}>
                        {t("common.create")}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            }
          >
            <ul className="grid gap-2 sm:grid-cols-3">
              {subjects.map((subject) => (
                <li
                  key={subject._id}
                  className="surface-muted flex items-center gap-3 p-3 text-sm"
                >
                  <span
                    className="size-3 rounded-full"
                    style={{ background: subject.color }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {pick(subject.nameEn, subject.nameAr)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {subject.code}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="topics">
          <SectionCard
            title={t("admin.academics.topics")}
            actions={
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="size-4" aria-hidden />
                    {t("admin.academics.add_topic")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("admin.academics.add_topic")}</DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void run(
                        () =>
                          createTopic({
                            subjectId: String(data.get("subjectId")) as never,
                            gradeId: (String(data.get("gradeId") ?? "") || undefined) as never,
                            nameEn: String(data.get("nameEn") ?? ""),
                            nameAr: String(data.get("nameAr") ?? ""),
                          }),
                        t("common.saved"),
                      );
                    }}
                  >
                    <Field label={t("common.subject")} required>
                      <Select name="subjectId" required>
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
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t("question.prompt_en")} required>
                        <Input name="nameEn" required />
                      </Field>
                      <Field label={t("question.prompt_ar")} required>
                        <Input name="nameAr" dir="rtl" required />
                      </Field>
                    </div>
                    <Field label={t("admin.academics.grades")}>
                      <Select name="gradeId">
                        <SelectTrigger>
                          <SelectValue placeholder={t("common.none")} />
                        </SelectTrigger>
                        <SelectContent>
                          {grades.map((grade) => (
                            <SelectItem key={grade._id} value={grade._id}>
                              {pick(grade.nameEn, grade.nameAr)}
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
            }
          >
            <ul className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <li key={topic._id} className="chip">
                  {pick(topic.nameEn, topic.nameAr)}
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog
        open={detailClassId !== null}
        onOpenChange={(open) => setDetailClassId(open ? detailClassId : null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("admin.academics.roster")}</DialogTitle>
            <DialogDescription>{t("teacher.join_code_hint")}</DialogDescription>
          </DialogHeader>
          {detail === undefined ? (
            <LoadingBlock />
          ) : (
            <div className="space-y-5">
              <DataList
                items={[
                  {
                    label: t("teacher.assigned_students"),
                    value: detail.students.length,
                  },
                  {
                    label: t("common.teacher"),
                    value: detail.teachers.map((teacher) => teacher.teacherName).join(", ") || "—",
                  },
                ]}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => regenerateCode({ classId: detailClassId as never }),
                      t("common.saved"),
                    )
                  }
                >
                  {t("teacher.join_code")}
                </Button>
              </div>

              <div>
                <p className="text-sm font-medium">{t("admin.academics.assign_teacher")}</p>
                {(teachers ?? []).length === 0 ? (
                  <p className="mt-2 rounded-lg border border-dashed border-border/80 p-3 text-xs text-muted-foreground">
                    {pick(
                      "There are no active teacher accounts yet. Create one in Users first, then come back to assign them.",
                      "لا توجد حسابات معلمين نشطة بعد. أنشئ حساب معلم من صفحة المستخدمين ثم عُد للإسناد.",
                    )}
                  </p>
                ) : (
                  <form
                    key={`${detailClassId}-${assignNonce}`}
                    className="mt-2 flex flex-wrap items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      const teacherId = String(data.get("teacherId") ?? "");
                      if (!teacherId) return;
                      void run(async () => {
                        await assignTeacher({
                          teacherId: teacherId as never,
                          classId: detailClassId as never,
                          subjectId: (String(data.get("subjectId") ?? "") ||
                            undefined) as never,
                        });
                        setAssignNonce((value) => value + 1);
                      }, t("common.saved"));
                    }}
                  >
                    <Select name="teacherId" required>
                      <SelectTrigger className="w-52">
                        <SelectValue placeholder={t("common.teacher")} />
                      </SelectTrigger>
                      <SelectContent>
                        {(teachers ?? []).map((teacher) => (
                          <SelectItem key={teacher.userId} value={teacher.userId}>
                            {teacher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      name="subjectId"
                      required
                      defaultValue={
                        classes.find((cls) => cls._id === detailClassId)?.subjectId ??
                        subjects[0]?._id
                      }
                    >
                      <SelectTrigger className="w-44">
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
                    <Button type="submit" size="sm" className="gap-2" disabled={busy}>
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <UserPlus className="size-4" aria-hidden />
                      )}
                      {t("admin.academics.assign_teacher")}
                    </Button>
                  </form>
                )}
              </div>

              <div>
                <p className="text-sm font-medium">{t("teacher.students.title")}</p>
                <ul className="mt-2 divide-y divide-border/60">
                  {detail.students.map((student) => (
                    <li
                      key={student.studentId}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{student.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {student.email}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              removeStudent({
                                classId: detailClassId as never,
                                studentId: student.studentId,
                              }),
                            t("common.saved"),
                          )
                        }
                      >
                        {t("admin.academics.remove_student")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>

              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void run(
                    () =>
                      enrollStudent({
                        classId: detailClassId as never,
                        studentId: String(data.get("studentId")) as never,
                      }),
                    t("common.saved"),
                  );
                }}
              >
                <Select name="studentId" required>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder={t("common.student")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(students ?? []).map((student) => (
                      <SelectItem key={student.userId} value={student.userId}>
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" size="sm" className="gap-2" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {t("admin.users.enroll_class")}
                </Button>
              </form>

              <div>
                <p className="text-sm font-medium">{t("common.teacher")}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {detail.teachers.map((teacher) => (
                    <li key={teacher.assignmentId} className="chip gap-2">
                      {teacher.teacherName} · {pick(teacher.subjectNameEn, teacher.subjectNameAr)}
                      <button
                        type="button"
                        className="text-xs underline"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            removeTeacher({ assignmentId: teacher.assignmentId }),
                          )
                        }
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {error ? <ErrorNotice error={error} /> : null}
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">
        {`${t("common.total")}: ${grades.length} ${t("admin.grades")} · ${subjects.length} ${t("teacher.subjects")} · ${classes.length} ${t("admin.classes")}`}
      </p>
    </>
  );
}
