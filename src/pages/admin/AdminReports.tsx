import {
  DemoBadge,
  EmptyState,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { downloadCsv, toCsv } from "@/lib/format";
import { useQuery } from "convex/react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";

export default function AdminReports() {
  const { t, pick, formatNumber } = useI18n();
  const users = useQuery(api.admin.users, { page: 0, pageSize: 100 });
  const structure = useQuery(api.academics.structure, {});
  const oversight = useQuery(api.admin.assessmentsOversight, {});
  const results = useQuery(api.admin.resultsExport, { limit: 5000 });
  const audit = useQuery(api.admin.auditLogs, { pageSize: 100 });

  if (
    users === undefined ||
    structure === undefined ||
    oversight === undefined ||
    results === undefined ||
    audit === undefined
  ) {
    return <LoadingBlock />;
  }

  const exports = [
    {
      label: t("admin.reports.users"),
      count: users.total,
      run: () =>
        downloadCsv(
          "users.csv",
          toCsv(
            users.rows.map((row) => ({
              name: row.name,
              email: row.email,
              role: row.role,
              status: row.status,
              language: row.language,
              demo: String(row.isDemo),
              classes: row.classNames.join(" | "),
              teaching_assignments: row.teachingCount,
              points: row.points,
              created_at: new Date(row.createdAt).toISOString(),
            })),
          ),
        ),
    },
    {
      label: t("admin.reports.classes"),
      count: structure.classes.length,
      run: () =>
        downloadCsv(
          "classes.csv",
          toCsv(
            structure.classes.map((cls) => ({
              name_en: cls.nameEn,
              name_ar: cls.nameAr,
              grade: cls.gradeNameEn ?? "",
              subject: cls.subjectNameEn ?? "",
              homeroom_teacher: cls.homeroomTeacherName ?? "",
              students: cls.studentCount,
              teachers: cls.teacherNames.join(" | "),
            })),
          ),
        ),
    },
    {
      label: t("admin.reports.assessments"),
      count: oversight.rows.length,
      run: () =>
        downloadCsv(
          "assessments.csv",
          toCsv(
            oversight.rows.map((row) => ({
              title_en: row.titleEn,
              title_ar: row.titleAr,
              kind: row.kind,
              status: row.status,
              subject: row.subjectNameEn,
              teacher: row.ownerName,
              max_score: row.maxScore,
              attempts: row.attempts,
              submissions: row.submissions,
              awaiting_grading: row.awaitingGrading,
              average_percent: row.averagePercent ?? "",
              version: row.version,
            })),
          ),
        ),
    },
    {
      label: t("admin.reports.results"),
      count: results.length,
      run: () =>
        downloadCsv(
          "results.csv",
          toCsv(
            results.map((row) => ({
              student: row.studentName,
              student_email: row.studentEmail,
              assessment_en: row.assessmentEn,
              assessment_ar: row.assessmentAr,
              subject: row.subjectEn,
              teacher: row.teacherName,
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
        ),
    },
    {
      label: t("admin.reports.audit"),
      count: audit.total,
      run: () =>
        downloadCsv(
          "audit-log.csv",
          toCsv(
            audit.rows.map((row) => ({
              created_at: new Date(row.createdAt).toISOString(),
              actor: row.actorName ?? "system",
              actor_role: row.actorRole ?? "",
              action: row.action,
              entity: row.entity,
              entity_id: row.entityId ?? "",
              summary_en: row.summaryEn,
              summary_ar: row.summaryAr,
            })),
          ),
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("admin.reports.title")}
        subtitle={t("admin.reports.subtitle")}
        actions={
          <Button
            variant="outline"
            className="gap-2 no-print"
            onClick={() => window.print()}
          >
            <Printer className="size-4" aria-hidden />
            {t("common.print")}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("admin.users")} value={formatNumber(users.total)} />
        <StatCard
          label={t("admin.classes")}
          value={formatNumber(structure.classes.length)}
        />
        <StatCard
          label={t("admin.assessments")}
          value={formatNumber(oversight.rows.length)}
        />
        <StatCard
          label={t("admin.submissions")}
          value={formatNumber(results.length)}
          tone="primary"
        />
      </div>

      <SectionCard title={t("admin.reports.title")}>
        <ul className="divide-y divide-border/60">
          {exports.map((item) => (
            <li
              key={item.label}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(item.count)} {t("common.results")}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 no-print"
                onClick={item.run}
                disabled={item.count === 0}
              >
                <Download className="size-4" aria-hidden />
                {t("common.export")}
              </Button>
            </li>
          ))}
        </ul>
        {users.total > users.rows.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {pick(
              `The users export covers the first ${users.rows.length} accounts. Narrow the list on the Users page for larger schools.`,
              `يشمل تصدير المستخدمين أول ${users.rows.length} حساباً. استخدم صفحة المستخدمين لتضييق النطاق في المدارس الأكبر.`,
            )}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title={t("admin.subject_breakdown")}>
        {oversight.rows.length === 0 ? (
          <EmptyState title={t("common.none_yet")} />
        ) : (
          <ul className="space-y-2 text-sm">
            {oversight.rows.slice(0, 8).map((row) => (
              <li
                key={row._id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium">{pick(row.titleEn, row.titleAr)}</span>
                  {row.ownerIsDemo ? <DemoBadge /> : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.ownerName} · {row.submissions} {t("admin.submissions")} ·{" "}
                  {row.averagePercent === null
                    ? "—"
                    : `${Math.round(row.averagePercent)}%`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
