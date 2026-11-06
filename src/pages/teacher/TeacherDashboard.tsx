import {
  EmptyState,
  LinkCard,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { useQuery } from "convex/react";
import {
  BookOpenCheck,
  ClipboardList,
  GraduationCap,
  PenLine,
  Plus,
  Target,
  Users,
} from "lucide-react";
import { Link } from "react-router";

export default function TeacherDashboard() {
  const { t, pick, formatDate, formatNumber } = useI18n();
  const data = useQuery(api.teacher.dashboard, { days: 14 });

  if (data === undefined) return <LoadingBlock />;

  const maxSubmissions = Math.max(
    1,
    ...data.series.map((point) => point.submissions),
  );

  return (
    <>
      <PageHeader
        eyebrow={t("roles.teacher")}
        title={t("teacher.dashboard")}
        subtitle={t("teacher.subtitle")}
        actions={
          <Button asChild className="gap-2">
            <Link to="/teacher/assessments">
              <Plus className="size-4" aria-hidden />
              {t("teacher.new_assessment")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("teacher.assigned_students")}
          value={formatNumber(data.counts.students)}
          icon={Users}
          tone="primary"
        />
        <StatCard
          label={t("admin.classes")}
          value={formatNumber(data.counts.classes)}
          icon={GraduationCap}
        />
        <StatCard
          label={t("teacher.published")}
          value={formatNumber(data.counts.published)}
          icon={ClipboardList}
        />
        <StatCard
          label={t("teacher.awaiting_grading")}
          value={formatNumber(data.counts.awaitingGrading)}
          icon={PenLine}
          tone="accent"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <SectionCard title={t("teacher.submissions_chart", { days: 14 })}>
          <div className="flex h-40 items-end gap-1.5">
            {data.series.map((point) => (
              <div
                key={point.day}
                className="group flex flex-1 flex-col items-center justify-end gap-1"
                title={`${point.day}: ${point.submissions}`}
              >
                <span
                  className="w-full rounded-t bg-primary/20 transition-colors group-hover:bg-primary/40"
                  style={{
                    height: `${Math.max(4, (point.submissions / maxSubmissions) * 100)}%`,
                  }}
                />
                <span className="text-[9px] text-muted-foreground">
                  {point.day.slice(8)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              {t("teacher.submissions")}: {formatNumber(data.counts.submissions)}
            </span>
            <span>
              {t("teacher.average_score")}:{" "}
              {data.counts.averagePercent === null
                ? "—"
                : `${Math.round(data.counts.averagePercent)}%`}
            </span>
          </div>
        </SectionCard>

        <SectionCard title={t("teacher.my_classes")}>
          {data.classes.length === 0 ? (
            <EmptyState title={t("common.none_yet")} icon={GraduationCap} />
          ) : (
            <ul className="space-y-2">
              {data.classes.map((cls) => (
                <li key={cls._id} className="surface-muted flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {pick(cls.nameEn, cls.nameAr)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cls.subjectNameEn
                        ? pick(cls.subjectNameEn, cls.subjectNameAr ?? cls.subjectNameEn)
                        : t("common.none")}
                    </p>
                  </div>
                  <span className="chip shrink-0" title={t("teacher.join_code_hint")}>
                    {cls.joinCode}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title={t("teacher.needs_grading")}
          actions={
            <Button asChild size="sm" variant="outline">
              <Link to="/teacher/grading">{t("teacher.grading.queue")}</Link>
            </Button>
          }
        >
          {data.needsGrading.length === 0 ? (
            <EmptyState title={t("teacher.no_grading")} icon={PenLine} />
          ) : (
            <ul className="space-y-2">
              {data.needsGrading.map((item) => (
                <li key={item.assessmentId}>
                  <LinkCard
                    to={`/teacher/assessments/${item.assessmentId}`}
                    title={pick(item.titleEn, item.titleAr)}
                    meta={
                      <>
                        <span>
                          {t("teacher.grading.pending", {
                            count: item.pendingAnswers,
                          })}
                        </span>
                        <span>
                          {item.pendingAttempts} {t("teacher.submissions")}
                        </span>
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t("teacher.upcoming")}>
          {data.upcoming.length === 0 ? (
            <EmptyState title={t("common.none_yet")} icon={ClipboardList} />
          ) : (
            <ul className="space-y-2">
              {data.upcoming.map((item) => (
                <li key={item._id}>
                  <LinkCard
                    to={`/teacher/assessments/${item._id}`}
                    title={pick(item.titleEn, item.titleAr)}
                    tone={t(`kind.${item.kind}`)}
                    meta={
                      <>
                        <StatusBadge status={item.status} />
                        <span>
                          {t("common.due")} {formatDate(item.closeAt ?? undefined, true)}
                        </span>
                        <span>
                          {item.submissions}/{item.attempts} {t("teacher.submissions")}
                        </span>
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={t("teacher.recent_submissions")}>
          {data.recentSubmissions.length === 0 ? (
            <EmptyState title={t("common.none_yet")} icon={BookOpenCheck} />
          ) : (
            <ul className="divide-y divide-border/60">
              {data.recentSubmissions.map((row) => (
                <li key={row.attemptId} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.studentName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {pick(row.titleEn, row.titleAr)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {row.pendingManualCount > 0 ? (
                      <span className="chip">
                        {t("teacher.grading.pending", { count: row.pendingManualCount })}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Target className="size-3.5 text-muted-foreground" aria-hidden />
                      {Math.round(row.percentage)}%
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/teacher/grading/${row.attemptId}`}>
                        {row.pendingManualCount > 0
                          ? t("nav.teacher.grading")
                          : t("student.details")}
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t("teacher.recent_activity")}>
          {data.recentActivity.length === 0 ? (
            <EmptyState title={t("common.none_yet")} />
          ) : (
            <ul className="space-y-3">
              {data.recentActivity.map((entry) => (
                <li key={entry._id} className="text-sm">
                  <p>{pick(entry.summaryEn, entry.summaryAr)}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.action} · {formatDate(entry.createdAt, true)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
