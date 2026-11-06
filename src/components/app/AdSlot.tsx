import { api } from "@/convex/_generated/api";
import { useProfile } from "@/hooks/use-profile";
import { useI18n } from "@/i18n";
import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_SCRIPT_ID = "adsense-script";

/** Inject the AdSense loader once per client id, per page load. */
function ensureAdsenseScript(client: string) {
  if (typeof document === "undefined") return;
  if (document.getElementById(ADSENSE_SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = ADSENSE_SCRIPT_ID;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(script);
}

/**
 * A Google AdSense unit.
 *
 * Renders only when the super admin switched ads on in Settings and a
 * publisher ID is configured — a fresh install never shows ads. Super admins
 * never see the slot themselves, so staff browsing the portal stay
 * distraction-free (and AdSense impressions are not wasted on the school's
 * own accounts).
 *
 * The focused exam-taking screen does not include this component, so ads can
 * never appear inside a live assessment.
 */
export function AdSlot({
  className,
  format = "auto",
  minHeight = 120,
}: {
  className?: string;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  minHeight?: number;
}) {
  const { t } = useI18n();
  const { isAdmin } = useProfile();
  const status = useQuery(api.profiles.platformStatus);
  const pushed = useRef(false);

  const adsEnabled = status?.settings?.adsEnabled ?? false;
  const clientId = status?.settings?.adsensePublisherId ?? null;
  const slotId = status?.settings?.adsenseSlotId ?? null;
  const visible = adsEnabled && clientId !== null && !isAdmin;

  useEffect(() => {
    if (!visible || !clientId) return;
    ensureAdsenseScript(clientId);
  }, [visible, clientId]);

  useEffect(() => {
    if (!visible || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // The loader can be blocked by ad blockers — never break the page.
    }
  }, [visible]);

  if (!visible || clientId === null) return null;

  return (
    <div className={className}>
      <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground/60">
        {t("common.ad")}
      </p>
      <ins
        className="adsbygoogle block"
        style={{ minHeight }}
        data-ad-client={clientId}
        data-ad-slot={slotId ?? undefined}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
