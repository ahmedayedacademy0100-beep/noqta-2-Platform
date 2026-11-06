import { PublicShell } from "@/components/app/AppShell";
import { ForbiddenScreen } from "@/components/app/ui";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { useQuery } from "convex/react";

export default function Forbidden() {
  const { t, pick } = useI18n();
  const status = useQuery(api.profiles.platformStatus);
  const schoolName = status?.settings
    ? pick(status.settings.schoolNameEn, status.settings.schoolNameAr)
    : t("app.name");

  return (
    <PublicShell schoolName={schoolName}>
      <ForbiddenScreen />
    </PublicShell>
  );
}
