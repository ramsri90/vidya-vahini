"use server";

import { signIn, signOut, auth } from "@/auth";
import { AuthError } from "next-auth";
import { loginSchema, changePasswordSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { writeAudit } from "@/lib/audit";

import {
  checkRateLimit,
  recordRateLimitAttempt,
  resetRateLimit,
} from "@/lib/rate-limit";

export async function loginAction(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const rawData = {
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  };

  const validation = loginSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: "Invalid credentials" };
  }

  const { identifier, password } = validation.data;

  try {
    await signIn("credentials", {
      identifier,
      password,
      redirectTo: "/",
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid credentials" };
    }
    // Re-throw redirect errors so Next.js handles navigation
    throw error;
  }
}

export async function changePasswordAction(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to change your password" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return { error: "User record not found" };
  }

  // Rate limit check on password change
  const rateLimit = checkRateLimit(user.email);
  if (!rateLimit.allowed) {
    return {
      error: "Too many attempts. Please try again after 15 minutes.",
    };
  }

  const rawData = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const validation = changePasswordSchema.safeParse(rawData);
  if (!validation.success) {
    const errorMsg =
      validation.error.issues[0]?.message ||
      "Invalid password details. Must be at least 8 characters.";
    return { error: errorMsg };
  }

  const { currentPassword, newPassword } = validation.data;

  const isCurrentPasswordCorrect = await bcrypt.compare(
    currentPassword,
    user.passwordHash
  );

  if (!isCurrentPasswordCorrect) {
    recordRateLimitAttempt(user.email);
    await writeAudit({
      actorId: user.id,
      action: "password.change_failed",
      targetType: "user",
      targetId: user.id,
      metadata: { reason: "wrong_current_password" },
    });
    return { error: "Current password is incorrect" };
  }

  resetRateLimit(user.email);

  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password, clear force-change flag, and increment session version
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      mustChangePassword: false,
      sessionVersion: {
        increment: 1,
      },
    },
  });

  // Log successful password change
  await writeAudit({
    actorId: user.id,
    action: "password.changed",
    targetType: "user",
    targetId: user.id,
  });

  // Sign out user so they log in with their newly set password
  await signOut({ redirectTo: "/login?passwordChanged=true" });
  return { success: true };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
