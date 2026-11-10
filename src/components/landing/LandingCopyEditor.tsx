import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { ar, en } from "@/i18n/dictionary";
import { useI18n } from "@/i18n";
import { describeError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { Loader2, RotateCcw, Search, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Entry = { en: string; ar: string };

/** Every landing string the dictionary ships, in a stable order. */
const COPY_KEYS = Object.keys(en)
  .filter((key) => key.startsWith("landing."))
  .sort();

const DEFAULT_EN: Record<string, string> = en;
const DEFAULT_AR: Record<string, string> = ar;

function defaultsFor(key: string): Entry {
  return {
    en: DEFAULT_EN[key] ?? key,
    ar: DEFAULT_AR[key] ?? DEFAULT_EN[key] ?? key,
  };
}

function groupOf(key: string): string {
  const parts = key.split(".");
  return parts.slice(0, 2).join(".");
}

/**
 * Owner editor for the public landing page.
 *
 * Each row is one string on the page. Leaving a field empty (or equal to the
 * shipped text) removes the override, so the platform always falls back to a
 * complete, translated page instead of blank copy.
 */
export function LandingCopyEditor({
  settings,
}: {
  settings?: { landingCopy?: { key: string; en: string; ar: string }[] };
}) {
  const { t, lang } = useI18n();
  const updateSettings = useMutation(api.admin.updateSettings);
  const stored = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const entry of settings?.landingCopy ?? []) {
      map.set(entry.key, { en: entry.en, ar: entry.ar });
    }
    return map;
  }, [settings?.landingCopy]);

  const [draft, setDraft] = useState<Record<string, Entry>>({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const valueFor = (key: string): Entry => draft[key] ?? stored.get(key) ?? defaultsFor(key);

  const editedCount = COPY_KEYS.filter((key) => {
    const value = valueFor(key);
    const fallback = defaultsFor(key);
    return value.en !== fallback.en || value.ar !== fallback.ar;
  }).length;

  const visible = COPY_KEYS.filter((key) => {
    if (!search.trim()) return true;
    const needle = search.trim().toLowerCase();
    const value = valueFor(key);
    return (
      key.toLowerCase().includes(needle) ||
      value.en.toLowerCase().includes(needle) ||
      value.ar.includes(needle)
    );
  });

  const setValue = (key: string, field: "en" | "ar", text: string) => {
    setDraft((current) => ({
      ...current,
      [key]: { ...valueFor(key), [field]: text },
    }));
  };

  const save = async () => {
    setBusy(true);
    try {
      const entries = COPY_KEYS.map((key) => ({ key, ...valueFor(key) })).filter((entry) => {
        const fallback = defaultsFor(entry.key);
        return (
          (entry.en.trim() && entry.en !== fallback.en) ||
          (entry.ar.trim() && entry.ar !== fallback.ar)
        );
      });
      await updateSettings({
        landingCopy: entries.map((entry) => ({
          key: entry.key,
          en: entry.en,
          ar: entry.ar,
        })),
      });
      toast.success(t("admin.copy.saved"));
    } catch (cause) {
      toast.error(describeError(cause, t, lang));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm(t("admin.copy.reset_confirm"))) return;
    setBusy(true);
    try {
      await updateSettings({ landingCopy: [] });
      setDraft({});
      toast.success(t("admin.copy.reset_done"));
    } catch (cause) {
      toast.error(describeError(cause, t, lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("admin.copy.search")}
            className="ps-9"
          />
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-bold text-muted-foreground">
          {t("admin.copy.count", {
            edited: editedCount,
            total: COPY_KEYS.length,
          })}
        </span>
        <Button type="button" variant="outline" className="gap-1.5" disabled={busy} onClick={() => void reset()}>
          <RotateCcw className="size-3.5" aria-hidden />
          {t("admin.copy.reset")}
        </Button>
        <Button type="button" className="gap-1.5" disabled={busy} onClick={() => void save()}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {t("common.save")}
        </Button>
      </div>

      <p className="rounded-xl border border-border/60 bg-muted/30 p-3 text-[11px] leading-5 text-muted-foreground">
        {t("admin.copy.hint")}
      </p>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto pe-1">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("admin.copy.empty")}
          </p>
        ) : null}
        {groupLabelKeys(visible).map((group) => (
          <div key={group.name} className="space-y-2">
            <p className="text-[11px] font-black tracking-wide text-muted-foreground uppercase">
              {group.name}
            </p>
            {group.keys.map((key) => {
              const value = valueFor(key);
              const fallback = defaultsFor(key);
              const changed = value.en !== fallback.en || value.ar !== fallback.ar;
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-xl border p-3",
                    changed ? "border-primary/40 bg-primary/5" : "border-border/70",
                  )}
                >
                  <p className="mb-2 font-mono text-[10px] text-muted-foreground">{key}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      dir="ltr"
                      value={value.en}
                      placeholder={fallback.en}
                      onChange={(event) => setValue(key, "en", event.target.value)}
                    />
                    <Input
                      dir="rtl"
                      value={value.ar}
                      placeholder={fallback.ar}
                      onChange={(event) => setValue(key, "ar", event.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function groupLabelKeys(keys: string[]): { name: string; keys: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const key of keys) {
    const name = groupOf(key);
    const bucket = groups.get(name);
    if (bucket) bucket.push(key);
    else groups.set(name, [key]);
  }
  return [...groups.entries()].map(([name, groupKeys]) => ({ name, keys: groupKeys }));
}
