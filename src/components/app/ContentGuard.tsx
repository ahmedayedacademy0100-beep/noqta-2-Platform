import { api } from "@/convex/_generated/api";
import { useProfile } from "@/hooks/use-profile";
import { useI18n } from "@/i18n";
import { useQuery } from "convex/react";
import { ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Best-effort content protection for students and teachers.
 *
 * What this really does: disables text selection/copying, the context menu,
 * dragging and the usual copy/print shortcuts, and covers the screen the moment
 * the window loses focus (so screenshot and screen-recording tools that need the
 * window active capture the shield, not the questions).
 *
 * What no web page can do: block an OS-level screenshot (Print Screen, iOS
 * buttons) — the browser has no access to that. This is a deterrent, not DRM.
 * Super admins are exempt so the owner can always copy their own content.
 *
 * The diagonal name/email watermark was removed on request: students and
 * teachers found it distracting, and it covered the very questions it was meant
 * to protect. The copy/shortcut blocks and the focus shield stay.
 */
export function ContentGuard() {
  const { t } = useI18n();
  const { profile } = useProfile();
  const status = useQuery(api.profiles.platformStatus);
  const enabled = status?.settings?.contentProtectionEnabled ?? true;
  const active = enabled && Boolean(profile && profile.role !== "super_admin");
  const [shielded, setShielded] = useState(false);

  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.classList.add("nq-guarded");

    const block = (event: Event) => event.preventDefault();
    const blockKeys = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (["c", "x", "s", "a", "p", "u"].includes(key)) {
        event.preventDefault();
      }
    };
    const hide = () => setShielded(true);
    const reveal = () => {
      if (document.visibilityState !== "hidden") setShielded(false);
    };
    const onVisibility = () =>
      document.visibilityState === "hidden" ? setShielded(true) : reveal();

    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("keydown", blockKeys);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", hide);
    window.addEventListener("focus", reveal);

    return () => {
      root.classList.remove("nq-guarded");
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("keydown", blockKeys);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", reveal);
    };
  }, [active]);

  if (!active) return null;

  return (
    <>
      {shielded ? (
        <div
          className="nq-shield cursor-pointer"
          role="alertdialog"
          aria-live="assertive"
          onClick={() => setShielded(false)}
        >
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-white/15">
              <ShieldAlert className="size-7" aria-hidden />
            </span>
            <p className="text-base font-bold">{t("nq.protect.title")}</p>
            <p className="text-sm leading-6 text-white/80">
              {t("nq.protect.body")}
            </p>
            <p className="text-xs font-semibold text-white/60">
              {t("nq.protect.resume")}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
