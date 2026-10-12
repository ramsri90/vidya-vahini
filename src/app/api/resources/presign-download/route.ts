import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createDownloadUrl } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const presignDownloadSchema = z.object({
  resourceId: z.string().uuid("Invalid resource ID"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "student") {
    return NextResponse.json({ error: "Forbidden: Student role required" }, { status: 403 });
  }
  const user = session.user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = presignDownloadSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { resourceId } = validation.data;

  // Retrieve student record to determine enrolled section
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
  });

  if (!student) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  // Retrieve resource with classSubject linkage
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      component: {
        include: {
          classSubject: true,
        },
      },
    },
  });

  // Verify resource exists, is ready, is not archived
  if (!resource || resource.status !== "ready" || resource.archived) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  // Verify resource belongs to student's enrolled section
  if (resource.component.classSubject.sectionId !== student.sectionId) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  // Generate presigned GET download URL valid for 600 seconds (10 minutes)
  const downloadUrl = await createDownloadUrl(resource.r2Key, 600);

  // Audit log with sanitized metadata (never log downloadUrl or signatures)
  await writeAudit({
    actorId: user.id,
    action: "resource.download_requested",
    targetType: "resource",
    targetId: resource.id,
    metadata: {
      category: resource.category,
      title: resource.title,
    },
  });

  // Return ONLY downloadUrl - never return storage_key to browser
  return NextResponse.json({
    downloadUrl,
  });
}
