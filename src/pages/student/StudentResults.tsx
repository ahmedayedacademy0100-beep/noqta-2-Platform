import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  ProgressRing,
  Reveal,
  SectionCard,
  StatusBadge,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { BookOpenCheck, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router";

export default function StudentResults() {
  const { t, pick, formatDate, formatNumber } = useI18n();
  const data = useQuery(api.student.results, {});

  if (data === undefined) return <LoadingBlock />;

  const best = data.released.reduce(
    (top, row) => (row.percentage > top ? row.percentage : top),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("nav.results")}
        title={t("results.title")}
        subtitle={t("results.subtitle")}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: t("results.released"),
            value: formatNumber(data.released.length),
            icon: BookOpenCheck,
          },
          {
            label: t("student.best"),
            value: data.released.length === 0 ? "—" : `${formatNumber(Math.round(best))}%`,
            icon: Target,
          },
          {
            label: t("results.pending"),
            value: formatNumber(data.pending.length),
            icon: TrendingUp,
          },
        ].map((stat, index) => (
          <Reveal key={stat.label} delay={index * 0.05}>
            <div className="nq-card nq-card-hover flex items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-[0_10px_22px_-16px_rgb(65_105_255/0.9)]">
                <stat.icon className="size-[18px]" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {stat.label}
                </p>
                <p className="text-xl font-extrabold tabular-nums">{stat.value}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <SectionCard title={t("results.released")}>
        {data.released.length === 0 ? (
          <EmptyState title={t("results.empty")} icon={BookOpenCheck} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.released.map((row, index) => (
              <Reveal as="li" key={row.attemptId} delay={index * 0.04}>
                <Link
                  to={`/results/${row.attemptId}`}
                  className="nq-card nq-card-hover group flex items-center gap-4 p-4"
                >
                  <ProgressRing value={row.percentage} size={68} stroke={6}>
                    <span className="text-xs font-extrabold tabular-nums">
                      {formatNumber(Math.round(row.percentage))}%
                    </span>
                  </ProgressRing>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {pick(row.titleEn, row.titleAr)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {pick(row.subjectNameEn, row.subjectNameAr)} · {t(`kind.${row.kind}`)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-semibold",
                          row.passed
                            ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {row.passed ? t("results.pass") : t("results.fail")}
                      </span>
                      <span className="text-muted-foreground">
                        {formatNumber(row.score)}/{formatNumber(row.maxScore)}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDate(row.submittedAt ?? undefined, true)}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors group-hover:bg-primary/10">
                    {t("student.review")}
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={t("results.pending")} description={t("results.pending_note")}>
        {data.pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("common.none_yet")}</p>
        ) : (
          <ul className="space-y-2">
            {data.pending.map((row) => (
              <li
                key={row.attemptId}
                className="surface-muted flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{pick(row.titleEn, row.titleAr)}</p>
                  <p className="text-xs text-muted-foreground">
                    {pick(row.subjectNameEn, row.subjectNameAr)} ·{" "}
                    {formatDate(row.submittedAt ?? undefined, true)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {row.pendingManualCount > 0 ? (
                    <span className="chip">{t("results.awaiting_manual")}</span>
                  ) : null}
                  <StatusBadge status={row.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
