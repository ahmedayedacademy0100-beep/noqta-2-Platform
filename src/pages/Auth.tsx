import { PublicShell } from "@/components/app/AppShell";
import { Field, LoadingBlock } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useI18n } from "@/i18n";
import { describeError } from "@/lib/errors";
import { ConvexError } from "convex/values";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

type Mode =
  | "signIn"
  | "signUp"
  | "code"
  | "bootstrap"
  | "forgot"
  | "resetPassword";

/** Convex Auth state can lag a moment behind the sign-in response. */
async function withAuthRetry<T>(action: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      const code =
        error instanceof ConvexError
          ? (error.data as { code?: string } | undefined)?.code
          : undefined;
      if (code !== "UNAUTHENTICATED") throw error;
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
  throw lastError;
}

export default function AuthPage() {
  const { t, lang, pick } = useI18n();
  const { signIn } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { isAuthenticated } = useConvexAuth();
  const status = useQuery(api.profiles.platformStatus);
  const bootstrapAdmin = useMutation(api.setup.bootstrapAdmin);
  const setMyPassword = useAction(api.accounts.setMyPassword);
  const completeRegistration = useMutation(api.profiles.completeStudentRegistration);
  const redeemInvite = useMutation(api.profiles.redeemInviteCode);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") ?? "/dashboard";

  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [otpEmail, setOtpEmail] = useState("");
  const [codeEmail, setCodeEmail] = useState("");
  const [otp, setOtp] = useState("");
  /** True while the code on screen belongs to the forgot-password flow. */
  const [recovery, setRecovery] = useState(false);

  const needsBootstrap = status?.needsBootstrap ?? false;
  // A production install ships empty: the first account becomes the school's
  // super admin (see the bootstrap panel). The demo sandbox is only offered
  // once an administrator switches it on in Settings.
  const demoAccounts = status?.demoAccounts ?? [];

  // Before the visitor picks a panel, derive the right one from the platform
  // status (empty install → bootstrap, otherwise sign in).
  const activeMode: Mode | null =
    mode ?? (status ? (needsBootstrap ? "bootstrap" : "signIn") : null);

  useEffect(() => {
    // Only bounce into the product while the session is genuinely live; the
    // cached profile can linger for a frame after a sign-out.
    if (profileLoading || !isAuthenticated) return;
    if (profile) navigate(returnTo, { replace: true });
  }, [profile, profileLoading, isAuthenticated, navigate, returnTo]);

  const schoolName = status?.settings
    ? pick(status.settings.schoolNameEn, status.settings.schoolNameAr)
    : t("app.name");

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = (event: React.FormEvent<HTMLFormElement>) =>
    run(async () => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      await signIn("password", {
        email: String(data.get("email") ?? "").trim().toLowerCase(),
        password: String(data.get("password") ?? ""),
        flow: "signIn",
      });
      navigate(returnTo, { replace: true });
    });

  const handleSignUpStudent = (event: React.FormEvent<HTMLFormElement>) =>
    run(async () => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name") ?? "").trim();
      const email = String(data.get("email") ?? "").trim().toLowerCase();
      const password = String(data.get("password") ?? "");
      const code = String(data.get("code") ?? "").trim();
      const useInvite = data.get("useInvite") === "on";
      await signIn("password", { email, password, flow: "signUp", name });
      await withAuthRetry(() =>
        useInvite
          ? redeemInvite({ name, code, language: lang })
          : completeRegistration({ name, classCode: code, language: lang }),
      );
      navigate("/dashboard", { replace: true });
    });

  const handleBootstrap = (event: React.FormEvent<HTMLFormElement>) =>
    run(async () => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name") ?? "").trim();
      const email = String(data.get("email") ?? "").trim().toLowerCase();
      const password = String(data.get("password") ?? "");
      await signIn("password", { email, password, flow: "signUp", name });
      await withAuthRetry(() =>
        bootstrapAdmin({
          name,
          schoolNameEn: String(data.get("schoolEn") ?? "").trim(),
          schoolNameAr: String(data.get("schoolAr") ?? "").trim(),
          language: lang,
        }),
      );
      navigate("/dashboard", { replace: true });
    });

  // The code panel lives inside the password form, and HTML forbids nested
  // forms: the browser would run the password submit instead. It is therefore a
  // plain div that reads its own controlled email field.
  const handleSendCode = (emailInput: string) =>
    run(async () => {
      const email = emailInput.trim().toLowerCase();
      if (!email) return;
      await signIn("email-otp", { email });
      setOtpEmail(email);
      setRecovery(false);
      setMode("code");
    });

  const handleVerifyCode = (event: React.FormEvent<HTMLFormElement>) =>
    run(async () => {
      event.preventDefault();
      await signIn("email-otp", { email: otpEmail, code: otp });
      if (recovery) {
        // Mailbox ownership proven: let the user choose a new password now.
        setOtp("");
        setMode("resetPassword");
        return;
      }
      navigate(returnTo, { replace: true });
    });

  const handleForgotCode = (event: React.FormEvent<HTMLFormElement>) =>
    run(async () => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const email = String(data.get("email") ?? "").trim().toLowerCase();
      await signIn("email-otp", { email });
      setOtpEmail(email);
      setRecovery(true);
      setMode("code");
    });

  const handleSetNewPassword = (event: React.FormEvent<HTMLFormElement>) =>
    run(async () => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const password = String(data.get("password") ?? "");
      // The session from the code verification can lag a moment behind the
      // sign-in response, so retry UNAUTHENTICATED the same way sign-up does.
      await withAuthRetry(() => setMyPassword({ password }));
      setRecovery(false);
      navigate(returnTo, { replace: true });
    });

  const handleDemo = (email: string, password: string) =>
    run(async () => {
      await signIn("password", { email, password, flow: "signIn" });
      navigate("/dashboard", { replace: true });
    });

  if (status === undefined || activeMode === null) {
    return (
      <PublicShell schoolName={schoolName}>
        <LoadingBlock />
      </PublicShell>
    );
  }

  const tabs: { id: Mode; label: string }[] = needsBootstrap
    ? [{ id: "bootstrap", label: t("auth.bootstrap.title") }]
    : [
        { id: "signIn", label: t("auth.signin.title") },
        { id: "signUp", label: t("auth.signup.title") },
      ];

  return (
    <PublicShell schoolName={schoolName}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:gap-12">
        <div className="flex-1">
          <div className="surface p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  type="button"
                  variant={activeMode === tab.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setError(null);
                    setMode(tab.id);
                  }}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {activeMode === "signIn" ? (
              <form className="space-y-4" onSubmit={handleSignIn}>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    {t("auth.signin.title")}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("auth.signin.subtitle")}
                  </p>
                </div>
                <Field label={t("auth.email")} required>
                  <Input name="email" type="email" autoComplete="email" required />
                </Field>
                <Field label={t("auth.password")} required>
                  <Input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    minLength={8}
                    required
                  />
                </Field>
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-xs font-normal text-muted-foreground"
                    onClick={() => {
                      setError(null);
                      setRecovery(true);
                      setMode("forgot");
                    }}
                  >
                    {t("auth.forgot.link")}
                  </Button>
                </div>

                <Button type="submit" className="w-full gap-2" disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      {t("auth.signin.signing_in")}
                    </>
                  ) : (
                    <>
                      <KeyRound className="size-4" aria-hidden />
                      {t("auth.signin.button")}
                    </>
                  )}
                </Button>

                <div className="surface-muted p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {t("auth.recovery.title")}
                  </p>
                  <p className="mt-1 leading-5">{t("auth.recovery.body")}</p>
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Field label={t("auth.or_code")}>
                      <Input
                        name="codeEmail"
                        type="email"
                        autoComplete="email"
                        value={codeEmail}
                        onChange={(event) => setCodeEmail(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          void handleSendCode(codeEmail);
                        }}
                      />
                    </Field>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={busy}
                    onClick={() => void handleSendCode(codeEmail)}
                  >
                    <Mail className="size-4" aria-hidden />
                    {t("auth.send_code")}
                  </Button>
                </div>
              </form>
            ) : null}

            {activeMode === "signUp" ? (
              <form className="space-y-4" onSubmit={handleSignUpStudent}>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    {t("auth.signup.title")}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("auth.signup.subtitle")}
                  </p>
                </div>
                <Field label={t("auth.full_name")} required>
                  <Input name="name" required minLength={2} />
                </Field>
                <Field label={t("auth.email")} required>
                  <Input name="email" type="email" autoComplete="email" required />
                </Field>
                <Field label={t("auth.password")} required hint="8+ characters">
                  <Input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </Field>
                <Field label={t("auth.class_code")} required>
                  <Input
                    name="code"
                    className="uppercase tracking-widest"
                    placeholder="G8MATH"
                    required
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    name="useInvite"
                    className="size-4 rounded border-input accent-primary"
                  />
                  {t("auth.signup.teacher")}
                </label>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  {t("auth.signup.button")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("auth.need_account")}</p>
              </form>
            ) : null}

            {activeMode === "bootstrap" ? (
              <form className="space-y-4" onSubmit={handleBootstrap}>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    {t("auth.bootstrap.title")}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("auth.bootstrap.subtitle")}
                  </p>
                </div>
                <Field label={t("auth.full_name")} required>
                  <Input name="name" required minLength={2} />
                </Field>
                <Field label={t("auth.email")} required>
                  <Input name="email" type="email" autoComplete="email" required />
                </Field>
                <Field label={t("auth.password")} required hint="8+ characters">
                  <Input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("auth.bootstrap.school_en")}>
                    <Input name="schoolEn" defaultValue="Noqta Academy" />
                  </Field>
                  <Field label={t("auth.bootstrap.school_ar")}>
                    <Input name="schoolAr" defaultValue="أكاديمية نُقطة" dir="rtl" />
                  </Field>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <ShieldCheck className="size-4" aria-hidden />
                  )}
                  {t("auth.bootstrap.button")}
                </Button>
              </form>
            ) : null}

            {activeMode === "code" ? (
              <form className="space-y-4" onSubmit={handleVerifyCode}>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    {t("auth.code")}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("auth.code_sent", { email: otpEmail })}
                  </p>
                </div>
                <div className="flex justify-center">
                  <InputOTP value={otp} onChange={setOtp} maxLength={6}>
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <InputOTPSlot key={index} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={busy || otp.length !== 6}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {t("auth.verify")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setOtp("");
                    setMode(recovery ? "forgot" : "signIn");
                  }}
                >
                  {t("auth.use_different_email")}
                </Button>
              </form>
            ) : null}

            {activeMode === "forgot" ? (
              <form className="space-y-4" onSubmit={handleForgotCode}>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    {t("auth.forgot.title")}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("auth.forgot.subtitle")}
                  </p>
                </div>
                <Field label={t("auth.email")} required>
                  <Input name="email" type="email" autoComplete="email" required />
                </Field>
                <Button type="submit" className="w-full gap-2" disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Mail className="size-4" aria-hidden />
                  )}
                  {t("auth.forgot.button")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setError(null);
                    setRecovery(false);
                    setMode("signIn");
                  }}
                >
                  {t("auth.back_to_signin")}
                </Button>
              </form>
            ) : null}

            {activeMode === "resetPassword" ? (
              <form className="space-y-4" onSubmit={handleSetNewPassword}>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    {t("auth.reset.title")}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("auth.reset.subtitle", { email: otpEmail })}
                  </p>
                </div>
                <Field
                  label={t("auth.reset.password")}
                  required
                  hint={t("auth.reset.hint")}
                >
                  <Input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </Field>
                <Button type="submit" className="w-full gap-2" disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <KeyRound className="size-4" aria-hidden />
                  )}
                  {t("auth.reset.button")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setError(null);
                    setMode("signIn");
                  }}
                >
                  {t("auth.back_to_signin")}
                </Button>
              </form>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{describeError(error, t, lang)}</span>
              </div>
            ) : null}
          </div>

        </div>

        {demoAccounts.length > 0 ? (
          <aside className="lg:w-80">
            <div className="surface p-6">
              <>
                  <h2 className="text-base font-semibold tracking-tight">
                    {t("auth.demo.title")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("auth.demo.body")}
                  </p>
                  <div className="mt-4 space-y-2">
                    {demoAccounts.map((account) => (
                      <Button
                        key={account.email}
                        type="button"
                        variant="outline"
                        className="w-full justify-between gap-2"
                        disabled={busy}
                        onClick={() => handleDemo(account.email, account.password)}
                      >
                        <span className="truncate">{account.email}</span>
                        <span className="text-xs text-muted-foreground">
                          {t(`roles.${account.role}`)}
                        </span>
                      </Button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {t("auth.demo.note")}
                  </p>
              </>
            </div>
          </aside>
        ) : null}
      </div>
    </PublicShell>
  );
}
