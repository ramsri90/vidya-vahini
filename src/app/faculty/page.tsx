import { requireRole } from "@/lib/auth/session";
import { FacultyNav } from "@/components/faculty/FacultyNav";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FacultyDashboardPage() {
  const user = await requireRole("faculty");

  // Query only components where components.faculty_id = current user
  const components = await prisma.component.findMany({
    where: { facultyId: user.id },
    include: {
      classSubject: {
        include: {
          section: true,
          subject: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch active student count for each section
  const sectionIds = Array.from(new Set(components.map((c) => c.classSubject.sectionId)));
  const studentCounts = await prisma.student.groupBy({
    by: ["sectionId"],
    where: {
      sectionId: { in: sectionIds },
      user: { isActive: true },
    },
    _count: { id: true },
  });

  const studentCountMap = new Map<string, number>();
  studentCounts.forEach((sc) => {
    studentCountMap.set(sc.sectionId, sc._count.id);
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-10">
      <div className="mx-auto max-w-6xl">
        <FacultyNav userName={user.name} />

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">My Assigned Components</h2>
            <p className="text-sm text-gray-600">
              Select a component to upload study materials, past question papers, or post announcements.
            </p>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
            {components.length} Component(s)
          </span>
        </div>

        {components.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">No Teaching Assignments Yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              You are currently not assigned to any course components. Contact the administrator if this is unexpected.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {components.map((c) => {
              const studentCount = studentCountMap.get(c.classSubject.sectionId) ?? 0;
              return (
                <div
                  key={c.id}
                  className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-500 hover:shadow"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-600">
                        {c.classSubject.subject.code}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                          c.type === "theory"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-teal-100 text-teal-800"
                        }`}
                      >
                        {c.type}
                      </span>
                    </div>

                    <h3 className="mt-2 text-base font-bold text-gray-900">
                      {c.classSubject.subject.name}
                    </h3>

                    <div className="mt-4 space-y-1.5 text-xs text-gray-600">
                      <p>
                        <strong>Section:</strong> {c.classSubject.section.name} (Year{" "}
                        {c.classSubject.section.year}, Sem {c.classSubject.section.semester})
                      </p>
                      <p>
                        <strong>Enrolled Students:</strong>{" "}
                        <span className="font-semibold text-gray-900">{studentCount}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-gray-100 pt-4">
                    <Link
                      href={`/faculty/components/${c.id}`}
                      className="block w-full rounded-md bg-blue-600 py-2 text-center text-xs font-semibold text-white shadow hover:bg-blue-700"
                    >
                      Manage Resources &amp; Announcements &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
