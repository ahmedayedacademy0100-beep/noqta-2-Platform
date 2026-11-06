import { Button } from "@/components/ui/button";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useI18n } from "@/i18n";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * Immersive view for desktops and phones. Renders nothing when the browser
 * cannot put an element fullscreen (iOS Safari, or a sandboxed iframe).
 */
export function FullscreenToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const { isFullscreen, isSupported, toggle } = useFullscreen();
  if (!isSupported) return null;
  const label = isFullscreen ? t("nq.exit_fullscreen") : t("nq.fullscreen");
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => void toggle()}
      aria-label={label}
      title={label}
      aria-pressed={isFullscreen}
      className={className}
    >
      {isFullscreen ? (
        <Minimize2 className="size-4" aria-hidden />
      ) : (
        <Maximize2 className="size-4" aria-hidden />
      )}
    </Button>
  );
}
