import { PublicShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useProfile } from "@/hooks/use-profile";
import { useI18n } from "@/i18n";
import { useQuery } from "convex/react";
import { Compass } from "lucide-react";
import { Link } from "react-router";

export default function NotFound() {
  const { t, pick } = useI18n();
  const status = useQuery(api.profiles.platformStatus);
  const { profile } = useProfile();
  const schoolName = status?.settings
    ? pick(status.settings.schoolNameEn, status.settings.schoolNameAr)
    : t("app.name");

  return (
    <PublicShell schoolName={schoolName}>
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="surface w-full max-w-md p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Compass className="size-5" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold">{t("notfound.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("notfound.body")}</p>
          <div className="mt-6 flex flex-col gap-2">
            {profile ? (
              <Button asChild>
                <Link to="/dashboard">{t("forbidden.cta")}</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link to="/auth">{t("auth.signin.button")}</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
