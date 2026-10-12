import { requireRole } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";
import { prisma } from "@/lib/prisma";
import { TimetableManager } from "@/components/admin/TimetableManager";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminTimetablePage() {
  await requireRole("super_admin");

  const [sections, timetables] = await Promise.all([
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
    prisma.timetable.findMany({
      include: {
        section: {
          select: {
            id: true,
            name: true,
            year: true,
            semester: true,
          },
        },
        slots: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-[#FBF7EF] lg:ml-[248px] pt-20 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-[1200px] mx-auto">
        <AdminNav
          title="Class Timetable"
          description="Create, upload, preview, validate, and publish official section timetables from structured Excel files."
          action={
            <a
              href="/api/timetable/template"
              download="vidya_vahini_timetable_template.xlsx"
              className="btn-secondary text-xs h-10 px-4 inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-[#0F766E]" />
              <span>Download Excel Template</span>
            </a>
          }
        />

        <TimetableManager sections={sections} timetables={timetables} />
      </div>
    </div>
  );
}
