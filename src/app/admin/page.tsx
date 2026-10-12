import { requireRole } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";
import { prisma } from "@/lib/prisma";
import { AdminOverviewManager, SummaryRow } from "@/components/admin/AdminOverviewManager";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole("super_admin");

  const [sections, subjects, facultyList, classSubjects] = await Promise.all([
    prisma.section.findMany({
      where: { isArchived: false },
      orderBy: [{ year: "asc" }, { semester: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        year: true,
        semester: true,
      },
    }),
    prisma.subject.findMany({
      orderBy: [{ semester: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        year: true,
        semester: true,
      },
    }),
    prisma.user.findMany({
      where: {
        role: "faculty",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.classSubject.findMany({
      where: { isActive: true },
      include: {
        section: {
          include: {
            _count: {
              select: { students: true },
            },
          },
        },
        subject: true,
        components: {
          include: {
            faculty: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [
        { section: { name: "asc" } },
        { subject: { code: "asc" } },
      ],
    }),
  ]);

  const summaryRows: SummaryRow[] = classSubjects.map((cs) => {
    const theory = cs.components.find((c) => c.type === "theory");
    const lab = cs.components.find((c) => c.type === "lab");

    return {
      id: cs.id,
      sectionName: cs.section.name,
      sectionYear: cs.section.year,
      sectionSemester: cs.section.semester,
      subjectCode: cs.subject.code,
      subjectName: cs.subject.name,
      theoryFacultyName: theory?.faculty.name ?? null,
      theoryFacultyEmail: theory?.faculty.email ?? null,
      labFacultyName: lab?.faculty.name ?? null,
      labFacultyEmail: lab?.faculty.email ?? null,
      studentCount: cs.section._count.students,
    };
  });

  return (
    <div className="min-h-screen bg-[#FBF7EF] lg:ml-[248px] pt-20 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-[1200px] mx-auto">
        <AdminNav
          title="Overview"
          description="View overall academic assignments and quickly manage faculty course allocations."
        />

        <AdminOverviewManager
          sections={sections}
          subjects={subjects}
          facultyList={facultyList}
          summaryRows={summaryRows}
        />
      </div>
    </div>
  );
}
