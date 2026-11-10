import "@vly-ai/integrations";
import { AnalyticsTracker } from "@/components/app/AnalyticsTracker";
import { AppShell } from "@/components/app/AppShell";
import { BrandTheme } from "@/components/app/BrandTheme";
import { ContentGuard } from "@/components/app/ContentGuard";
import { RoleGuard } from "@/components/app/ui";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/i18n";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
} from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const LandingPage = lazy(() => import("./pages/Landing.tsx"));
const PrivacyPage = lazy(() => import("@/pages/Privacy"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const NotificationsPage = lazy(() => import("./pages/Notifications.tsx"));
const ProfilePage = lazy(() => import("./pages/Profile.tsx"));
const Forbidden = lazy(() => import("./pages/Forbidden.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const StudentAssessments = lazy(() => import("./pages/student/StudentAssessments.tsx"));
const StudentAssessmentDetail = lazy(
  () => import("./pages/student/StudentAssessmentDetail.tsx"),
);
const TakeAssessment = lazy(() => import("./pages/student/TakeAssessment.tsx"));
const StudentResults = lazy(() => import("./pages/student/StudentResults.tsx"));
const StudentResultDetail = lazy(
  () => import("./pages/student/StudentResultDetail.tsx"),
);
const StudentProgress = lazy(() => import("./pages/student/StudentProgress.tsx"));
const StudentHomework = lazy(() => import("./pages/student/StudentHomework.tsx"));
const StudentGames = lazy(() => import("./pages/student/StudentGames.tsx"));
const StudentAchievements = lazy(
  () => import("./pages/student/StudentAchievements.tsx"),
);
const TeacherAssessments = lazy(
  () => import("./pages/teacher/TeacherAssessments.tsx"),
);
const AssessmentBuilder = lazy(() => import("./pages/teacher/AssessmentBuilder.tsx"));
const QuestionBank = lazy(() => import("./pages/teacher/QuestionBank.tsx"));
const ClassGames = lazy(() => import("./pages/teacher/ClassGames.tsx"));
const GradingQueue = lazy(() => import("./pages/teacher/GradingQueue.tsx"));
const GradingDetail = lazy(() => import("./pages/teacher/GradingDetail.tsx"));
const AssessmentAnalytics = lazy(
  () => import("./pages/teacher/AssessmentAnalytics.tsx"),
);
const TeacherStudents = lazy(() => import("./pages/teacher/TeacherStudents.tsx"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers.tsx"));
const AdminAcademics = lazy(() => import("./pages/admin/AdminAcademics.tsx"));
const AdminOversight = lazy(() => import("./pages/admin/AdminOversight.tsx"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports.tsx"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics.tsx"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit.tsx"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="animate-pulse text-sm text-muted-foreground">Loading…</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
          <div className="max-w-lg text-center">
            <p className="text-base font-bold">حدث خطأ غير متوقع</p>
            <p className="text-sm font-semibold text-muted-foreground">
              Something went wrong
            </p>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              أعد تحميل الصفحة للمتابعة. إن تكرر الخطأ فأبلغ المعلم أو مسؤول
              المنصة بنص التفاصيل أدناه.
              <br />
              Reload the page to continue. If it happens again, send the details
              below to your teacher or the platform admin.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                إعادة التحميل · Reload
              </button>
              <a
                href="/dashboard"
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
              >
                لوحة التحكم · Dashboard
              </a>
            </div>
            {this.state.message ? (
              <details className="mt-5 text-left">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  تفاصيل تقنية · Technical details
                </summary>
                <p className="mt-2 text-xs break-words text-muted-foreground">
                  {this.state.message}
                </p>
                {this.state.stack ? (
                  <pre className="mt-2 max-h-40 overflow-auto rounded border border-border/60 p-2 text-[10px] leading-4 text-muted-foreground/80">
                    {this.state.stack}
                  </pre>
                ) : null}
              </details>
            ) : null}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

/** Every authenticated page lives inside the shell and behind a role guard.
 *  The backend re-checks every rule, so this only keeps the wrong portal out
 *  of the way. */
function Guarded({
  roles,
  children,
}: {
  roles: ("student" | "teacher" | "super_admin")[];
  children: React.ReactNode;
}) {
  return <RoleGuard roles={roles}>{children}</RoleGuard>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="noor.theme"
        disableTransitionOnChange
      >
        <I18nProvider>
          <ConvexAuthProvider client={convex}>
            <BrowserRouter>
              <BrandTheme />
              <ContentGuard />
              <AnalyticsTracker />
              <RouteSyncer />
              <Suspense fallback={<RouteLoading />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/landing" element={<LandingPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/onboarding" element={<Onboarding />} />

                  <Route element={<AppShell />}>
                    <Route
                      path="/dashboard"
                      element={
                        <Guarded roles={["student", "teacher", "super_admin"]}>
                          <Dashboard />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/assessments"
                      element={
                        <Guarded roles={["student"]}>
                          <StudentAssessments />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/assessments/:assessmentId"
                      element={
                        <Guarded roles={["student"]}>
                          <StudentAssessmentDetail />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/results"
                      element={
                        <Guarded roles={["student"]}>
                          <StudentResults />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/results/:attemptId"
                      element={
                        <Guarded roles={["student"]}>
                          <StudentResultDetail />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/progress"
                      element={
                        <Guarded roles={["student"]}>
                          <StudentProgress />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/homework"
                      element={
                        <Guarded roles={["student"]}>
                          <StudentHomework />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/games"
                      element={
                        <Guarded roles={["student"]}>
                          <StudentGames />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/achievements"
                      element={
                        <Guarded roles={["student"]}>
                          <StudentAchievements />
                        </Guarded>
                      }
                    />

                    <Route
                      path="/teacher/assessments"
                      element={
                        <Guarded roles={["teacher", "super_admin"]}>
                          <TeacherAssessments />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/teacher/assessments/:assessmentId"
                      element={
                        <Guarded roles={["teacher", "super_admin"]}>
                          <AssessmentBuilder />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/teacher/question-bank"
                      element={
                        <Guarded roles={["teacher", "super_admin"]}>
                          <QuestionBank />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/teacher/grading"
                      element={
                        <Guarded roles={["teacher", "super_admin"]}>
                          <GradingQueue />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/teacher/grading/:attemptId"
                      element={
                        <Guarded roles={["teacher", "super_admin"]}>
                          <GradingDetail />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/teacher/analytics/:assessmentId"
                      element={
                        <Guarded roles={["teacher", "super_admin"]}>
                          <AssessmentAnalytics />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/teacher/students"
                      element={
                        <Guarded roles={["teacher", "super_admin"]}>
                          <TeacherStudents />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/teacher/games"
                      element={
                        <Guarded roles={["teacher", "super_admin"]}>
                          <ClassGames />
                        </Guarded>
                      }
                    />

                    <Route
                      path="/admin/users"
                      element={
                        <Guarded roles={["super_admin"]}>
                          <AdminUsers />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/admin/academics"
                      element={
                        <Guarded roles={["super_admin"]}>
                          <AdminAcademics />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/admin/oversight"
                      element={
                        <Guarded roles={["super_admin"]}>
                          <AdminOversight />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/admin/reports"
                      element={
                        <Guarded roles={["super_admin"]}>
                          <AdminReports />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/admin/analytics"
                      element={
                        <Guarded roles={["super_admin"]}>
                          <AdminAnalytics />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/admin/audit"
                      element={
                        <Guarded roles={["super_admin"]}>
                          <AdminAudit />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/admin/settings"
                      element={
                        <Guarded roles={["super_admin"]}>
                          <AdminSettings />
                        </Guarded>
                      }
                    />

                    <Route
                      path="/notifications"
                      element={
                        <Guarded roles={["student", "teacher", "super_admin"]}>
                          <NotificationsPage />
                        </Guarded>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <Guarded roles={["student", "teacher", "super_admin"]}>
                          <ProfilePage />
                        </Guarded>
                      }
                    />
                  </Route>

                  {/* Focused exam-taking screen: no sidebar, no distractions. */}
                  <Route
                    path="/assessments/:assessmentId/take"
                    element={
                      <Guarded roles={["student"]}>
                        <TakeAssessment />
                      </Guarded>
                    }
                  />

                  <Route path="/403" element={<Forbidden />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
            <Toaster />
          </ConvexAuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
