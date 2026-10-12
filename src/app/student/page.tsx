import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { StudentNav } from "@/components/student/StudentNav";
import { redirect } from "next/navigation";
import { BookOpen, FileText, Megaphone, Users, ChevronRight, GraduationCap } from "lucide-react";

export default async function StudentDashboardPage() {
  const user = await requireRole("student");

  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    include: {
      section: true,
      user: true,
    },
  });

  if (!student) {
    redirect("/login");
  }

  // Fetch all active class_subjects belonging to student's section
  const classSubjects = await prisma.classSubject.findMany({
    where: {
      sectionId: student.sectionId,
      isActive: true,
    },
    include: {
      subject: true,
      components: {
        include: {
          faculty: {
            select: { id: true, name: true, email: true },
          },
          resources: {
            where: { status: "ready", archived: false },
            select: { id: true },
          },
          announcements: {
            select: { id: true },
          },
        },
      },
    },
    orderBy: [
      { subject: { year: "asc" } },
      { subject: { semester: "asc" } },
      { subject: { code: "asc" } },
    ],
  });

  // Calculate totals
  const totalSubjects = classSubjects.length;
  let totalNotes = 0;
  let totalAnnouncements = 0;
  const facultySet = new Set<string>();

  for (const cs of classSubjects) {
    for (const comp of cs.components) {
      totalNotes += comp.resources.length;
      totalAnnouncements += comp.announcements.length;
      if (comp.faculty?.id) facultySet.add(comp.faculty.id);
    }
  }

  // Group class_subjects by year and semester
  const groups: Record<string, typeof classSubjects> = {};
  for (const cs of classSubjects) {
    const key = `Year ${cs.subject.year} - Semester ${cs.subject.semester}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(cs);
  }

  return (
    <div className="min-h-screen bg-[#FBF7EF] flex flex-col">
      <StudentNav studentName={student.user.name} rollNo={student.rollNo} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-8">
        {/* Welcome Banner */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0F766E]">
            <GraduationCap className="w-4 h-4" />
            <span>Student Portal</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1F2937] mt-1">
            Good Morning, {student.user.name.split(" ")[0]}!
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Section: <span className="font-semibold text-[#1F2937]">{student.section.name}</span> (Year {student.section.year}, Sem {student.section.semester}) &bull; Enrolled Courses &amp; Class Notes
          </p>
        </div>

        {/* Overview Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="card-study p-5">
            <div className="w-10 h-10 rounded-[10px] bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center mb-3">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="font-heading text-2xl font-bold text-[#1F2937]">{totalSubjects}</div>
            <div className="text-xs text-[#6B7280] font-medium mt-0.5">Enrolled Subjects</div>
          </div>

          <div className="card-study p-5">
            <div className="w-10 h-10 rounded-[10px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <div className="font-heading text-2xl font-bold text-[#1F2937]">{totalNotes}</div>
            <div className="text-xs text-[#6B7280] font-medium mt-0.5">PDF Notes &amp; Files</div>
          </div>

          <div className="card-study p-5">
            <div className="w-10 h-10 rounded-[10px] bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mb-3">
              <Megaphone className="w-5 h-5" />
            </div>
            <div className="font-heading text-2xl font-bold text-[#1F2937]">{totalAnnouncements}</div>
            <div className="text-xs text-[#6B7280] font-medium mt-0.5">Announcements</div>
          </div>

          <div className="card-study p-5">
            <div className="w-10 h-10 rounded-[10px] bg-[#DCFCE7] text-[#15803D] flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <div className="font-heading text-2xl font-bold text-[#1F2937]">{facultySet.size}</div>
            <div className="text-xs text-[#6B7280] font-medium mt-0.5">Assigned Faculty</div>
          </div>
        </div>

        {/* Subjects List */}
        {Object.keys(groups).length === 0 ? (
          <div className="card-study p-12 text-center">
            <div className="mx-auto w-12 h-12 bg-[#CCFBF1] text-[#0F766E] rounded-full flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-[#1F2937]">No active subjects enrolled</h3>
            <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
              There are currently no active course subjects assigned to your section. Please contact your department administration.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(groups).map(([groupTitle, list]) => (
              <section key={groupTitle}>
                <div className="flex items-center space-x-3 mb-5">
                  <h2 className="font-heading text-lg font-bold text-[#1F2937]">{groupTitle}</h2>
                  <span className="text-xs bg-[#E7E0D2]/50 text-[#1F2937] font-semibold px-2.5 py-0.5 rounded-full">
                    {list.length} {list.length === 1 ? "Subject" : "Subjects"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {list.map((cs) => {
                    const theoryComp = cs.components.find((c) => c.type === "theory");
                    const labComp = cs.components.find((c) => c.type === "lab");
                    const noteCount = cs.components.reduce((acc, curr) => acc + curr.resources.length, 0);

                    return (
                      <Link
                        key={cs.id}
                        href={`/student/subjects/${cs.id}`}
                        prefetch={true}
                        className="card-study p-6 hover:shadow-md hover:border-[#0F766E] transition-all duration-150 flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-[#CCFBF1] text-[#0F766E] border border-[#0F766E]/20">
                              {cs.subject.code}
                            </span>
                            <span className="text-xs text-[#6B7280] group-hover:text-[#0F766E] transition-colors flex items-center gap-1 font-semibold">
                              <span>View Notes</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                          <h3 className="font-heading text-base font-bold text-[#1F2937] group-hover:text-[#0F766E] transition-colors line-clamp-2">
                            {cs.subject.name}
                          </h3>
                        </div>

                        <div className="mt-6 pt-4 border-t border-[#E7E0D2] text-xs space-y-2.5 text-[#6B7280]">
                          {theoryComp && (
                            <div className="flex items-center justify-between">
                              <span className="badge-theory">Theory</span>
                              <span className="text-[#1F2937] font-semibold truncate max-w-[170px]">
                                {theoryComp.faculty.name}
                              </span>
                            </div>
                          )}
                          {labComp && (
                            <div className="flex items-center justify-between">
                              <span className="badge-lab">Lab</span>
                              <span className="text-[#1F2937] font-semibold truncate max-w-[170px]">
                                {labComp.faculty.name}
                              </span>
                            </div>
                          )}
                          {!theoryComp && !labComp && (
                            <div className="text-amber-700 italic">Faculty assignment pending</div>
                          )}

                          <div className="pt-2 flex items-center justify-between text-[11px] text-[#6B7280]">
                            <span>{noteCount} PDF files ready</span>
                            <span className="text-[#0F766E] font-semibold">Open &rarr;</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
