import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  StatCard,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarClock, ClipboardList, Search, Timer } from "lucide-react";
import { useMemo, useState } from "react";
import { AssessmentCard, type StudentAssessmentRow } from "./AssessmentCard";

type Filter = "all" | "available" | "in_progress" | "completed" | "missed" | "upcoming";

export default function StudentAssessments() {
  const { t, pick, formatNumber } = useI18n();
  const data = useQuery(api.student.home, {});
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const allRows = useMemo(() => {
    if (!data) return [] as StudentAssessmentRow[];
    const all = [
      ...data.inProgress,
      ...data.quizzes,
      ...data.homework,
      ...data.upcoming,
      ...data.missed,
    ] as StudentAssessmentRow[];
    const seen = new Set<string>();
    return all.filter((row) => {
      if (seen.has(row.assessmentId)) return false;
      seen.add(row.assessmentId);
      return true;
    });
  }, [data]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allRows
      .filter((row) => (filter === "all" ? true : row.status === filter))
      .filter((row) =>
        term
          ? row.titleEn.toLowerCase().includes(term) ||
            row.titleAr.includes(term) ||
            row.subjectNameEn.toLowerCase().includes(term) ||
            row.subjectNameAr.includes(term)
          : true,
      )
      .sort((a, b) => (a.closeAt ?? 0) - (b.closeAt ?? 0));
  }, [allRows, filter, search]);

  if (data === undefined) return <LoadingBlock />;

  const filters: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: t("common.all"), count: allRows.length },
    { id: "available", label: t("student.available"), count: data.counts.available },
    { id: "in_progress", label: t("student.in_progress"), count: data.counts.inProgress },
    { id: "completed", label: t("student.completed"), count: data.counts.completed },
    { id: "missed", label: t("student.missed"), count: data.counts.missed },
    { id: "upcoming", label: t("student.upcoming"), count: data.counts.upcoming },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("nav.assessments")}
        title={t("nav.assessments")}
        subtitle={t("student.assessments.subtitle")}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("student.available")}
          value={formatNumber(data.counts.available)}
          icon={ClipboardList}
          tone="primary"
        />
        <StatCard
          label={t("student.in_progress")}
          value={formatNumber(data.counts.inProgress)}
          icon={Timer}
          tone="accent"
        />
        <StatCard
          label={t("student.upcoming")}
          value={formatNumber(data.counts.upcoming)}
          icon={CalendarClock}
        />
      </div>

      <div className="nq-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="nq-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {filters.map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  aria-pressed={active}
                  className={cn(
                    "relative shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200",
                    active
                      ? "text-white"
                      : "border border-border/70 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="assessment-filter-pill"
                      className="nq-gradient absolute inset-0 rounded-full shadow-[0_8px_18px_-12px_rgb(65_105_255/0.9)]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      aria-hidden
                    />
                  ) : null}
                  <span className="relative">
                    {item.label}
                    {item.count !== undefined ? (
                      <span className={cn("ms-1.5", active ? "text-white/75" : "opacity-60")}>
                        {formatNumber(item.count)}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative lg:w-64">
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
        </div>

        {rows.length === 0 ? (
          <EmptyState title={t("student.no_quiz")} icon={ClipboardList} />
        ) : (
          <motion.div layout={!reduce} className="grid gap-3 md:grid-cols-2">
            {rows.map((row, index) => (
              <AssessmentCard key={row.assessmentId} row={row} index={index} />
            ))}
          </motion.div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {pick(
          "Assessments are only visible to students the teacher assigned them to.",
          "تظهر التقييمات فقط للطلاب الذين أسندها إليهم المعلم.",
        )}
      </p>
    </div>
  );
}
