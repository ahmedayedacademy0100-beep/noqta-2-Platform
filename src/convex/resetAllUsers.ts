import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { TableNames } from "./_generated/dataModel";

/**
 * RECOVERY UTILITY — wipe every user account and start the platform over.
 *
 * Use when nobody can sign in (forgotten admin password, broken bootstrap).
 * After it runs, `/auth` shows the "Set up your school" panel again and a
 * fresh super admin can be created — with the same email as before, because
 * the old auth accounts are removed too.
 *
 * Safety:
 * - `internalMutation`, so it can NEVER be called from the app — only from
 *   the developer CLI:  bunx convex run resetAllUsers:run
 * - It only touches users, their auth/session rows and platform settings.
 *   Classes, subjects, questions and assessments are left untouched.
 * - Take a snapshot first:  bunx convex export --path backup.zip
 */
const USER_TABLES = [
  // app-side identity
  "profiles",
  "users",
  // Convex Auth rows (sessions, credentials, verification state)
  "authAccounts",
  "authSessions",
  "authRefreshTokens",
  "authVerifiers",
  "authVerificationCodes",
  "authRateLimits",
  // rows that reference a user id
  "class_enrollments",
  "teacher_assignments",
  "student_achievements",
  "notifications",
  "invite_codes",
  "audit_logs",
  // settings row so the next bootstrap recreates it cleanly
  "platform_settings",
] as const satisfies readonly TableNames[];

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const deleted: Record<string, number> = {};
    for (const table of USER_TABLES) {
      deleted[table] = await deleteAll(ctx, table);
    }
    return deleted;
  },
});

async function deleteAll(
  ctx: MutationCtx,
  table: (typeof USER_TABLES)[number],
): Promise<number> {
  let count = 0;
  for (;;) {
    const doc = await ctx.db.query(table).first();
    if (!doc) return count;
    await ctx.db.delete(doc._id);
    count += 1;
  }
}
