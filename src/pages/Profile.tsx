import {
  DataList,
  DemoBadge,
  Field,
  PageHeader,
  RoleBadge,
  SectionCard,
} from "@/components/app/ui";
import { LevelBadge, StreakPill, XpPill } from "@/components/student/gamification-ui";
import { StudentAvatar } from "@/components/student/StudentAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { useProfile } from "@/hooks/use-profile";
import { useI18n, type Language } from "@/i18n";
import { AVATARS } from "@/lib/avatars";
import { describeError } from "@/lib/errors";
import { levelStateFor } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import { useTheme } from "next-themes";
import {
  BellRing,
  GraduationCap,
  Loader2,
  LogOut,
  Mail,
  Moon,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

const NOTIFICATION_TYPES = [
  "assignment",
  "deadline",
  "result",
  "feedback",
  "schedule",
  "announcement",
] as const;

export default function ProfilePage() {
  const { t, lang, setLanguage, pick, formatNumber } = useI18n();
  const { profile } = useProfile();
  const { signOut } = useAuth();
  const updateProfile = useMutation(api.profiles.updateMyProfile);
  const setMyPassword = useAction(api.accounts.setMyPassword);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isStudent = profile?.role === "student";

  // Real class membership; skipped entirely for staff so their profile never
  // calls a student-only query.
  const classInfo = useQuery(
    api.student.myClassContact,
    isStudent ? {} : "skip",
  );

  // The field edits a local override so the stored name can finish loading
  // without an effect rewriting what the user is typing.
  const [editedName, setEditedName] = useState<string | null>(null);
  const name = editedName ?? profile?.name ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<unknown>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  if (!profile) return null;

  const level = levelStateFor(profile.points);
  const muted = new Set(profile.mutedNotificationTypes ?? []);

  const savePreferences = async (next: string[]) => {
    setSavingPrefs(true);
    try {
      await updateProfile({ mutedNotificationTypes: next });
      toast.success(t("profile.preferences.saved"));
    } catch (cause) {
      toast.error(describeError(cause, t, lang));
    } finally {
      setSavingPrefs(false);
    }
  };

  const toggleType = (type: string, enabled: boolean) => {
    const next = new Set(muted);
    if (enabled) next.delete(type);
    else next.add(type);
    void savePreferences([...next]);
  };

  const chooseAvatar = async (avatar: string) => {
    setAvatarBusy(true);
    try {
      await updateProfile({ avatar });
      toast.success(t("profile.avatar.saved"));
    } catch (cause) {
      toast.error(describeError(cause, t, lang));
    } finally {
      setAvatarBusy(false);
    }
  };

  const savePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await setMyPassword({ password: newPassword });
      setNewPassword("");
      toast.success(t("profile.password.updated"));
    } catch (cause) {
      setPasswordError(cause);
    } finally {
      setPasswordBusy(false);
    }
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        name,
        language: lang,
        theme: (theme ?? "system") as "light" | "dark" | "system",
      });
      toast.success(t("profile.updated"));
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {isStudent ? (
        <section className="nq-card relative overflow-hidden p-5 sm:p-6">
          <span aria-hidden className="nq-aurora absolute inset-0 opacity-[0.10]" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              <StudentAvatar avatar={profile.avatar} name={profile.name} size="lg" />
              <span className="absolute -end-2 -bottom-2 grid size-8 place-items-center rounded-full bg-nq-yellow text-[11px] font-black text-[#7A4A02] ring-4 ring-card">
                {formatNumber(level.level)}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">
                {profile.name}
              </h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3.5" aria-hidden />
                  {profile.email}
                </span>
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="size-3.5" aria-hidden />
                  {classInfo
                    ? pick(classInfo.classNameEn, classInfo.classNameAr)
                    : t("profile.class.none")}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <XpPill points={profile.points} />
                <StreakPill streak={profile.streak} />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-bold">
                  <Sparkles className="size-3.5 text-primary" aria-hidden />
                  {t("profile.level")} {formatNumber(level.level)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <LevelBadge
                points={profile.points}
                level={level.level}
                progress={level.progress}
                size={92}
                caption={t("nq.level_short")}
              />
              {profile.isDemo ? <DemoBadge /> : null}
            </div>
          </div>
        </section>
      ) : (
        <PageHeader
          title={t("profile.title")}
          subtitle={t("profile.subtitle")}
          actions={profile.isDemo ? <DemoBadge /> : null}
        />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          {isStudent ? (
            <SectionCard
              title={t("profile.avatar.title")}
              description={t("profile.avatar.sub")}
              actions={<Sparkles className="size-4 text-primary" aria-hidden />}
            >
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {AVATARS.map((avatar) => {
                  const active = profile.avatar === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      aria-label={pick(avatar.nameEn, avatar.nameAr)}
                      aria-pressed={active}
                      disabled={avatarBusy}
                      onClick={() => void chooseAvatar(avatar.id)}
                      className={cn(
                        "nq-press grid aspect-square place-items-center rounded-2xl bg-gradient-to-br text-2xl transition-transform",
                        avatar.gradient,
                        active
                          ? "scale-[1.04] ring-4 ring-primary/60"
                          : "ring-1 ring-border/60 hover:scale-[1.02]",
                      )}
                    >
                      {avatar.emoji}
                    </button>
                  );
                })}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title={t("profile.account")}>
            <form className="space-y-5" onSubmit={save}>
              <Field label={t("profile.name")} required>
                <Input
                  value={name}
                  onChange={(event) => setEditedName(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("common.language")}>
                  <div className="flex gap-2">
                    {(["en", "ar"] as Language[]).map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant={lang === option ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLanguage(option)}
                      >
                        {option === "ar" ? "العربية" : "English"}
                      </Button>
                    ))}
                  </div>
                </Field>
                <Field label={t("common.theme")}>
                  <div className="flex flex-wrap gap-2">
                    {(["light", "dark", "system"] as const).map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant={(theme ?? "system") === option ? "default" : "outline"}
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setTheme(option)}
                      >
                        {option === "light" ? (
                          <Sun className="size-3.5" aria-hidden />
                        ) : option === "dark" ? (
                          <Moon className="size-3.5" aria-hidden />
                        ) : (
                          <Sparkles className="size-3.5" aria-hidden />
                        )}
                        {t(`common.${option}`)}
                      </Button>
                    ))}
                  </div>
                </Field>
              </div>

              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {describeError(error, t, lang)}
                </p>
              ) : null}

              <Button type="submit" disabled={busy} className="gap-2">
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t("common.save")}
              </Button>
            </form>
          </SectionCard>

          {/* Real preference: the backend filters the inbox by these types. */}
          <SectionCard
            title={t("profile.preferences")}
            description={t("profile.preferences.sub")}
            actions={
              savingPrefs ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
              ) : (
                <BellRing className="size-4 text-primary" aria-hidden />
              )
            }
          >
            <ul className="divide-y divide-border/60">
              {NOTIFICATION_TYPES.map((type) => {
                const enabled = !muted.has(type);
                return (
                  <li key={type} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {t(`profile.notif.${type}`)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {enabled
                          ? pick("Shown in your inbox.", "تظهر في صندوقك.")
                          : pick("Hidden from your inbox.", "مخفية من صندوقك.")}
                      </p>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(value) => toggleType(type, value)}
                      aria-label={t(`profile.notif.${type}`)}
                      disabled={savingPrefs}
                    />
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title={t("profile.account")}>
            <DataList
              items={[
                { label: t("common.name"), value: profile.name },
                { label: t("common.email"), value: profile.email },
                { label: t("common.role"), value: <RoleBadge role={profile.role} /> },
                {
                  label: t("common.theme"),
                  value: resolvedTheme === "dark" ? t("common.dark") : t("common.light"),
                },
                ...(isStudent
                  ? [
                      {
                        label: t("profile.class"),
                        value: classInfo
                          ? pick(classInfo.classNameEn, classInfo.classNameAr)
                          : t("profile.class.none"),
                      },
                      {
                        label: t("profile.xp"),
                        value: formatNumber(profile.points),
                      },
                      {
                        label: t("profile.streak"),
                        value: `${formatNumber(profile.streak)} ${t("student.days")}`,
                      },
                    ]
                  : []),
              ]}
            />
          </SectionCard>

          <SectionCard title={t("profile.password.title")}>
            <p className="text-sm leading-6 text-muted-foreground">
              {t("profile.password.body")}
            </p>
            <form className="mt-4 space-y-4" onSubmit={savePassword}>
              <Field
                label={t("profile.password.new")}
                required
                hint={t("profile.password.hint")}
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </Field>

              {passwordError ? (
                <p role="alert" className="text-sm text-destructive">
                  {describeError(passwordError, t, lang)}
                </p>
              ) : null}

              <Button type="submit" disabled={passwordBusy} className="gap-2">
                {passwordBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {t("profile.password.save")}
              </Button>
            </form>
          </SectionCard>

          <div className="nq-card flex items-center gap-3 p-4">
            <span className="grid size-10 place-items-center rounded-xl bg-secondary text-muted-foreground">
              <UserRound className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{profile.name}</p>
              <p className="text-[11px] text-muted-foreground">{t(`roles.${profile.role}`)}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-1.5")}
              onClick={() => void signOut()}
            >
              <LogOut className="size-3.5" aria-hidden />
              {t("nav.signout")}
            </Button>
          </div>

          {profile.isDemo ? (
            <SectionCard title={t("common.demo_badge")}>
              <p className="text-sm leading-6 text-muted-foreground">
                {pick(
                  "This account is part of the demo sandbox. Scores here are sample data.",
                  "هذا الحساب جزء من البيئة التجريبية. الدرجات المعروضة بيانات نموذجية.",
                )}
              </p>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </>
  );
}
