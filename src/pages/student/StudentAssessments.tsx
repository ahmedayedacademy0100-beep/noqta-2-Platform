import { EmptyState, LoadingBlock, PageHeader } from "@/components/app/ui";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  PlayCircle,
  Search,
  Timer,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AssessmentCard, type StudentAssessmentRow } from "./AssessmentCard";

type Filter =
  | "all"
  | "available"
  | "in_progress"
  | "completed"
  | "missed"
  | "upcoming";

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
            row.subjectNameAr.includes(term) ||
            row.teacherName.toLowerCase().includes(term)
          : true,
      )
      .sort((a, b) => (a.closeAt ?? Infinity) - (b.closeAt ?? Infinity));
  }, [allRows, filter, search]);

  if (data === undefined) return <LoadingBlock />;

  const filters: { id: Filter; label: string; count: number; icon: typeof ClipboardList }[] = [
    { id: "all", label: t("common.all"), count: allRows.length, icon: ClipboardList },
    { id: "available", label: t("student.available"), count: data.counts.available, icon: PlayCircle },
    { id: "in_progress", label: t("student.in_progress"), count: data.counts.inProgress, icon: Timer },
    { id: "upcoming", label: t("student.upcoming"), count: data.counts.upcoming, icon: CalendarClock },
    { id: "completed", label: t("student.completed"), count: data.counts.completed, icon: CheckCircle2 },
    { id: "missed", label: t("student.missed"), count: data.counts.missed, icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("nav.assessments")}
        title={t("nav.assessments")}
        subtitle={t("student.assessments.subtitle")}
      />

      {/* Summary strip: what needs action, at a glance. */}
      <div className="nq-card nq-relative overflow-hidden p-4 sm:p-5">
        <span aria-hidden className="nq-aurora pointer-events-none absolute inset-0 opacity-[0.07]" />
        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <PlayCircle className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                {t("student.available")}
              </p>
              <p className="text-lg font-black tabular-nums">
                {formatNumber(data.counts.available)}
              </p>
            </div>
          </div>
          <div className="hidden h-10 w-px bg-border/70 sm:block" />
          <div className="flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-2xl bg-nq-yellow/15 text-amber-600 dark:text-nq-yellow">
              <Timer className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                {t("student.in_progress")}
              </p>
              <p className="text-lg font-black tabular-nums">
                {formatNumber(data.counts.inProgress)}
              </p>
            </div>
          </div>
          <div className="hidden h-10 w-px bg-border/70 sm:block" />
          <div className="flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-2xl bg-nq-turquoise/15 text-[#0B7F76] dark:text-nq-turquoise">
              <Clock className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                {t("student.upcoming")}
              </p>
              <p className="text-lg font-black tabular-nums">
                {formatNumber(data.counts.upcoming)}
              </p>
            </div>
          </div>
          <div className="hidden h-10 w-px bg-border/70 sm:block" />
          <div className="flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                {t("student.completed")}
              </p>
              <p className="text-lg font-black tabular-nums">
                {formatNumber(data.counts.completed)}
              </p>
            </div>
          </div>
          <p className="ms-auto max-w-xs text-[11px] leading-5 text-muted-foreground">
            {pick(
              "Every item here was assigned to you by a teacher.",
              "كل عنصر هنا أسنده إليك معلم.",
            )}
          </p>
        </div>
      </div>

      <div className="nq-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label={t("nav.assessments")}
            className="nq-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
          >
            {filters.map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    "relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-all duration-200",
                    active
                      ? "text-white"
                      : "border border-border/70 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="assessment-filter-pill"
                      className="nq-gradient absolute inset-0 rounded-full shadow-[0_8px_18px_-12px_rgb(52_120_246/0.9)]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      aria-hidden
                    />
                  ) : null}
                  <item.icon className="relative size-3.5" aria-hidden />
                  <span className="relative">
                    {item.label}
                    <span className={cn("ms-1.5", active ? "text-white/75" : "opacity-60")}>
                      {formatNumber(item.count)}
                    </span>
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
              aria-label={t("common.search")}
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={search ? t("common.no_results") : t("student.no_quiz")}
            body={search ? t("common.try_other_search") : undefined}
            icon={ClipboardList}
          />
        ) : (
          <motion.div layout={!reduce} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
