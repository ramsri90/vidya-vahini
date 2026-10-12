import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";
import { SectionManager } from "@/components/admin/SectionManager";

export const dynamic = "force-dynamic";

export default async function AdminSectionsPage() {
  await requireRole("super_admin");

  const sections = await prisma.section.findMany({
    orderBy: [{ year: "asc" }, { semester: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          students: true,
          classSubjects: true,
        },
      },
      classSubjects: {
        include: {
          subject: {
            select: {
              code: true,
              name: true,
            },
          },
          components: {
            include: {
              faculty: {
                select: {
                  name: true,
                },
              },
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
          title="Sections"
          description="Create and manage student cohort sections across academic years and semesters."
        />
        <SectionManager initialSections={sections} />
      </div>
    </div>
  );
}
