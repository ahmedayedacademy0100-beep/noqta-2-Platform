import {
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  Meter,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { downloadCsv, toCsv } from "@/lib/format";
import { useQuery } from "convex/react";
import { BarChart3, Download, Printer, Target, Users } from "lucide-react";
import { Link, useParams } from "react-router";

export default function AssessmentAnalytics() {
  const { t, pick, formatDate, formatNumber } = useI18n();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const data = useQuery(
    api.assessments.analytics,
    assessmentId ? { assessmentId: assessmentId as never } : "skip",
  );
  const attempts = useQuery(
    api.assessments.attemptRowsForAssessment,
    assessmentId ? { assessmentId: assessmentId as never } : "skip",
  );

  if (data === undefined || attempts === undefined) return <LoadingBlock />;
  if (!data || !attempts) return <ErrorNotice error={null} />;

  const maxBand = Math.max(1, ...data.distribution.map((band) => band.count));

  return (
    <>
      <PageHeader
        eyebrow={t("teacher.analytics.title")}
        title={pick(data.assessment.titleEn, data.assessment.titleAr)}
        subtitle={t("teacher.analytics.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.assessment.status} />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                downloadCsv(
                  `assessment-${data.assessment._id}.csv`,
                  toCsv(
                    attempts.rows.map((row) => ({
                      student: row.studentName,
                      attempt: row.attemptNumber,
                      status: row.status,
                      score: row.score,
                      max_score: row.maxScore,
                      percentage: row.percentage,
                      passed: row.passed === null ? "" : String(row.passed),
                      pending_manual: row.pendingManualCount,
                      submitted_at: row.submittedAt
                        ? new Date(row.submittedAt).toISOString()
                        : "",
                      released_at: row.releasedAt
                        ? new Date(row.releasedAt).toISOString()
                        : "",
                    })),
                  ),
                )
              }
            >
              <Download className="size-4" aria-hidden />
              {t("common.export")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.print()}
            >
              <Printer className="size-4" aria-hidden />
              {t("common.print")}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/teacher/assessments/${data.assessment._id}`}>
                {t("teacher.builder.title")}
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("teacher.analytics.completion")}
          value={
            data.counts.completionRate === null
              ? "—"
              : `${data.counts.completionRate}%`
          }
          hint={`${data.counts.submitted} / ${data.counts.assigned}`}
          icon={Users}
          tone="primary"
        />
        <StatCard
          label={t("teacher.average_score")}
          value={
            data.counts.averagePercent === null
              ? "—"
              : `${Math.round(data.counts.averagePercent)}%`
          }
          icon={Target}
        />
        <StatCard
          label={t("results.pass")}
          value={data.counts.passRate === null ? "—" : `${data.counts.passRate}%`}
          hint={`${t("assessment.pass_threshold")}: ${data.assessment.passThreshold}%`}
          tone="accent"
        />
        <StatCard
          label={t("teacher.awaiting_grading")}
          value={formatNumber(data.counts.awaitingGrading)}
          icon={BarChart3}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={t("teacher.analytics.distribution")}>
          {data.counts.graded === 0 ? (
            <EmptyState title={t("teacher.analytics.no_data")} icon={BarChart3} />
          ) : (
            <ul className="space-y-3">
              {data.distribution.map((band) => (
                <li key={band.label} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">
                    {band.label}
                  </span>
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary/70"
                      style={{ width: `${(band.count / maxBand) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-end text-sm font-medium">
                    {band.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t("teacher.analytics.topics")}>
          {data.topics.length === 0 ? (
            <EmptyState title={t("teacher.analytics.no_data")} />
          ) : (
            <div className="space-y-4">
              {data.topics.map((topic) => (
                <Meter
                  key={topic.topicId}
                  label={pick(topic.nameEn, topic.nameAr)}
                  value={topic.averagePercent ?? 0}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title={t("teacher.analytics.questions")}>
        {data.questions.length === 0 ? (
          <EmptyState title={t("teacher.analytics.no_data")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs text-muted-foreground">
                  <th className="py-2 pe-3 text-start font-medium">#</th>
                  <th className="py-2 pe-3 text-start font-medium">{t("common.name")}</th>
                  <th className="py-2 pe-3 text-start font-medium">{t("common.type")}</th>
                  <th className="py-2 pe-3 text-start font-medium">{t("common.marks")}</th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {t("teacher.analytics.correct_rate")}
                  </th>
                  <th className="py-2 text-start font-medium">{t("common.average")}</th>
                </tr>
              </thead>
              <tbody>
                {data.questions.map((question) => (
                  <tr key={question.assessmentQuestionId} className="border-b border-border/40">
                    <td className="py-3 pe-3">{question.order + 1}</td>
                    <td className="max-w-md py-3 pe-3">
                      <span className="line-clamp-2">
                        {pick(question.promptEn, question.promptAr)}
                      </span>
                      {question.topicNameEn ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {pick(question.topicNameEn, question.topicNameAr ?? "")}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {t(`qtype.${question.type}`)}
                    </td>
                    <td className="py-3 pe-3">{question.marks}</td>
                    <td className="py-3 pe-3">
                      {question.correctRate === null ? "—" : `${question.correctRate}%`}
                    </td>
                    <td className="py-3">
                      {question.averagePercent === null
                        ? "—"
                        : `${Math.round(question.averagePercent)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title={t("teacher.analytics.attempts_table")}>
        {attempts.rows.length === 0 ? (
          <EmptyState title={t("teacher.analytics.no_data")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs text-muted-foreground">
                  <th className="py-2 pe-3 text-start font-medium">{t("common.student")}</th>
                  <th className="py-2 pe-3 text-start font-medium">#</th>
                  <th className="py-2 pe-3 text-start font-medium">{t("common.status")}</th>
                  <th className="py-2 pe-3 text-start font-medium">{t("common.score")}</th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {t("teacher.awaiting_grading")}
                  </th>
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
                {attempts.rows.map((row) => (
                  <tr key={row.attemptId} className="border-b border-border/40">
                    <td className="py-3 pe-3 font-medium">{row.studentName}</td>
                    <td className="py-3 pe-3">{row.attemptNumber}</td>
                    <td className="py-3 pe-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-3 pe-3">
                      {row.score} / {row.maxScore} ({Math.round(row.percentage)}%)
                    </td>
                    <td className="py-3 pe-3">
                      {row.pendingManualCount > 0 ? row.pendingManualCount : "—"}
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
