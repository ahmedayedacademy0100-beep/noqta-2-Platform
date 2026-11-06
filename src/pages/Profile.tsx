import {
  DataList,
  DemoBadge,
  Field,
  PageHeader,
  RoleBadge,
  SectionCard,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useProfile } from "@/hooks/use-profile";
import { useI18n, type Language } from "@/i18n";
import { describeError } from "@/lib/errors";
import { useAction, useMutation } from "convex/react";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { t, lang, setLanguage, pick } = useI18n();
  const { profile } = useProfile();
  const updateProfile = useMutation(api.profiles.updateMyProfile);
  const setMyPassword = useAction(api.accounts.setMyPassword);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [name, setName] = useState(profile?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<unknown>(null);

  useEffect(() => {
    if (profile) setName(profile.name);
  }, [profile]);

  if (!profile) return null;

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
      await updateProfile({ name, language: lang, theme: (theme ?? "system") as "light" | "dark" | "system" });
      toast.success(t("profile.updated"));
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t("profile.title")}
        subtitle={t("profile.subtitle")}
        actions={profile.isDemo ? <DemoBadge /> : null}
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <SectionCard title={t("profile.account")}>
          <form className="space-y-5" onSubmit={save}>
            <Field label={t("profile.name")} required>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
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
                <div className="flex gap-2">
                  {(["light", "dark", "system"] as const).map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={(theme ?? "system") === option ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme(option)}
                    >
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
