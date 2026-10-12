import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { createUploadUrl, isStorageConfigured } from "@/lib/storage";
import { sanitizeFilename } from "@/lib/validations";
import crypto from "crypto";

const ALLOWED_MIMES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden: Super Admin role required" }, { status: 403 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Cloud storage is not configured. Please set storage credentials in environment variables." },
      { status: 500 }
    );
  }

  try {
    const { filename, mimeType, sizeBytes } = await req.json();

    if (!filename || !mimeType) {
      return NextResponse.json({ error: "Filename and MIME type are required." }, { status: 400 });
    }

    if (!ALLOWED_MIMES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Invalid attachment type. Only PDF (.pdf) and images (.png, .jpg, .webp) are supported." },
        { status: 400 }
      );
    }

    // 20 MB max for timetable attachment
    if (sizeBytes && sizeBytes > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Attachment size must be under 20 MB." }, { status: 400 });
    }

    const uuid = crypto.randomUUID();
    const sanitized = sanitizeFilename(filename);
    const storageKey = `timetables/${uuid}/${sanitized}`;

    const uploadUrl = await createUploadUrl(storageKey, mimeType, 300);

    return NextResponse.json({
      uploadUrl,
      storageKey,
      filename: sanitized,
    });
  } catch (error) {
    console.error("Failed to generate presigned upload for timetable attachment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
