import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin/AdminNav";
import { RolloverManager, RolloverSectionItem } from "@/components/admin/RolloverManager";

export const dynamic = "force-dynamic";

export default async function AdminRolloverPage() {
  await requireRole("super_admin");

  const sections = await prisma.section.findMany({
    include: {
      _count: {
        select: {
          students: true,
          classSubjects: true,
        },
      },
    },
    orderBy: [{ year: "asc" }, { semester: "asc" }, { name: "asc" }],
  });

  const items: RolloverSectionItem[] = sections.map((sec) => ({
    id: sec.id,
    name: sec.name,
    year: sec.year,
    semester: sec.semester,
    isArchived: sec.isArchived,
    studentCount: sec._count.students,
    classSubjectCount: sec._count.classSubjects,
  }));

  return (
    <div className="min-h-screen bg-[#FBF7EF] lg:ml-[248px] pt-20 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-[1200px] mx-auto">
        <AdminNav
          title="Semester Rollover"
          description="Conclude academic semesters by transitioning sections into read-only archive mode while retaining student access to class notes."
        />

        <RolloverManager sections={items} />
      </div>
    </div>
  );
}
