import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import {
  presignUploadSchema,
  ALLOWED_RESOURCE_MIMES,
  sanitizeFilename,
} from "@/lib/validations";
import { createUploadUrl } from "@/lib/storage";
import { NextResponse } from "next/server";
import crypto from "crypto";

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

  const validation = presignUploadSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Validation failed" },
      { status: 400 }
    );
  }

  const { componentId, category, title, message, filename, mimeType, sizeBytes } =
    validation.data;

  // 1. Ownership & Archived Section check
  const component = await prisma.component.findUnique({
    where: { id: componentId },
    include: {
      classSubject: {
        include: {
          section: true,
        },
      },
    },
  });

  if (!component || component.facultyId !== session.user.id) {
    return NextResponse.json(
      { error: "Forbidden: You are not assigned to this component" },
      { status: 403 }
    );
  }

  if (component.classSubject.section.isArchived) {
    return NextResponse.json(
      { error: "Forbidden: This section is archived and read-only" },
      { status: 403 }
    );
  }

  // 2. MIME type & extension match validation
  const allowedExtensions = ALLOWED_RESOURCE_MIMES[mimeType];
  if (!allowedExtensions) {
    return NextResponse.json(
      { error: `Unsupported MIME type "${mimeType}".` },
      { status: 400 }
    );
  }

  const fileExt = "." + filename.split(".").pop()?.toLowerCase();
  if (!allowedExtensions.includes(fileExt)) {
    return NextResponse.json(
      { error: `File extension "${fileExt}" does not match declared MIME type "${mimeType}".` },
      { status: 400 }
    );
  }

  // Reject executable extensions explicitly
  const forbiddenExtensions = [".exe", ".bat", ".cmd", ".sh", ".com", ".msi", ".vbs", ".ps1"];
  if (forbiddenExtensions.includes(fileExt)) {
    return NextResponse.json(
      { error: "Executable files are strictly prohibited." },
      { status: 400 }
    );
  }

  // 3. Prepare storage key and resource record
  const resourceId = crypto.randomUUID();
  const sanitized = sanitizeFilename(filename);
  const storageKey = `resources/${resourceId}/${sanitized}`;

  const resource = await prisma.resource.create({
    data: {
      id: resourceId,
      componentId,
      uploadedBy: session.user.id,
      category,
      title,
      message: message || null,
      r2Key: storageKey,
      fileSizeBytes: BigInt(sizeBytes),
      mimeType,
      status: "uploading",
      archived: false,
    },
  });

  // 4. Create presigned upload URL (300 seconds)
  const uploadUrl = await createUploadUrl(storageKey, mimeType, 300);

  // 5. Audit log (never log storageKey or presigned URL)
  await writeAudit({
    actorId: session.user.id,
    action: "resource.upload_started",
    targetType: "resource",
    targetId: resource.id,
    metadata: {
      componentId,
      category,
      title,
      sizeBytes,
    },
  });

  // Return ONLY resourceId and uploadUrl (never send storage_key to browser)
  return NextResponse.json({
    resourceId: resource.id,
    uploadUrl,
  });
}
