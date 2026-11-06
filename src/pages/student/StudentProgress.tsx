import {
  CountUp,
  EmptyState,
  LoadingBlock,
  PageHeader,
  ProgressRing,
  Reveal,
  SectionCard,
} from "@/components/app/ui";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import { ChartLine, Layers, Sparkles } from "lucide-react";

export default function StudentProgress() {
  const { t, pick, formatNumber } = useI18n();
  const data = useQuery(api.student.progress, {});
  const reduce = useReducedMotion();

  if (data === undefined) return <LoadingBlock />;

  const points = data.series;
  const width = 640;
  const height = 210;
  const maxPoints = Math.max(points.length - 1, 1);
  const path = points
    .map((point, index) => {
      const x = (index / maxPoints) * (width - 40) + 20;
      const y = height - 20 - (point.percentage / 100) * (height - 40);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const best = points.reduce((top, point) => Math.max(top, point.percentage), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("nav.progress")}
        title={t("results.progress_title")}
        subtitle={t("results.subtitle")}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: t("common.average"),
            value:
              data.overall === null ? "—" : `${formatNumber(Math.round(data.overall))}%`,
            icon: ChartLine,
          },
          {
            label: t("results.released"),
            value: formatNumber(points.length),
            icon: Sparkles,
          },
          {
            label: t("student.best"),
            value: points.length === 0 ? "—" : `${formatNumber(Math.round(best))}%`,
            icon: Layers,
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

      <SectionCard
        title={t("results.progress_title")}
        description={
          data.overall === null
            ? undefined
            : t("results.trend", {
                average: Math.round(data.overall),
                count: points.length,
              })
        }
      >
        {points.length === 0 ? (
          <EmptyState title={t("results.empty")} icon={ChartLine} />
        ) : (
          <div className="nq-scrollbar overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-56 w-full min-w-[480px] text-foreground"
              role="img"
              aria-label={t("results.progress_title")}
            >
              <defs>
                <linearGradient id="nq-progress-line" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4169FF" />
                  <stop offset="60%" stopColor="#6D63FF" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
                <linearGradient id="nq-progress-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#4169FF" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#4169FF" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 25, 50, 75, 100].map((line) => {
                const y = height - 20 - (line / 100) * (height - 40);
                return (
                  <g key={line}>
                    <line
                      x1={20}
                      x2={width - 20}
                      y1={y}
                      y2={y}
                      stroke="currentColor"
                      strokeOpacity={0.1}
                      strokeWidth={1}
                      strokeDasharray="4 6"
                    />
                    <text x={0} y={y + 4} fontSize={9} fill="currentColor" fillOpacity={0.45}>
                      {line}
                    </text>
                  </g>
                );
              })}
              {points.length > 1 ? (
                <motion.path
                  d={`${path} L${width - 20},${height - 20} L20,${height - 20} Z`}
                  fill="url(#nq-progress-fill)"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 0.35 }}
                />
              ) : null}
              <motion.path
                d={path}
                fill="none"
                stroke="url(#nq-progress-line)"
                strokeWidth={3}
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              />
              {points.map((point, index) => {
                const x = (index / maxPoints) * (width - 40) + 20;
                const y = height - 20 - (point.percentage / 100) * (height - 40);
                return (
                  <circle
                    key={`${point.at}-${index}`}
                    cx={x}
                    cy={y}
                    r={4.5}
                    fill="var(--card)"
                    stroke="url(#nq-progress-line)"
                    strokeWidth={2.5}
                  />
                );
              })}
            </svg>
          </div>
        )}
      </SectionCard>

      <SectionCard title={t("student.subject_progress")}>
        {data.subjects.length === 0 ? (
          <EmptyState title={t("results.empty")} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.subjects.map((subject, index) => (
              <Reveal as="li" key={subject.subjectId} delay={index * 0.05}>
                <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-secondary/25 p-4">
                  <ProgressRing
                    value={subject.averagePercent ?? 0}
                    size={64}
                    stroke={6}
                    label={pick(subject.nameEn, subject.nameAr)}
                  >
                    <span className="text-[11px] font-extrabold tabular-nums">
                      {subject.averagePercent === null ? (
                        "—"
                      ) : (
                        <CountUp
                          value={Math.round(subject.averagePercent)}
                          format={(n) => `${formatNumber(Math.round(n))}%`}
                        />
                      )}
                    </span>
                  </ProgressRing>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {pick(subject.nameEn, subject.nameAr)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(subject.count)} {t("common.results")}
                    </p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {subject.points.slice(-3).map((point, pointIndex) => (
                        <li
                          key={`${point.at}-${pointIndex}`}
                          className="max-w-40 truncate rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                          title={pick(point.titleEn, point.titleAr)}
                        >
                          {Math.round(point.percentage)}%
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
