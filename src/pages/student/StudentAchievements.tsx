import {
  Celebration,
  EmptyState,
  LoadingBlock,
  Meter,
  PageHeader,
  Reveal,
} from "@/components/app/ui";
import { Medal } from "@/components/student/gamification-ui";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Award, Lock, Sparkles, Star, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

type Filter = "all" | "unlocked" | "locked";

export default function StudentAchievements() {
  const { t, pick, formatDate, formatNumber } = useI18n();
  const data = useQuery(api.student.gamification, {});
  const [filter, setFilter] = useState<Filter>("all");
  const [celebrate, setCelebrate] = useState(false);

  // A single burst when a badge was genuinely earned in the last day.
  useEffect(() => {
    if (!data) return;
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const fresh = data.achievements.find(
      (row) => row.earnedAt !== null && row.earnedAt >= dayAgo,
    );
    if (!fresh) return;
    const key = `nq.badge.celebrated.${fresh.code}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: still celebrate once.
    }
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      setCelebrate(true);
      timer = window.setTimeout(() => setCelebrate(false), 4000);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [data]);

  if (data === undefined) return <LoadingBlock />;

  const rows = data.achievements.filter((row) =>
    filter === "all"
      ? true
      : filter === "unlocked"
        ? row.earnedAt !== null
        : row.earnedAt === null,
  );

  const percent =
    data.totals.available === 0
      ? 0
      : (data.totals.earned / data.totals.available) * 100;

  const filters: { id: Filter; label: string; count: number; icon: typeof Award }[] = [
    { id: "all", label: t("common.all"), count: data.totals.available, icon: Award },
    {
      id: "unlocked",
      label: t("achievements.unlocked"),
      count: data.totals.earned,
      icon: Trophy,
    },
    {
      id: "locked",
      label: t("achievements.locked"),
      count: data.totals.available - data.totals.earned,
      icon: Lock,
    },
  ];

  return (
    <div className="space-y-6">
      <Celebration show={celebrate} />
      <PageHeader
        eyebrow={t("nav.achievements")}
        title={t("achievements.title")}
        subtitle={t("achievements.subtitle")}
      />

      {/* Trophy room header */}
      <section className="nq-card relative overflow-hidden p-5 sm:p-6">
        <span aria-hidden className="nq-aurora absolute inset-0 opacity-[0.10]" />
        <span aria-hidden className="nq-sparkle-field absolute inset-0 opacity-40" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-black tracking-tight">
              {t("achievements.progress", {
                earned: formatNumber(data.totals.earned),
                total: formatNumber(data.totals.available),
              })}
            </h2>
            <div className="mt-3 max-w-md">
              <Meter value={percent} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-nq-yellow/50 bg-nq-yellow/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-nq-yellow">
                <Sparkles className="size-3.5" aria-hidden />
                {formatNumber(data.totals.badgePoints)} {t("student.xp")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-bold">
                <Star className="size-3.5 text-nq-yellow" aria-hidden />
                {t("achievements.stars")}: {formatNumber(data.totals.earned)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-bold">
                <Trophy className="size-3.5 text-primary" aria-hidden />
                {formatNumber(data.totals.earned)} / {formatNumber(data.totals.available)}
              </span>
            </div>
          </div>

          {/* Star shelf: one star per earned badge, capped for layout. */}
          <div className="flex flex-wrap gap-1.5 sm:max-w-[240px] sm:justify-end">
            {Array.from({ length: Math.min(data.totals.earned, 12) }).map((_, index) => (
              <span
                key={index}
                className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-nq-yellow to-[#FF9F45] text-white shadow-[0_10px_20px_-14px_rgb(255_201_74/0.9)] animate-pop"
                style={{ animationDelay: `${index * 40}ms` }}
                aria-hidden
              >
                <Star className="size-4" fill="currentColor" />
              </span>
            ))}
            {data.totals.earned === 0 ? (
              <p className="max-w-[220px] text-xs leading-5 text-muted-foreground">
                {t("achievements.empty")}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div
        role="tablist"
        aria-label={t("achievements.title")}
        className="nq-scrollbar flex gap-1.5 overflow-x-auto pb-1"
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
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors",
                active
                  ? "nq-gradient text-white shadow-[0_10px_20px_-14px_rgb(52_120_246/0.9)]"
                  : "border border-border/70 bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="size-3.5" aria-hidden />
              {item.label}
              <span className={active ? "text-white/75" : "opacity-60"}>
                {formatNumber(item.count)}
              </span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={
            filter === "unlocked" ? t("achievements.empty") : t("achievements.empty")
          }
          icon={Award}
        />
      ) : (
        <Reveal>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {rows.map((row) => (
              <Medal
                key={row.code}
                code={row.code}
                icon={row.icon}
                title={pick(row.titleEn, row.titleAr)}
                description={pick(row.descriptionEn, row.descriptionAr)}
                earned={row.earnedAt !== null}
                earnedAtLabel={
                  row.earnedAt
                    ? t("achievements.earned_on", { date: formatDate(row.earnedAt) })
                    : undefined
                }
                size="md"
                className="bg-card/80"
              />
            ))}
          </div>
        </Reveal>
      )}

      <p className="rounded-xl border border-border/60 bg-muted/30 p-3 text-[11px] leading-5 text-muted-foreground">
        {pick(
          "Badges unlock automatically from real activity: completing assessments, scoring 90% or more, written answers your teacher grades, and staying active three days in a row.",
          "تُفتح الشارات تلقائياً من نشاطك الحقيقي: إكمال التقييمات، الحصول على 90% أو أكثر، الإجابات الكتابية التي يصححها معلمك، والنشاط ثلاثة أيام متتالية.",
        )}
      </p>
    </div>
  );
}
