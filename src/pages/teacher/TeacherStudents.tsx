import {
  DemoBadge,
  EmptyState,
  Field,
  LoadingBlock,
  Meter,
  PageHeader,
  SectionCard,
  StatusBadge,
  DataList,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { useMutation, useQuery } from "convex/react";
import { Copy, RefreshCw, Search, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type SortKey = "name" | "average" | "points";

export default function TeacherStudents() {
  const { t, pick, formatDate } = useI18n();
  const structure = useQuery(api.academics.structure, {});
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  const students = useQuery(api.academics.myStudents, {
    search: search || undefined,
    classId: classId === "all" ? undefined : (classId as never),
  });
  const history = useQuery(
    api.academics.studentHistory,
    selectedStudent ? { studentId: selectedStudent as never } : "skip",
  );
  const regenerate = useMutation(api.academics.regenerateJoinCode);
  const [busy, setBusy] = useState(false);

  const rows = (students ?? []).slice().sort((a, b) => {
    if (sort === "average") {
      return (b.averagePercent ?? -1) - (a.averagePercent ?? -1);
    }
    if (sort === "points") return b.points - a.points;
    return a.name.localeCompare(b.name);
  });

  const classes = structure?.classes ?? [];

  return (
    <>
      <PageHeader title={t("teacher.students.title")} subtitle={t("teacher.students.subtitle")} />

      <SectionCard title={t("teacher.my_classes")} description={t("teacher.join_code_hint")}>
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
                    {cls.studentCount} {t("teacher.assigned_students")}
                    {cls.subjectNameEn
                      ? ` · ${pick(cls.subjectNameEn, cls.subjectNameAr ?? cls.subjectNameEn)}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="chip font-mono tracking-widest">{cls.joinCode}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={t("common.edit")}
                    onClick={() => {
                      void navigator.clipboard?.writeText(cls.joinCode);
                      toast.success(t("common.saved"));
                    }}
                  >
                    <Copy className="size-4" aria-hidden />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={busy}
                    aria-label={t("common.create")}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await regenerate({ classId: cls._id });
                        toast.success(t("common.saved"));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <RefreshCw className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={t("teacher.students.title")}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("teacher.students.search")}
              className="ps-9"
            />
          </div>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t("teacher.students.group_by_class")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls._id} value={cls._id}>
                  {pick(cls.nameEn, cls.nameAr)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t("teacher.students.sort")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">{t("common.name")}</SelectItem>
              <SelectItem value="average">{t("teacher.students.average")}</SelectItem>
              <SelectItem value="points">{t("student.points")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {students === undefined ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title={t("teacher.students.empty")} icon={Users} />
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs text-muted-foreground">
                  <th className="py-2 pe-3 text-start font-medium">{t("common.student")}</th>
                  <th className="py-2 pe-3 text-start font-medium">{t("common.classes")}</th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {t("teacher.students.average")}
                  </th>
                  <th className="py-2 pe-3 text-start font-medium">{t("assessment.attempts")}</th>
                  <th className="py-2 pe-3 text-start font-medium">{t("student.points")}</th>
                  <th className="py-2 text-start font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.studentId} className="border-b border-border/40">
                    <td className="py-3 pe-3">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{row.name}</span>
                        {row.isDemo ? <DemoBadge /> : null}
                      </span>
                      <span className="block text-xs text-muted-foreground">{row.email}</span>
                    </td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {row.classNames.join(", ")}
                    </td>
                    <td className="w-40 py-3 pe-3">
                      {row.averagePercent === null ? (
                        "—"
                      ) : (
                        <Meter value={row.averagePercent} />
                      )}
                    </td>
                    <td className="py-3 pe-3">{row.attemptsCount}</td>
                    <td className="py-3 pe-3">{row.points}</td>
                    <td className="py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedStudent(row.studentId)}
                      >
                        {t("teacher.students.history")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Dialog
        open={selectedStudent !== null}
        onOpenChange={(open) => setSelectedStudent(open ? selectedStudent : null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{history?.student?.name ?? t("teacher.students.history")}</DialogTitle>
            <DialogDescription>
              {t("teacher.students.subtitle")} {history?.student?.isDemo ? `· ${t("common.demo_data")}` : ""}
            </DialogDescription>
          </DialogHeader>
          {history === undefined ? (
            <LoadingBlock />
          ) : (
            <div className="space-y-4">
              <DataList
                items={[
                  { label: t("common.email"), value: history?.student?.email ?? "—" },
                  {
                    label: t("student.points"),
                    value: history?.student?.points ?? 0,
                  },
                  {
                    label: t("student.streak"),
                    value: history?.student?.streak ?? 0,
                  },
                  {
                    label: t("student.badges"),
                    value: history?.achievements.length ?? 0,
                  },
                ]}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-xs text-muted-foreground">
                      <th className="py-2 pe-3 text-start font-medium">
                        {t("common.name")}
                      </th>
                      <th className="py-2 pe-3 text-start font-medium">
                        {t("common.subject")}
                      </th>
                      <th className="py-2 pe-3 text-start font-medium">
                        {t("common.status")}
                      </th>
                      <th className="py-2 pe-3 text-start font-medium">
                        {t("common.score")}
                      </th>
                      <th className="py-2 text-start font-medium">{t("common.due")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(history?.results ?? []).map((row) => (
                      <tr key={row.attemptId} className="border-b border-border/40">
                        <td className="py-2.5 pe-3">{pick(row.titleEn, row.titleAr)}</td>
                        <td className="py-2.5 pe-3 text-muted-foreground">
                          {pick(row.subjectNameEn, row.subjectNameAr)}
                        </td>
                        <td className="py-2.5 pe-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="py-2.5 pe-3">
                          {row.score} / {row.maxScore}
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {formatDate(row.submittedAt ?? undefined, true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(history?.results ?? []).length === 0 ? (
                  <EmptyState title={t("common.none_yet")} />
                ) : null}
              </div>
              <Field label={t("student.badges")}>
                <div className="flex flex-wrap gap-2">
                  {(history?.achievements ?? []).map((badge) => (
                    <span key={badge._id} className="chip">
                      {badge.achievementCode}
                    </span>
                  ))}
                </div>
              </Field>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
