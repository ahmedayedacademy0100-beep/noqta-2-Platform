import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { QueryBoundary } from "@/components/app/ui";
import { AdSlot } from "@/components/app/AdSlot";
import { ClassContactFab } from "@/components/app/ClassContactFab";
import { api } from "@/convex/_generated/api";
import logo from "@/assets/logo.svg";
import { FullscreenToggle } from "@/components/app/FullscreenToggle";
import { useProfile, type ProfileRole } from "@/hooks/use-profile";
import { useI18n, type Language } from "@/i18n";

import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Activity,
  Bell,
  BookOpenCheck,
  CalendarClock,
  ChartLine,
  ChevronDown,
  ClipboardList,
  Cog,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router";
import { useAuth } from "@/hooks/use-auth";

type NavItem = { to: string; labelKey: string; icon: LucideIcon; end?: boolean };

function navItemsFor(role: ProfileRole): NavItem[] {
  if (role === "student") {
    return [
      { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, end: true },
      { to: "/assessments", labelKey: "nav.assessments", icon: ClipboardList },
      { to: "/homework", labelKey: "nav.homework", icon: BookOpenCheck },
      { to: "/games", labelKey: "nav.games", icon: Gamepad2 },
      { to: "/progress", labelKey: "nav.progress", icon: ChartLine },
      { to: "/achievements", labelKey: "nav.achievements", icon: Trophy },
      { to: "/results", labelKey: "nav.results", icon: Target },
      { to: "/notifications", labelKey: "nav.notifications", icon: Bell },
      { to: "/profile", labelKey: "nav.profile", icon: UserRound },
    ];
  }
  if (role === "teacher") {
    return [
      { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, end: true },
      { to: "/teacher/assessments", labelKey: "nav.teacher.assessments", icon: ClipboardList },
      { to: "/teacher/question-bank", labelKey: "nav.teacher.question_bank", icon: BookOpenCheck },
      { to: "/teacher/grading", labelKey: "nav.teacher.grading", icon: PenLine },
      { to: "/teacher/students", labelKey: "nav.teacher.students", icon: Users },
      { to: "/teacher/games", labelKey: "nav.teacher.games", icon: Gamepad2 },
      { to: "/notifications", labelKey: "nav.notifications", icon: Bell },
      { to: "/profile", labelKey: "nav.profile", icon: UserRound },
    ];
  }
  return [
    { to: "/dashboard", labelKey: "nav.admin.overview", icon: LayoutDashboard, end: true },
    { to: "/admin/users", labelKey: "nav.admin.users", icon: Users },
    { to: "/admin/academics", labelKey: "nav.admin.academics", icon: GraduationCap },
    { to: "/admin/oversight", labelKey: "nav.admin.oversight", icon: ShieldCheck },
    { to: "/admin/reports", labelKey: "nav.admin.reports", icon: ChartLine },
    { to: "/admin/analytics", labelKey: "nav.admin.analytics", icon: Activity },
    { to: "/admin/audit", labelKey: "nav.admin.audit", icon: ScrollText },
    { to: "/admin/settings", labelKey: "nav.admin.settings", icon: Cog },
    { to: "/notifications", labelKey: "nav.notifications", icon: Bell },
    { to: "/profile", labelKey: "nav.profile", icon: UserRound },
  ];
}

function NavList({
  role,
  onNavigate,
  collapsed = false,
}: {
  role: ProfileRole;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { t } = useI18n();
  return (
    <nav className={cn("flex flex-col gap-1", collapsed && "items-stretch")}>
      {navItemsFor(role).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          title={collapsed ? t(item.labelKey) : undefined}
          aria-label={t(item.labelKey)}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
              collapsed && "justify-center px-0",
              isActive
                ? "text-white"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive ? (
                <motion.span
                  layoutId={`nav-active-${role}`}
                  className="nq-nav-active absolute inset-0 rounded-xl"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  aria-hidden
                />
              ) : null}
              <item.icon
                className={cn(
                  "relative size-[18px] shrink-0 transition-transform duration-200",
                  "group-hover:scale-110",
                )}
                aria-hidden
              />
              {collapsed ? null : (
                <>
                  <span className="relative truncate">{t(item.labelKey)}</span>
                  {isActive ? (
                    <span
                      className="relative ms-auto size-1.5 rounded-full bg-white/80"
                      aria-hidden
                    />
                  ) : null}
                </>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * The platform identity: the owner can replace the name, tagline and logo from
 * Admin → Settings, and every shell (portal + signed-out pages) picks it up.
 */
function Brand({ schoolName }: { schoolName?: string }) {
  const { t, pick } = useI18n();
  const status = useQuery(api.profiles.platformStatus);
  const settings = status?.settings;
  const name = settings
    ? pick(settings.schoolNameEn, settings.schoolNameAr)
    : (schoolName ?? t("app.name"));
  const tagline = settings
    ? (settings.taglineAr ?? "")
        ? pick(settings.taglineEn, settings.taglineAr)
        : (settings.taglineEn ?? t("app.tagline"))
    : t("app.tagline");
  const customLogo = Boolean(settings?.logoUrl);
  return (
    <Link
      to="/"
      aria-label={name}
      className="flex min-w-0 items-center gap-2.5 rounded-xl transition-opacity hover:opacity-85"
    >
      <img
        src={settings?.logoUrl ?? logo}
        alt={name}
        className={cn(
          "h-9 shrink-0",
          customLogo
            ? "w-auto max-w-[130px] rounded-lg object-contain"
            : "w-auto",
        )}
        width={customLogo ? undefined : 174}
        height={customLogo ? undefined : 192}
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {tagline}
        </span>
      </span>
    </Link>
  );
}

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLanguage, t } = useI18n();
  const updateProfile = useMutation(api.profiles.updateMyProfile);
  const next: Language = lang === "ar" ? "en" : "ar";
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 px-2.5"
      onClick={() => {
        setLanguage(next);
        // Best effort: remember the preference on the account as well.
        void updateProfile({ language: next }).catch(() => undefined);
      }}
      aria-label={t("common.language")}
    >
      <span className="text-xs font-semibold">{lang === "ar" ? "AR" : "EN"}</span>
      <span
        className={
          compact
            ? "hidden text-xs text-muted-foreground sm:inline"
            : "text-xs text-muted-foreground"
        }
      >
        {lang === "ar" ? "العربية" : "English"}
      </span>
    </Button>
  );
}

export { FullscreenToggle };

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {isDark ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
    </Button>
  );
}

export function AppShell() {
  const { t, pick, isRtl } = useI18n();
  const { profile, isLoading: profileLoading } = useProfile();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  /** Students can fold the sidebar down to icons; the choice is remembered. */
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("nq.sidebar.collapsed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("nq.sidebar.collapsed", collapsed ? "1" : "0");
    } catch {
      // Storage is optional; the layout still works for this session.
    }
  }, [collapsed]);
  /** Set the moment we start signing out so no page query re-runs signed-out. */
  const [signingOut, setSigningOut] = useState(false);
  const unread = useQuery(api.student.unreadCount);
  const status = useQuery(api.profiles.platformStatus);

  useEffect(() => {
    const root = document.documentElement;
    const title = status?.settings
      ? pick(status.settings.schoolNameEn, status.settings.schoolNameAr)
      : t("app.name");
    root.dataset.school = title;
  }, [status, pick, t]);

  if (!profile) {
    // Signed out (or the profile was revoked): leave the portal immediately
    // instead of rendering a shell whose queries would fail.
    if (!profileLoading) {
      return <Navigate to="/auth" replace />;
    }
    return null;
  }

  const schoolName = status?.settings
    ? pick(status.settings.schoolNameEn, status.settings.schoolNameAr)
    : t("app.name");

  const handleSignOut = async () => {
    // Tear the shell down first: once the session is gone every mounted query
    // would throw, which is what used to surface as an error on the dashboard.
    setSigningOut(true);
    setMobileOpen(false);
    try {
      await signOut();
    } catch {
      // An already-expired session is fine; the redirect below is what matters.
    } finally {
      // Signal to the auth page that we just signed out so it doesn't
      // immediately redirect back to the dashboard.
      navigate("/auth?justSignedOut=1", { replace: true });
    }
  };

  if (signingOut) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("nav.signout")}
        </div>
      </div>
    );
  }

  return (
    <div className="nq-safe-x min-h-dvh overflow-x-clip bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] 2xl:max-w-[1840px]">
        <aside
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 flex-col justify-between border-e border-border/70 bg-sidebar/60 px-3 py-4 transition-[width] duration-300 lg:flex",
            collapsed ? "w-[76px]" : "w-64 2xl:w-72",
          )}
        >
          <div className="space-y-6">
            {collapsed ? (
              <Link
                to="/dashboard"
                className="mx-auto grid size-10 place-items-center rounded-xl bg-primary/10"
                aria-label={schoolName}
              >
                <img src={logo} alt="" className="h-7 w-auto" aria-hidden />
              </Link>
            ) : (
              <Brand schoolName={schoolName} />
            )}
            <NavList role={profile.role} collapsed={collapsed} />
            {profile.role === "student" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCollapsed((value) => !value)}
                className={cn(
                  "w-full gap-2 text-muted-foreground",
                  collapsed && "justify-center px-0",
                )}
                aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
                title={collapsed ? t("nav.expand") : t("nav.collapse")}
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-4" aria-hidden />
                ) : (
                  <PanelLeftClose className="size-4" aria-hidden />
                )}
                {collapsed ? null : (
                  <span className="text-xs">{t("nav.collapse")}</span>
                )}
              </Button>
            ) : null}
          </div>
          <div className="space-y-3">
            {profile.isDemo && !collapsed ? (
              <Badge
                variant="outline"
                className="w-full justify-center border-dashed border-chart-4/60 bg-chart-4/10 text-[10px] font-semibold tracking-wide text-chart-4 uppercase"
              >
                {t("common.demo_badge")}
              </Badge>
            ) : null}
            <div
              className={cn(
                "surface-muted flex items-center gap-3 p-3",
                collapsed && "justify-center p-2",
              )}
            >
              <span className="nq-gradient grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white shadow-[0_6px_16px_-10px_rgb(52_120_246/0.9)]">
                {profile.name.slice(0, 1).toUpperCase()}
              </span>
              {collapsed ? null : (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{profile.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t(`roles.${profile.role}`)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
            <div className="flex items-center gap-2.5 px-4 py-3 sm:px-6">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden">
                    <Menu className="size-4" aria-hidden />
                    <span className="sr-only">{t("nav.dashboard")}</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side={isRtl ? "right" : "left"} className="w-72 p-4">
                  <SheetTitle className="sr-only">{t("app.name")}</SheetTitle>
                  <div className="space-y-5">
                    <Brand schoolName={schoolName} />
                    <NavList
                      role={profile.role}
                      onNavigate={() => setMobileOpen(false)}
                    />
                    {/* Phones keep their controls here, so the top bar stays clean. */}
                    <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                      <LanguageToggle />
                      <ThemeToggle />
                      <FullscreenToggle />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1 lg:hidden">
                <Brand schoolName={schoolName} />
              </div>

              <div className="flex items-center gap-2">
                {profile.role === "student" ? (
                  <Link
                    to="/progress"
                    className="hidden items-center gap-1.5 rounded-xl border border-nq-yellow/40 bg-nq-yellow/12 px-2.5 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-nq-yellow/20 sm:inline-flex dark:text-nq-yellow"
                    aria-label={t("student.points")}
                  >
                    <Sparkles className="size-3.5" aria-hidden />
                    {profile.points}
                  </Link>
                ) : null}
                <span className="hidden sm:inline-flex">
                  <FullscreenToggle />
                </span>
                <LanguageToggle />
                <ThemeToggle />
                <Button variant="outline" size="icon" asChild className="relative">
                  <Link to="/notifications" aria-label={t("nav.notifications")}>
                    <Bell className="size-4" aria-hidden />
                    {unread ? (
                      <span className="nq-gradient absolute -end-1 -top-1 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-background">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    ) : null}
                  </Link>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <span className="grid size-5 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {profile.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="hidden max-w-32 truncate sm:inline">
                        {profile.name}
                      </span>
                      <ChevronDown className="size-3.5 opacity-60" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="space-y-0.5">
                      <span className="block truncate text-sm">{profile.name}</span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {profile.email}
                      </span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="cursor-pointer">
                        <UserRound className="size-4" aria-hidden />
                        {t("nav.profile")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard" className="cursor-pointer">
                        <LayoutDashboard className="size-4" aria-hidden />
                        {t("nav.dashboard")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => void handleSignOut()}
                      className="cursor-pointer"
                    >
                      <LogOut className="size-4" aria-hidden />
                      {t("nav.signout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main
            className={cn(
              "flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
              profile.role === "student" && "pb-28 lg:pb-8",
            )}
          >
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto w-full max-w-6xl space-y-6 xl:max-w-7xl 2xl:max-w-[1400px]"
            >
              <QueryBoundary>
                <Outlet />
              </QueryBoundary>
            </motion.div>
          </main>

          {/* Admin-controlled AdSense slot (never on the exam screen). */}
          <div className="px-4 pb-2 sm:px-6 lg:px-8">
            <AdSlot className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1400px]" />
          </div>

          <footer className="border-t border-border/60 px-4 py-4 text-xs text-muted-foreground sm:px-6">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 xl:max-w-7xl 2xl:max-w-[1400px]">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" aria-hidden />
                {t("app.tagline")}
              </span>
              {profile.isDemo ? <span>{t("profile.demo_notice")}</span> : null}
            </div>
          </footer>
        </div>
      </div>
      {/* Students get a thumb-friendly tab bar; staff keep the sidebar only. */}
      {profile.role === "student" ? <StudentTabBar /> : null}

      <AnimatePresence>
        <ClassContactFab />
      </AnimatePresence>
    </div>
  );
}

function StudentTabBar() {
  const { t } = useI18n();
  // Five thumb-sized destinations; everything else stays in the sidebar/menu.
  const primary = ["/dashboard", "/assessments", "/homework", "/games", "/achievements"];
  const items = navItemsFor("student").filter((item) => primary.includes(item.to));
  return (
    <nav
      aria-label={t("app.name")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="group relative flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-semibold transition-colors"
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <motion.span
                    layoutId="student-tab-pill"
                    className="nq-nav-active absolute inset-x-1.5 inset-y-1 rounded-xl"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    aria-hidden
                  />
                ) : null}
                <item.icon
                  className={cn(
                    "relative size-[18px] transition-transform duration-200 group-active:scale-90",
                    isActive ? "text-white" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "relative truncate",
                    isActive ? "text-white" : "text-muted-foreground",
                  )}
                >
                  {t(item.labelKey)}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Signed-out shell used by the auth screens. */
export function PublicShell({
  children,
  schoolName,
}: {
  children: React.ReactNode;
  schoolName?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="nq-safe-x flex min-h-dvh flex-col overflow-x-clip bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 xl:max-w-7xl">
          <Brand schoolName={schoolName} />
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex">
              <FullscreenToggle />
            </span>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      {/* Admin-controlled AdSense slot on public pages too (auth screen). */}
      <div className="px-4 sm:px-6">
        <AdSlot className="mx-auto w-full max-w-6xl xl:max-w-7xl" />
      </div>
      <footer className="border-t border-border/60 px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between xl:max-w-7xl">
          <span>{t("app.footer.note")}</span>
          <span>{schoolName ?? t("app.name")}</span>
        </div>
      </footer>
    </div>
  );
}
