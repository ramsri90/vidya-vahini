import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { StudentNav } from "@/components/student/StudentNav";
import { StudentTimetable } from "@/components/student/StudentTimetable";

export const dynamic = "force-dynamic";

export default async function StudentTimetablePage() {
  const user = await requireRole("student");

  const [student, timetable] = await Promise.all([
    prisma.student.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        rollNo: true,
        sectionId: true,
        section: {
          select: { name: true, year: true, semester: true },
        },
        user: {
          select: { name: true },
        },
      },
    }),
    user.sectionId
      ? prisma.timetable.findFirst({
          where: {
            sectionId: user.sectionId,
            status: "published",
          },
          include: {
            slots: {
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { version: "desc" },
        })
      : Promise.resolve(null),
  ]);

  if (!student) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#FBF7EF] flex flex-col">
      <StudentNav studentName={student.user.name} rollNo={student.rollNo} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-8">
        <StudentTimetable
          sectionName={student.section.name}
          year={student.section.year}
          semester={student.section.semester}
          timetable={
            timetable
              ? {
                  id: timetable.id,
                  academicYear: timetable.academicYear,
                  department: timetable.department,
                  version: timetable.version,
                  effectiveFrom: timetable.effectiveFrom,
                  effectiveTill: timetable.effectiveTill,
                  attachmentKey: timetable.attachmentKey,
                  attachmentName: timetable.attachmentName,
                  slots: timetable.slots,
                }
              : null
          }
        />
      </main>
    </div>
  );
}
