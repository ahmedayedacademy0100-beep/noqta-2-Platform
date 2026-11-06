import { PublicShell } from "@/components/app/AppShell";
import { Field, LoadingBlock } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useProfile } from "@/hooks/use-profile";
import { useI18n } from "@/i18n";
import { describeError } from "@/lib/errors";
import { useMutation, useQuery } from "convex/react";
import { Loader2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";

/**
 * Registration is controlled: a signed-in account only gets a role once it
 * presents a class join code (students) or an administrator's invite code.
 */
export default function Onboarding() {
  const { t, lang, pick } = useI18n();
  const { isLoading, signedIn, hasProfile } = useProfile();
  const { signOut } = useAuth();
  const status = useQuery(api.profiles.platformStatus);
  const completeRegistration = useMutation(api.profiles.completeStudentRegistration);
  const redeemInvite = useMutation(api.profiles.redeemInviteCode);
  const bootstrapAdmin = useMutation(api.setup.bootstrapAdmin);
  const navigate = useNavigate();
  const [mode, setMode] = useState<"student" | "invite" | "bootstrap">("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!isLoading && hasProfile) navigate("/dashboard", { replace: true });
  }, [hasProfile, isLoading, navigate]);

  useEffect(() => {
    if (status?.needsBootstrap) setMode("bootstrap");
  }, [status?.needsBootstrap]);

  const schoolName = status?.settings
    ? pick(status.settings.schoolNameEn, status.settings.schoolNameAr)
    : t("app.name");

  if (isLoading) {
    return (
      <PublicShell schoolName={schoolName}>
        <LoadingBlock />
      </PublicShell>
    );
  }

  if (!signedIn) {
    return (
      <PublicShell schoolName={schoolName}>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">{t("error.UNAUTHENTICATED")}</p>
          <Button className="mt-4" onClick={() => navigate("/auth")}>
            {t("auth.signin.button")}
          </Button>
        </div>
      </PublicShell>
    );
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) =>
    (async () => {
      event.preventDefault();
      setBusy(true);
      setError(null);
      try {
        const data = new FormData(event.currentTarget);
        const name = String(data.get("name") ?? "").trim();
        if (mode === "bootstrap") {
          await bootstrapAdmin({
            name,
            schoolNameEn: String(data.get("schoolEn") ?? "").trim(),
            schoolNameAr: String(data.get("schoolAr") ?? "").trim(),
            language: lang,
          });
        } else if (mode === "invite") {
          await redeemInvite({
            name,
            code: String(data.get("code") ?? "").trim(),
            language: lang,
          });
        } else {
          await completeRegistration({
            name,
            classCode: String(data.get("code") ?? "").trim(),
            language: lang,
          });
        }
        navigate("/dashboard", { replace: true });
      } catch (cause) {
        setError(cause);
      } finally {
        setBusy(false);
      }
    })();

  return (
    <PublicShell schoolName={schoolName}>
      <div className="mx-auto w-full max-w-lg px-4 py-12 sm:px-6">
        <div className="surface p-6 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "bootstrap" ? t("auth.bootstrap.title") : t("onboarding.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "bootstrap" ? t("auth.bootstrap.subtitle") : t("onboarding.subtitle")}
          </p>

          {mode !== "bootstrap" ? (
            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "student" ? "default" : "outline"}
                onClick={() => setMode("student")}
              >
                {t("roles.student")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "invite" ? "default" : "outline"}
                onClick={() => setMode("invite")}
              >
                {t("auth.invite_code")}
              </Button>
            </div>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={submit}>
            <Field label={t("auth.full_name")} required>
              <Input name="name" required minLength={2} />
            </Field>

            {mode === "bootstrap" ? (
              <div className="grid gap-4 sm:grid-cols-2">                  <Field label={t("auth.bootstrap.school_en")}>
                    <Input name="schoolEn" defaultValue="Noqta Academy" />
                  </Field>
                  <Field label={t("auth.bootstrap.school_ar")}>
                    <Input name="schoolAr" defaultValue="أكاديمية نُقطة" dir="rtl" />
                  </Field>
              </div>
            ) : (
              <Field
                label={mode === "student" ? t("auth.class_code") : t("auth.invite_code")}
                required
              >
                <Input
                  name="code"
                  className="uppercase tracking-widest"
                  placeholder={mode === "student" ? "G8MATH" : "AB12CD"}
                  required
                />
              </Field>
            )}

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {describeError(error, t, lang)}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {mode === "bootstrap"
                ? t("auth.bootstrap.button")
                : t("auth.signup.button")}
            </Button>
          </form>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-4 w-full gap-2"
            onClick={async () => {
              await signOut();
              navigate("/auth", { replace: true });
            }}
          >
            <LogOut className="size-4" aria-hidden />
            {t("nav.signout")}
          </Button>
        </div>
      </div>
    </PublicShell>
  );
}
