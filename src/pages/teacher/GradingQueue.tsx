import {
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { useMutation, useQuery } from "convex/react";
import { PenLine, Send, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

export default function GradingQueue() {
  const { t, pick, formatDate, formatNumber } = useI18n();
  const [assessmentId, setAssessmentId] = useState<string>("all");
  const queue = useQuery(api.assessments.gradingQueue, {
    assessmentId: assessmentId === "all" ? undefined : (assessmentId as never),
  });
  const releaseResults = useMutation(api.assessments.releaseResults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const rows = useMemo(() => queue ?? [], [queue]);
  const assessments = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (!map.has(row.assessmentId)) map.set(row.assessmentId, row.titleEn);
    }
    return [...map.entries()];
  }, [rows]);

  const pending = rows.filter((row) => row.pendingManualCount > 0);

  return (
    <>
      <PageHeader title={t("teacher.grading.title")} subtitle={t("teacher.grading.subtitle")} />

      {error ? <ErrorNotice error={error} /> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("teacher.grading.queue")}
          value={formatNumber(rows.length)}
          icon={PenLine}
          tone="primary"
        />
        <StatCard
          label={t("teacher.awaiting_grading")}
          value={formatNumber(pending.length)}
          icon={Target}
          tone="accent"
        />
        <StatCard
          label={t("teacher.grading.released")}
          value={formatNumber(rows.filter((row) => row.releasedAt).length)}
          icon={Send}
        />
      </div>

      <SectionCard
        title={t("teacher.grading.queue")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={assessmentId} onValueChange={setAssessmentId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder={t("nav.teacher.assessments")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {assessments.map(([id, title]) => (
                  <SelectItem key={id} value={id}>
                    {title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assessmentId !== "all" ? (
              <Button
                variant="outline"
                className="gap-2"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    const result = await releaseResults({
                      assessmentId: assessmentId as never,
                    });
                    toast.success(
                      t("teacher.grading.released_ok", {
                        released: result.released,
                        skipped: result.skipped,
                      }),
                    );
                  } catch (cause) {
                    setError(cause);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Send className="size-4" aria-hidden />
                {t("teacher.grading.release")}
              </Button>
            ) : null}
          </div>
        }
      >
        {queue === undefined ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title={t("teacher.grading.empty")} icon={PenLine} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs text-muted-foreground">
                  <th className="py-2 pe-3 text-start font-medium">{t("common.student")}</th>
                  <th className="py-2 pe-3 text-start font-medium">{t("common.name")}</th>
                  <th className="py-2 pe-3 text-start font-medium">{t("common.status")}</th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {t("teacher.awaiting_grading")}
                  </th>
                  <th className="py-2 pe-3 text-start font-medium">{t("common.score")}</th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {t("teacher.grading.released")}
                  </th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {t("common.due")}
                  </th>
                  <th className="py-2 text-start font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.attemptId} className="border-b border-border/40">
                    <td className="py-3 pe-3 font-medium">{row.studentName}</td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {pick(row.titleEn, row.titleAr)}
                    </td>
                    <td className="py-3 pe-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-3 pe-3">
                      {row.pendingManualCount > 0 ? (
                        <span className="chip">
                          {t("teacher.grading.pending", {
                            count: row.pendingManualCount,
                          })}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pe-3">
                      {row.autoScore} / {row.maxScore}
                    </td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {row.releasedAt
                        ? formatDate(row.releasedAt, true)
                        : t("teacher.grading.not_released")}
                    </td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {formatDate(row.submittedAt, true)}
                    </td>
                    <td className="py-3">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/teacher/grading/${row.attemptId}`}>
                          {t("teacher.grading.award")}
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
