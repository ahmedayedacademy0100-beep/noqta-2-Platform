import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getSettingsRow } from "./guards";

type NotificationType =
  | "assignment"
  | "deadline"
  | "result"
  | "feedback"
  | "schedule"
  | "announcement";

export type NotificationContent = {
  type: NotificationType;
  titleEn: string;
  titleAr: string;
  bodyEn?: string;
  bodyAr?: string;
  link?: string;
};

/**
 * In-app notifications only. Nothing here claims to send email: an email
 * provider would have to be configured and added separately.
 */
export async function notifyUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  content: NotificationContent,
): Promise<void> {
  const settings = await getSettingsRow(ctx);
  if (settings && settings.notificationsEnabled === false) return;
  await ctx.db.insert("notifications", {
    userId,
    type: content.type,
    titleEn: content.titleEn,
    titleAr: content.titleAr,
    bodyEn: content.bodyEn,
    bodyAr: content.bodyAr,
    link: content.link,
    createdAt: Date.now(),
  });
}

export async function notifyMany(
  ctx: MutationCtx,
  userIds: Iterable<Id<"users">>,
  content: NotificationContent,
): Promise<number> {
  let count = 0;
  const seen = new Set<string>();
  for (const userId of userIds) {
    if (seen.has(userId as string)) continue;
    seen.add(userId as string);
    await notifyUser(ctx, userId, content);
    count += 1;
  }
  return count;
}
