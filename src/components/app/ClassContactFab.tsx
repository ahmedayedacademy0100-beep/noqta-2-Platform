import { api } from "@/convex/_generated/api";
import { useProfile } from "@/hooks/use-profile";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";

/** WhatsApp glyph (lucide has no brand icons, so it is inlined). */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.03 1-.98 2.42.05 1.42 1.03 2.79 1.18 2.99.15.2 2.03 3.24 4.94 4.42.69.3 1.23.47 1.65.6.7.22 1.33.19 1.83.12.56-.09 1.72-.7 1.96-1.38.25-.67.25-1.25.17-1.37-.07-.12-.27-.2-.57-.35Z" />
      <path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.44 1.32 4.93L2 22l5.36-1.4a9.83 9.83 0 0 0 4.68 1.19h.01c5.43 0 9.84-4.4 9.84-9.84C21.89 6.4 17.48 2 12.04 2Zm0 17.94a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.06.8.82-2.99-.19-.31a8.09 8.09 0 0 1-1.24-4.3c0-4.48 3.65-8.12 8.13-8.12 2.17 0 4.21.85 5.74 2.38a8.05 8.05 0 0 1 2.38 5.75c0 4.48-3.65 8.12-8.14 8.12Z" />
    </svg>
  );
}

/**
 * Floating contact button for students.
 *
 * The number belongs to the student's *class*: an administrator sets one per
 * class (e.g. the "Grade 7 – A" number), and every student in it opens the same
 * chat. The button stays visible when a class has no number yet and explains
 * who to ask, instead of silently disappearing.
 */
export function ClassContactFab() {
  const { t, pick, isRtl } = useI18n();
  const { profile } = useProfile();
  const isStudent = profile?.role === "student";
  const contact = useQuery(api.student.myClassContact, isStudent ? {} : "skip");
  const [expanded, setExpanded] = useState(false);

  if (!isStudent || contact === undefined || contact === null) return null;

  const className = pick(contact.classNameEn, contact.classNameAr);
  const raw = contact.whatsapp?.replace(/[^0-9]/g, "") ?? "";
  const href = raw
    ? `https://wa.me/${raw}?text=${encodeURIComponent(
        t("student.contact_class.message", { className }),
      )}`
    : null;
  const label = t("student.contact_class", { className });

  const handleClick = () => {
    if (!href) {
      toast.message(t("student.contact_class.missing"));
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.6, type: "spring", stiffness: 260, damping: 20 }}
      className={cn(
        // Sit above the student tab bar on phones, clear of it on desktop.
        "fixed bottom-24 z-40 flex items-center gap-2 lg:bottom-5",
        isRtl ? "left-5 flex-row-reverse" : "right-5",
      )}
    >
      <motion.button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={() => setExpanded(false)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label={label}
        className={cn(
          "relative grid size-14 place-items-center rounded-full text-white shadow-lg shadow-emerald-600/30",
          "bg-gradient-to-br from-emerald-500 to-emerald-600 focus-visible:ring-3 focus-visible:ring-emerald-400/60 focus-visible:outline-none",
          !href && "from-muted-foreground/70 to-muted-foreground",
        )}
      >
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-emerald-500/30" aria-hidden />
        <WhatsAppIcon className="size-7" />
      </motion.button>

      <motion.div
        initial={false}
        animate={{
          opacity: expanded ? 1 : 0,
          x: expanded ? 0 : isRtl ? 8 : -8,
          width: expanded ? "auto" : 0,
        }}
        transition={{ duration: 0.18 }}
        className="hidden overflow-hidden sm:block"
      >
        <span className="surface-muted inline-flex max-w-56 items-center gap-1.5 truncate px-3 py-2 text-xs font-medium shadow-sm">
          {t("student.contact_class.short")} · {className}
        </span>
      </motion.div>
    </motion.div>
  );
}
