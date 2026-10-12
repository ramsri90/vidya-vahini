import { NextRequest, NextResponse } from "next/server";
import { downloadCredentialCsv } from "@/lib/onboarding/actions";
import { requireRole } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    await requireRole("super_admin");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token parameter." }, { status: 400 });
  }

  const result = await downloadCredentialCsv(token);
  if (!result.success || !result.data) {
    return NextResponse.json(
      { error: result.error || "Credential CSV not available or already downloaded." },
      { status: 410 }
    );
  }

  return new NextResponse(result.data.csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="student_credentials_${Date.now()}.csv"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
