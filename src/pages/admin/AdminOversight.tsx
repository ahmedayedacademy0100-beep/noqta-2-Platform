import {
  EmptyState,
  ErrorNotice,
  Field,
  LoadingBlock,
  PageHeader,
  SectionCard,
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
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { describeError } from "@/lib/errors";
import { useMutation, useQuery } from "convex/react";
import { Archive, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

export default function AdminOversight() {
  const { t, pick, formatDate } = useI18n();
  const [search, setSearch] = useState("");
  const [ownerId, setOwnerId] = useState("all");
  const [subjectId, setSubjectId] = useState("all");
  const [status, setStatus] = useState("all");
  const data = useQuery(api.admin.assessmentsOversight, {
    search: search || undefined,
    ownerId: ownerId === "all" ? undefined : (ownerId as never),
    subjectId: subjectId === "all" ? undefined : (subjectId as never),
    status,
  });
  const setAssessmentStatus = useMutation(api.admin.setAssessmentStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

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

  if (data === undefined) return <LoadingBlock />;
  if (!data) return <ErrorNotice error={null} />;

  return (
    <>
      <PageHeader
        title={t("admin.oversight.title")}
        subtitle={t("admin.oversight.subtitle")}
      />

      {error ? <ErrorNotice error={error} /> : null}

      <SectionCard title={t("admin.oversight.filters")}>
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
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("common.teacher")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {data.teachers.map((teacher) => (
                <SelectItem key={teacher.userId} value={teacher.userId}>
                  {teacher.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t("common.subject")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {data.subjects.map((subject) => (
                <SelectItem key={subject._id} value={subject._id}>
                  {pick(subject.nameEn, subject.nameAr)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("common.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {["draft", "scheduled", "published", "closed", "archived"].map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`status.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {data.rows.length === 0 ? (
        <EmptyState title={t("common.none_yet")} icon={ShieldCheck} />
      ) : (
        <div className="surface overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs text-muted-foreground">
                <th className="p-3 text-start font-medium">{t("common.name")}</th>
                <th className="p-3 text-start font-medium">{t("common.teacher")}</th>
                <th className="p-3 text-start font-medium">{t("common.subject")}</th>
                <th className="p-3 text-start font-medium">{t("common.status")}</th>
                <th className="p-3 text-start font-medium">{t("admin.submissions")}</th>
                <th className="p-3 text-start font-medium">{t("admin.awaiting_grading")}</th>
                <th className="p-3 text-start font-medium">{t("common.average")}</th>
                <th className="p-3 text-start font-medium">{t("common.due")}</th>
                <th className="p-3 text-start font-medium" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row._id} className="border-b border-border/40">
                  <td className="p-3">
                    <span className="font-medium">{pick(row.titleEn, row.titleAr)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t(`kind.${row.kind}`)} · v{row.version}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{row.ownerName}</td>
                  <td className="p-3 text-muted-foreground">
                    {pick(row.subjectNameEn, row.subjectNameAr)}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="p-3">
                    {row.submissions}/{row.attempts}
                  </td>
                  <td className="p-3">{row.awaitingGrading}</td>
                  <td className="p-3">
                    {row.averagePercent === null
                      ? "—"
                      : `${Math.round(row.averagePercent)}%`}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {formatDate(row.closeAt ?? undefined, true)}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/teacher/analytics/${row._id}`}>
                          {t("teacher.analytics.title")}
                        </Link>
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="gap-1.5">
                            <Archive className="size-3.5" aria-hidden />
                            {t("admin.oversight.suspend")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t("admin.oversight.suspend")}</DialogTitle>
                            <DialogDescription>
                              {pick(
                                "Closing stops new attempts. Submitted answers and released grades are never modified.",
                                "الإغلاق يوقف المحاولات الجديدة، ولا يتم تعديل الإجابات المسلّمة أو الدرجات المُصدرة.",
                              )}
                            </DialogDescription>
                          </DialogHeader>
                          <form
                            className="space-y-4"
                            onSubmit={(event) => {
                              event.preventDefault();
                              const formData = new FormData(event.currentTarget);
                              void run(
                                () =>
                                  setAssessmentStatus({
                                    assessmentId: row._id,
                                    status: formData.get("archive") === "on"
                                      ? "archived"
                                      : "closed",
                                    reason: String(formData.get("reason") ?? ""),
                                  }),
                                t("common.saved"),
                              );
                            }}
                          >
                            <Field label={t("admin.oversight.reason")}>
                              <Input name="reason" />
                            </Field>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                name="archive"
                                className="size-4 accent-primary"
                              />
                              {t("admin.oversight.archive")}
                            </label>
                            <DialogFooter>
                              <Button type="submit" disabled={busy}>
                                {t("common.confirm")}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {error ? (
            <p className="p-3 text-sm text-destructive">
              {describeError(error, t, "en")}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
