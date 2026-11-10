/**
 * Google AdSense unit.
 *
 * Renders only when the super admin switched ads on in Settings and BOTH the
 * publisher id and the ad slot id are configured — an `<ins>` without a slot
 * is never requested, because AdSense answers it with a "missing data-ad-slot"
 * error and a permanently blank box.
 *
 * Super admins never see the slot themselves, so staff browsing the portal
 * stay distraction-free and the school's own accounts do not burn impressions.
 * The focused exam screen does not include this component, so ads can never
 * appear inside a live assessment.
 */
import { api } from "@/convex/_generated/api";
import { useProfile } from "@/hooks/use-profile";
import { useI18n } from "@/i18n";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_SCRIPT_ID = "adsense-script";

/** Inject the AdSense loader once per client id, per page load. The loader is
 *  also present in index.html, so this only fills in if that tag is missing. */
function ensureAdsenseScript(client: string) {
  if (typeof document === "undefined") return;
  if (document.getElementById(ADSENSE_SCRIPT_ID)) return;
  if (document.querySelector('script[src*="adsbygoogle.js"]')) return;
  const script = document.createElement("script");
  script.id = ADSENSE_SCRIPT_ID;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(script);
}

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
  const container = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const recordAdImpression = useMutation(api.analytics.recordAdImpression);

  const adsEnabled = status?.settings?.adsEnabled ?? false;
  const clientId = status?.settings?.adsensePublisherId ?? null;
  const slotId = status?.settings?.adsenseSlotId ?? null;
  const visible = adsEnabled && clientId !== null && slotId !== null && !isAdmin;

  useEffect(() => {
    if (!visible || !clientId) return;
    ensureAdsenseScript(clientId);
  }, [visible, clientId]);

  // One request per unit. AdSense stamps `data-adsbygoogle-status` on the
  // <ins> it has processed, so checking the DOM (instead of a ref) also keeps
  // React's StrictMode double-mount in development from pushing twice — a
  // second push is what produces "already have ads in them" errors.
  useEffect(() => {
    if (!visible) return;
    const node = container.current?.querySelector<HTMLElement>("ins.adsbygoogle");
    if (!node) return;
    if (node.getAttribute("data-adsbygoogle-status")) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // The loader can be blocked by an ad blocker — never break the page.
    }
  }, [visible]);

  // Count a real view: the unit must be at least half on screen AND actually
  // filled by AdSense. Unfilled or blocked units record nothing, so the
  // owner's numbers reflect served ads rather than empty boxes.
  useEffect(() => {
    if (!visible) return;
    const node = container.current?.querySelector<HTMLElement>("ins.adsbygoogle");
    if (!node) return;
    const key = `nq.ad.${location.pathname}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
    } catch {
      // Storage unavailable: still measure the current view.
    }

    let counted = false;
    const count = () => {
      if (counted) return;
      if (node.getAttribute("data-ad-status") !== "filled") return;
      counted = true;
      try {
        window.sessionStorage.setItem(key, "1");
      } catch {
        // Ignore storage failures.
      }
      void recordAdImpression({}).catch(() => undefined);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        count();
        if (counted) observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(node);

    // The unit usually fills after the observer fires, so wait for the status.
    const watcher = new MutationObserver(count);
    watcher.observe(node, {
      attributes: true,
      attributeFilter: ["data-ad-status"],
    });

    return () => {
      observer.disconnect();
      watcher.disconnect();
    };
  }, [visible, location.pathname, recordAdImpression]);

  if (!visible || clientId === null || slotId === null) return null;

  return (
    <div ref={container} className={className}>
      <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground/60">
        {t("common.ad")}
      </p>
      <ins
        className="adsbygoogle block"
        style={{ minHeight }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
