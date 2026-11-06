import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";

export type ProfileRole = "student" | "teacher" | "super_admin";

export type AppProfile = {
  userId: string;
  name: string;
  email: string;
  role: ProfileRole;
  status: "active" | "suspended";
  language: "en" | "ar";
  theme: "light" | "dark" | "system";
  isDemo: boolean;
  points: number;
  streak: number;
};

/**
 * Role source of truth for the UI. The backend still re-checks every rule, so
 * this only decides what to render — never what a user is allowed to do.
 */
export function useProfile() {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const account = useQuery(api.profiles.myAccount);

  const profile = (account && "profile" in account && account.profile
    ? account.profile
    : null) as AppProfile | null;

  return {
    isLoading: authLoading || account === undefined,
    isAuthenticated,
    signedIn: account?.signedIn ?? false,
    hasProfile: Boolean(profile),
    profile,
    role: profile?.role ?? null,
    isStudent: profile?.role === "student",
    isTeacher: profile?.role === "teacher",
    isAdmin: profile?.role === "super_admin",
  };
}
