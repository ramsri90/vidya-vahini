import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { StudentNav } from "@/components/student/StudentNav";
import {
  SubjectDetailViewer,
  FacultyCardInfo,
  AnnouncementItem,
  ResourceItem,
} from "@/components/student/SubjectDetailViewer";

interface SubjectDetailPageProps {
  params: Promise<{
    classSubjectId: string;
  }>;
}

export default async function StudentSubjectDetailPage({ params }: SubjectDetailPageProps) {
  const user = await requireRole("student");
  const { classSubjectId } = await params;

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

  // Fetch class_subject
  const classSubject = await prisma.classSubject.findUnique({
    where: { id: classSubjectId },
    include: {
      subject: true,
      section: true,
      components: {
        include: {
          faculty: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              showContactToStudents: true,
            },
          },
          announcements: {
            orderBy: { createdAt: "desc" },
            include: {
              poster: {
                select: { name: true },
              },
            },
          },
          resources: {
            where: {
              status: "ready",
              archived: false,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  // Access control rule: Student can open a class_subject ONLY if it belongs to their section.
  // Otherwise 404.
  if (!classSubject || classSubject.sectionId !== student.sectionId) {
    notFound();
  }

  // 1. Process Faculty Cards (Deduplicate if same faculty teaches both Theory and Lab)
  const facultyMap = new Map<string, FacultyCardInfo>();
  for (const comp of classSubject.components) {
    const f = comp.faculty;
    const tag: "Theory" | "Lab" = comp.type === "theory" ? "Theory" : "Lab";
    if (facultyMap.has(f.id)) {
      const existing = facultyMap.get(f.id)!;
      if (!existing.tags.includes(tag)) {
        existing.tags.push(tag);
      }
    } else {
      facultyMap.set(f.id, {
        id: f.id,
        name: f.name,
        email: f.email,
        phone: f.phone,
        showContactToStudents: f.showContactToStudents,
        tags: [tag],
      });
    }
  }
  const facultyCards = Array.from(facultyMap.values());

  // 2. Process Announcements (newest first from both components)
  const allAnnouncements: AnnouncementItem[] = [];
  for (const comp of classSubject.components) {
    for (const ann of comp.announcements) {
      allAnnouncements.push({
        id: ann.id,
        message: ann.message,
        createdAt: ann.createdAt.toISOString(),
        componentType: comp.type as "theory" | "lab",
        facultyName: ann.poster.name,
      });
    }
  }
  allAnnouncements.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // 3. Process Resources
  const allResources: ResourceItem[] = [];
  for (const comp of classSubject.components) {
    for (const res of comp.resources) {
      allResources.push({
        id: res.id,
        category: res.category as ResourceItem["category"],
        title: res.title,
        message: res.message,
        fileSizeBytes: res.fileSizeBytes ? Number(res.fileSizeBytes) : null,
        mimeType: res.mimeType,
        createdAt: res.createdAt.toISOString(),
        componentType: comp.type as "theory" | "lab",
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#FBF7EF] flex flex-col">
      <StudentNav studentName={student.user.name} rollNo={student.rollNo} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-8">
        <SubjectDetailViewer
          subjectName={classSubject.subject.name}
          subjectCode={classSubject.subject.code}
          facultyCards={facultyCards}
          announcements={allAnnouncements}
          resources={allResources}
        />
      </main>
    </div>
  );
}
