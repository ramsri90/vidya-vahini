import { requireRole } from "@/lib/auth/session";
import { FacultyNav } from "@/components/faculty/FacultyNav";
import { prisma } from "@/lib/prisma";
import { FacultyProfileForm } from "@/components/faculty/FacultyProfileForm";

export const dynamic = "force-dynamic";

export default async function FacultyProfilePage() {
  const user = await requireRole("faculty");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  return (
    <div className="min-h-screen bg-[#FBF7EF] p-6 sm:p-10">
      <div className="mx-auto max-w-6xl">
        <FacultyNav userName={user.name} />

        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-[#1F2937]">Faculty Profile</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Manage your personal contact details and security settings.
          </p>
        </div>

        <FacultyProfileForm
          name={dbUser?.name ?? user.name ?? ""}
          initialEmail={dbUser?.email ?? user.email ?? ""}
          initialPhone={dbUser?.phone ?? null}
        />
      </div>
    </div>
  );
}
