import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  ResourceModerationManager,
  ModerationResourceItem,
} from "@/components/admin/ResourceModerationManager";

export const dynamic = "force-dynamic";

export default async function AdminResourcesPage() {
  await requireRole("super_admin");

  const resources = await prisma.resource.findMany({
    include: {
      uploader: {
        select: {
          name: true,
          email: true,
        },
      },
      component: {
        include: {
          classSubject: {
            include: {
              section: true,
              subject: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const items: ModerationResourceItem[] = resources.map((res) => ({
    id: res.id,
    title: res.title,
    category: res.category,
    status: res.status as "uploading" | "ready" | "failed",
    archived: res.archived,
    fileSizeBytes: res.fileSizeBytes ? Number(res.fileSizeBytes) : null,
    createdAt: res.createdAt.toISOString(),
    uploaderName: res.uploader.name,
    uploaderEmail: res.uploader.email,
    sectionName: res.component.classSubject.section.name,
    subjectCode: res.component.classSubject.subject.code,
    subjectName: res.component.classSubject.subject.name,
    componentType: res.component.type as "theory" | "lab",
  }));

  return (
    <div className="min-h-screen bg-[#FBF7EF] lg:ml-[248px] pt-20 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-[1200px] mx-auto">
        <AdminNav
          title="Resource Moderation"
          description="Review academic uploads across all sections and subjects. Moderate contents with audit-logged reasons or purge failed items."
        />

        <ResourceModerationManager resources={items} />
      </div>
    </div>
  );
}
