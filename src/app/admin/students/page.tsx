import { requireRole } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";
import { prisma } from "@/lib/prisma";
import { StudentManager } from "@/components/admin/StudentManager";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ sectionId?: string }>;
}

export default async function AdminStudentsPage({ searchParams }: PageProps) {
  await requireRole("super_admin");
  const params = await searchParams;

  const sections = await prisma.section.findMany({
    orderBy: [{ year: "asc" }, { semester: "asc" }, { name: "asc" }],
  });

  const students = await prisma.student.findMany({
    include: {
      section: { select: { name: true, year: true, semester: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
        },
      },
    },
    orderBy: [{ rollNo: "asc" }],
  });

  return (
    <div className="min-h-screen bg-[#FBF7EF] lg:ml-[248px] pt-20 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-[1200px] mx-auto">
        <AdminNav
          title="Students"
          description="Enroll students by section, bulk import via Excel, transfer cohorts, and manage credentials."
        />
        <StudentManager
          sections={sections}
          initialStudents={students}
          selectedSectionId={params.sectionId}
        />
      </div>
    </div>
  );
}
