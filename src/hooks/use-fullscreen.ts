import { useCallback, useEffect, useState } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
  msFullscreenElement?: Element | null;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

function currentFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.msFullscreenElement ?? null;
}

/**
 * An installed PWA already owns the whole screen, so there is nothing to toggle.
 */
function canUseFullscreen() {
  if (typeof document === "undefined") return false;
  const doc = document as FullscreenDocument;
  const element = document.documentElement as FullscreenElement;
  const enabled = Boolean(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
  const canRequest = Boolean(
    element.requestFullscreen ?? element.webkitRequestFullscreen ?? element.msRequestFullscreen,
  );
  const alreadyImmersive =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: fullscreen) and (pointer: coarse)").matches;
  return enabled && canRequest && !alreadyImmersive;
}

/**
 * Browser fullscreen, with the WebKit prefixed API for older Safari and a
 * graceful "unsupported" answer for iOS Safari (where elements cannot go
 * fullscreen at all — the toggle is simply hidden there).
 */
export function useFullscreen() {
  // Computed once on mount; both values come from the browser, not from React.
  const [isSupported] = useState(canUseFullscreen);
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== "undefined" && Boolean(currentFullscreenElement()),
  );

  useEffect(() => {
    // Updates arrive from the browser's own fullscreen events, never from render.
    const sync = () => setIsFullscreen(Boolean(currentFullscreenElement()));
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggle = useCallback(async () => {
    const doc = document as FullscreenDocument;
    try {
      if (currentFullscreenElement()) {
        const exit = doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc);
        await exit?.();
        return;
      }
      const element = document.documentElement as FullscreenElement;
      const request =
        element.requestFullscreen?.bind(element) ??
        element.webkitRequestFullscreen?.bind(element) ??
        element.msRequestFullscreen?.bind(element);
      await request?.();
    } catch {
      // A refused fullscreen (permissions, iOS, iframe without allowfullscreen)
      // must never break the page — the layout is already viewport-adaptive.
    }
  }, []);

  return { isFullscreen, isSupported, toggle };
}
