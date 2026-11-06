// This file configures Convex Auth. The email OTP + anonymous providers were
// part of the original template and are preserved untouched; the Password
// provider is added so that (a) real users can sign in without waiting for an
// email code and (b) admins can create teacher/student accounts with a
// temporary password. See src/convex/setup.ts for account creation.

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { emailOtp } from "./auth/emailOtp";

const passwordProvider = Password({
  id: "password",
  profile(params) {
    const email = String(params.email ?? "")
      .trim()
      .toLowerCase();
    const rawName = typeof params.name === "string" ? params.name.trim() : "";
    return {
      email,
      ...(rawName.length > 1 && rawName.length <= 80 ? { name: rawName } : {}),
    };
  },
  validatePasswordRequirements(password: string) {
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }
    if (!/[A-Za-z0-9]/.test(password)) {
      throw new Error("Password must contain at least one letter or number.");
    }
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [emailOtp, Anonymous, passwordProvider],
});
