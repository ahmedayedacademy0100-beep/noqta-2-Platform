import {
  Field,
  LoadingBlock,
  PageHeader,
  SectionCard,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useI18n } from "@/i18n";
import { describeError } from "@/lib/errors";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ImageIcon,
  Info,
  Loader2,
  Megaphone,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Band = {
  letter: string;
  minPercent: number;
  labelEn: string;
  labelAr: string;
};

export default function AdminSettings() {  const { t, lang, pick } = useI18n();
  const adminSettings = useQuery(api.admin.platformSettings, {}) ?? { settings: null };
  const updateSettings = useMutation(api.admin.updateSettings);
  const generateBrandUploadUrl = useMutation(api.admin.generateBrandUploadUrl);
  function brandSettingsValue() {
    return adminSettings?.settings
      ? { settings: adminSettings.settings }
      : null;
  }

  const setDemoAccounts = useMutation(api.setup.setDemoAccountsEnabled);
  const loadDemoContent = useAction(api.setup.loadDemoContent);
  const broadcast = useMutation(api.admin.broadcastAnnouncement);

  const [bands, setBands] = useState<Band[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [hydrated, setHydrated] = useState(false);
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [publisherId, setPublisherId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [protection, setProtection] = useState(true);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const brand = brandSettingsValue();
    if (!brand?.settings || hydrated) return;
    setBands(brand.settings.gradingScale as Band[]);
    setAdsEnabled(brand.settings.adsEnabled ?? false);
    setPublisherId(brand.settings.adsensePublisherId ?? "");
    setSlotId(brand.settings.adsenseSlotId ?? "");
    setProtection(brand.settings.contentProtectionEnabled ?? true);
    setHydrated(true);
  }, [brandSettingsValue, hydrated]);

  if (adminSettings === undefined) return <LoadingBlock />;

  const brand = brandSettingsValue();
  const settings = brand?.settings ?? adminSettings.settings;
  if (!settings) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">{t("error.NOT_FOUND")}</p>
      </div>
    );
  }

  const run = async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (message) toast.success(message);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  /** Upload the logo to Convex storage, then save the file id on the settings. */
  const uploadLogo = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const { uploadUrl } = await generateBrandUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) throw new Error("upload_failed");
      const json = (await response.json()) as { storageId: string };                  await updateSettings({ logoStorageId: json.storageId as string as Parameters<typeof updateSettings>[0]["logoStorageId"] });

      toast.success(t("common.saved"));
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
      if (logoInput.current) logoInput.current.value = "";
    }
  };

  return (
    <>
      <PageHeader
        title={t("admin.settings.title")}
        subtitle={t("admin.settings.subtitle")}
      />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {describeError(error, t, lang)}
        </p>
      ) : null}

      <SectionCard
        title={t("admin.brand.title")}
        description={t("admin.brand.subtitle")}
      >          <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);              void run(
              async () =>
                updateSettings({
                  schoolNameEn: String(formData.get("schoolNameEn") ?? ""),
                  schoolNameAr: String(formData.get("schoolNameAr") ?? ""),
                  taglineEn: String(formData.get("taglineEn") ?? ""),
                  taglineAr: String(formData.get("taglineAr") ?? ""),
                  brandPrimary: String(formData.get("brandPrimary") ?? ""),
                  brandAccent: String(formData.get("brandAccent") ?? ""),
                }),
              t("common.saved"),
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin.brand.name_en")} required>
              <Input name="schoolNameEn" defaultValue={settings.schoolNameEn} required />
            </Field>
            <Field label={t("admin.brand.name_ar")} required>
              <Input
                name="schoolNameAr"
                dir="rtl"
                defaultValue={settings.schoolNameAr}
                required
              />
            </Field>
            <Field label={t("admin.brand.tagline_en")}>
              <Input
                name="taglineEn"
                defaultValue={settings.taglineEn ?? ""}
                placeholder={t("app.tagline")}
              />
            </Field>
            <Field label={t("admin.brand.tagline_ar")}>
              <Input
                name="taglineAr"
                dir="rtl"
                defaultValue={settings.taglineAr ?? ""}
                placeholder="منصة تعلّم تفاعلية"
              />
            </Field>
            <Field label={t("admin.brand.primary")} hint={t("admin.brand.color_hint")}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  name="brandPrimary"
                  defaultValue={settings.brandPrimary ?? "#4169ff"}
                  className="h-9 w-14 cursor-pointer rounded-lg border border-input bg-transparent p-1"
                />
                <span className="text-xs text-muted-foreground">
                  {settings.brandPrimary ?? "#4169ff"}
                </span>
              </div>
            </Field>
            <Field label={t("admin.brand.accent")} hint={t("admin.brand.color_hint")}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  name="brandAccent"
                  defaultValue={settings.brandAccent ?? "#8b5cf6"}
                  className="h-9 w-14 cursor-pointer rounded-lg border border-input bg-transparent p-1"
                />
                <span className="text-xs text-muted-foreground">
                  {settings.brandAccent ?? "#8b5cf6"}
                </span>
              </div>
            </Field>
          </div>
          <Button type="submit" disabled={busy} className="gap-2">
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {t("common.save")}
          </Button>
        </form>

        <div className="mt-6 space-y-3 border-t border-border/60 pt-5">
          <p className="text-sm font-medium">{t("admin.brand.logo")}</p>
          <div className="flex flex-wrap items-center gap-3">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={t("admin.brand.logo")}
                className="h-14 w-auto max-w-44 rounded-xl border border-border/60 bg-white object-contain p-1.5"
              />
            ) : (
              <span className="grid size-14 place-items-center rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground">
                <ImageIcon className="size-5" aria-hidden />
              </span>
            )}
            <input
              ref={logoInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadLogo(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={busy}
              onClick={() => logoInput.current?.click()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
              {t("admin.brand.upload")}
            </Button>
            {settings.logoUrl ? (
              <Button
                type="button"
                variant="ghost"
                className="gap-2 text-destructive"
                disabled={busy}
                onClick={() =>
              void run(
                async () => updateSettings({ logoStorageId: null as Parameters<typeof updateSettings>[0]["logoStorageId"] }),
                t("common.saved"),
              )
                }
              >
                <Trash2 className="size-4" aria-hidden />
                {t("admin.brand.remove_logo")}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{t("admin.brand.logo_hint")}</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="text-sm">
              <p className="font-medium">{t("admin.brand.protect")}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {t("admin.brand.protect_hint")}
              </p>
            </div>
          </div>
          <Switch
            checked={protection}
            onCheckedChange={(checked) => {
              setProtection(checked);
              void run(
                () => updateSettings({ contentProtectionEnabled: checked }),
                t("common.saved"),
              );
            }}
          />
        </div>
      </SectionCard>

      <SectionCard title={t("admin.settings.title")}>          <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            void run(
              async () =>
                updateSettings({
                  defaultLanguage: formData.get("defaultLanguage") === "ar" ? ("ar" as const) : ("en" as const),
                  defaultPassThreshold: Number(formData.get("defaultPassThreshold") ?? 60),
                  defaultDurationMinutes: Number(
                    formData.get("defaultDurationMinutes") ?? 30,
                  ),
                  gamificationEnabled: formData.get("gamification") === "on",
                  leaderboardsEnabled: formData.get("leaderboards") === "on",
                  notificationsEnabled: formData.get("notifications") === "on",
                  gradingScale: bands.map((b) => ({ ...b })),
                }),
              t("common.saved"),
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin.settings.default_language")}>
              <Select name="defaultLanguage" defaultValue={settings.defaultLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("admin.settings.pass")}>
              <Input
                name="defaultPassThreshold"
                type="number"
                min={0}
                max={100}
                defaultValue={settings.defaultPassThreshold}
              />
            </Field>
            <Field label={t("admin.settings.duration")}>
              <Input
                name="defaultDurationMinutes"
                type="number"
                min={1}
                max={600}
                defaultValue={settings.defaultDurationMinutes}
              />
            </Field>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                {t("admin.settings.gamification")}
                <span className="block text-xs text-muted-foreground">
                  {t("student.badges")}
                </span>
              </span>
              <input
                type="checkbox"
                name="gamification"
                defaultChecked={settings.gamificationEnabled}
                className="size-4 accent-primary"
              />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                {t("admin.settings.leaderboards")}
                <span className="block text-xs text-muted-foreground">
                  {t("admin.settings.leaderboards_hint")}
                </span>
              </span>
              <input
                type="checkbox"
                name="leaderboards"
                defaultChecked={settings.leaderboardsEnabled}
                className="size-4 accent-primary"
              />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                {t("admin.settings.notifications")}
                <span className="block text-xs text-muted-foreground">
                  {t("notifications.subtitle")}
                </span>
              </span>
              <input
                type="checkbox"
                name="notifications"
                defaultChecked={settings.notificationsEnabled}
                className="size-4 accent-primary"
              />
            </label>
          </div>

          <div>
            <p className="text-sm font-medium">{t("admin.reports.assessments")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pick(
                "Grade bands used for letter grades on result pages.",
                "حدود التقديرات المستخدمة في صفحات النتائج.",
              )}
            </p>
            <ul className="mt-3 space-y-2">
              {bands.map((band, index) => (
                <li key={`${band.letter}-${index}`} className="flex flex-wrap items-end gap-2">
                  <Input
                    className="w-20"
                    value={band.letter}
                    aria-label="letter"
                    onChange={(event) =>
                      setBands((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, letter: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Input
                    className="w-24"
                    type="number"
                    min={0}
                    max={100}
                    value={band.minPercent}
                    aria-label="min percent"
                    onChange={(event) =>
                      setBands((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, minPercent: Number(event.target.value) as Band["minPercent"] }
                            : item,
                        ),
                      )
                    }
                  />
                  <Input
                    className="flex-1"
                    value={band.labelEn}
                    aria-label="label en"
                    onChange={(event) =>
                      setBands((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, labelEn: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Input
                    className="flex-1"
                    dir="rtl"
                    value={band.labelAr}
                    aria-label="label ar"
                    onChange={(event) =>
                      setBands((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, labelAr: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      setBands((prev) => prev.filter((_, i) => i !== index))
                    }
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 gap-2"
              onClick={() =>
                setBands((prev) => [
                  ...prev,
                  { letter: "", minPercent: 0, labelEn: "", labelAr: "" },
                ])
              }
            >
              <Plus className="size-4" aria-hidden />
              {t("common.create")}
            </Button>
          </div>

          <Button type="submit" disabled={busy} className="gap-2">
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {t("common.save")}
          </Button>
        </form>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title={t("common.demo_badge")}
          description={t("auth.demo.note")}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span>{t("admin.settings.demo_accounts")}</span>
              <Switch
                checked={settings.demoAccountsEnabled}
                onCheckedChange={(checked) =>
                  void run(
                    () => setDemoAccounts({ enabled: checked }),
                    t("common.saved"),
                  )
                }
              />
            </div>
            <Button
              variant="outline"
              disabled={busy || settings.demoDataLoaded}
              onClick={() =>
                void run(() => loadDemoContent({}), t("common.saved"))
              }
            >
              {settings.demoDataLoaded
                ? t("admin.settings.demo_loaded")
                : t("admin.settings.demo_load")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {pick(
                "Demo accounts are labelled in every list and can be switched off at any time. Loading demo content adds sample classes, a question bank and three assessments.",
                "الحسابات التجريبية موسومة في كل القوائم ويمكن إيقافها في أي وقت. تحميل المحتوى التجريبي يضيف صفوفاً نموذجية وبنك أسئلة وثلاثة تقييمات.",
              )}
            </p>
          </div>
        </SectionCard>

        <SectionCard title={t("admin.broadcast.title")} description={t("notifications.subtitle")}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void run(async () => {
                const result = await broadcast({
                  titleEn: String(formData.get("titleEn") ?? ""),
                  titleAr: String(formData.get("titleAr") ?? ""),
                  bodyEn: String(formData.get("bodyEn") ?? "") || undefined,
                  bodyAr: String(formData.get("bodyAr") ?? "") || undefined,                audience: (formData.get("audience") ?? "all") === "students"
                ? "students"
                : (formData.get("audience") ?? "all") === "teachers"
                  ? "teachers"
                  : "all",
                });
                toast.success(t("admin.broadcast.sent", { count: result.sent }));
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("admin.broadcast.en")} required>
                <Input name="titleEn" required />
              </Field>
              <Field label={t("admin.broadcast.ar")} required>
                <Input name="titleAr" dir="rtl" required />
              </Field>
              <Field label={t("admin.broadcast.body_en")}>
                <Textarea name="bodyEn" rows={2} />
              </Field>
              <Field label={t("admin.broadcast.body_ar")}>
                <Textarea name="bodyAr" rows={2} dir="rtl" />
              </Field>
            </div>
            <Field label={t("admin.broadcast.audience")}>
              <Select name="audience" defaultValue="all">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="students">{t("roles.student")}</SelectItem>
                  <SelectItem value="teachers">{t("roles.teacher")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Button type="submit" disabled={busy} className="gap-2">
              <Megaphone className="size-4" aria-hidden />
              {t("admin.broadcast.send")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {pick(
                "Notifications are in-app only. Email requires a separate provider to be configured.",
                "الإشعارات داخل التطبيق فقط. يتطلب البريد الإلكتروني تهيئة مزوّد مستقل.",
              )}
            </p>
          </form>
        </SectionCard>
      </div>

      <SectionCard title={t("admin.ads.title")} description={t("admin.ads.description")}>          <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            void run(
              async () =>
                updateSettings({
                  adsEnabled,
                  adsensePublisherId: publisherId.trim() || undefined,
                  adsenseSlotId: slotId.trim() || undefined,
                }),
              t("common.saved"),
            );
          }}
        >
          <div className="flex items-center justify-between gap-4 text-sm">
            <div>
              <span>{t("admin.ads.enable")}</span>
              <p className="text-xs text-muted-foreground">
                {t("admin.ads.enable_hint")}
              </p>
            </div>
            <Switch checked={adsEnabled} onCheckedChange={setAdsEnabled} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("admin.ads.publisher_id")}
              required={adsEnabled}
              hint={t("admin.ads.publisher_hint")}
            >
              <Input
                value={publisherId}
                onChange={(event) => setPublisherId(event.target.value)}
                placeholder="ca-pub-0123456789012345"
                dir="ltr"
              />
            </Field>
            <Field label={t("admin.ads.slot_id")} hint={t("admin.ads.slot_hint")}>
              <Input
                value={slotId}
                onChange={(event) => setSlotId(event.target.value)}
                placeholder="1234567890"
                dir="ltr"
                inputMode="numeric"
              />
            </Field>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("admin.ads.note")}
          </p>
          <Button type="submit" disabled={busy} className="gap-2">
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {t("common.save")}
          </Button>
        </form>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={t("admin.settings.backup")}>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("admin.settings.backup_body")}
          </p>
        </SectionCard>
        <SectionCard title={t("admin.settings.danger")}>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="leading-6">{t("admin.settings.danger_body")}</p>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
