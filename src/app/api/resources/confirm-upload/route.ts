import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { confirmUploadSchema } from "@/lib/validations";
import { headObject, deleteObject, getObjectHeaderBytes } from "@/lib/storage";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "faculty") {
    return NextResponse.json({ error: "Forbidden: Faculty role required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = confirmUploadSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Validation failed" },
      { status: 400 }
    );
  }

  const { resourceId } = validation.data;

  // 1. Fetch resource and verify ownership
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { component: true },
  });

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const isOwner =
    resource.uploadedBy === session.user.id ||
    resource.component.facultyId === session.user.id;

  if (!isOwner) {
    return NextResponse.json(
      { error: "Forbidden: You are not assigned to this component" },
      { status: 403 }
    );
  }

  // 2. HeadObject check in storage
  const head = await headObject(resource.r2Key);
  if (!head) {
    await prisma.resource.update({
      where: { id: resourceId },
      data: { status: "failed" },
    });
    return NextResponse.json(
      { error: "Uploaded object not found in storage. Upload failed." },
      { status: 400 }
    );
  }

  // 3. Compare size in storage vs declared size_bytes
  const expectedSize = Number(resource.fileSizeBytes ?? 0);
  if (head.contentLength !== expectedSize) {
    await deleteObject(resource.r2Key);
    await prisma.resource.update({
      where: { id: resourceId },
      data: { status: "failed" },
    });
    return NextResponse.json(
      {
        error: `File size mismatch. Expected ${expectedSize} bytes, storage received ${head.contentLength} bytes.`,
      },
      { status: 400 }
    );
  }

  // 4. Inspect magic bytes for executable payloads disguised as allowed types (.exe -> .pdf)
  const headerBytes = await getObjectHeaderBytes(resource.r2Key, 16);
  if (headerBytes && headerBytes.length >= 2) {
    // DOS / Windows PE Executable magic header: "MZ" (0x4D, 0x5A)
    const isExe = headerBytes[0] === 0x4d && headerBytes[1] === 0x5a;
    // Linux ELF Executable magic header: 0x7F, 'E', 'L', 'F' (0x7F, 0x45, 0x4C, 0x46)
    const isElf =
      headerBytes[0] === 0x7f &&
      headerBytes[1] === 0x45 &&
      headerBytes[2] === 0x4c &&
      headerBytes[3] === 0x46;

    if (isExe || isElf) {
      await deleteObject(resource.r2Key);
      await prisma.resource.update({
        where: { id: resourceId },
        data: { status: "failed" },
      });
      return NextResponse.json(
        { error: "Security violation: Executable binary detected. Upload rejected." },
        { status: 400 }
      );
    }
  }

  // 5. Transition status to ready
  const updated = await prisma.resource.update({
    where: { id: resourceId },
    data: { status: "ready" },
  });

  // 6. Audit log
  await writeAudit({
    actorId: session.user.id,
    action: "resource.upload_confirmed",
    targetType: "resource",
    targetId: updated.id,
    metadata: {
      componentId: updated.componentId,
      category: updated.category,
      title: updated.title,
      sizeBytes: Number(updated.fileSizeBytes ?? 0),
    },
  });

  return NextResponse.json({
    success: true,
    resourceId: updated.id,
  });
}
