import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useEffect } from "react";
import { useLocation } from "react-router";

/**
 * Counts one visit per page per browser session (signed in or not). The server
 * attributes signed-in visits to the visitor's classes and teachers, so the
 * owner's analytics screen can break usage down per class and per teacher
 * without keeping an event log. Failures are ignored: analytics must never
 * break navigation.
 */
export function AnalyticsTracker() {
  const location = useLocation();
  const recordVisit = useMutation(api.analytics.recordVisit);

  useEffect(() => {
    const key = `nq.visit.${location.pathname}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Private mode without storage: count the visit once per mount instead.
    }
    void recordVisit({}).catch(() => undefined);
  }, [location.pathname, recordVisit]);

  return null;
}
