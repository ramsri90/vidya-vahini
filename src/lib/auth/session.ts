import { auth } from "@/auth";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cache } from "react";

export function getHomeRouteForRole(role: Role): string {
  switch (role) {
    case "super_admin":
      return "/admin";
    case "faculty":
      return "/faculty";
    case "student":
      return "/student";
    default:
      return "/login";
  }
}

export const getCurrentUser = cache(async () => {
  const session = await auth();
  return session?.user ?? null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireUserWithMustChangeCheck() {
  const user = await requireUser();
  if (user.mustChangePassword) {
    redirect("/change-password");
  }
  return user;
}

export async function requireRole(allowedRole: Role | Role[]) {
  const user = await requireUserWithMustChangeCheck();
  const roles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];
  if (!roles.includes(user.role)) {
    redirect(getHomeRouteForRole(user.role));
  }
  return user;
}

/**
 * Server-side ownership / assignment check helper stubs.
 * These will be fully connected to database queries in Step 5 (Faculty upload) and Step 6 (Student download).
 */
export async function verifyComponentFacultyOwnership(
  facultyId: string,
  componentId: string
): Promise<boolean> {
  const component = await prisma.component.findUnique({
    where: { id: componentId },
    select: { facultyId: true },
  });
  return component?.facultyId === facultyId;
}

export async function verifyStudentSectionOwnership(
  _studentSectionId: string,
  _classSubjectId: string
): Promise<boolean> {
  // Stub to be completed in Step 6
  void _studentSectionId;
  void _classSubjectId;
  return false;
}
