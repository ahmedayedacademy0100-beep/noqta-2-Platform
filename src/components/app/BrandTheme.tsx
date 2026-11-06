import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { useQuery } from "convex/react";
import { useEffect } from "react";

const DEFAULT_GRADIENT =
  "linear-gradient(120deg, #4169ff 0%, #6d63ff 46%, #8b5cf6 100%)";

/** Black or white text, whichever stays readable on the chosen brand color. */
function readableOn(hex: string): string {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.45 ? "#171b38" : "#ffffff";
}

/**
 * Applies the platform owner's identity to the whole document: page title,
 * favicon, brand colors and the logo. Admin → Settings is the only writer.
 */
export function BrandTheme() {
  const { pick } = useI18n();
  const status = useQuery(api.profiles.platformStatus);
  const settings = status?.settings;

  useEffect(() => {
    const root = document.documentElement;
    const name = settings
      ? pick(settings.schoolNameEn, settings.schoolNameAr)
      : "";
    if (name) document.title = name;

    const primary = settings?.brandPrimary ?? null;
    const accent = settings?.brandAccent ?? null;

    if (primary) {
      root.style.setProperty("--nq-blue", primary);
      root.style.setProperty("--primary", primary);
      root.style.setProperty("--ring", primary);
      root.style.setProperty("--primary-foreground", readableOn(primary));
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--primary-foreground");
    }

    if (accent) {
      root.style.setProperty("--nq-violet", accent);
    } else {
      root.style.removeProperty("--nq-violet");
    }

    root.style.setProperty(
      "--nq-gradient",
      primary || accent
        ? `linear-gradient(120deg, ${primary ?? "#4169ff"} 0%, ${accent ?? "#8b5cf6"} 100%)`
        : DEFAULT_GRADIENT,
    );

    const logoUrl = settings?.logoUrl;
    if (logoUrl) {
      let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!icon) {
        icon = document.createElement("link");
        icon.rel = "icon";
        document.head.appendChild(icon);
      }
      icon.href = logoUrl;
    }
  }, [settings, pick]);

  return null;
}
