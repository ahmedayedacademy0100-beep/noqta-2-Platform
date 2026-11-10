import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { useQuery } from "convex/react";
import {
  Activity,
  Eye,
  GraduationCap,
  School,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";

export default function AdminAnalytics() {
  const { t, pick, formatNumber } = useI18n();
  const [days, setDays] = useState(30);
  const data = useQuery(api.analytics.overview, { days });

  if (data === undefined) return <LoadingBlock />;

  const maxVisits = Math.max(1, ...data.series.map((point) => point.visits));
  const totalSeriesVisits = data.series.reduce(
    (sum, point) => sum + point.visits,
    0,
  );
  const totalSeriesAds = data.series.reduce((sum, point) => sum + point.ads, 0);

  return (
    <>
      <PageHeader
        eyebrow={t("roles.super_admin")}
        title={t("admin.analytics.title")}
        subtitle={t("admin.analytics.subtitle")}
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
          label={t("admin.analytics.visits")}
          value={formatNumber(data.totals.visits)}
          hint={t("admin.analytics.visits_hint", { days })}
          icon={Activity}
          tone="primary"
        />
        <StatCard
          label={t("admin.analytics.ads")}
          value={formatNumber(data.totals.ads)}
          hint={t("admin.analytics.ads_hint")}
          icon={Eye}
          tone="accent"
        />
        <StatCard
          label={t("admin.analytics.classes")}
          value={formatNumber(data.totals.classes)}
          hint={t("admin.analytics.classes_hint")}
          icon={School}
        />
        <StatCard
          label={t("admin.analytics.teachers")}
          value={formatNumber(data.totals.teachers)}
          hint={t("admin.analytics.teachers_hint")}
          icon={GraduationCap}
        />
      </div>

      <SectionCard
        title={t("admin.analytics.trend")}
        description={t("admin.analytics.trend_sub", { days })}
      >
        <div className="flex h-48 items-end gap-1">
          {data.series.map((point) => (
            <div
              key={point.day}
              className="group flex flex-1 flex-col items-center justify-end gap-1"
              title={`${point.day} · ${point.visits} ${t("admin.analytics.visits")} · ${point.ads} ${t("admin.analytics.ads")}`}
            >
              <span className="flex w-full items-end justify-center gap-0.5">
                <span
                  className="w-1/2 rounded-t bg-primary/35 transition-colors group-hover:bg-primary/60"
                  style={{
                    height: `${Math.max(
                      point.visits === 0 ? 0 : 3,
                      (point.visits / maxVisits) * 100,
                    )}%`,
                  }}
                />
                <span
                  className="w-1/2 rounded-t bg-accent/35 transition-colors group-hover:bg-accent/60"
                  style={{
                    height: `${Math.max(
                      point.ads === 0 ? 0 : 3,
                      (point.ads / maxVisits) * 100,
                    )}%`,
                  }}
                />
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" aria-hidden />
            {t("admin.analytics.visits")}: {formatNumber(totalSeriesVisits)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent" aria-hidden />
            {t("admin.analytics.ads")}: {formatNumber(totalSeriesAds)}
          </span>
          <span className="ms-auto inline-flex items-center gap-1.5">
            <TrendingUp className="size-3.5" aria-hidden />
            {data.series[0]?.day} → {data.series[data.series.length - 1]?.day}
          </span>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title={t("admin.analytics.by_class")}
          description={t("admin.analytics.by_class_sub")}
        >
          {data.classes.length === 0 ? (
            <EmptyState title={t("admin.analytics.no_data")} icon={School} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs text-muted-foreground">
                    <th className="py-2 text-start font-semibold">
                      {t("admin.classes")}
                    </th>
                    <th className="py-2 text-end font-semibold">
                      {t("admin.analytics.students")}
                    </th>
                    <th className="py-2 text-end font-semibold">
                      {t("admin.analytics.visits")}
                    </th>
                    <th className="py-2 text-end font-semibold">
                      {t("admin.analytics.ads")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.classes.map((row) => (
                    <tr
                      key={row.classId}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td className="py-2.5 pe-3">
                        <span className="block max-w-56 truncate font-semibold">
                          {pick(row.nameEn, row.nameAr)}
                        </span>
                      </td>
                      <td className="py-2.5 text-end text-muted-foreground tabular-nums">
                        {formatNumber(row.students)}
                      </td>
                      <td className="py-2.5 text-end font-bold tabular-nums">
                        {formatNumber(row.visits)}
                      </td>
                      <td className="py-2.5 text-end text-muted-foreground tabular-nums">
                        {formatNumber(row.ads)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={t("admin.analytics.by_teacher")}
          description={t("admin.analytics.by_teacher_sub")}
        >
          {data.teachers.length === 0 ? (
            <EmptyState title={t("admin.analytics.no_data")} icon={Users} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs text-muted-foreground">
                    <th className="py-2 text-start font-semibold">
                      {t("common.teacher")}
                    </th>
                    <th className="py-2 text-end font-semibold">
                      {t("admin.analytics.visits")}
                    </th>
                    <th className="py-2 text-end font-semibold">
                      {t("admin.analytics.ads")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.teachers.map((row) => (
                    <tr
                      key={row.userId}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td className="py-2.5 pe-3">
                        <span className="block max-w-56 truncate font-semibold">
                          {row.name}
                        </span>
                        <span className="block max-w-56 truncate text-xs text-muted-foreground">
                          {row.email}
                        </span>
                      </td>
                      <td className="py-2.5 text-end font-bold tabular-nums">
                        {formatNumber(row.visits)}
                      </td>
                      <td className="py-2.5 text-end text-muted-foreground tabular-nums">
                        {formatNumber(row.ads)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <p className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs leading-6 text-muted-foreground">
        {t("admin.analytics.note")}
      </p>
    </>
  );
}
