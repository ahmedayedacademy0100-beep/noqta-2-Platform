import { LoadingBlock } from "@/components/app/ui";
import { useProfile } from "@/hooks/use-profile";
import { lazy, Suspense } from "react";

const StudentDashboard = lazy(() => import("./student/StudentDashboard.tsx"));
const TeacherDashboard = lazy(() => import("./teacher/TeacherDashboard.tsx"));
const AdminOverview = lazy(() => import("./admin/AdminOverview.tsx"));

/** One entry point that opens the portal matching the signed-in role. */
export default function Dashboard() {
  const { profile } = useProfile();
  if (!profile) return <LoadingBlock />;

  return (
    <Suspense fallback={<LoadingBlock />}>
      {profile.role === "student" ? <StudentDashboard /> : null}
      {profile.role === "teacher" ? <TeacherDashboard /> : null}
      {profile.role === "super_admin" ? <AdminOverview /> : null}
    </Suspense>
  );
}
