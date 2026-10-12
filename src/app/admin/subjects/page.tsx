import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";
import { SubjectManager } from "@/components/admin/SubjectManager";

export const dynamic = "force-dynamic";

export default async function AdminSubjectsPage() {
  await requireRole("super_admin");

  const subjects = await prisma.subject.findMany({
    orderBy: [{ year: "asc" }, { semester: "asc" }, { code: "asc" }],
    include: {
      classSubjects: {
        include: {
          section: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-[#FBF7EF] lg:ml-[248px] pt-20 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-[1200px] mx-auto">
        <AdminNav
          title="Subjects"
          description="Maintain the institutional curriculum catalog and course definitions."
        />
        <SubjectManager initialSubjects={subjects} />
      </div>
    </div>
  );
}
