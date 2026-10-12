import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";
import { ClassSubjectManager } from "@/components/admin/ClassSubjectManager";

export const dynamic = "force-dynamic";

export default async function AdminClassSubjectsPage() {
  await requireRole("super_admin");

  const [sections, subjects, facultyList, classSubjects] = await Promise.all([
    prisma.section.findMany({
      orderBy: [{ year: "asc" }, { semester: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        year: true,
        semester: true,
        isArchived: true,
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
      orderBy: [{ section: { name: "asc" } }, { subject: { code: "asc" } }],
      include: {
        section: {
          select: {
            id: true,
            name: true,
            year: true,
            semester: true,
          },
        },
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        components: {
          include: {
            _count: {
              select: {
                resources: true,
              },
            },
            faculty: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-[#FBF7EF] lg:ml-[248px] pt-20 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-[1200px] mx-auto">
        <AdminNav
          title="Section Subjects"
          description="Link subjects to student cohort sections and assign theory and lab faculty slots."
        />
        <ClassSubjectManager
          sections={sections}
          subjects={subjects}
          facultyList={facultyList}
          classSubjects={classSubjects}
        />
      </div>
    </div>
  );
}
