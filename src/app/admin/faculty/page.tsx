import { requireRole } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { FacultyManager } from "@/components/admin/FacultyManager";

export const dynamic = "force-dynamic";

export default async function AdminFacultyPage() {
  await requireRole("super_admin");

  const faculty = await prisma.user.findMany({
    where: { role: Role.faculty },
    include: {
      _count: {
        select: {
          resourcesUploaded: true,
          announcements: true,
        },
      },
      componentsTaught: {
        include: {
          classSubject: {
            include: {
              section: { select: { name: true } },
              subject: { select: { code: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-[#FBF7EF] lg:ml-[248px] pt-20 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-[1200px] mx-auto">
        <AdminNav
          title="Faculty"
          description="Onboard teaching faculty, reassign duties, and configure student contact visibility."
        />
        <FacultyManager initialFaculty={faculty} />
      </div>
    </div>
  );
}
