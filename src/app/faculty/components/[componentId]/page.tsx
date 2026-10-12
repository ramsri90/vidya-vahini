import { requireRole } from "@/lib/auth/session";
import { FacultyNav } from "@/components/faculty/FacultyNav";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { ComponentResourceManager } from "@/components/faculty/ComponentResourceManager";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ componentId: string }>;
}

export default async function FacultyComponentPage({ params }: PageProps) {
  const user = await requireRole("faculty");
  const { componentId } = await params;

  const component = await prisma.component.findUnique({
    where: { id: componentId },
    include: {
      classSubject: {
        include: {
          section: true,
          subject: true,
        },
      },
    },
  });

  if (!component) {
    notFound();
  }

  // Security check: Must be assigned to this component
  if (component.facultyId !== user.id) {
    redirect("/faculty");
  }

  const [resources, announcements] = await Promise.all([
    prisma.resource.findMany({
      where: {
        componentId,
        archived: false,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.announcement.findMany({
      where: { componentId },
      include: {
        poster: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-[#FBF7EF] p-6 sm:p-10">
      <div className="mx-auto max-w-6xl">
        <FacultyNav userName={user.name} />

        <div className="mb-6">
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
            <span>{component.classSubject.section.name}</span>
            <span>&bull;</span>
            <span>Year {component.classSubject.section.year}, Sem {component.classSubject.section.semester}</span>
            <span>&bull;</span>
            <span className="rounded-[6px] bg-[#CCFBF1] px-2 py-0.5 text-[#0F766E] border border-[#99F6E4]">
              {component.type.toUpperCase()}
            </span>
          </div>

          <h1 className="mt-1.5 font-heading text-2xl font-bold text-[#1F2937]">
            {component.classSubject.subject.code} &mdash; {component.classSubject.subject.name}
          </h1>
        </div>

        <ComponentResourceManager
          componentId={component.id}
          componentType={component.type}
          initialResources={resources}
          initialAnnouncements={announcements}
        />
      </div>
    </div>
  );
}
