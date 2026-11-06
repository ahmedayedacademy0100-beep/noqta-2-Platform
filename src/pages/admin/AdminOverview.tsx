import {
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  Meter,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { useQuery } from "convex/react";
import {
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  GraduationCap,
  PenLine,
  ScrollText,
  Target,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

export default function AdminOverview() {
  const { t, pick, formatDate, formatNumber } = useI18n();
  const [days, setDays] = useState(30);
  const data = useQuery(api.admin.overview, { days });

  if (data === undefined) return <LoadingBlock />;
  if (!data) return <ErrorNotice error={null} />;

  const { counts } = data;
  const maxActivity = Math.max(1, ...data.series.map((point) => point.activity));

  return (
    <>
      <PageHeader
        eyebrow={t("roles.super_admin")}
        title={t("admin.overview.title")}
        subtitle={t("admin.overview.subtitle")}
        actions={
          <div className="flex gap-2">
            {[7, 30, 90].map((option) => (
              <Button
                key={option}
                size="sm"
                variant={days === option ? "default" : "outline"}
                onClick={() => setDays(option)}
              >
                {t("admin.window", { days: option })}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("admin.users")}
          value={formatNumber(counts.users)}
          hint={`${formatNumber(counts.students)} ${t("roles.student")} · ${formatNumber(counts.teachers)} ${t("roles.teacher")}`}
          icon={Users}
          tone="primary"
        />
        <StatCard
          label={t("admin.classes")}
          value={formatNumber(counts.classes)}
          hint={`${formatNumber(counts.subjects)} ${t("teacher.subjects")} · ${formatNumber(counts.grades)} ${t("admin.grades")}`}
          icon={GraduationCap}
        />
        <StatCard
          label={t("admin.assessments")}
          value={formatNumber(counts.assessments)}
          hint={`${formatNumber(counts.published)} ${t("teacher.published")} · ${formatNumber(counts.drafts)} ${t("teacher.drafts")}`}
          icon={ClipboardList}
        />
        <StatCard
          label={t("admin.submissions")}
          value={formatNumber(counts.submissions)}
          hint={`${formatNumber(counts.awaitingGrading)} ${t("admin.awaiting_grading")}`}
          icon={BookOpenCheck}
          tone="accent"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard title={t("admin.charts.activity")}>
          <div className="flex h-44 items-end gap-1">
            {data.series.map((point) => (
              <div
                key={point.day}
                className="group flex flex-1 flex-col items-center justify-end gap-1"
                title={`${point.day}: ${point.activity}`}
              >
                <span
                  className="w-full rounded-t bg-primary/20 transition-colors group-hover:bg-primary/40"
                  style={{
                    height: `${Math.max(3, (point.activity / maxActivity) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              {t("admin.charts.activity")}:{" "}
              {formatNumber(data.series.reduce((sum, p) => sum + p.activity, 0))}
            </span>
            <span>
              {t("admin.charts.submissions")}:{" "}
              {formatNumber(data.series.reduce((sum, p) => sum + p.submissions, 0))}
            </span>
            <span>
              {t("admin.charts.signups")}:{" "}
              {formatNumber(data.series.reduce((sum, p) => sum + p.signups, 0))}
            </span>
          </div>
        </SectionCard>

        <SectionCard title={t("teacher.average_score")}>
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-semibold tracking-tight">
                {counts.averagePercent === null
                  ? "—"
                  : `${Math.round(counts.averagePercent)}%`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("admin.submissions")}: {formatNumber(counts.submissions)} ·{" "}
                {t("student.in_progress")}: {formatNumber(counts.inProgress)}
              </p>
            </div>
            <Meter
              label={t("teacher.analytics.completion")}
              value={
                counts.submissions + counts.inProgress === 0
                  ? 0
                  : (counts.submissions / (counts.submissions + counts.inProgress)) *
                    100
              }
            />
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>
                {t("admin.suspended")}: {formatNumber(counts.suspended)}
              </li>
              <li>
                {t("admin.demo_accounts")}: {formatNumber(counts.demoAccounts)}
              </li>
              <li>
                {t("admin.audit_entries")}: {formatNumber(counts.auditEntries)}
              </li>
            </ul>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={t("admin.subject_breakdown")}>
          {data.subjectBreakdown.length === 0 ? (
            <EmptyState title={t("common.none_yet")} icon={BarChart3} />
          ) : (
            <ul className="space-y-3">
              {data.subjectBreakdown.map((subject) => (
                <li key={subject.subjectId} className="flex items-center gap-3">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: subject.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {pick(subject.nameEn, subject.nameAr)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {subject.assessments} {t("admin.assessments")} ·{" "}
                      {subject.submissions} {t("admin.submissions")}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium">
                    {subject.averagePercent === null
                      ? "—"
                      : `${Math.round(subject.averagePercent)}%`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t("admin.teacher_breakdown")}>
          {data.teacherBreakdown.length === 0 ? (
            <EmptyState title={t("common.none_yet")} icon={Users} />
          ) : (
            <ul className="divide-y divide-border/60">
              {data.teacherBreakdown.map((row) => (
                <li
                  key={row.ownerId}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="truncate font-medium">{row.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {row.assessments} {t("admin.assessments")} · {row.submissions}{" "}
                    {t("admin.submissions")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={t("admin.recent_audit")}
        actions={
          <Button asChild size="sm" variant="outline" className="gap-2">
            <Link to="/admin/audit">
              <ScrollText className="size-4" aria-hidden />
              {t("admin.audit.title")}
            </Link>
          </Button>
        }
      >
        {data.recentAudit.length === 0 ? (
          <EmptyState title={t("common.none_yet")} />
        ) : (
          <ul className="space-y-3">
            {data.recentAudit.map((entry) => (
              <li key={entry._id} className="flex items-start gap-3 text-sm">
                <Target
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p>{pick(entry.summaryEn, entry.summaryAr)}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actorName} · {entry.action} ·{" "}
                    {formatDate(entry.createdAt, true)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/admin/users">
            <Users className="size-4" aria-hidden />
            {t("admin.users.title")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/admin/oversight">
            <ClipboardList className="size-4" aria-hidden />
            {t("admin.oversight.title")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/teacher/grading">
            <PenLine className="size-4" aria-hidden />
            {t("nav.teacher.grading")}
          </Link>
        </Button>
      </div>
    </>
  );
}
