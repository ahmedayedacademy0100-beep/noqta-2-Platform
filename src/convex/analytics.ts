import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { dayKey, getProfile, requireRole } from "./lib/guards";
import { ROLES } from "./schema";

/**
 * Usage analytics for the platform owner.
 *
 * Counters are rolled up per UTC day, per metric and per scope, so the admin
 * screen never scans an event log and the numbers stay cheap to read:
 *   - `platform` / "all"  → every visit and every ad impression
 *   - `class`    / classId → attributions for students enrolled in that class
 *   - `teacher`  / userId  → attributions for that teacher
 *
 * A single visit therefore increments one platform row, one row per class the
 * visitor belongs to, and one row per teacher of those classes. The client
 * deduplicates per session so a page is counted once per visit.
 */

type Kind = "visit" | "ad";
type Scope = "platform" | "class" | "teacher";

async function bump(
  ctx: MutationCtx,
  day: string,
  kind: Kind,
  scope: Scope,
  scopeId: string,
): Promise<void> {
  const existing = await ctx.db
    .query("analytics_daily")
    .withIndex("by_key", (q) =>
      q
        .eq("day", day)
        .eq("kind", kind)
        .eq("scope", scope)
        .eq("scopeId", scopeId),
    )
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
      updatedAt: Date.now(),
    });
    return;
  }
  await ctx.db.insert("analytics_daily", {
    day,
    kind,
    scope,
    scopeId,
    count: 1,
    updatedAt: Date.now(),
  });
}

/** Which classes and teachers a signed-in visitor belongs to. */
async function attribution(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ classIds: Id<"classes">[]; teacherIds: Id<"users">[] }> {
  const profile = await getProfile(ctx, userId);
  if (!profile) return { classIds: [], teacherIds: [] };

  if (profile.role === ROLES.STUDENT) {
    const enrollments = await ctx.db
      .query("class_enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();
    const classIds = enrollments
      .filter((entry) => entry.status === "active")
      .map((entry) => entry.classId);
    const teacherIds = new Set<string>();
    for (const classId of classIds) {
      const cls = await ctx.db.get(classId);
      if (cls?.homeroomTeacherId) teacherIds.add(cls.homeroomTeacherId as string);
      const links = await ctx.db
        .query("teacher_assignments")
        .withIndex("by_class", (q) => q.eq("classId", classId))
        .collect();
      for (const link of links) teacherIds.add(link.teacherId as string);
    }
    return {
      classIds,
      teacherIds: [...teacherIds] as Id<"users">[],
    };
  }

  // A teacher's own browsing counts for them; admins only feed the platform
  // total (the owner does not want their own clicks attributed to staff).
  if (profile.role === ROLES.TEACHER) {
    return { classIds: [], teacherIds: [userId] };
  }
  return { classIds: [], teacherIds: [] };
}

/** Called once per page view per browser session. */
export const recordVisit = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const day = dayKey(now);
    await bump(ctx, day, "visit", "platform", "all");

    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: true };

    const { classIds, teacherIds } = await attribution(ctx, userId);
    for (const classId of classIds) {
      await bump(ctx, day, "visit", "class", classId as string);
    }
    for (const teacherId of teacherIds) {
      await bump(ctx, day, "visit", "teacher", teacherId as string);
    }
    return { ok: true };
  },
});

/** Called when an ad unit actually becomes visible on screen. */
export const recordAdImpression = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const day = dayKey(now);
    await bump(ctx, day, "ad", "platform", "all");

    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: true };

    const { classIds, teacherIds } = await attribution(ctx, userId);
    for (const classId of classIds) {
      await bump(ctx, day, "ad", "class", classId as string);
    }
    for (const teacherId of teacherIds) {
      await bump(ctx, day, "ad", "teacher", teacherId as string);
    }
    return { ok: true };
  },
});

function dayList(days: number): string[] {
  const today = new Date();
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const out: string[] = [];
  for (let index = 0; index < days; index += 1) {
    const cursor = new Date(start);
    cursor.setUTCDate(start.getUTCDate() + index);
    out.push(cursor.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Owner-only dashboard data: totals, a daily series, and visits / ad views
 * broken down per class and per teacher.
 */
export const overview = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const days = Math.min(Math.max(Math.round(args.days ?? 30), 1), 90);
    const seriesDays = dayList(days);
    const today = seriesDays[seriesDays.length - 1];

    const rows = await ctx.db
      .query("analytics_daily")
      .withIndex("by_day", (q) => q.gte("day", seriesDays[0]))
      .collect();

    const seriesMap = new Map(
      seriesDays.map((day) => [day, { day, visits: 0, ads: 0 }]),
    );
    const perClass = new Map<string, { visits: number; ads: number }>();
    const perTeacher = new Map<string, { visits: number; ads: number }>();
    let visits = 0;
    let ads = 0;

    for (const row of rows) {
      if (row.day > today) continue;
      const isVisit = row.kind === "visit";
      if (isVisit) visits += row.count;
      else ads += row.count;

      const point = seriesMap.get(row.day);
      if (point) {
        if (isVisit) point.visits += row.count;
        else point.ads += row.count;
      }

      if (row.scope === "class") {
        const current = perClass.get(row.scopeId) ?? { visits: 0, ads: 0 };
        if (isVisit) current.visits += row.count;
        else current.ads += row.count;
        perClass.set(row.scopeId, current);
      } else if (row.scope === "teacher") {
        const current = perTeacher.get(row.scopeId) ?? { visits: 0, ads: 0 };
        if (isVisit) current.visits += row.count;
        else current.ads += row.count;
        perTeacher.set(row.scopeId, current);
      }
    }

    const [classes, enrollments, profiles] = await Promise.all([
      ctx.db.query("classes").collect(),
      ctx.db.query("class_enrollments").collect(),
      ctx.db.query("profiles").collect(),
    ]);

    const studentsPerClass = new Map<string, number>();
    for (const entry of enrollments) {
      if (entry.status !== "active") continue;
      const key = entry.classId as string;
      studentsPerClass.set(key, (studentsPerClass.get(key) ?? 0) + 1);
    }

    const classRows = classes
      .filter((cls) => cls.archivedAt === undefined)
      .map((cls) => {
        const stats = perClass.get(cls._id as string) ?? { visits: 0, ads: 0 };
        return {
          classId: cls._id,
          nameEn: cls.nameEn,
          nameAr: cls.nameAr,
          students: studentsPerClass.get(cls._id as string) ?? 0,
          visits: stats.visits,
          ads: stats.ads,
        };
      })
      .sort((a, b) => b.visits - a.visits || b.ads - a.ads);

    const teacherRows = profiles
      .filter((profile) => profile.role === ROLES.TEACHER)
      .map((profile) => {
        const stats = perTeacher.get(profile.userId as string) ?? {
          visits: 0,
          ads: 0,
        };
        return {
          userId: profile.userId,
          name: profile.name,
          email: profile.email,
          visits: stats.visits,
          ads: stats.ads,
        };
      })
      .sort((a, b) => b.visits - a.visits || b.ads - a.ads);

    return {
      days,
      totals: {
        visits,
        ads,
        classes: classRows.length,
        teachers: teacherRows.length,
      },
      series: seriesDays.map((day) => seriesMap.get(day)!),
      classes: classRows,
      teachers: teacherRows,
    };
  },
});
