import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { FacultyNav } from "@/components/faculty/FacultyNav";
import { FacultyTimetable } from "@/components/faculty/FacultyTimetable";

export const dynamic = "force-dynamic";

export default async function FacultyTimetablePage() {
  const user = await requireRole("faculty");

  // Find sections where this faculty teaches
  const components = await prisma.component.findMany({
    where: { facultyId: user.id },
    include: {
      classSubject: {
        include: {
          section: true,
        },
      },
    },
  });

  const sectionIds = Array.from(new Set(components.map((c) => c.classSubject.sectionId)));

  // Fetch published timetables for these sections
  const timetables = await prisma.timetable.findMany({
    where: {
      sectionId: { in: sectionIds },
      status: "published",
    },
    include: {
      section: true,
      slots: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const facultyName = user.name || "Faculty Member";

  const sectionTimetables = timetables.map((tt) => {
    // Filter slots for this faculty (or if slot matches faculty name, or all slots in the section)
    const facultySlots = tt.slots.filter((s) => {
      if (!s.facultyName) return true;
      const slotFac = s.facultyName.toLowerCase();
      const userFac = facultyName.toLowerCase();
      return slotFac.includes(userFac) || userFac.includes(slotFac);
    });

    const slotsToUse = facultySlots.length > 0 ? facultySlots : tt.slots;

    return {
      timetableId: tt.id,
      sectionName: tt.section.name,
      year: tt.section.year,
      semester: tt.section.semester,
      academicYear: tt.academicYear,
      attachmentKey: tt.attachmentKey,
      attachmentName: tt.attachmentName,
      slots: slotsToUse.map((s) => ({
        id: s.id,
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        facultyName: s.facultyName,
        roomNumber: s.roomNumber,
        sessionType: s.sessionType,
        sectionName: s.sectionName || tt.section.name,
        sortOrder: s.sortOrder,
        timetableId: tt.id,
        academicYear: tt.academicYear,
      })),
    };
  });

  return (
    <div className="min-h-screen bg-[#FBF7EF] p-6 sm:p-10">
      <div className="mx-auto max-w-[1200px]">
        <FacultyNav userName={user.name} />

        <FacultyTimetable facultyName={facultyName} sectionTimetables={sectionTimetables} />
      </div>
    </div>
  );
}
