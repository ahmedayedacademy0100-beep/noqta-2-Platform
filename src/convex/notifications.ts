import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ERROR_CODES, deny, requireProfile } from "./lib/guards";

export const list = query({
  args: { onlyUnread: v.optional(v.boolean()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireProfile(ctx);
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    // An account can silence inbox types from the profile screen; honor it here
    // so the preference changes what is actually listed, not just a toggle.
    const muted = new Set(profile.mutedNotificationTypes ?? []);
    const rows = muted.size === 0 ? all : all.filter((row) => !muted.has(row.type));
    const filtered = args.onlyUnread ? rows.filter((r) => !r.readAt) : rows;
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return {
      rows: filtered
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
        .map((row) => ({
          _id: row._id,
          type: row.type,
          titleEn: row.titleEn,
          titleAr: row.titleAr,
          bodyEn: row.bodyEn,
          bodyAr: row.bodyAr,
          link: row.link,
          readAt: row.readAt,
          createdAt: row.createdAt,
        })),
      unread: rows.filter((r) => !r.readAt).length,
      total: rows.length,
      muted: [...muted],
    };
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const { userId } = await requireProfile(ctx);
    const row = await ctx.db.get(args.notificationId);
    if (!row || row.userId !== userId) {
      deny(
        ERROR_CODES.NOT_FOUND,
        "Notification not found.",
        "لم يتم العثور على الإشعار.",
      );
    }
    if (!row.readAt) {
      await ctx.db.patch(args.notificationId, { readAt: Date.now() });
    }
    return { ok: true };
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireProfile(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();
    let updated = 0;
    for (const row of rows) {
      if (row.readAt) continue;
      await ctx.db.patch(row._id, { readAt: now });
      updated += 1;
    }
    return { updated };
  },
});
